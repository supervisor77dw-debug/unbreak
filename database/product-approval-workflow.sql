-- ============================================================
-- UNBREAK ONE - Product Approval Workflow Migration
-- ============================================================
-- Purpose: Enable User → Admin → Live workflow for products
-- NO manual SQL work required by operator after this migration
-- ============================================================

-- ============================================================
-- 1️⃣ EXTEND PRODUCTS TABLE
-- ============================================================

-- Add workflow columns
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;

-- Add status constraint
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'products_status_check'
  ) THEN
    ALTER TABLE products
      ADD CONSTRAINT products_status_check 
      CHECK (status IN ('draft', 'pending_review', 'approved', 'rejected'));
  END IF;
END $$;

-- Add index for status queries
CREATE INDEX IF NOT EXISTS idx_products_status ON products(status);
CREATE INDEX IF NOT EXISTS idx_products_created_by ON products(created_by);

COMMENT ON COLUMN products.status IS 'Workflow status: draft, pending_review, approved, rejected';
COMMENT ON COLUMN products.created_by IS 'User who created this product';
COMMENT ON COLUMN products.approved_by IS 'Admin who approved/rejected this product';
COMMENT ON COLUMN products.approved_at IS 'Timestamp when product was approved/rejected';

-- ============================================================
-- 2️⃣ STORAGE BUCKET FOR PRODUCT IMAGES
-- ============================================================

-- Create bucket (if not exists)
INSERT INTO storage.buckets (id, name, public)
VALUES ('product-images', 'product-images', false)
ON CONFLICT (id) DO NOTHING;

-- Enable RLS on storage.objects
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Policy: Authenticated users can upload to their folder
DROP POLICY IF EXISTS "Users can upload product images" ON storage.objects;
CREATE POLICY "Users can upload product images"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'product-images' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

-- Policy: Users can update their own images
DROP POLICY IF EXISTS "Users can update own images" ON storage.objects;
CREATE POLICY "Users can update own images"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'product-images' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

-- Policy: Users can delete their own images
DROP POLICY IF EXISTS "Users can delete own images" ON storage.objects;
CREATE POLICY "Users can delete own images"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'product-images' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

-- Policy: Public can view images of approved products
DROP POLICY IF EXISTS "Public can view approved product images" ON storage.objects;
CREATE POLICY "Public can view approved product images"
  ON storage.objects FOR SELECT
  TO public
  USING (
    bucket_id = 'product-images' AND
    EXISTS (
      SELECT 1 FROM products
      WHERE 
        products.created_by::text = (storage.foldername(name))[1] AND
        products.status = 'approved'
    )
  );

