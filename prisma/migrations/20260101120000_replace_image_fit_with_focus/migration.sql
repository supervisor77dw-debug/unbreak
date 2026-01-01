-- Migration: Transform-based crop system
-- AlterTable
ALTER TABLE "products" 
DROP COLUMN IF EXISTS "image_fit",
DROP COLUMN IF EXISTS "image_position",
DROP COLUMN IF EXISTS "image_focus";

ALTER TABLE "products" 
ADD COLUMN "image_crop_scale" DOUBLE PRECISION DEFAULT 1.0,
ADD COLUMN "image_crop_x" INTEGER DEFAULT 0,
ADD COLUMN "image_crop_y" INTEGER DEFAULT 0;

-- Update existing products with defaults
UPDATE "products" 
SET 
  "image_crop_scale" = 1.0,
  "image_crop_x" = 0,
  "image_crop_y" = 0
WHERE "image_crop_scale" IS NULL;
