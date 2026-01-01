-- Migration 007: Add Thumbnail Paths
-- Fügt thumb_path und shop_image_path Spalten hinzu
-- für server-generierte Thumbnails

-- Thumb Path (240x300 WebP)
ALTER TABLE products ADD COLUMN IF NOT EXISTS thumb_path TEXT;

-- Shop Image Path (800x1000 WebP)
ALTER TABLE products ADD COLUMN IF NOT EXISTS shop_image_path TEXT;

-- Optional: Index für schnellere Abfragen
CREATE INDEX IF NOT EXISTS idx_products_thumb_path ON products(thumb_path);
CREATE INDEX IF NOT EXISTS idx_products_shop_image_path ON products(shop_image_path);

-- Kommentar
COMMENT ON COLUMN products.thumb_path IS 'Server-generiertes Thumbnail (240x300, 4:5) mit Crop';
COMMENT ON COLUMN products.shop_image_path IS 'Server-generiertes Shop-Image (800x1000, 4:5) mit Crop';
