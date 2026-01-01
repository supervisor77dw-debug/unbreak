-- AlterTable
ALTER TABLE "products" 
ADD COLUMN "image_fit" TEXT DEFAULT 'cover',
ADD COLUMN "image_position" TEXT DEFAULT '50% 50%';

-- Update existing products to have default values
UPDATE "products" 
SET "image_fit" = 'cover', 
    "image_position" = '50% 50%' 
WHERE "image_fit" IS NULL OR "image_position" IS NULL;
