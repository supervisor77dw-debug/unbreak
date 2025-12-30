-- ============================================================
-- Diagnose Image Storage Setup
-- ============================================================
-- Run this in Supabase Dashboard SQL Editor to check setup

-- 1. Check if image_url column exists
SELECT 
  column_name, 
  data_type, 
  is_nullable
FROM information_schema.columns
WHERE table_name = 'products' AND column_name = 'image_url';

-- 2. Check products with images
SELECT 
  id,
  name,
  sku,
  image_url,
  created_at
FROM products
WHERE image_url IS NOT NULL
ORDER BY created_at DESC
LIMIT 10;

-- 3. Check storage bucket exists
SELECT 
  id, 
  name, 
  public,
  created_at
FROM storage.buckets
WHERE id = 'product-images';

-- 4. Check storage policies
SELECT 
  policyname,
  cmd,
  qual
FROM pg_policies
WHERE tablename = 'objects' 
  AND schemaname = 'storage';

-- 5. Count products with/without images
SELECT 
  'With Images' as category,
  COUNT(*) as count
FROM products
WHERE image_url IS NOT NULL
UNION ALL
SELECT 
  'Without Images' as category,
  COUNT(*) as count
FROM products
WHERE image_url IS NULL;
