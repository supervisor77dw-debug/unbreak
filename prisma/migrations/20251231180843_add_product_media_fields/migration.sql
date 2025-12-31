-- AlterTable: Add product media & shop display fields
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "image_path" TEXT;
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "image_url" TEXT;
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "badge_label" TEXT;
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "shipping_text" TEXT;
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "highlights" JSONB;

-- Set default shipping text for existing products
UPDATE "products" SET "shipping_text" = 'Versand 3–5 Tage' WHERE "shipping_text" IS NULL;

-- Set badge for Gastro Edition
UPDATE "products" 
SET "badge_label" = 'Gastro Edition'
WHERE "sku" = 'UNBREAK-GASTRO-01';

-- Set highlights for all products
UPDATE "products" 
SET "highlights" = '["Magnetisch", "Sicherer Halt", "Made in Germany"]'::jsonb
WHERE "sku" = 'UNBREAK-WEIN-01' AND "highlights" IS NULL;

UPDATE "products" 
SET "highlights" = '["Magnetisch", "Praktisch", "Made in Germany"]'::jsonb
WHERE "sku" = 'UNBREAK-GLAS-01' AND "highlights" IS NULL;

UPDATE "products" 
SET "highlights" = '["Magnetisch", "Stabil", "Made in Germany"]'::jsonb
WHERE "sku" = 'UNBREAK-FLASCHE-01' AND "highlights" IS NULL;

UPDATE "products" 
SET "highlights" = '["10x Weinglashalter", "Professionell", "Gastronomie-Qualität"]'::jsonb
WHERE "sku" = 'UNBREAK-GASTRO-01' AND "highlights" IS NULL;

-- Add column comments
COMMENT ON COLUMN "products"."image_path" IS 'Supabase Storage path: products/<sku>/main.jpg';
COMMENT ON COLUMN "products"."image_url" IS 'Public URL (cached from Storage)';
COMMENT ON COLUMN "products"."badge_label" IS 'Product badge (e.g. "Gastro Edition", max 20 chars)';
COMMENT ON COLUMN "products"."shipping_text" IS 'Shipping time display (e.g. "Versand 3–5 Tage")';
COMMENT ON COLUMN "products"."highlights" IS 'JSONB array of product USPs (max 3)';
