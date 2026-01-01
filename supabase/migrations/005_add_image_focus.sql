-- Migration: Transform-based crop system for 4:5 product images
-- Date: 2026-01-01
-- Purpose: Zoom + Drag statt einfache Fokus-Presets

-- Step 1: Remove old columns (if they exist)
ALTER TABLE "products" 
DROP COLUMN IF EXISTS "image_fit",
DROP COLUMN IF EXISTS "image_position",
DROP COLUMN IF EXISTS "image_focus";

-- Step 2: Add crop columns
ALTER TABLE "products" 
ADD COLUMN IF NOT EXISTS "image_crop_scale" DOUBLE PRECISION DEFAULT 1.0,
ADD COLUMN IF NOT EXISTS "image_crop_x" INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS "image_crop_y" INTEGER DEFAULT 0;

-- Step 3: Set defaults for existing products (no nulls!)
UPDATE "products" 
SET 
  "image_crop_scale" = 1.0,
  "image_crop_x" = 0,
  "image_crop_y" = 0
WHERE "image_crop_scale" IS NULL OR "image_crop_x" IS NULL OR "image_crop_y" IS NULL;

-- Step 4: Add constraints
ALTER TABLE "products"
ADD CONSTRAINT "image_crop_scale_range" CHECK ("image_crop_scale" >= 1.0 AND "image_crop_scale" <= 2.5),
ADD CONSTRAINT "image_crop_x_range" CHECK ("image_crop_x" >= -200 AND "image_crop_x" <= 200),
ADD CONSTRAINT "image_crop_y_range" CHECK ("image_crop_y" >= -200 AND "image_crop_y" <= 200);

-- Step 5: Add comments
COMMENT ON COLUMN "products"."image_crop_scale" IS 'Zoom level: 1.0 (no zoom) to 2.5 (max zoom)';
COMMENT ON COLUMN "products"."image_crop_x" IS 'Horizontal offset: -200 (left) to +200 (right)';
COMMENT ON COLUMN "products"."image_crop_y" IS 'Vertical offset: -200 (top) to +200 (bottom)';
