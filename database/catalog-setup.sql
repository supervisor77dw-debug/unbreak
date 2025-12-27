-- ============================================================
-- UNBREAK ONE - Catalog Setup (Bundles + Presets)
-- ============================================================
-- Run this in Supabase SQL Editor after auth-setup.sql
-- Creates bundles and presets tables with RLS policies
-- ============================================================

-- ============================================================
-- 1. BUNDLES TABLE
-- ============================================================
-- Bundles: Multiple products sold together (e.g., "Gastro 10er Set")
CREATE TABLE IF NOT EXISTS bundles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Content
  title_de TEXT NOT NULL,
  title_en TEXT NOT NULL,
  description_de TEXT,
  description_en TEXT,
  image_url TEXT,
  
  -- Pricing
  price_cents INTEGER NOT NULL CHECK (price_cents >= 0),
  currency TEXT NOT NULL DEFAULT 'EUR',
  
  -- Bundle Items (array of {sku, qty})
  -- Example: [{"sku":"UO-GLASSHOLDER","qty":4}, {"sku":"UO-BOTTLEHOLDER","qty":2}]
  items_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  
  -- Status
  active BOOLEAN NOT NULL DEFAULT true,
  
  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  
  -- Constraints
  CONSTRAINT bundles_items_not_empty CHECK (jsonb_array_length(items_json) > 0)
);

-- Index for active bundles (public queries)
CREATE INDEX IF NOT EXISTS idx_bundles_active ON bundles(active) WHERE active = true;

-- Index for timestamps
CREATE INDEX IF NOT EXISTS idx_bundles_created_at ON bundles(created_at DESC);

-- ============================================================
-- 2. PRESETS TABLE
-- ============================================================
-- Presets: Pre-configured configurator products (e.g., "Schwarz/Gold Premium")
CREATE TABLE IF NOT EXISTS presets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Content
  title_de TEXT NOT NULL,
  title_en TEXT NOT NULL,
  description_de TEXT,
  description_en TEXT,
  image_url TEXT,
  
  -- Pricing
  price_cents INTEGER NOT NULL CHECK (price_cents >= 0),
  currency TEXT NOT NULL DEFAULT 'EUR',
  
  -- Base Product Reference
  product_sku TEXT NOT NULL, -- References products.sku (e.g., "UO-CONFIGURED")
  
  -- Pre-configured Settings
  -- Example: {"finish":"matte-black","magnet":"gold","quantity":2}
  config_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  
  -- Status
  active BOOLEAN NOT NULL DEFAULT true,
  
  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES profiles(id) ON DELETE SET NULL
);

-- Index for active presets
CREATE INDEX IF NOT EXISTS idx_presets_active ON presets(active) WHERE active = true;

-- Index for product_sku lookup
CREATE INDEX IF NOT EXISTS idx_presets_product_sku ON presets(product_sku);

-- Index for timestamps
CREATE INDEX IF NOT EXISTS idx_presets_created_at ON presets(created_at DESC);

-- ============================================================
-- 3. UPDATE EXISTING TABLES
-- ============================================================

-- Add image_url to products if not exists (for shop display)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'products' AND column_name = 'image_url'
  ) THEN
    ALTER TABLE products ADD COLUMN image_url TEXT;
  END IF;
END $$;

-- Add short_description for products
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'products' AND column_name = 'short_description_de'
  ) THEN
    ALTER TABLE products ADD COLUMN short_description_de TEXT;
    ALTER TABLE products ADD COLUMN short_description_en TEXT;
  END IF;
END $$;

-- ============================================================
-- 4. RLS POLICIES - BUNDLES
-- ============================================================

-- Enable RLS
ALTER TABLE bundles ENABLE ROW LEVEL SECURITY;

-- Public: Read only ACTIVE bundles
CREATE POLICY "Public can view active bundles"
  ON bundles
  FOR SELECT
  USING (active = true);

-- Staff/Admin: View ALL bundles
CREATE POLICY "Staff and Admin can view all bundles"
  ON bundles
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('staff', 'admin')
    )
  );

-- Staff/Admin: Insert new bundles
CREATE POLICY "Staff and Admin can create bundles"
  ON bundles
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('staff', 'admin')
    )
  );

-- Staff/Admin: Update bundles
CREATE POLICY "Staff and Admin can update bundles"
  ON bundles
  FOR UPDATE
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

-- Admin only: Delete bundles
CREATE POLICY "Admin can delete bundles"
  ON bundles
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- ============================================================
-- 5. RLS POLICIES - PRESETS
-- ============================================================

-- Enable RLS
ALTER TABLE presets ENABLE ROW LEVEL SECURITY;

-- Public: Read only ACTIVE presets
CREATE POLICY "Public can view active presets"
  ON presets
  FOR SELECT
  USING (active = true);

-- Staff/Admin: View ALL presets
CREATE POLICY "Staff and Admin can view all presets"
  ON presets
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('staff', 'admin')
    )
  );

-- Staff/Admin: Insert new presets
CREATE POLICY "Staff and Admin can create presets"
  ON presets
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('staff', 'admin')
    )
  );

-- Staff/Admin: Update presets
CREATE POLICY "Staff and Admin can update presets"
  ON presets
  FOR UPDATE
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

