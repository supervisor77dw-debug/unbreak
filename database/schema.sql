-- =====================================================
-- UNBREAK ONE - Production Database Schema
-- Supabase/Postgres Migration
-- =====================================================
-- Version: 1.0.0
-- Purpose: E-Commerce Backend (Konfigurator → Stripe → Production)
-- =====================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- 1) PRODUCTS TABLE
-- Base product catalog
-- =====================================================
CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sku TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  base_price_cents INTEGER NOT NULL CHECK (base_price_cents >= 0),
  currency TEXT NOT NULL DEFAULT 'EUR',
  
  -- Media
  image_path TEXT,              -- Storage path: products/<sku>/main.jpg
  image_url TEXT,               -- Public URL (cached or generated)
  
  -- Shop Display
  badge_label TEXT,             -- e.g. "Gastro Edition", "Bestseller"
  shipping_text TEXT,           -- e.g. "Versand 3–5 Tage"
  highlights JSONB,             -- Array of 3 USPs: ["Made in Germany", "Magnetisch", "Sicherer Halt"]
  
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_products_sku ON products(sku);
CREATE INDEX idx_products_active ON products(active);

COMMENT ON TABLE products IS 'Base product catalog (Weinglashalter, Flaschenhalter, Gastro-Edition)';
COMMENT ON COLUMN products.base_price_cents IS 'Base price in cents (EUR): 5990 = 59.90 EUR';

-- =====================================================
-- 2) PRODUCT_OPTIONS TABLE
-- Configurable options (colors, editions, finishes)
-- =====================================================
CREATE TABLE product_options (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  option_type TEXT NOT NULL, -- 'color', 'edition', 'finish', 'engraving'
  option_key TEXT NOT NULL,  -- 'petrol', 'anthracite', 'gastro', 'matte'
  option_label TEXT NOT NULL, -- 'Petrol Deep', 'Anthrazit', 'Gastro Edition'
  price_delta_cents INTEGER NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_product_options_product_id ON product_options(product_id);
CREATE INDEX idx_product_options_type ON product_options(option_type);
CREATE UNIQUE INDEX idx_product_options_unique ON product_options(product_id, option_type, option_key);

COMMENT ON TABLE product_options IS 'Configurable product options with price deltas';
COMMENT ON COLUMN product_options.price_delta_cents IS 'Price adjustment in cents (+500 = +5 EUR)';

-- =====================================================
-- 3) CONFIGURATIONS TABLE
-- User-created product configurations from 3D Konfigurator
-- =====================================================
CREATE TABLE configurations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID NOT NULL REFERENCES products(id),
  config_json JSONB NOT NULL,
  price_cents INTEGER NOT NULL CHECK (price_cents >= 0),
  currency TEXT NOT NULL DEFAULT 'EUR',
  preview_image_url TEXT,
  model_export_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_configurations_product_id ON configurations(product_id);
CREATE INDEX idx_configurations_created_at ON configurations(created_at DESC);
CREATE INDEX idx_configurations_config_json ON configurations USING GIN (config_json);

COMMENT ON TABLE configurations IS '3D Konfigurator output - full product configuration';
COMMENT ON COLUMN configurations.config_json IS 'Complete config: {color, edition, finish, engraving, modelData}';
COMMENT ON COLUMN configurations.preview_image_url IS 'Render/screenshot from 3D viewer (optional)';
COMMENT ON COLUMN configurations.model_export_url IS 'Exported 3D model URL for production (optional)';

-- =====================================================
-- 4) CUSTOMERS TABLE
-- Customer records (minimal v1, expandable)
-- =====================================================
CREATE TABLE customers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT UNIQUE NOT NULL,
  name TEXT,
  phone TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_customers_email ON customers(email);

COMMENT ON TABLE customers IS 'Customer records - minimal v1 (email required)';

-- =====================================================
-- 5) ORDERS TABLE
-- Order lifecycle: draft → pending_payment → paid → in_production → fulfilled
-- =====================================================
CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_number TEXT UNIQUE NOT NULL,
  customer_id UUID NOT NULL REFERENCES customers(id),
  configuration_id UUID NOT NULL REFERENCES configurations(id),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (
    status IN (
      'draft',
      'pending_payment',
      'paid',
      'in_production',
      'fulfilled',
      'canceled',
      'refunded'
    )
  ),
  subtotal_cents INTEGER NOT NULL CHECK (subtotal_cents >= 0),
  shipping_cents INTEGER NOT NULL DEFAULT 0 CHECK (shipping_cents >= 0),
  tax_cents INTEGER NOT NULL DEFAULT 0 CHECK (tax_cents >= 0),
  total_cents INTEGER NOT NULL CHECK (total_cents >= 0),
  currency TEXT NOT NULL DEFAULT 'EUR',
  stripe_checkout_session_id TEXT UNIQUE,
  stripe_payment_intent_id TEXT UNIQUE,
  shipping_address JSONB,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_orders_order_number ON orders(order_number);
