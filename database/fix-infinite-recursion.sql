-- ============================================================
-- FIX: Infinite Recursion in Admin Policies
-- ============================================================
-- Creates helper function to check admin role without triggering RLS

-- Helper function to check if current user is admin (bypasses RLS)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate profiles policies using the helper function
DROP POLICY IF EXISTS "Users can read own profile" ON profiles;
DROP POLICY IF EXISTS "Admins can read all profiles" ON profiles;

-- Users can read their own profile
CREATE POLICY "Users can read own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

-- Admins can read all profiles (uses helper function to avoid recursion)
CREATE POLICY "Admins can read all profiles"
  ON profiles FOR SELECT
  USING (public.is_admin());

-- ============================================================
-- Fix products policies to use helper function
-- ============================================================

DROP POLICY IF EXISTS "Admins can view all products" ON products;
DROP POLICY IF EXISTS "Admins can update all products" ON products;
DROP POLICY IF EXISTS "Admins can delete all products" ON products;
DROP POLICY IF EXISTS "Admins can create products" ON products;

-- Admins can view ALL products
CREATE POLICY "Admins can view all products"
  ON products FOR SELECT
  TO authenticated
  USING (public.is_admin());

-- Admins can update ANY product
CREATE POLICY "Admins can update all products"
  ON products FOR UPDATE
  TO authenticated
  USING (public.is_admin());

-- Admins can delete ANY product
CREATE POLICY "Admins can delete all products"
  ON products FOR DELETE
  TO authenticated
  USING (public.is_admin());

-- Admins can create products directly as approved
CREATE POLICY "Admins can create products"
  ON products FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

-- Verify
SELECT 'Infinite recursion fix applied successfully' as status;
