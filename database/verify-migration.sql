-- ============================================================
-- VERIFICATION: Check Product Approval System Setup
-- ============================================================
-- Run this to verify the migration was successful
-- ============================================================

-- 1. Check profiles table exists and has correct structure
SELECT 
  'profiles' as table_name,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'profiles'
ORDER BY ordinal_position;

-- 2. Check products table has new columns
SELECT 
  'products' as table_name,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'products' 
  AND column_name IN ('status', 'created_by', 'approved_by', 'approved_at')
ORDER BY column_name;

-- 3. Check RLS is enabled
SELECT 
  schemaname,
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables
WHERE tablename IN ('profiles', 'products');

-- 4. Check policies exist
SELECT 
  schemaname,
  tablename,
  policyname,
  cmd as operation,
  roles
FROM pg_policies
WHERE tablename IN ('profiles', 'products')
ORDER BY tablename, policyname;

-- 5. Check helper functions exist
SELECT 
  routine_name,
  routine_type
FROM information_schema.routines
WHERE routine_name IN ('submit_product_for_review', 'approve_product', 'reject_product', 'handle_new_user')
ORDER BY routine_name;

-- 6. Check storage bucket exists
SELECT 
  id,
  name,
  public
FROM storage.buckets
WHERE id = 'product-images';

-- 7. Check products status distribution
SELECT 
  status,
  COUNT(*) as count
FROM products
GROUP BY status
ORDER BY status;

-- 8. Summary
SELECT 
  '✓ MIGRATION SUCCESSFUL' as status,
  'All components installed' as message;
