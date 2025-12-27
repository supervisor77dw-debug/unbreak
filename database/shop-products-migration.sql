-- ============================================================
-- UNBREAK ONE - Shop Products Migration
-- ============================================================
-- Professional shop with 3 initial products from current shop
-- Run this in Supabase SQL Editor
-- ============================================================

-- ============================================================
-- 1. EXTEND PRODUCTS TABLE FOR SHOP
-- ============================================================

-- Add shop-specific fields if not exist
DO $$ 
BEGIN
  -- Short description for shop cards
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'products' AND column_name = 'short_description_de'
  ) THEN
    ALTER TABLE products ADD COLUMN short_description_de TEXT;
    ALTER TABLE products ADD COLUMN short_description_en TEXT;
  END IF;
  
  -- Long description for product detail pages
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'products' AND column_name = 'long_description_de'
  ) THEN
    ALTER TABLE products ADD COLUMN long_description_de TEXT;
    ALTER TABLE products ADD COLUMN long_description_en TEXT;
  END IF;
  
  -- Image URL for shop display
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'products' AND column_name = 'image_url'
  ) THEN
    ALTER TABLE products ADD COLUMN image_url TEXT;
  END IF;
  
  -- Slug for clean URLs
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'products' AND column_name = 'slug'
  ) THEN
    ALTER TABLE products ADD COLUMN slug TEXT UNIQUE;
  END IF;
  
  -- Sort order for shop display
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'products' AND column_name = 'sort_order'
  ) THEN
    ALTER TABLE products ADD COLUMN sort_order INTEGER DEFAULT 100;
  END IF;
  
  -- Stripe Price ID (recommended over SKU)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'products' AND column_name = 'stripe_price_id'
  ) THEN
    ALTER TABLE products ADD COLUMN stripe_price_id TEXT;
  END IF;
  
  -- Currency (if not exists from base schema)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'products' AND column_name = 'currency'
  ) THEN
    ALTER TABLE products ADD COLUMN currency TEXT DEFAULT 'EUR';
  END IF;
END $$;

-- Create index on slug for fast lookups
CREATE INDEX IF NOT EXISTS idx_products_slug ON products(slug) WHERE slug IS NOT NULL;

-- Create index on sort_order for shop display
CREATE INDEX IF NOT EXISTS idx_products_sort_order ON products(sort_order, id) WHERE active = true;

-- ============================================================
-- 2. SEED: 3 CURRENT SHOP PRODUCTS
-- ============================================================

-- Product 1: Basic Set
INSERT INTO products (
  sku,
  slug,
  name,
  short_description_de,
  short_description_en,
  long_description_de,
  long_description_en,
  base_price_cents,
  currency,
  image_url,
  active,
  sort_order,
  stripe_price_id
) VALUES (
  'UNBREAK-BASIC-SET',
  'basic-set',
  'UNBREAK ONE Basic Set',
  '2x Weinglashalter + 1x Flaschenhalter – Der perfekte Einstieg',
  '2x Wine Glass Holders + 1x Bottle Holder – The perfect starter set',
  'Das Basic Set enthält 2 magnetische Weinglashalter und 1 Flaschenhalter. Ideal für den Heimgebrauch und als Geschenk. Alle Komponenten in hochwertigem Petrol Deep Finish.',
  'The Basic Set includes 2 magnetic wine glass holders and 1 bottle holder. Perfect for home use and as a gift. All components in premium Petrol Deep finish.',
  7990, -- 79,90 EUR
  'EUR',
  '/images/set-basic.jpg',
  true,
  10,
  NULL -- Set via Stripe Dashboard or leave NULL for SKU-based checkout
)
ON CONFLICT (sku) DO UPDATE SET
  slug = EXCLUDED.slug,
  name = EXCLUDED.name,
  short_description_de = EXCLUDED.short_description_de,
  short_description_en = EXCLUDED.short_description_en,
  long_description_de = EXCLUDED.long_description_de,
  long_description_en = EXCLUDED.long_description_en,
  base_price_cents = EXCLUDED.base_price_cents,
  image_url = EXCLUDED.image_url,
  sort_order = EXCLUDED.sort_order;

