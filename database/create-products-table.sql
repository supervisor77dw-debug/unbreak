-- Create shop_products table for admin product management
-- Run this in Supabase SQL Editor if the table doesn't exist

CREATE TABLE IF NOT EXISTS shop_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name_de TEXT NOT NULL,
  name_en TEXT,
  description_de TEXT,
  description_en TEXT,
  sku TEXT UNIQUE,
  base_price_cents INTEGER NOT NULL DEFAULT 0,
  stock_quantity INTEGER NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT true,
  image_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create index for search performance
CREATE INDEX IF NOT EXISTS idx_shop_products_sku ON shop_products(sku);
CREATE INDEX IF NOT EXISTS idx_shop_products_active ON shop_products(active);
CREATE INDEX IF NOT EXISTS idx_shop_products_created_at ON shop_products(created_at DESC);

-- Add some sample products for testing
INSERT INTO shop_products (name_de, name_en, description_de, description_en, sku, base_price_cents, stock_quantity, active, image_url)
VALUES 
  (
    'UNBREAK ONE - Basis',
    'UNBREAK ONE - Basic',
    'Das Standard UNBREAK ONE Modell mit allen Grundfunktionen.',
    'The standard UNBREAK ONE model with all basic features.',
    'UB1-BASIC',
    299900, -- 2999.00 EUR
    10,
    true,
    'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=400'
  ),
  (
    'UNBREAK ONE - Premium',
    'UNBREAK ONE - Premium',
    'Premium-Version mit erweiterten Features und besseren Materialien.',
    'Premium version with advanced features and better materials.',
    'UB1-PREMIUM',
    399900, -- 3999.00 EUR
    5,
    true,
    'https://images.unsplash.com/photo-1572635196237-14b3f281503f?w=400'
  ),
  (
    'UNBREAK ONE - Custom',
    'UNBREAK ONE - Custom',
    'Vollständig anpassbares Modell nach Ihren Wünschen.',
    'Fully customizable model according to your wishes.',
    'UB1-CUSTOM',
    499900, -- 4999.00 EUR
    3,
    true,
    'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=400'
  )
ON CONFLICT (sku) DO NOTHING;

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_shop_products_updated_at 
  BEFORE UPDATE ON shop_products 
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

-- Grant permissions (adjust as needed)
-- ALTER TABLE shop_products ENABLE ROW LEVEL SECURITY;

-- Allow service role to access
-- CREATE POLICY "Service role can manage products" ON shop_products
--   FOR ALL
--   TO service_role
--   USING (true)
--   WITH CHECK (true);