-- Policy: Admins can manage all images
DROP POLICY IF EXISTS "Admins can manage all images" ON storage.objects;
CREATE POLICY "Admins can manage all images"
  ON storage.objects FOR ALL
  TO authenticated
  USING (
    bucket_id = 'product-images' AND
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- ============================================================
-- 3️⃣ RLS POLICIES FOR PRODUCTS
-- ============================================================

-- Drop all existing product policies
DROP POLICY IF EXISTS "Public can read active products" ON products;
DROP POLICY IF EXISTS "Admins can manage products" ON products;
DROP POLICY IF EXISTS "Service role has full access to products" ON products;

-- ============================================================
-- PUBLIC ACCESS
-- ============================================================

-- Public can only see approved products
CREATE POLICY "Public can read approved products"
  ON products FOR SELECT
  TO public
  USING (status = 'approved' AND active = true);

-- ============================================================
-- USER ACCESS (Regular authenticated users)
-- ============================================================

-- Users can view their own products (any status)
CREATE POLICY "Users can view own products"
  ON products FOR SELECT
  TO authenticated
  USING (created_by = auth.uid());

-- Users can create products (automatically draft)
CREATE POLICY "Users can create products"
  ON products FOR INSERT
  TO authenticated
  WITH CHECK (
    created_by = auth.uid() AND
    status IN ('draft', 'pending_review')
  );

-- Users can update their own products (only if not approved)
CREATE POLICY "Users can update own draft products"
  ON products FOR UPDATE
  TO authenticated
  USING (
    created_by = auth.uid() AND
    status != 'approved'
  )
  WITH CHECK (
    created_by = auth.uid() AND
    status IN ('draft', 'pending_review')
  );

-- Users can delete their own draft products
CREATE POLICY "Users can delete own draft products"
  ON products FOR DELETE
  TO authenticated
  USING (
    created_by = auth.uid() AND
    status = 'draft'
  );

-- ============================================================
-- ADMIN ACCESS
-- ============================================================

-- Admins can view ALL products
CREATE POLICY "Admins can view all products"
  ON products FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Admins can update ANY product
CREATE POLICY "Admins can update all products"
  ON products FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Admins can delete ANY product
CREATE POLICY "Admins can delete all products"
  ON products FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Admins can create products directly as approved
CREATE POLICY "Admins can create products"
  ON products FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- ============================================================
-- 4️⃣ MIGRATE EXISTING DATA
-- ============================================================

-- Set all existing products to 'approved' status
-- (they were already live, so they are implicitly approved)
UPDATE products
SET 
  status = 'approved',
  approved_at = created_at
WHERE status = 'draft' OR status IS NULL;

-- ============================================================
-- 5️⃣ HELPER FUNCTIONS
-- ============================================================

-- Function to submit product for review (User → Admin)
CREATE OR REPLACE FUNCTION submit_product_for_review(product_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE products
  SET status = 'pending_review', updated_at = NOW()
  WHERE 
    id = product_id AND
    created_by = auth.uid() AND
    status = 'draft';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to approve product (Admin only)
CREATE OR REPLACE FUNCTION approve_product(product_id UUID)
RETURNS void AS $$
BEGIN
  -- Check if user is admin
  IF NOT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Only admins can approve products';
  END IF;

  UPDATE products
  SET 
    status = 'approved',
    approved_by = auth.uid(),
    approved_at = NOW(),
    active = true,
    updated_at = NOW()
  WHERE id = product_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to reject product (Admin only)
CREATE OR REPLACE FUNCTION reject_product(product_id UUID, rejection_reason TEXT DEFAULT NULL)
RETURNS void AS $$
BEGIN
  -- Check if user is admin
  IF NOT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Only admins can reject products';
  END IF;

  UPDATE products
  SET 
    status = 'rejected',
    approved_by = auth.uid(),
    approved_at = NOW(),
    active = false,
    updated_at = NOW()
  WHERE id = product_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- 6️⃣ VERIFICATION QUERIES
-- ============================================================

-- Show migration results
DO $$
BEGIN
  RAISE NOTICE '============================================================';
  RAISE NOTICE 'PRODUCT APPROVAL WORKFLOW MIGRATION COMPLETE';
  RAISE NOTICE '============================================================';
  RAISE NOTICE '';
  RAISE NOTICE 'Products Table:';
  RAISE NOTICE '  - status column: added';
  RAISE NOTICE '  - created_by column: added';
  RAISE NOTICE '  - approved_by column: added';
  RAISE NOTICE '  - approved_at column: added';
  RAISE NOTICE '';
  RAISE NOTICE 'Storage Bucket:';
  RAISE NOTICE '  - product-images: created';
  RAISE NOTICE '  - RLS policies: configured';
  RAISE NOTICE '';
  RAISE NOTICE 'RLS Policies:';
  RAISE NOTICE '  - Public: approved products only';
  RAISE NOTICE '  - Users: own products (draft/pending)';
  RAISE NOTICE '  - Admins: all products + approval';
  RAISE NOTICE '';
  RAISE NOTICE 'Helper Functions:';
  RAISE NOTICE '  - submit_product_for_review()';
  RAISE NOTICE '  - approve_product()';
  RAISE NOTICE '  - reject_product()';
  RAISE NOTICE '============================================================';
END $$;

-- Show products by status
SELECT 
  status,
  COUNT(*) as count
FROM products
GROUP BY status
ORDER BY status;

-- Show storage bucket
SELECT 
  id,
  name,
  public
FROM storage.buckets
WHERE id = 'product-images';

-- ============================================================
-- NEXT STEPS
-- ============================================================
-- 1. Create test users in Supabase Auth Dashboard:
--    - user@test.com (regular user)
--    - admin@test.com (admin user)
--
-- 2. Set admin role (run in SQL Editor):
--    UPDATE profiles 
--    SET role = 'admin' 
--    WHERE email = 'admin@test.com';
--
-- 3. Test workflow:
--    a) Login as user@test.com
--    b) Create product (status: draft)
--    c) Submit for review (status: pending_review)
--    d) Login as admin@test.com
--    e) Approve product (status: approved, visible on site)
-- ============================================================
