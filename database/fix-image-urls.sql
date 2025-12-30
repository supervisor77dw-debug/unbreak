-- ============================================================
-- Fix Existing Product Image URLs
-- ============================================================
-- This fixes any product image URLs that reference wrong bucket name
-- Run this in Supabase Dashboard SQL Editor

-- BEFORE running: Check if there are any wrong URLs
SELECT 
  id,
  name,
  sku,
  image_url,
  CASE 
    WHEN image_url LIKE '%/object/public/products/%' THEN 'NEEDS FIX'
    WHEN image_url LIKE '%/object/public/product-images/%' THEN 'OK'
    WHEN image_url IS NULL THEN 'NO IMAGE'
    ELSE 'UNKNOWN'
  END as status
FROM products
WHERE image_url IS NOT NULL
ORDER BY created_at DESC;

-- FIX: Replace wrong bucket name 'products' with correct 'product-images'
UPDATE products
SET image_url = REPLACE(image_url, '/object/public/products/', '/object/public/product-images/')
WHERE image_url LIKE '%/object/public/products/%';

-- VERIFY: Check results
SELECT 
  id,
  name,
  sku,
  image_url,
  CASE 
    WHEN image_url LIKE '%/object/public/products/%' THEN '❌ STILL WRONG'
    WHEN image_url LIKE '%/object/public/product-images/%' THEN '✅ FIXED'
    WHEN image_url IS NULL THEN 'NO IMAGE'
    ELSE 'UNKNOWN'
  END as status
FROM products
WHERE image_url IS NOT NULL
ORDER BY created_at DESC;

-- Count fixed rows
SELECT 
  'Total products with images' as metric,
  COUNT(*) as count
FROM products
WHERE image_url IS NOT NULL
UNION ALL
SELECT 
  'Using correct bucket (product-images)' as metric,
  COUNT(*) as count
FROM products
WHERE image_url LIKE '%/object/public/product-images/%'
UNION ALL
SELECT 
  'Using wrong bucket (products)' as metric,
  COUNT(*) as count
FROM products
WHERE image_url LIKE '%/object/public/products/%';