CREATE INDEX idx_orders_customer_id ON orders(customer_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_stripe_checkout_session_id ON orders(stripe_checkout_session_id);
CREATE INDEX idx_orders_created_at ON orders(created_at DESC);

COMMENT ON TABLE orders IS 'Order lifecycle management with Stripe integration';
COMMENT ON COLUMN orders.order_number IS 'Human-readable: UB-20250101-A1B2';
COMMENT ON COLUMN orders.shipping_address IS '{street, city, zip, country, ...}';

-- =====================================================
-- 6) PAYMENTS TABLE
-- Payment event tracking (Stripe webhook events)
-- =====================================================
CREATE TABLE payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  provider TEXT NOT NULL DEFAULT 'stripe',
  status TEXT NOT NULL CHECK (
    status IN ('initiated', 'succeeded', 'failed', 'refunded', 'canceled')
  ),
  stripe_event_id TEXT UNIQUE, -- for idempotency
  stripe_payment_intent_id TEXT,
  amount_cents INTEGER NOT NULL CHECK (amount_cents >= 0),
  currency TEXT NOT NULL DEFAULT 'EUR',
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_payments_order_id ON payments(order_id);
CREATE INDEX idx_payments_stripe_event_id ON payments(stripe_event_id);
CREATE INDEX idx_payments_status ON payments(status);

COMMENT ON TABLE payments IS 'Payment event log - audit trail from Stripe webhooks';
COMMENT ON COLUMN payments.stripe_event_id IS 'Stripe webhook event ID for idempotency';

-- =====================================================
-- 7) PRODUCTION_JOBS TABLE
-- Manufacturing queue - created after successful payment
-- =====================================================
CREATE TABLE production_jobs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID NOT NULL REFERENCES orders(id),
  status TEXT NOT NULL DEFAULT 'queued' CHECK (
    status IN ('queued', 'processing', 'done', 'error')
  ),
  payload_json JSONB NOT NULL,
  priority INTEGER NOT NULL DEFAULT 0,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_production_jobs_order_id ON production_jobs(order_id);
CREATE INDEX idx_production_jobs_status ON production_jobs(status);
CREATE INDEX idx_production_jobs_priority ON production_jobs(priority DESC, created_at ASC);

COMMENT ON TABLE production_jobs IS 'Manufacturing queue - contains all data needed for production';
COMMENT ON COLUMN production_jobs.payload_json IS '{order_number, product, config, customer, shipping}';
COMMENT ON COLUMN production_jobs.priority IS 'Higher = urgent (0 = normal)';

-- =====================================================
-- HELPER FUNCTIONS
-- =====================================================

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_customers_updated_at BEFORE UPDATE ON customers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_production_jobs_updated_at BEFORE UPDATE ON production_jobs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Generate order number
CREATE OR REPLACE FUNCTION generate_order_number()
RETURNS TEXT AS $$
DECLARE
  random_suffix TEXT;
BEGIN
  -- Format: UB-YYYYMMDD-XXXX (UB-20250127-A1B2)
  random_suffix := UPPER(SUBSTRING(MD5(RANDOM()::TEXT || NOW()::TEXT) FROM 1 FOR 4));
  RETURN 'UB-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || random_suffix;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- ROW LEVEL SECURITY (RLS)
-- =====================================================

-- Enable RLS on all tables
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE configurations ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE production_jobs ENABLE ROW LEVEL SECURITY;

-- PUBLIC READ POLICIES (products/options - catalog data)
CREATE POLICY "Public can read active products"
  ON products FOR SELECT
  USING (active = true);

CREATE POLICY "Public can read active product options"
  ON product_options FOR SELECT
  USING (active = true);

-- SERVICE ROLE FULL ACCESS (backend API only)
-- All write operations go through backend API with service_role key

-- Customers: Service role only
CREATE POLICY "Service role can manage customers"
  ON customers FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Configurations: Service role can create/read
CREATE POLICY "Service role can manage configurations"
  ON configurations FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Orders: Service role only
CREATE POLICY "Service role can manage orders"
  ON orders FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Payments: Service role only
CREATE POLICY "Service role can manage payments"
  ON payments FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Production Jobs: Service role only
CREATE POLICY "Service role can manage production jobs"
  ON production_jobs FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- =====================================================
-- SEED DATA (Initial Products)
-- =====================================================

