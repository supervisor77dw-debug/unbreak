-- ============================================================
-- UNBREAK ONE - Add Profiles Table + Admin System
-- ============================================================

-- 1) Create profiles table for user roles
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

-- 2) Admin RLS policies for products table
-- Drop existing policies first
DROP POLICY IF EXISTS "Public can read active products" ON products;
DROP POLICY IF EXISTS "Service role has full access to products" ON products;

-- Public can read all active products
CREATE POLICY "Public can read active products"
  ON products FOR SELECT
  USING (active = true);

-- Admins can do everything with products
CREATE POLICY "Admins can manage products"
  ON products FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- 3) Function to create profile on signup
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

-- 4) Create test admin account
-- Note: You need to create the auth.users manually first in Supabase Dashboard
-- Then run this to make them admin:
-- INSERT INTO profiles (id, email, role)
-- SELECT id, email, 'admin'
-- FROM auth.users
-- WHERE email = 'admin@unbreak-one.local'
-- ON CONFLICT (id) DO UPDATE SET role = 'admin';

-- 5) Verify setup
SELECT 
  'Profiles table exists' AS check_name,
  COUNT(*) > 0 AS result
FROM information_schema.tables
WHERE table_name = 'profiles';

-- Show current admins
SELECT email, role, created_at
FROM profiles
WHERE role = 'admin';

-- ============================================================
-- NEXT STEPS (Manual in Supabase Dashboard):
-- ============================================================
-- 1. Go to Authentication > Users
-- 2. Add user: admin@unbreak-one.local / Unbreak123!
-- 3. Add user: user@unbreak-one.local / User123!
-- 4. Run this SQL to make admin:
--    UPDATE profiles SET role = 'admin' 
--    WHERE email = 'admin@unbreak-one.local';
-- ============================================================
