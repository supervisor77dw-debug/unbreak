-- =====================================================
-- Migration 002: Profiles RLS Policies
-- =====================================================
-- Description: Row Level Security policies for profiles table
-- =====================================================

-- Drop existing policies if any
DROP POLICY IF EXISTS "Users can read own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can read all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Prevent role escalation" ON public.profiles;
DROP POLICY IF EXISTS "Service role has full access" ON public.profiles;

-- 1) Users can read their own profile
CREATE POLICY "Users can read own profile"
  ON public.profiles
  FOR SELECT
  USING (auth.uid() = id);

-- 2) Admins can read all profiles
CREATE POLICY "Admins can read all profiles"
  ON public.profiles
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- 3) Users can update their own profile (but NOT the role)
CREATE POLICY "Users can update own profile"
  ON public.profiles
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id AND
    -- Prevent role change unless current user is admin
    (role = (SELECT role FROM public.profiles WHERE id = auth.uid()) OR
     EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'))
  );

-- 4) Service role bypass (for server-side operations)
-- This is automatically handled by Supabase for service_role key
