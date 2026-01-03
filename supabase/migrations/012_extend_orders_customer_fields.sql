-- =====================================================
-- Migration 012: Extend Orders with Customer Fields
-- =====================================================
-- Description: Adds customer data fields to orders/simple_orders
--              for better webhook sync and customer management
-- =====================================================

-- 1) Add missing customer fields to public.orders
DO $$
BEGIN
  -- stripe_customer_id (if not exists)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'orders' 
    AND column_name = 'stripe_customer_id'
    AND table_schema = 'public'
  ) THEN
    ALTER TABLE public.orders ADD COLUMN stripe_customer_id TEXT;
    CREATE INDEX idx_orders_stripe_customer_id ON public.orders(stripe_customer_id);
  END IF;

  -- customer_email (if not exists)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'orders' 
    AND column_name = 'customer_email'
    AND table_schema = 'public'
  ) THEN
    ALTER TABLE public.orders ADD COLUMN customer_email TEXT;
    CREATE INDEX idx_orders_customer_email ON public.orders(customer_email);
  END IF;

  -- customer_name (if not exists)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'orders' 
    AND column_name = 'customer_name'
    AND table_schema = 'public'
  ) THEN
    ALTER TABLE public.orders ADD COLUMN customer_name TEXT;
  END IF;

  -- customer_phone (if not exists)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'orders' 
    AND column_name = 'customer_phone'
    AND table_schema = 'public'
  ) THEN
    ALTER TABLE public.orders ADD COLUMN customer_phone TEXT;
  END IF;

  -- billing_address (if not exists)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'orders' 
    AND column_name = 'billing_address'
    AND table_schema = 'public'
  ) THEN
    ALTER TABLE public.orders ADD COLUMN billing_address JSONB;
  END IF;
END $$;

-- 2) Add missing customer fields to public.simple_orders
DO $$
BEGIN
  -- stripe_customer_id (already added in migration 008, but ensure it exists)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'simple_orders' 
    AND column_name = 'stripe_customer_id'
    AND table_schema = 'public'
  ) THEN
    ALTER TABLE public.simple_orders ADD COLUMN stripe_customer_id TEXT;
    CREATE INDEX idx_simple_orders_stripe_customer_id ON public.simple_orders(stripe_customer_id);
  END IF;

  -- customer_name (if not exists)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'simple_orders' 
    AND column_name = 'customer_name'
    AND table_schema = 'public'
  ) THEN
    ALTER TABLE public.simple_orders ADD COLUMN customer_name TEXT;
  END IF;

  -- customer_phone (if not exists)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'simple_orders' 
    AND column_name = 'customer_phone'
    AND table_schema = 'public'
  ) THEN
    ALTER TABLE public.simple_orders ADD COLUMN customer_phone TEXT;
  END IF;

  -- shipping_address (if not exists)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'simple_orders' 
    AND column_name = 'shipping_address'
    AND table_schema = 'public'
  ) THEN
    ALTER TABLE public.simple_orders ADD COLUMN shipping_address JSONB;
  END IF;

  -- billing_address (if not exists)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'simple_orders' 
    AND column_name = 'billing_address'
    AND table_schema = 'public'
  ) THEN
    ALTER TABLE public.simple_orders ADD COLUMN billing_address JSONB;
  END IF;
END $$;

-- 3) Update customers table: ensure shipping_address exists (rename if needed)
DO $$
BEGIN
  -- Check if default_shipping exists (old name from migration 008)
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'customers' 
    AND column_name = 'default_shipping'
    AND table_schema = 'public'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'customers' 
    AND column_name = 'shipping_address'
    AND table_schema = 'public'
  ) THEN
    -- Rename default_shipping to shipping_address
    ALTER TABLE public.customers RENAME COLUMN default_shipping TO shipping_address;
  END IF;

  -- Check if default_billing exists (old name from migration 008)
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'customers' 
    AND column_name = 'default_billing'
    AND table_schema = 'public'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'customers' 
    AND column_name = 'billing_address'
    AND table_schema = 'public'
  ) THEN
    -- Rename default_billing to billing_address
    ALTER TABLE public.customers RENAME COLUMN default_billing TO billing_address;
  END IF;
END $$;

-- 4) Add comments for documentation
COMMENT ON COLUMN public.orders.stripe_customer_id IS 'Stripe Customer ID from checkout session';
COMMENT ON COLUMN public.orders.customer_email IS 'Customer email (synced from Stripe)';
COMMENT ON COLUMN public.orders.customer_name IS 'Customer name (synced from Stripe)';
COMMENT ON COLUMN public.orders.customer_phone IS 'Customer phone (synced from Stripe)';
COMMENT ON COLUMN public.orders.billing_address IS 'Customer billing address (JSONB from Stripe)';

COMMENT ON COLUMN public.simple_orders.stripe_customer_id IS 'Stripe Customer ID from checkout session';
COMMENT ON COLUMN public.simple_orders.customer_name IS 'Customer name (synced from Stripe)';
COMMENT ON COLUMN public.simple_orders.customer_phone IS 'Customer phone (synced from Stripe)';
COMMENT ON COLUMN public.simple_orders.shipping_address IS 'Shipping address (JSONB from Stripe)';
COMMENT ON COLUMN public.simple_orders.billing_address IS 'Billing address (JSONB from Stripe)';

-- =====================================================
-- Migration complete
-- =====================================================
-- Orders tables now have:
-- - stripe_customer_id (indexed)
-- - customer_email (indexed on orders)
-- - customer_name
-- - customer_phone
-- - shipping_address (JSONB)
-- - billing_address (JSONB)
-- =====================================================
