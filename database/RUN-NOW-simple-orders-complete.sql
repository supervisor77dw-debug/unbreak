-- =====================================================
-- COMPLETE simple_orders Schema Update
-- Run this in Supabase SQL Editor NOW
-- =====================================================

-- 1) Add order_number column (human-readable)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'simple_orders' AND column_name = 'order_number' AND table_schema = 'public'
  ) THEN
    ALTER TABLE public.simple_orders ADD COLUMN order_number TEXT UNIQUE;
    CREATE INDEX IF NOT EXISTS idx_simple_orders_order_number ON public.simple_orders(order_number);
    RAISE NOTICE '✅ Added order_number column';
  ELSE
    RAISE NOTICE '⏭️ order_number already exists';
  END IF;
END $$;

-- 2) Add customer_name column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'simple_orders' AND column_name = 'customer_name' AND table_schema = 'public'
  ) THEN
    ALTER TABLE public.simple_orders ADD COLUMN customer_name TEXT;
    RAISE NOTICE '✅ Added customer_name column';
  ELSE
    RAISE NOTICE '⏭️ customer_name already exists';
  END IF;
END $$;

-- 3) Add customer_phone column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'simple_orders' AND column_name = 'customer_phone' AND table_schema = 'public'
  ) THEN
    ALTER TABLE public.simple_orders ADD COLUMN customer_phone TEXT;
    RAISE NOTICE '✅ Added customer_phone column';
  ELSE
    RAISE NOTICE '⏭️ customer_phone already exists';
  END IF;
END $$;

-- 4) Add shipping_address column (JSONB)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'simple_orders' AND column_name = 'shipping_address' AND table_schema = 'public'
  ) THEN
    ALTER TABLE public.simple_orders ADD COLUMN shipping_address JSONB;
    RAISE NOTICE '✅ Added shipping_address column';
  ELSE
    RAISE NOTICE '⏭️ shipping_address already exists';
  END IF;
END $$;

-- 5) Add billing_address column (JSONB)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'simple_orders' AND column_name = 'billing_address' AND table_schema = 'public'
  ) THEN
    ALTER TABLE public.simple_orders ADD COLUMN billing_address JSONB;
    RAISE NOTICE '✅ Added billing_address column';
  ELSE
    RAISE NOTICE '⏭️ billing_address already exists';
  END IF;
END $$;

-- 6) Add items column (JSONB array)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'simple_orders' AND column_name = 'items' AND table_schema = 'public'
  ) THEN
    ALTER TABLE public.simple_orders ADD COLUMN items JSONB DEFAULT '[]'::jsonb;
    RAISE NOTICE '✅ Added items column';
  ELSE
    RAISE NOTICE '⏭️ items already exists';
  END IF;
END $$;

-- 7) Add fulfillment_status column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'simple_orders' AND column_name = 'fulfillment_status' AND table_schema = 'public'
  ) THEN
    ALTER TABLE public.simple_orders ADD COLUMN fulfillment_status TEXT DEFAULT 'new';
    RAISE NOTICE '✅ Added fulfillment_status column';
  ELSE
    RAISE NOTICE '⏭️ fulfillment_status already exists';
  END IF;
END $$;

-- 8) Add paid_at timestamp
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'simple_orders' AND column_name = 'paid_at' AND table_schema = 'public'
  ) THEN
    ALTER TABLE public.simple_orders ADD COLUMN paid_at TIMESTAMPTZ;
    RAISE NOTICE '✅ Added paid_at column';
  ELSE
    RAISE NOTICE '⏭️ paid_at already exists';
  END IF;
END $$;

-- 9) Add email tracking columns
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'simple_orders' AND column_name = 'customer_email_sent_at' AND table_schema = 'public'
  ) THEN
    ALTER TABLE public.simple_orders ADD COLUMN customer_email_sent_at TIMESTAMPTZ;
    RAISE NOTICE '✅ Added customer_email_sent_at column';
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'simple_orders' AND column_name = 'admin_email_sent_at' AND table_schema = 'public'
  ) THEN
    ALTER TABLE public.simple_orders ADD COLUMN admin_email_sent_at TIMESTAMPTZ;
    RAISE NOTICE '✅ Added admin_email_sent_at column';
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'simple_orders' AND column_name = 'email_status' AND table_schema = 'public'
  ) THEN
    ALTER TABLE public.simple_orders ADD COLUMN email_status TEXT DEFAULT 'pending';
    RAISE NOTICE '✅ Added email_status column';
  END IF;
END $$;

-- 10) Add notes column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'simple_orders' AND column_name = 'notes' AND table_schema = 'public'
  ) THEN
    ALTER TABLE public.simple_orders ADD COLUMN notes TEXT;
    RAISE NOTICE '✅ Added notes column';
  ELSE
    RAISE NOTICE '⏭️ notes already exists';
  END IF;
END $$;

-- 11) Add subtotal and tax columns
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'simple_orders' AND column_name = 'subtotal_cents' AND table_schema = 'public'
  ) THEN
    ALTER TABLE public.simple_orders ADD COLUMN subtotal_cents INTEGER;
    RAISE NOTICE '✅ Added subtotal_cents column';
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'simple_orders' AND column_name = 'shipping_cents' AND table_schema = 'public'
  ) THEN
    ALTER TABLE public.simple_orders ADD COLUMN shipping_cents INTEGER DEFAULT 0;
    RAISE NOTICE '✅ Added shipping_cents column';
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'simple_orders' AND column_name = 'tax_cents' AND table_schema = 'public'
  ) THEN
    ALTER TABLE public.simple_orders ADD COLUMN tax_cents INTEGER DEFAULT 0;
    RAISE NOTICE '✅ Added tax_cents column';
  END IF;
END $$;

-- 12) Create sequence for order numbers (if not exists)
CREATE SEQUENCE IF NOT EXISTS simple_order_number_seq START WITH 126;

-- 13) Create function to auto-generate order numbers
CREATE OR REPLACE FUNCTION generate_simple_order_number()
RETURNS TRIGGER AS $$
DECLARE
  next_num INTEGER;
  year_str TEXT;
BEGIN
  -- Only generate if order_number is NULL
  IF NEW.order_number IS NULL THEN
    SELECT nextval('simple_order_number_seq') INTO next_num;
    year_str := TO_CHAR(NOW(), 'YYYY');
    NEW.order_number := 'UO-' || year_str || '-' || LPAD(next_num::text, 7, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 14) Create trigger for auto order number
DROP TRIGGER IF EXISTS trigger_generate_simple_order_number ON public.simple_orders;
CREATE TRIGGER trigger_generate_simple_order_number
  BEFORE INSERT ON public.simple_orders
  FOR EACH ROW
  EXECUTE FUNCTION generate_simple_order_number();

-- 15) Backfill order_number for existing orders without one
WITH numbered_orders AS (
  SELECT 
    id,
    created_at,
    ROW_NUMBER() OVER (ORDER BY created_at) as rn
  FROM public.simple_orders
  WHERE order_number IS NULL
)
UPDATE public.simple_orders s
SET order_number = 'UO-' || TO_CHAR(n.created_at, 'YYYY') || '-' || LPAD(n.rn::text, 7, '0')
FROM numbered_orders n
WHERE s.id = n.id;

-- =====================================================
-- VERIFICATION: Show current schema
-- =====================================================
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'simple_orders' AND table_schema = 'public'
ORDER BY ordinal_position;
