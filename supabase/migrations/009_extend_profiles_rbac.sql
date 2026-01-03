-- =====================================================
-- Migration 009: Enhanced Profiles with RBAC
-- =====================================================
-- Description: Extends profiles table with role-based access control
--              Roles: admin, ops, support, designer, finance
-- =====================================================

-- 1) Extend profiles table with new roles
DO $$
BEGIN
  -- Drop old role constraint if exists
  ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
  
  -- Add new role constraint with all roles
  ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check
    CHECK (role IN ('user', 'admin', 'ops', 'support', 'designer', 'finance'));
END $$;

-- 2) Add display_name and is_active columns
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'profiles' 
    AND column_name = 'display_name'
    AND table_schema = 'public'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN display_name TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'profiles' 
    AND column_name = 'is_active'
    AND table_schema = 'public'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN is_active BOOLEAN DEFAULT TRUE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'profiles' 
    AND column_name = 'last_login_at'
    AND table_schema = 'public'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN last_login_at TIMESTAMPTZ;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'profiles' 
    AND column_name = 'metadata'
    AND table_schema = 'public'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN metadata JSONB DEFAULT '{}';
  END IF;
END $$;

-- 3) Create index for is_active
CREATE INDEX IF NOT EXISTS idx_profiles_is_active ON public.profiles(is_active);
CREATE INDEX IF NOT EXISTS idx_profiles_last_login ON public.profiles(last_login_at DESC);

-- 4) Update existing RLS policies (drop old ones)
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can update all profiles" ON public.profiles;

-- 5) New RLS policies with role-based access

-- Policy: Users can view own profile
CREATE POLICY "Users can view own profile"
  ON public.profiles
  FOR SELECT
  USING (id = auth.uid());

-- Policy: Users can update own display_name and metadata (not role)
CREATE POLICY "Users can update own profile"
  ON public.profiles
  FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (
    id = auth.uid() AND
    -- Cannot change own role or is_active
    role = (SELECT role FROM public.profiles WHERE id = auth.uid()) AND
    is_active = (SELECT is_active FROM public.profiles WHERE id = auth.uid())
  );

-- Policy: Admins can view all profiles
CREATE POLICY "Admins can view all profiles"
  ON public.profiles
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin' AND is_active = TRUE
    )
  );

-- Policy: Admins can insert new profiles
CREATE POLICY "Admins can insert profiles"
  ON public.profiles
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin' AND is_active = TRUE
    )
  );

-- Policy: Admins can update profiles (including roles)
CREATE POLICY "Admins can update profiles"
  ON public.profiles
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin' AND is_active = TRUE
    )
  );

-- Policy: Admins can delete profiles (soft delete via is_active preferred)
CREATE POLICY "Admins can delete profiles"
  ON public.profiles
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin' AND is_active = TRUE
    )
  );

-- 6) Helper function to check user role
CREATE OR REPLACE FUNCTION public.has_role(required_role TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() 
    AND role = required_role
    AND is_active = TRUE
  );
END;
$$;

-- 7) Helper function to check if user has any of multiple roles
CREATE OR REPLACE FUNCTION public.has_any_role(required_roles TEXT[])
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() 
    AND role = ANY(required_roles)
    AND is_active = TRUE
  );
END;
$$;

-- 8) Helper function to get current user role
CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
  user_role TEXT;
BEGIN
  SELECT role INTO user_role
  FROM public.profiles
  WHERE id = auth.uid();
  
  RETURN user_role;
END;
$$;

-- 9) Function to update last_login_at
CREATE OR REPLACE FUNCTION public.update_last_login()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.profiles
  SET last_login_at = NOW()
  WHERE id = auth.uid();
END;
$$;

-- 10) Seed first admin user (if none exists)
-- IMPORTANT: Update this email to your admin email
DO $$
DECLARE
  admin_email TEXT := 'admin@unbreak-one.de'; -- CHANGE THIS
  admin_user_id UUID;
BEGIN
  -- Check if admin exists
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles WHERE role = 'admin'
  ) THEN
    -- Try to find user by email
    SELECT id INTO admin_user_id
    FROM auth.users
    WHERE email = admin_email;
    
    IF admin_user_id IS NOT NULL THEN
      -- Update existing profile to admin
      UPDATE public.profiles
      SET role = 'admin',
          display_name = 'System Admin',
          is_active = TRUE,
          updated_at = NOW()
      WHERE id = admin_user_id;
      
      RAISE NOTICE 'Promoted user % to admin', admin_email;
    ELSE
      RAISE NOTICE 'No user found with email %. Please create admin manually.', admin_email;
    END IF;
  END IF;
END $$;

-- =====================================================
-- Migration complete
-- =====================================================
-- Profiles table extended with:
-- - New roles: admin, ops, support, designer, finance
-- - display_name, is_active, last_login_at, metadata
-- - Enhanced RLS policies
-- - Helper functions: has_role(), has_any_role(), current_user_role()
-- - Auto-create admin user (if email matches)
-- =====================================================
