-- Add pricing fields to admin_order_items table
ALTER TABLE public.admin_order_items 
  ADD COLUMN IF NOT EXISTS pricing_version TEXT,
  ADD COLUMN IF NOT EXISTS base_price_cents INTEGER,
  ADD COLUMN IF NOT EXISTS option_prices_cents JSONB,
  ADD COLUMN IF NOT EXISTS custom_fee_cents INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS subtotal_cents INTEGER,
  ADD COLUMN IF NOT EXISTS config JSONB;
