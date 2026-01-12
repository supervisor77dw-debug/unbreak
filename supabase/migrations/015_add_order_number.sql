-- =====================================================
-- Migration 015: Add Order Number + Public ID
-- =====================================================
-- Description: Adds human-readable order numbers and public IDs
--              for consistent order identification across all systems
-- =====================================================

-- 1) Add order_number column (human-readable, unique)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'simple_orders' 
    AND column_name = 'order_number'
    AND table_schema = 'public'
  ) THEN
    ALTER TABLE public.simple_orders ADD COLUMN order_number TEXT UNIQUE;
    CREATE INDEX IF NOT EXISTS idx_simple_orders_order_number ON public.simple_orders(order_number);
    COMMENT ON COLUMN public.simple_orders.order_number IS 'Human-readable order number (e.g., UO-2026-000123)';
    RAISE NOTICE 'Added order_number column to simple_orders';
  ELSE
    RAISE NOTICE 'order_number column already exists in simple_orders';
  END IF;
END $$;

-- 2) Add public_id column (short 8-char ID for customer-facing display)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'simple_orders' 
    AND column_name = 'public_id'
    AND table_schema = 'public'
  ) THEN
    ALTER TABLE public.simple_orders ADD COLUMN public_id TEXT UNIQUE;
    CREATE INDEX IF NOT EXISTS idx_simple_orders_public_id ON public.simple_orders(public_id);
    COMMENT ON COLUMN public.simple_orders.public_id IS 'Short public ID (first 8 chars of UUID)';
    RAISE NOTICE 'Added public_id column to simple_orders';
  ELSE
    RAISE NOTICE 'public_id column already exists in simple_orders';
  END IF;
END $$;

-- 3) Add indexes for Stripe IDs (if not exist)
CREATE INDEX IF NOT EXISTS idx_simple_orders_stripe_session ON public.simple_orders(stripe_session_id);
CREATE INDEX IF NOT EXISTS idx_simple_orders_stripe_checkout_session ON public.simple_orders(stripe_checkout_session_id);

-- 4) Backfill public_id for existing orders (first 8 chars of UUID)
DO $$
DECLARE
  updated_count INTEGER;
BEGIN
  UPDATE public.simple_orders
  SET public_id = SUBSTRING(id::text, 1, 8)
  WHERE public_id IS NULL;
  
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RAISE NOTICE 'Backfilled public_id for % existing orders', updated_count;
END $$;

-- 5) Backfill order_number for existing orders (format: UO-YYYYMMDD-8CHAR)
-- Note: This is for legacy orders only. New orders will get sequential numbers.
DO $$
DECLARE
  updated_count INTEGER;
BEGIN
  UPDATE public.simple_orders
  SET order_number = 'UO-' || 
                     TO_CHAR(created_at, 'YYYYMMDD') || '-' || 
                     SUBSTRING(id::text, 1, 8)
  WHERE order_number IS NULL
    AND created_at IS NOT NULL;
  
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RAISE NOTICE 'Backfilled order_number for % existing orders', updated_count;
END $$;

-- 6) Create sequence for new order numbers
CREATE SEQUENCE IF NOT EXISTS order_number_seq START WITH 1;

-- 7) Create helper function to get next order number
CREATE OR REPLACE FUNCTION get_next_order_number()
RETURNS TEXT AS $$
DECLARE
  next_val BIGINT;
  year_str TEXT;
  padded_num TEXT;
BEGIN
  next_val := nextval('order_number_seq');
  year_str := TO_CHAR(CURRENT_DATE, 'YYYY');
  padded_num := LPAD(next_val::TEXT, 6, '0');
  RETURN 'UO-' || year_str || '-' || padded_num;
END;
$$ LANGUAGE plpgsql;

-- 8) Verification
DO $$
DECLARE
  total_orders INTEGER;
  orders_with_number INTEGER;
  orders_with_public_id INTEGER;
BEGIN
  SELECT COUNT(*) INTO total_orders FROM public.simple_orders;
  SELECT COUNT(*) INTO orders_with_number FROM public.simple_orders WHERE order_number IS NOT NULL;
  SELECT COUNT(*) INTO orders_with_public_id FROM public.simple_orders WHERE public_id IS NOT NULL;
  
  RAISE NOTICE '==============================================';
  RAISE NOTICE 'Migration 015: Order Numbers Added';
  RAISE NOTICE '==============================================';
  RAISE NOTICE 'Total orders: %', total_orders;
  RAISE NOTICE 'Orders with order_number: % (%.1f%%)', orders_with_number,
    CASE WHEN total_orders > 0 THEN (orders_with_number::FLOAT / total_orders * 100) ELSE 0 END;
  RAISE NOTICE 'Orders with public_id: % (%.1f%%)', orders_with_public_id,
    CASE WHEN total_orders > 0 THEN (orders_with_public_id::FLOAT / total_orders * 100) ELSE 0 END;
  RAISE NOTICE '==============================================';
END $$;
