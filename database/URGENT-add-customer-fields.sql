-- =====================================================
-- MIGRATION QUICK-FIX: Add missing customer fields to simple_orders
-- =====================================================
-- This adds customer_id and other fields that should have been added by migration 008
-- Run this IMMEDIATELY in Supabase SQL Editor
-- =====================================================

-- 1) Add customer_id column (FK to customers table)
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
    RAISE NOTICE 'Added customer_id column';
  ELSE
    RAISE NOTICE 'customer_id column already exists';
  END IF;
END $$;

-- 2) Add stripe_customer_id column (already might exist from migration 012)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'simple_orders' 
    AND column_name = 'stripe_customer_id'
    AND table_schema = 'public'
  ) THEN
    ALTER TABLE public.simple_orders ADD COLUMN stripe_customer_id TEXT;
    CREATE INDEX idx_simple_orders_stripe_customer_id ON public.simple_orders(stripe_customer_id);
    RAISE NOTICE 'Added stripe_customer_id column';
  ELSE
    RAISE NOTICE 'stripe_customer_id column already exists';
  END IF;
END $$;

-- 3) Add customer_name column (from migration 012)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'simple_orders' 
    AND column_name = 'customer_name'
    AND table_schema = 'public'
  ) THEN
    ALTER TABLE public.simple_orders ADD COLUMN customer_name TEXT;
    RAISE NOTICE 'Added customer_name column';
  ELSE
    RAISE NOTICE 'customer_name column already exists';
  END IF;
END $$;

-- 4) Add customer_phone column (from migration 012)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'simple_orders' 
    AND column_name = 'customer_phone'
    AND table_schema = 'public'
  ) THEN
    ALTER TABLE public.simple_orders ADD COLUMN customer_phone TEXT;
    RAISE NOTICE 'Added customer_phone column';
  ELSE
    RAISE NOTICE 'customer_phone column already exists';
  END IF;
END $$;

-- 5) Add shipping_address column (from migration 012)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'simple_orders' 
    AND column_name = 'shipping_address'
    AND table_schema = 'public'
  ) THEN
    ALTER TABLE public.simple_orders ADD COLUMN shipping_address JSONB;
    RAISE NOTICE 'Added shipping_address column';
  ELSE
    RAISE NOTICE 'shipping_address column already exists';
  END IF;
END $$;

-- 6) Add billing_address column (from migration 012)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'simple_orders' 
    AND column_name = 'billing_address'
    AND table_schema = 'public'
  ) THEN
    ALTER TABLE public.simple_orders ADD COLUMN billing_address JSONB;
    RAISE NOTICE 'Added billing_address column';
  ELSE
    RAISE NOTICE 'billing_address column already exists';
  END IF;
END $$;

-- Verify the changes
SELECT 
  column_name, 
  data_type, 
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'simple_orders'
  AND table_schema = 'public'
  AND column_name IN (
    'customer_id', 
    'stripe_customer_id', 
    'customer_name', 
    'customer_phone',
    'shipping_address',
    'billing_address'
  )
ORDER BY column_name;
