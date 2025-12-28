-- =====================================================
-- Migration 004: Seed Admin User
-- =====================================================
-- Description: Function to promote user to admin by email
--              Called by API route with SEED_ADMIN_EMAIL
-- =====================================================

-- Function to promote user to admin
CREATE OR REPLACE FUNCTION public.promote_user_to_admin(user_email TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  affected_rows INTEGER;
BEGIN
  -- Update role to admin for matching email
  UPDATE public.profiles
  SET role = 'admin', updated_at = NOW()
  WHERE email = user_email AND role != 'admin';
  
  GET DIAGNOSTICS affected_rows = ROW_COUNT;
  
  -- Return true if user was promoted
  RETURN affected_rows > 0;
END;
$$;

-- Function to check if any admin exists
CREATE OR REPLACE FUNCTION public.has_admin_user()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles WHERE role = 'admin'
  );
END;
$$;

COMMENT ON FUNCTION public.promote_user_to_admin IS 'Promotes a user to admin role by email (server-side only)';
COMMENT ON FUNCTION public.has_admin_user IS 'Checks if at least one admin exists';
