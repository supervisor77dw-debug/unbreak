-- APPLY NOW: Add missing items column + backfill from existing data
-- Run this in Supabase SQL Editor

-- 1. Add items column
ALTER TABLE simple_orders
ADD COLUMN IF NOT EXISTS items JSONB DEFAULT '[]'::jsonb;

-- 2. Backfill items from existing product_sku + quantity
UPDATE simple_orders
SET items = jsonb_build_array(
  jsonb_build_object(
    'sku', product_sku,
    'name', 'UNBREAK ONE Glass Holder',
    'quantity', quantity,
    'unit_price_cents', total_amount_cents / NULLIF(quantity, 0)
  )
)
WHERE product_sku IS NOT NULL;

-- 3. Verify
SELECT 
  id,
  customer_email,
  items,
  config_json,
  total_amount_cents,
  created_at
FROM simple_orders
ORDER BY created_at DESC
LIMIT 5;
