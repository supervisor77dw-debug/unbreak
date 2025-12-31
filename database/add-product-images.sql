-- Add image_url column to products table
-- Run this in Supabase SQL Editor to add image support

ALTER TABLE products ADD COLUMN IF NOT EXISTS image_url TEXT;

COMMENT ON COLUMN products.image_url IS 'Product image URL (Supabase Storage or external CDN)';

-- Update existing products with placeholder images
UPDATE products 
SET image_url = 'https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?w=400&h=400&fit=crop'
WHERE sku = 'UNBREAK-WEIN-01' AND image_url IS NULL;

UPDATE products 
SET image_url = 'https://images.unsplash.com/photo-1572635196237-14b3f281503f?w=400&h=400&fit=crop'
WHERE sku = 'UNBREAK-GLAS-01' AND image_url IS NULL;

UPDATE products 
SET image_url = 'https://images.unsplash.com/photo-1569443693539-175ea9f007e8?w=400&h=400&fit=crop'
WHERE sku = 'UNBREAK-FLASCHE-01' AND image_url IS NULL;

UPDATE products 
SET image_url = 'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=400&h=400&fit=crop'
WHERE sku = 'UNBREAK-GASTRO-01' AND image_url IS NULL;

-- Create trigger to auto-update updated_at when image changes
-- (reuse existing trigger if present)
