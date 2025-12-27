-- ============================================================
-- UNBREAK ONE - Auth & Roles Setup
-- ============================================================
-- Purpose: Complete authentication and role-based access control
-- Roles: customer (default), staff (operations), admin (full access)
-- Security: RLS policies, service_role only server-side
-- ============================================================

-- ============================================================
-- 1. PROFILES TABLE
-- ============================================================
-- Stores user metadata and role information
-- Linked 1:1 with auth.users via trigger

CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  role TEXT NOT NULL DEFAULT 'customer' CHECK (role IN ('customer', 'staff', 'admin')),
  full_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Index for faster role lookups
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email);

COMMENT ON TABLE public.profiles IS 'User profiles with role-based access control';
COMMENT ON COLUMN public.profiles.role IS 'User role: customer (default), staff (operations), admin (full access)';

-- ============================================================
-- 2. AUTO-CREATE PROFILE ON USER SIGNUP
-- ============================================================
-- Trigger function to automatically create profile when user signs up

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, role)
  VALUES (NEW.id, NEW.email, 'customer');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing trigger if exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Create trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

COMMENT ON FUNCTION public.handle_new_user IS 'Auto-creates profile with customer role on user signup';

-- ============================================================
-- 3. HELPER FUNCTION - GET USER ROLE
-- ============================================================
-- Returns current user's role (used in RLS policies)

CREATE OR REPLACE FUNCTION public.get_user_role(user_id UUID)
RETURNS TEXT AS $$
  SELECT role FROM public.profiles WHERE id = user_id;
$$ LANGUAGE SQL SECURITY DEFINER;

COMMENT ON FUNCTION public.get_user_role IS 'Returns user role for RLS policy checks';

-- ============================================================
-- 4. RLS POLICIES - PROFILES
-- ============================================================

-- Policy 1: Users can view their own profile
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile"
  ON public.profiles
  FOR SELECT
  USING (auth.uid() = id);

-- Policy 2: Users can update their own profile (except role)
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile"
  ON public.profiles
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id 
    AND role = (SELECT role FROM public.profiles WHERE id = auth.uid()) -- Cannot change own role
  );

-- Policy 3: Admins can view all profiles
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
CREATE POLICY "Admins can view all profiles"
  ON public.profiles
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Policy 4: Admins can update any profile (role changes server-side only via service_role)
DROP POLICY IF EXISTS "Admins can update profiles" ON public.profiles;
CREATE POLICY "Admins can update profiles"
  ON public.profiles
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- ============================================================
-- 5. RLS POLICIES - ORDERS
-- ============================================================

-- Policy 1: Customers can view own orders
DROP POLICY IF EXISTS "Customers view own orders" ON public.orders;
CREATE POLICY "Customers view own orders"
  ON public.orders
  FOR SELECT
  USING (
    customer_user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND role IN ('staff', 'admin')
    )
  );

-- Policy 2: Staff/Admin can update order status
DROP POLICY IF EXISTS "Staff can update orders" ON public.orders;
CREATE POLICY "Staff can update orders"
  ON public.orders
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND role IN ('staff', 'admin')
    )
  );

-- ============================================================
-- 6. RLS POLICIES - PRODUCTS
-- ============================================================

-- Policy 1: Public can view active products (anon + authenticated)
DROP POLICY IF EXISTS "Public can view active products" ON public.products;
CREATE POLICY "Public can view active products"
  ON public.products
  FOR SELECT
  USING (active = true);

-- Policy 2: Staff/Admin can view all products
DROP POLICY IF EXISTS "Staff view all products" ON public.products;
CREATE POLICY "Staff view all products"
  ON public.products
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND role IN ('staff', 'admin')
    )
  );

-- Policy 3: Staff can update product descriptions/images
DROP POLICY IF EXISTS "Staff can update product content" ON public.products;
CREATE POLICY "Staff can update product content"
  ON public.products
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND role IN ('staff', 'admin')
    )
  );

