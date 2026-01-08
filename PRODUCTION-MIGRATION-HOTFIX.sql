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

-- 2. Add ALL missing fields to admin_orders (from previous sessions)
DO $$
BEGIN
  -- Add subtotal_net (MwSt calculation)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'admin_orders' AND column_name = 'subtotal_net'
  ) THEN
    ALTER TABLE admin_orders ADD COLUMN subtotal_net INTEGER;
  END IF;

  -- Add tax_rate (MwSt rate)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'admin_orders' AND column_name = 'tax_rate'
  ) THEN
    ALTER TABLE admin_orders ADD COLUMN tax_rate DECIMAL(5,4);
  END IF;

  -- Add tax_amount (calculated MwSt)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'admin_orders' AND column_name = 'tax_amount'
  ) THEN
    ALTER TABLE admin_orders ADD COLUMN tax_amount INTEGER;
  END IF;

  -- Add total_gross (total including MwSt)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'admin_orders' AND column_name = 'total_gross'
  ) THEN
    ALTER TABLE admin_orders ADD COLUMN total_gross INTEGER;
  END IF;

  -- Add config_json (configurator config)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'admin_orders' AND column_name = 'config_json'
  ) THEN
    ALTER TABLE admin_orders ADD COLUMN config_json JSONB;
  END IF;

  -- Add shipping_region (DE/EU/INT)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'admin_orders' AND column_name = 'shipping_region'
  ) THEN
    ALTER TABLE admin_orders ADD COLUMN shipping_region VARCHAR(10);
    CREATE INDEX idx_orders_shipping_region ON admin_orders(shipping_region);
  END IF;
END $$;

-- 3. Verify all columns exist
SELECT 
  'admin_orders columns' as check_type,
  COUNT(*) as total_columns
FROM information_schema.columns 
WHERE table_name = 'admin_orders';

-- 4. Verify shipping_rates
SELECT 
  'shipping_rates' as table_name, 
  COUNT(*) as row_count 
FROM shipping_rates;
