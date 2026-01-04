-- =====================================================
-- CRITICAL: RUN THIS NOW - Complete simple_orders Fix
-- =====================================================
-- Combines migrations 008, 012, and 013
-- Adds ALL missing customer and config fields
-- Safe to run multiple times (checks for existing columns)
-- =====================================================

-- PART 1: Customer Fields (from migrations 008 + 012)
-- =====================================================

-- 1) customer_id (FK to customers table)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'simple_orders' AND column_name = 'customer_id' AND table_schema = 'public'
  ) THEN
    ALTER TABLE public.simple_orders ADD COLUMN customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL;
    CREATE INDEX idx_simple_orders_customer_id ON public.simple_orders(customer_id);
    RAISE NOTICE '✅ Added customer_id';
  END IF;
END $$;

-- 2) stripe_customer_id
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'simple_orders' AND column_name = 'stripe_customer_id' AND table_schema = 'public'
  ) THEN
    ALTER TABLE public.simple_orders ADD COLUMN stripe_customer_id TEXT;
    CREATE INDEX idx_simple_orders_stripe_customer_id ON public.simple_orders(stripe_customer_id);
    RAISE NOTICE '✅ Added stripe_customer_id';
  END IF;
END $$;

-- 3) customer_name
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'simple_orders' AND column_name = 'customer_name' AND table_schema = 'public'
  ) THEN
    ALTER TABLE public.simple_orders ADD COLUMN customer_name TEXT;
    RAISE NOTICE '✅ Added customer_name';
  END IF;
END $$;

-- 4) customer_phone
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'simple_orders' AND column_name = 'customer_phone' AND table_schema = 'public'
  ) THEN
    ALTER TABLE public.simple_orders ADD COLUMN customer_phone TEXT;
    RAISE NOTICE '✅ Added customer_phone';
  END IF;
END $$;

-- 5) shipping_address
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'simple_orders' AND column_name = 'shipping_address' AND table_schema = 'public'
  ) THEN
    ALTER TABLE public.simple_orders ADD COLUMN shipping_address JSONB;
    RAISE NOTICE '✅ Added shipping_address';
  END IF;
END $$;

-- 6) billing_address
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'simple_orders' AND column_name = 'billing_address' AND table_schema = 'public'
  ) THEN
    ALTER TABLE public.simple_orders ADD COLUMN billing_address JSONB;
    RAISE NOTICE '✅ Added billing_address';
  END IF;
END $$;

-- PART 2: Config Fields (from migration 013)
-- =====================================================

-- 7) items (JSONB array for line items with config)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'simple_orders' AND column_name = 'items' AND table_schema = 'public'
  ) THEN
    ALTER TABLE public.simple_orders ADD COLUMN items JSONB DEFAULT '[]';
    COMMENT ON COLUMN public.simple_orders.items IS 'Array of order items with product details and configs';
    RAISE NOTICE '✅ Added items';
  END IF;
END $$;

-- 8) config_json (direct config storage)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'simple_orders' AND column_name = 'config_json' AND table_schema = 'public'
  ) THEN
    ALTER TABLE public.simple_orders ADD COLUMN config_json JSONB;
    COMMENT ON COLUMN public.simple_orders.config_json IS 'Product configuration (color, finish, etc.)';
    RAISE NOTICE '✅ Added config_json';
  END IF;
END $$;

-- 9) preview_image_url
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'simple_orders' AND column_name = 'preview_image_url' AND table_schema = 'public'
  ) THEN
    ALTER TABLE public.simple_orders ADD COLUMN preview_image_url TEXT;
    COMMENT ON COLUMN public.simple_orders.preview_image_url IS 'URL to configuration preview image';
    RAISE NOTICE '✅ Added preview_image_url';
  END IF;
END $$;

-- 10) bom_json (Bill of Materials)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'simple_orders' AND column_name = 'bom_json' AND table_schema = 'public'
  ) THEN
    ALTER TABLE public.simple_orders ADD COLUMN bom_json JSONB;
    COMMENT ON COLUMN public.simple_orders.bom_json IS 'Bill of materials for configured products';
    RAISE NOTICE '✅ Added bom_json';
  END IF;
END $$;

-- 11) price_breakdown_json
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'simple_orders' AND column_name = 'price_breakdown_json' AND table_schema = 'public'
  ) THEN
    ALTER TABLE public.simple_orders ADD COLUMN price_breakdown_json JSONB;
    COMMENT ON COLUMN public.simple_orders.price_breakdown_json IS 'Detailed price breakdown';
    RAISE NOTICE '✅ Added price_breakdown_json';
  END IF;
END $$;

-- 12) metadata (flexible key-value store)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'simple_orders' AND column_name = 'metadata' AND table_schema = 'public'
  ) THEN
    ALTER TABLE public.simple_orders ADD COLUMN metadata JSONB DEFAULT '{}';
    COMMENT ON COLUMN public.simple_orders.metadata IS 'Additional metadata (utm, referrer, notes, etc.)';
    RAISE NOTICE '✅ Added metadata';
  END IF;
END $$;

-- 13) stripe_checkout_session_id (separate from stripe_session_id)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'simple_orders' AND column_name = 'stripe_checkout_session_id' AND table_schema = 'public'
  ) THEN
    ALTER TABLE public.simple_orders ADD COLUMN stripe_checkout_session_id TEXT UNIQUE;
    CREATE INDEX idx_simple_orders_stripe_checkout_session_id ON public.simple_orders(stripe_checkout_session_id);
    COMMENT ON COLUMN public.simple_orders.stripe_checkout_session_id IS 'Stripe Checkout Session ID (cs_xxx)';
    RAISE NOTICE '✅ Added stripe_checkout_session_id';
  END IF;
END $$;

-- =====================================================
-- VERIFICATION
-- =====================================================

-- Show all columns in simple_orders
SELECT 
  column_name, 
  data_type, 
  is_nullable,
  CASE 
    WHEN column_default IS NOT NULL THEN column_default::text
    ELSE 'NULL'
  END as default_value
FROM information_schema.columns
WHERE table_name = 'simple_orders'
  AND table_schema = 'public'
ORDER BY ordinal_position;

-- =====================================================
-- MIGRATION COMPLETE
-- =====================================================
-- Added 13 columns to simple_orders:
-- Customer fields: customer_id, stripe_customer_id, customer_name, customer_phone, shipping_address, billing_address
-- Config fields: items, config_json, preview_image_url, bom_json, price_breakdown_json, metadata, stripe_checkout_session_id
-- =====================================================