-- Note: Price changes should be done via server API with additional validation

-- ============================================================
-- 7. RLS POLICIES - CUSTOMERS
-- ============================================================

-- Policy 1: Users can view own customer record
DROP POLICY IF EXISTS "Users view own customer record" ON public.customers;
CREATE POLICY "Users view own customer record"
  ON public.customers
  FOR SELECT
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND role IN ('staff', 'admin')
    )
  );

-- Policy 2: Users can update own customer record
DROP POLICY IF EXISTS "Users update own customer record" ON public.customers;
CREATE POLICY "Users update own customer record"
  ON public.customers
  FOR UPDATE
  USING (user_id = auth.uid());

-- ============================================================
-- 8. RLS POLICIES - CONFIGURATIONS
-- ============================================================

-- Policy 1: Users can view own configurations
DROP POLICY IF EXISTS "Users view own configurations" ON public.configurations;
CREATE POLICY "Users view own configurations"
  ON public.configurations
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.orders 
      WHERE orders.id = configurations.order_id 
      AND orders.customer_user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND role IN ('staff', 'admin')
    )
  );

-- ============================================================
-- 9. RLS POLICIES - PAYMENTS
-- ============================================================

-- Policy 1: Users can view own payment records
DROP POLICY IF EXISTS "Users view own payments" ON public.payments;
CREATE POLICY "Users view own payments"
  ON public.payments
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.orders 
      WHERE orders.id = payments.order_id 
      AND orders.customer_user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND role IN ('staff', 'admin')
    )
  );

-- ============================================================
-- 10. RLS POLICIES - PRODUCTION JOBS
-- ============================================================

-- Policy 1: Only staff/admin can view production jobs
DROP POLICY IF EXISTS "Staff view production jobs" ON public.production_jobs;
CREATE POLICY "Staff view production jobs"
  ON public.production_jobs
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND role IN ('staff', 'admin')
    )
  );

-- Policy 2: Staff can update production jobs
DROP POLICY IF EXISTS "Staff update production jobs" ON public.production_jobs;
CREATE POLICY "Staff update production jobs"
  ON public.production_jobs
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND role IN ('staff', 'admin')
    )
  );

-- ============================================================
-- 11. GRANT PERMISSIONS
-- ============================================================

-- Grant authenticated users access to profiles
GRANT SELECT, UPDATE ON public.profiles TO authenticated;
GRANT SELECT ON public.profiles TO anon;

-- Orders/Customers/Configs/Payments - authenticated only
GRANT SELECT ON public.orders TO authenticated;
GRANT SELECT, UPDATE ON public.orders TO authenticated;
GRANT SELECT ON public.customers TO authenticated;
GRANT SELECT, UPDATE ON public.customers TO authenticated;
GRANT SELECT ON public.configurations TO authenticated;
GRANT SELECT ON public.payments TO authenticated;

-- Products - public read, authenticated write
GRANT SELECT ON public.products TO anon, authenticated;
GRANT UPDATE ON public.products TO authenticated;

-- Production jobs - authenticated only
GRANT SELECT, UPDATE ON public.production_jobs TO authenticated;

-- ============================================================
-- 12. SETUP VERIFICATION QUERY
-- ============================================================

-- Run this after migration to verify setup:
-- SELECT 
--   schemaname, 
--   tablename, 
--   rowsecurity 
-- FROM pg_tables 
-- WHERE schemaname = 'public' 
-- AND tablename IN ('profiles', 'orders', 'products', 'customers', 'configurations', 'payments', 'production_jobs');

-- Expected: rowsecurity = true for all tables

-- ============================================================
-- 13. FIRST ADMIN SETUP
-- ============================================================
-- After first user signup, run this with service_role to make them admin:
-- UPDATE public.profiles SET role = 'admin' WHERE email = 'your-email@example.com';

COMMENT ON TABLE public.profiles IS 'User profiles - Run `UPDATE profiles SET role = ''admin'' WHERE email = ''your-email@example.com''` to create first admin';
