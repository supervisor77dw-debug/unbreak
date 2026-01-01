-- Migration 006: Image Cache-Busting
-- Add image_updated_at column for proper cache invalidation

-- Add column
ALTER TABLE products 
ADD COLUMN IF NOT EXISTS image_updated_at TIMESTAMPTZ;

-- Set existing products to current timestamp (one-time initialization)
UPDATE products 
SET image_updated_at = NOW()
WHERE image_path IS NOT NULL AND image_updated_at IS NULL;

-- Add comment
COMMENT ON COLUMN products.image_updated_at IS 'Timestamp des letzten Image-Uploads für Cache-Busting';
