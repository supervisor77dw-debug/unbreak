-- ============================================================
-- UNBREAK ONE - Product Approval Workflow Migration (Fixed)
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

-- Note: Storage policies must be set via Supabase Dashboard → Storage → product-images → Policies
-- Or continue to the storage policies section at the end if you have superuser access

-- ============================================================
-- 3️⃣ RLS POLICIES FOR PRODUCTS
-- ============================================================

-- Drop all existing product policies
DROP POLICY IF EXISTS "Public can read active products" ON products;
DROP POLICY IF EXISTS "Admins can manage products" ON products;
DROP POLICY IF EXISTS "Service role has full access to products" ON products;
DROP POLICY IF EXISTS "Users can view own products" ON products;
DROP POLICY IF EXISTS "Users can create products" ON products;
DROP POLICY IF EXISTS "Users can update own draft products" ON products;
DROP POLICY IF EXISTS "Users can delete own draft products" ON products;
DROP POLICY IF EXISTS "Admins can view all products" ON products;
DROP POLICY IF EXISTS "Admins can update all products" ON products;
DROP POLICY IF EXISTS "Admins can delete all products" ON products;
DROP POLICY IF EXISTS "Public can read approved products" ON products;

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
  RAISE NOTICE '';
  RAISE NOTICE 'NEXT: Set Storage Policies in Dashboard (see instructions below)';
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
-- MANUAL STEP: STORAGE POLICIES (via Supabase Dashboard)
-- ============================================================
-- Go to: Storage → product-images → Policies
-- Create these policies via the UI:
--
-- 1. "Users can upload images" (INSERT)
--    Target: authenticated
--    USING: bucket_id = 'product-images' AND (storage.foldername(name))[1] = auth.uid()::text
--
-- 2. "Users can update own images" (UPDATE)
--    Target: authenticated  
--    USING: bucket_id = 'product-images' AND (storage.foldername(name))[1] = auth.uid()::text
--
-- 3. "Users can delete own images" (DELETE)
--    Target: authenticated
--    USING: bucket_id = 'product-images' AND (storage.foldername(name))[1] = auth.uid()::text
--
-- 4. "Public can view approved images" (SELECT)
--    Target: public
--    USING: bucket_id = 'product-images' AND EXISTS (
--      SELECT 1 FROM products WHERE created_by::text = (storage.foldername(name))[1] AND status = 'approved'
--    )
--
-- 5. "Admins manage all images" (ALL)
--    Target: authenticated
--    USING: bucket_id = 'product-images' AND EXISTS (
--      SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
--    )
-- ============================================================
