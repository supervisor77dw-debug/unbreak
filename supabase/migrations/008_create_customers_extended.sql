-- =====================================================
-- Migration 008: Enhanced Customers Table
-- =====================================================
-- Description: Creates customers table with Stripe sync
--              Tracks customer data from Stripe webhooks
-- =====================================================

-- 1) Create customers table (enhanced version)
CREATE TABLE IF NOT EXISTS public.customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Stripe sync
  stripe_customer_id TEXT UNIQUE,
  
  -- Contact info
  email TEXT NOT NULL UNIQUE,
  name TEXT,
  phone TEXT,
  
  -- Addresses (JSONB for flexibility)
  default_shipping JSONB,
  default_billing JSONB,
  
  -- Additional metadata from Stripe
  metadata JSONB DEFAULT '{}',
  
  -- Stats (calculated fields)
  total_orders INTEGER DEFAULT 0,
  total_spent_cents BIGINT DEFAULT 0,
  last_order_at TIMESTAMPTZ,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2) Indexes for performance
CREATE INDEX IF NOT EXISTS idx_customers_email ON public.customers(email);
CREATE INDEX IF NOT EXISTS idx_customers_stripe_id ON public.customers(stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_customers_last_order ON public.customers(last_order_at DESC);
CREATE INDEX IF NOT EXISTS idx_customers_total_spent ON public.customers(total_spent_cents DESC);

-- 3) Enable RLS
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

-- 4) RLS Policies (admin-only for now, will refine later)
CREATE POLICY "Admins can view all customers"
  ON public.customers
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'ops', 'support')
    )
  );

CREATE POLICY "Admins can insert customers"
  ON public.customers
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'ops')
    )
  );

CREATE POLICY "Admins can update customers"
  ON public.customers
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'ops', 'support')
    )
  );

-- 5) Updated_at trigger
CREATE TRIGGER customers_updated_at
  BEFORE UPDATE ON public.customers
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- 6) Function to update customer stats
CREATE OR REPLACE FUNCTION public.update_customer_stats(customer_uuid UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.customers
  SET 
    total_orders = (
      SELECT COUNT(*) 
      FROM public.orders 
      WHERE customer_id = customer_uuid AND status IN ('paid', 'completed', 'shipped', 'delivered')
    ),
    total_spent_cents = (
      SELECT COALESCE(SUM(total_cents), 0)
      FROM public.orders
      WHERE customer_id = customer_uuid AND status IN ('paid', 'completed', 'shipped', 'delivered')
    ),
    last_order_at = (
      SELECT MAX(created_at)
      FROM public.orders
      WHERE customer_id = customer_uuid AND status IN ('paid', 'completed', 'shipped', 'delivered')
    ),
    updated_at = NOW()
  WHERE id = customer_uuid;
END;
$$;

-- 7) Migrate existing customers (if any)
-- This safely handles existing customer records
DO $$
BEGIN
  -- Check if customers table has old structure
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'customers' 
    AND column_name = 'email'
    AND table_schema = 'public'
  ) THEN
    -- Customers already exist, ensure they have UUIDs
    UPDATE public.customers
    SET id = gen_random_uuid()
    WHERE id IS NULL;
  END IF;
END $$;

-- 8) Add foreign key to orders (if not exists)
-- This links orders to customers
DO $$
BEGIN
  -- Add customer_id column if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'orders' 
    AND column_name = 'customer_id'
    AND table_schema = 'public'
  ) THEN
    ALTER TABLE public.orders ADD COLUMN customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL;
    CREATE INDEX idx_orders_customer_id ON public.orders(customer_id);
  END IF;

  -- Add stripe_customer_id column to orders for easier lookup
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'orders' 
    AND column_name = 'stripe_customer_id'
    AND table_schema = 'public'
  ) THEN
    ALTER TABLE public.orders ADD COLUMN stripe_customer_id TEXT;
    CREATE INDEX idx_orders_stripe_customer_id ON public.orders(stripe_customer_id);
  END IF;
END $$;

-- 9) Add customer_id to simple_orders (shop orders)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'simple_orders' 
    AND column_name = 'customer_id'
    AND table_schema = 'public'
  ) THEN
    ALTER TABLE public.simple_orders ADD COLUMN customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL;
    CREATE INDEX idx_simple_orders_customer_id ON public.simple_orders(customer_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'simple_orders' 
    AND column_name = 'stripe_customer_id'
    AND table_schema = 'public'
  ) THEN
    ALTER TABLE public.simple_orders ADD COLUMN stripe_customer_id TEXT;
    CREATE INDEX idx_simple_orders_stripe_customer_id ON public.simple_orders(stripe_customer_id);
  END IF;
END $$;

-- 10) Trigger to auto-update customer stats when order status changes
CREATE OR REPLACE FUNCTION public.handle_order_customer_stats()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Only update stats for paid/completed orders
  IF NEW.status IN ('paid', 'completed', 'shipped', 'delivered') THEN
    IF NEW.customer_id IS NOT NULL THEN
      PERFORM public.update_customer_stats(NEW.customer_id);
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger for orders
DROP TRIGGER IF EXISTS orders_update_customer_stats ON public.orders;
CREATE TRIGGER orders_update_customer_stats
  AFTER INSERT OR UPDATE OF status ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_order_customer_stats();

-- Create trigger for simple_orders
DROP TRIGGER IF EXISTS simple_orders_update_customer_stats ON public.simple_orders;
CREATE TRIGGER simple_orders_update_customer_stats
  AFTER INSERT OR UPDATE OF status ON public.simple_orders
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_order_customer_stats();

-- =====================================================
-- Migration complete
-- =====================================================
-- Customers table created with:
-- - Stripe sync (stripe_customer_id)
-- - Contact info (email, name, phone)
-- - Addresses (JSONB)
-- - Stats (total_orders, total_spent_cents, last_order_at)
-- - RLS policies (admin/ops/support access)
-- - Auto-update triggers for order stats
-- =====================================================