-- Base Products
INSERT INTO products (sku, name, description, base_price_cents, active) VALUES
  ('UNBREAK-WEIN-01', 'Weinglashalter', 'Magnetischer Halter für Weingläser', 5990, true),
  ('UNBREAK-GLAS-01', 'Glashalter Universal', 'Magnetischer Halter für Gläser', 4990, true),
  ('UNBREAK-FLASCHE-01', 'Flaschenhalter', 'Magnetischer Halter für Flaschen', 5490, true),
  ('UNBREAK-GASTRO-01', 'Gastro Edition Set', 'Professionelles Set für Gastronomie (4x Weinglashalter)', 19990, true);

-- Product Options (Colors)
INSERT INTO product_options (product_id, option_type, option_key, option_label, price_delta_cents) 
SELECT id, 'color', 'petrol', 'Petrol Deep', 0 FROM products WHERE sku = 'UNBREAK-WEIN-01';

INSERT INTO product_options (product_id, option_type, option_key, option_label, price_delta_cents) 
SELECT id, 'color', 'anthracite', 'Anthrazit', 0 FROM products WHERE sku = 'UNBREAK-WEIN-01';

INSERT INTO product_options (product_id, option_type, option_key, option_label, price_delta_cents) 
SELECT id, 'color', 'graphite', 'Graphit', 0 FROM products WHERE sku = 'UNBREAK-WEIN-01';

-- Product Options (Finish)
INSERT INTO product_options (product_id, option_type, option_key, option_label, price_delta_cents) 
SELECT id, 'finish', 'matte', 'Matt', 0 FROM products WHERE sku = 'UNBREAK-WEIN-01';

INSERT INTO product_options (product_id, option_type, option_key, option_label, price_delta_cents) 
SELECT id, 'finish', 'glossy', 'Glänzend', 200 FROM products WHERE sku = 'UNBREAK-WEIN-01';

-- Product Options (Engraving - premium)
INSERT INTO product_options (product_id, option_type, option_key, option_label, price_delta_cents) 
SELECT id, 'engraving', 'yes', 'Gravur (max. 20 Zeichen)', 990 FROM products WHERE sku = 'UNBREAK-WEIN-01';

-- =====================================================
-- INDEXES FOR PERFORMANCE
-- =====================================================

-- Composite index for order lookups
CREATE INDEX idx_orders_customer_status ON orders(customer_id, status);

-- Production queue optimization
CREATE INDEX idx_production_jobs_queue ON production_jobs(status, priority DESC, created_at ASC)
  WHERE status IN ('queued', 'processing');

-- =====================================================
-- VIEWS (Optional - helpful for reporting)
-- =====================================================

-- Active orders with customer info
CREATE VIEW v_active_orders AS
SELECT 
  o.id,
  o.order_number,
  o.status,
  o.total_cents,
  o.currency,
  o.created_at,
  c.email AS customer_email,
  c.name AS customer_name,
  p.name AS product_name,
  p.sku AS product_sku
FROM orders o
JOIN customers c ON o.customer_id = c.id
JOIN configurations cfg ON o.configuration_id = cfg.id
JOIN products p ON cfg.product_id = p.id
WHERE o.status != 'canceled';

-- Production queue summary
CREATE VIEW v_production_queue AS
SELECT 
  pj.id,
  pj.status,
  pj.priority,
  pj.created_at,
  o.order_number,
  c.email AS customer_email,
  p.name AS product_name
FROM production_jobs pj
JOIN orders o ON pj.order_id = o.id
JOIN customers c ON o.customer_id = c.id
JOIN configurations cfg ON o.configuration_id = cfg.id
JOIN products p ON cfg.product_id = p.id
WHERE pj.status IN ('queued', 'processing')
ORDER BY pj.priority DESC, pj.created_at ASC;

-- =====================================================
-- GRANTS (Supabase specific)
-- =====================================================

-- Grant authenticated users read on products/options
GRANT SELECT ON products TO authenticated;
GRANT SELECT ON product_options TO authenticated;

-- Service role has full access (automatically granted in Supabase)

-- =====================================================
-- MIGRATION COMPLETE
-- =====================================================

-- Verification query
SELECT 
  'Products' AS table_name, COUNT(*) AS row_count FROM products
UNION ALL
SELECT 'Product Options', COUNT(*) FROM product_options
UNION ALL
SELECT 'Configurations', COUNT(*) FROM configurations
UNION ALL
SELECT 'Customers', COUNT(*) FROM customers
UNION ALL
SELECT 'Orders', COUNT(*) FROM orders
UNION ALL
SELECT 'Payments', COUNT(*) FROM payments
UNION ALL
SELECT 'Production Jobs', COUNT(*) FROM production_jobs;
