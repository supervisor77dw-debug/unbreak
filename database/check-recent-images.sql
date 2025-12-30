-- Quick diagnostic: Check actual image URLs in database
SELECT 
  id,
  sku,
  name,
  image_url,
  created_at,
  CASE 
    WHEN image_url IS NULL THEN '⚪ No image'
    WHEN image_url LIKE '%/product-images/products/%' THEN '✅ Correct bucket'
    WHEN image_url LIKE '%/products/%' AND image_url NOT LIKE '%/product-images/%' THEN '❌ Wrong bucket'
    ELSE '⚠️ Unknown pattern'
  END as url_status
FROM products
WHERE created_at > NOW() - INTERVAL '1 hour'
ORDER BY created_at DESC
LIMIT 10;

-- If you see wrong bucket, copy the exact image_url value and test it in browser
