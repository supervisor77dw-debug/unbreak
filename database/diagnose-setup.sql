-- ============================================================
-- DIAGNOSE: Check Products Table Setup
-- ============================================================
-- Run this to check if the approval system is properly configured

-- 1. Check if new columns exist
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'products'
  AND column_name IN ('status', 'created_by', 'approved_by', 'approved_at')
ORDER BY column_name;

-- 2. Check RLS policies on products
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'products'
ORDER BY policyname;

-- 3. Check if profiles table exists and has data
SELECT COUNT(*) as total_profiles FROM public.profiles;

-- 4. Test: Try to select products (should work for authenticated user)
-- SELECT * FROM products WHERE created_by = auth.uid();

-- 5. Check helper functions
SELECT 
  routine_name,
  routine_type
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name IN ('submit_product_for_review', 'approve_product', 'reject_product')
ORDER BY routine_name;
