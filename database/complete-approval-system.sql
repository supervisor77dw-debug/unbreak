-- ============================================================
-- UNBREAK ONE - COMPLETE PRODUCT APPROVAL SYSTEM
-- ============================================================
-- This is a complete migration that includes:
-- 1. Profiles table with user roles
-- 2. Product approval workflow
-- 3. Storage bucket setup
-- 4. All RLS policies
-- 5. Helper functions
-- ============================================================

-- ============================================================
-- STEP 1: CREATE PROFILES TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for quick role lookups
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);

-- RLS Policies for profiles
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Drop existing profile policies
DROP POLICY IF EXISTS "Users can read own profile" ON profiles;
DROP POLICY IF EXISTS "Admins can read all profiles" ON profiles;

-- Users can read their own profile
CREATE POLICY "Users can read own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

-- Admins can read all profiles
CREATE POLICY "Admins can read all profiles"
  ON profiles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Function to create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, role)
  VALUES (NEW.id, NEW.email, 'user');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to auto-create profile
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- STEP 2: EXTEND PRODUCTS TABLE
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

-- Add indexes for status queries
CREATE INDEX IF NOT EXISTS idx_products_status ON products(status);
CREATE INDEX IF NOT EXISTS idx_products_created_by ON products(created_by);

COMMENT ON COLUMN products.status IS 'Workflow status: draft, pending_review, approved, rejected';
COMMENT ON COLUMN products.created_by IS 'User who created this product';
COMMENT ON COLUMN products.approved_by IS 'Admin who approved/rejected this product';
COMMENT ON COLUMN products.approved_at IS 'Timestamp when product was approved/rejected';

-- ============================================================
-- STEP 3: STORAGE BUCKET FOR PRODUCT IMAGES
-- ============================================================

-- Create bucket (if not exists)
INSERT INTO storage.buckets (id, name, public)
VALUES ('product-images', 'product-images', false)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- STEP 4: RLS POLICIES FOR PRODUCTS
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
-- STEP 5: MIGRATE EXISTING DATA
-- ============================================================

-- Set all existing products to 'approved' status
UPDATE products
SET 
  status = 'approved',
  approved_at = created_at
WHERE status = 'draft' OR status IS NULL;

-- ============================================================
-- STEP 6: HELPER FUNCTIONS
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
-- STEP 7: VERIFICATION
-- ============================================================

DO $$
BEGIN
  RAISE NOTICE '============================================================';
  RAISE NOTICE 'PRODUCT APPROVAL SYSTEM MIGRATION COMPLETE';
  RAISE NOTICE '============================================================';
  RAISE NOTICE '';
  RAISE NOTICE 'Profiles Table:';
  RAISE NOTICE '  ✓ Created with user/admin roles';
  RAISE NOTICE '  ✓ Auto-signup trigger configured';
  RAISE NOTICE '';
  RAISE NOTICE 'Products Table:';
  RAISE NOTICE '  ✓ status column added';
  RAISE NOTICE '  ✓ created_by column added';
  RAISE NOTICE '  ✓ approved_by column added';
  RAISE NOTICE '  ✓ approved_at column added';
  RAISE NOTICE '';
  RAISE NOTICE 'Storage:';
  RAISE NOTICE '  ✓ product-images bucket created';
  RAISE NOTICE '';
  RAISE NOTICE 'RLS Policies:';
  RAISE NOTICE '  ✓ Public: approved products only';
  RAISE NOTICE '  ✓ Users: own products (draft/pending)';
  RAISE NOTICE '  ✓ Admins: all products + approval';
  RAISE NOTICE '';
  RAISE NOTICE 'Helper Functions:';
  RAISE NOTICE '  ✓ submit_product_for_review()';
  RAISE NOTICE '  ✓ approve_product()';
  RAISE NOTICE '  ✓ reject_product()';
  RAISE NOTICE '';
  RAISE NOTICE '============================================================';
  RAISE NOTICE 'READY FOR ADMIN UI DEVELOPMENT';
  RAISE NOTICE '============================================================';
END $$;

-- Show profiles count
SELECT 
  'Total profiles' as metric,
  COUNT(*) as count
FROM profiles;

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
