-- ============================================================
-- Add image_url column to products table
-- ============================================================
-- Run this in Supabase Dashboard SQL Editor

-- Add image_url column if it doesn't exist
ALTER TABLE products 
ADD COLUMN IF NOT EXISTS image_url TEXT;

-- Add comment
COMMENT ON COLUMN products.image_url IS 'URL to product image (Supabase Storage or external)';

-- Verify column was added
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'products' AND column_name = 'image_url';