-- Admin only: Delete presets
CREATE POLICY "Admin can delete presets"
  ON presets
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- ============================================================
-- 6. HELPER FUNCTIONS
-- ============================================================

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for bundles
DROP TRIGGER IF EXISTS update_bundles_updated_at ON bundles;
CREATE TRIGGER update_bundles_updated_at
  BEFORE UPDATE ON bundles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Triggers for presets
DROP TRIGGER IF EXISTS update_presets_updated_at ON presets;
CREATE TRIGGER update_presets_updated_at
  BEFORE UPDATE ON presets
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- 7. SEED DATA - Example Bundles & Presets
-- ============================================================

-- Insert example bundles (adjust SKUs to match your products table)
INSERT INTO bundles (title_de, title_en, description_de, description_en, price_cents, items_json, image_url, active)
VALUES
  (
    'Gastro Starter Set',
    'Gastro Starter Set',
    '4x Glashalter + 2x Flaschenhalter – perfekt für kleine Bars und Cafés',
    '4x Glass Holders + 2x Bottle Holders – perfect for small bars and cafes',
    24900, -- 249.00 EUR
    '[
      {"sku":"UO-GLASSHOLDER","qty":4},
      {"sku":"UO-BOTTLEHOLDER","qty":2}
    ]'::jsonb,
    '/images/bundle-gastro-starter.jpg',
    true
  ),
  (
    'Gastro Premium Paket',
    'Gastro Premium Package',
    '10x Glashalter + 5x Flaschenhalter – für größere Gastronomie-Betriebe',
    '10x Glass Holders + 5x Bottle Holders – for larger gastronomy businesses',
    59900, -- 599.00 EUR
    '[
      {"sku":"UO-GLASSHOLDER","qty":10},
      {"sku":"UO-BOTTLEHOLDER","qty":5}
    ]'::jsonb,
    '/images/bundle-gastro-premium.jpg',
    true
  ),
  (
    'Home Office Set',
    'Home Office Set',
    '2x Glashalter – halte deinen Schreibtisch frei von Flecken',
    '2x Glass Holders – keep your desk free from stains',
    9900, -- 99.00 EUR
    '[
      {"sku":"UO-GLASSHOLDER","qty":2}
    ]'::jsonb,
    '/images/bundle-home-office.jpg',
    true
  )
ON CONFLICT DO NOTHING;

-- Insert example presets (adjust product_sku and config_json to match your configurator)
INSERT INTO presets (title_de, title_en, description_de, description_en, price_cents, product_sku, config_json, image_url, active)
VALUES
  (
    'Schwarz/Gold Premium',
    'Black/Gold Premium',
    'Edles Design: Mattschwarze Oberfläche mit goldenen Magneten',
    'Elegant design: Matte black surface with gold magnets',
    7900, -- 79.00 EUR
    'UO-CONFIGURED',
    '{
      "finish": "matte-black",
      "magnet": "gold",
      "quantity": 1
    }'::jsonb,
    '/images/preset-black-gold.jpg',
    true
  ),
  (
    'Weiß/Silber Clean',
    'White/Silver Clean',
    'Minimalistisch: Weiße Oberfläche mit silbernen Magneten',
    'Minimalist: White surface with silver magnets',
    6900, -- 69.00 EUR
    'UO-CONFIGURED',
    '{
      "finish": "glossy-white",
      "magnet": "silver",
      "quantity": 1
    }'::jsonb,
    '/images/preset-white-silver.jpg',
    true
  ),
  (
    'Holz/Kupfer Natur',
    'Wood/Copper Natural',
    'Natürlich: Holz-Optik mit kupferfarbenen Magneten',
    'Natural: Wood finish with copper magnets',
    8900, -- 89.00 EUR
    'UO-CONFIGURED',
    '{
      "finish": "wood-oak",
      "magnet": "copper",
      "quantity": 1
    }'::jsonb,
    '/images/preset-wood-copper.jpg',
    true
  )
ON CONFLICT DO NOTHING;

-- ============================================================
-- 8. GRANTS
-- ============================================================

-- Grant access to authenticated users
GRANT SELECT ON bundles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON bundles TO authenticated;

GRANT SELECT ON presets TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON presets TO authenticated;

-- Grant access to anon users (public read of active items)
GRANT SELECT ON bundles TO anon;
GRANT SELECT ON presets TO anon;

-- ============================================================
-- 9. VERIFICATION QUERIES
-- ============================================================

-- Check bundles
SELECT 
  id, 
  title_de, 
  price_cents / 100.0 AS price_eur,
  jsonb_array_length(items_json) AS item_count,
  active,
  created_at
FROM bundles
ORDER BY created_at DESC;

-- Check presets
SELECT 
  id, 
  title_de, 
  price_cents / 100.0 AS price_eur,
  product_sku,
  config_json,
  active,
  created_at
FROM presets
ORDER BY created_at DESC;

-- Check RLS policies
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual 
FROM pg_policies 
WHERE tablename IN ('bundles', 'presets')
ORDER BY tablename, policyname;

-- ============================================================
-- SETUP COMPLETE
-- ============================================================
-- Next steps:
-- 1. Verify tables created: SELECT * FROM bundles; SELECT * FROM presets;
-- 2. Test RLS: Try querying as anon vs authenticated staff
-- 3. Update product images: UPDATE products SET image_url = '...' WHERE sku = '...';
-- 4. Add more bundles/presets via /ops/catalog UI
-- ============================================================
