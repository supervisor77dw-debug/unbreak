-- ============================================================
-- SIMPLE ORDERS TABLE - Standard Product Checkout
-- ============================================================
-- Ergänzt das bestehende Schema um einfache Produkt-Orders
-- (ohne Konfigurator-Abhängigkeit)
-- ============================================================

-- Neue Tabelle für Standard-Checkout
CREATE TABLE IF NOT EXISTS simple_orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Customer (optional - kann Guest sein)
  customer_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  customer_email TEXT,
  
  -- Product
  product_sku TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
  
  -- Pricing
  total_amount_cents INTEGER NOT NULL CHECK (total_amount_cents >= 0),
  currency TEXT NOT NULL DEFAULT 'EUR',
  
  -- Order Status
  status TEXT NOT NULL DEFAULT 'pending' CHECK (
    status IN ('pending', 'paid', 'failed', 'refunded', 'canceled')
  ),
  order_type TEXT NOT NULL DEFAULT 'standard',
  
  -- Stripe Integration
  stripe_session_id TEXT UNIQUE,
  stripe_payment_intent_id TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_simple_orders_customer_user_id ON simple_orders(customer_user_id);
CREATE INDEX IF NOT EXISTS idx_simple_orders_product_sku ON simple_orders(product_sku);
CREATE INDEX IF NOT EXISTS idx_simple_orders_status ON simple_orders(status);
CREATE INDEX IF NOT EXISTS idx_simple_orders_stripe_session_id ON simple_orders(stripe_session_id);
CREATE INDEX IF NOT EXISTS idx_simple_orders_created_at ON simple_orders(created_at DESC);

-- Comments
COMMENT ON TABLE simple_orders IS 'Standard product orders (without configurator)';
COMMENT ON COLUMN simple_orders.customer_user_id IS 'NULL for guest checkouts';
COMMENT ON COLUMN simple_orders.order_type IS 'standard, bundle, subscription, etc.';

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_simple_orders_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_simple_orders_updated_at_trigger ON simple_orders;
CREATE TRIGGER update_simple_orders_updated_at_trigger
  BEFORE UPDATE ON simple_orders
  FOR EACH ROW
  EXECUTE FUNCTION update_simple_orders_updated_at();

-- RLS Policies (Row Level Security)
ALTER TABLE simple_orders ENABLE ROW LEVEL SECURITY;

-- Policy: Admins can do everything
CREATE POLICY "Admins can manage all simple orders"
ON simple_orders FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND role IN ('admin', 'staff')
  )
);

-- Policy: Users can view their own orders
CREATE POLICY "Users can view own simple orders"
ON simple_orders FOR SELECT
TO authenticated
USING (customer_user_id = auth.uid());

-- Policy: Service role can insert orders (for API)
CREATE POLICY "Service role can create simple orders"
ON simple_orders FOR INSERT
TO service_role
WITH CHECK (true);

-- Verification Query
SELECT 
  table_name,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'simple_orders'
ORDER BY ordinal_position;