-- Product 2: Premium Set
INSERT INTO products (
  sku,
  slug,
  name,
  short_description_de,
  short_description_en,
  long_description_de,
  long_description_en,
  base_price_cents,
  currency,
  image_url,
  active,
  sort_order,
  stripe_price_id
) VALUES (
  'UNBREAK-PREMIUM-SET',
  'premium-set',
  'UNBREAK ONE Premium Set',
  '4x Weinglashalter + 2x Flaschenhalter – Für Genießer',
  '4x Wine Glass Holders + 2x Bottle Holders – For connoisseurs',
  'Das Premium Set bietet maximale Flexibilität mit 4 Weinglashaltern und 2 Flaschenhaltern. Perfekt für Weinliebhaber und größere Haushalte. Alle Komponenten in edlem Anthrazit mit Matt-Finish.',
  'The Premium Set offers maximum flexibility with 4 wine glass holders and 2 bottle holders. Perfect for wine lovers and larger households. All components in elegant Anthracite with matte finish.',
  14990, -- 149,90 EUR
  'EUR',
  '/images/set-premium.jpg',
  true,
  20,
  NULL
)
ON CONFLICT (sku) DO UPDATE SET
  slug = EXCLUDED.slug,
  name = EXCLUDED.name,
  short_description_de = EXCLUDED.short_description_de,
  short_description_en = EXCLUDED.short_description_en,
  long_description_de = EXCLUDED.long_description_de,
  long_description_en = EXCLUDED.long_description_en,
  base_price_cents = EXCLUDED.base_price_cents,
  image_url = EXCLUDED.image_url,
  sort_order = EXCLUDED.sort_order;

-- Product 3: Gastro Edition
INSERT INTO products (
  sku,
  slug,
  name,
  short_description_de,
  short_description_en,
  long_description_de,
  long_description_en,
  base_price_cents,
  currency,
  image_url,
  active,
  sort_order,
  stripe_price_id
) VALUES (
  'UNBREAK-GASTRO-BUNDLE',
  'gastro-edition',
  'UNBREAK ONE Gastro Edition',
  '10x Weinglashalter – Professionell für Gastronomie & Events',
  '10x Wine Glass Holders – Professional for gastronomy & events',
  'Die Gastro Edition wurde speziell für den professionellen Einsatz entwickelt. 10 robuste Weinglashalter mit verstärkten Magneten und Graphit-Finish. Inklusive Wandmontage-Set und Pflegeanleitung. Ideal für Restaurants, Bars, Weinproben und Events.',
  'The Gastro Edition was developed specifically for professional use. 10 robust wine glass holders with reinforced magnets and graphite finish. Including wall mounting set and care instructions. Ideal for restaurants, bars, wine tastings and events.',
  24990, -- 249,90 EUR
  'EUR',
  '/images/gastro-set.jpg',
  true,
  30,
  NULL
)
ON CONFLICT (sku) DO UPDATE SET
  slug = EXCLUDED.slug,
  name = EXCLUDED.name,
  short_description_de = EXCLUDED.short_description_de,
  short_description_en = EXCLUDED.short_description_en,
  long_description_de = EXCLUDED.long_description_de,
  long_description_en = EXCLUDED.long_description_en,
  base_price_cents = EXCLUDED.base_price_cents,
  image_url = EXCLUDED.image_url,
  sort_order = EXCLUDED.sort_order;

-- ============================================================
-- 3. RLS POLICIES FOR SHOP
-- ============================================================

-- Public can read active products (already exists in base schema)
-- This policy should already exist, but ensure it's there:
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'products' 
    AND policyname = 'Public can read active products'
  ) THEN
    CREATE POLICY "Public can read active products"
      ON products FOR SELECT
      USING (active = true);
  END IF;
END $$;

-- Staff/Admin can manage products
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'products' 
    AND policyname = 'Staff and Admin can manage products'
  ) THEN
    CREATE POLICY "Staff and Admin can manage products"
      ON products FOR ALL
      USING (
        EXISTS (
          SELECT 1 FROM profiles
          WHERE profiles.id = auth.uid()
          AND profiles.role IN ('staff', 'admin')
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM profiles
          WHERE profiles.id = auth.uid()
          AND profiles.role IN ('staff', 'admin')
        )
      );
  END IF;
END $$;

-- ============================================================
-- 4. VERIFICATION QUERY
-- ============================================================

SELECT 
  sku,
  slug,
  name,
  base_price_cents / 100.0 AS price_eur,
  active,
  sort_order,
  image_url,
  short_description_de
FROM products
WHERE active = true
ORDER BY sort_order ASC;

-- ============================================================
-- MIGRATION COMPLETE
-- ============================================================
-- Next steps:
-- 1. Add product images to /public/images/ folder
-- 2. Create Stripe products/prices and add stripe_price_id
-- 3. Deploy shop page to pull from this data
-- ============================================================
