-- ============================================================
-- UPDATE SIMPLE_ORDERS - Add Items Array & Paid Timestamp
-- ============================================================
-- Extends simple_orders table to support:
-- 1. Multiple items with quantities (cart checkout)
-- 2. Paid timestamp for webhook
-- ============================================================

-- Add items column (JSONB array)
ALTER TABLE simple_orders
ADD COLUMN IF NOT EXISTS items JSONB DEFAULT '[]'::jsonb;

-- Add paid_at timestamp
ALTER TABLE simple_orders
ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ;

-- Comments
COMMENT ON COLUMN simple_orders.items IS 'Cart items: [{product_id, sku, name, unit_price_cents, quantity, image_url}]';
COMMENT ON COLUMN simple_orders.paid_at IS 'Timestamp when payment was confirmed (set by webhook)';

-- Update existing orders to have empty items array
UPDATE simple_orders
SET items = jsonb_build_array(
  jsonb_build_object(
    'sku', product_sku,
    'quantity', quantity,
    'unit_price_cents', total_amount_cents / NULLIF(quantity, 0)
  )
)
WHERE items = '[]'::jsonb AND product_sku IS NOT NULL;

-- Verification
SELECT 
  id,
  customer_email,
  items,
  total_amount_cents,
  status,
  paid_at,
  created_at
FROM simple_orders
ORDER BY created_at DESC
LIMIT 5;
