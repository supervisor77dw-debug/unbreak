-- PRODUCTION MIGRATION: Add missing tables and fields
-- Run this in Supabase SQL Editor or via psql

-- 1. Create shipping_rates table (if not exists)
CREATE TABLE IF NOT EXISTS shipping_rates (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  country_code TEXT NOT NULL,
  label_de TEXT NOT NULL,
  label_en TEXT NOT NULL,
  price_net INTEGER NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for shipping_rates
CREATE INDEX IF NOT EXISTS shipping_rates_active_idx ON shipping_rates(active);
CREATE INDEX IF NOT EXISTS shipping_rates_sort_order_idx ON shipping_rates(sort_order);

-- Insert default shipping rates (if table is empty)
INSERT INTO shipping_rates (country_code, label_de, label_en, price_net, active, sort_order)
SELECT 'DE', 'Deutschland', 'Germany', 490, true, 1
WHERE NOT EXISTS (SELECT 1 FROM shipping_rates WHERE country_code = 'DE');

INSERT INTO shipping_rates (country_code, label_de, label_en, price_net, active, sort_order)
SELECT 'EU', 'EU-Ausland', 'EU Countries', 1290, true, 2
WHERE NOT EXISTS (SELECT 1 FROM shipping_rates WHERE country_code = 'EU');

INSERT INTO shipping_rates (country_code, label_de, label_en, price_net, active, sort_order)
SELECT 'INT', 'International', 'International', 2490, true, 3
WHERE NOT EXISTS (SELECT 1 FROM shipping_rates WHERE country_code = 'INT');

-- 2. Add shipping_region to admin_orders (if not exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'admin_orders' AND column_name = 'shipping_region'
  ) THEN
    ALTER TABLE admin_orders ADD COLUMN shipping_region VARCHAR(10);
    CREATE INDEX idx_orders_shipping_region ON admin_orders(shipping_region);
  END IF;
END $$;

-- 3. Verify tables exist
SELECT 
  'shipping_rates' as table_name, 
  COUNT(*) as row_count 
FROM shipping_rates
UNION ALL
SELECT 
  'admin_orders with shipping_region' as table_name,
  COUNT(*) as row_count
FROM admin_orders
WHERE shipping_region IS NOT NULL;
