-- ============================================================
-- BACKFILL PROFILES FOR EXISTING USERS
-- ============================================================
-- Run this ONCE if you have users created before the profiles system
-- This creates profiles for all existing auth.users without a profile

INSERT INTO public.profiles (id, email, role)
SELECT 
  au.id,
  au.email,
  'user' as role
FROM auth.users au
LEFT JOIN public.profiles p ON p.id = au.id
WHERE p.id IS NULL;

-- Check results
SELECT 
  COUNT(*) as total_users,
  COUNT(p.id) as users_with_profiles,
  COUNT(*) - COUNT(p.id) as users_without_profiles
FROM auth.users au
LEFT JOIN public.profiles p ON p.id = au.id;

-- Optional: Make specific users admins
-- UPDATE public.profiles 
-- SET role = 'admin' 
-- WHERE email = 'admin@test.com';
