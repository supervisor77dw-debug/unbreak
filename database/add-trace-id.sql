-- =====================================================
-- ADD TRACE_ID TO ORDERS TABLE
-- =====================================================
-- Adds trace_id column for end-to-end debugging
-- Safe to run multiple times
-- =====================================================

-- Add trace_id column to orders table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'orders' 
    AND column_name = 'trace_id' 
    AND table_schema = 'public'
  ) THEN
    ALTER TABLE public.orders ADD COLUMN trace_id TEXT;
    CREATE INDEX idx_orders_trace_id ON public.orders(trace_id);
    COMMENT ON COLUMN public.orders.trace_id IS 'Correlation ID for end-to-end tracing';
    RAISE NOTICE '✅ Added trace_id to orders';
  ELSE
    RAISE NOTICE '⚠️  trace_id already exists in orders';
  END IF;
END $$;

-- Add trace_id to simple_orders table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'simple_orders' 
    AND column_name = 'trace_id' 
    AND table_schema = 'public'
  ) THEN
    ALTER TABLE public.simple_orders ADD COLUMN trace_id TEXT;
    CREATE INDEX idx_simple_orders_trace_id ON public.simple_orders(trace_id);
    COMMENT ON COLUMN public.simple_orders.trace_id IS 'Correlation ID for end-to-end tracing';
    RAISE NOTICE '✅ Added trace_id to simple_orders';
  ELSE
    RAISE NOTICE '⚠️  trace_id already exists in simple_orders';
  END IF;
END $$;

-- Verification
SELECT 
  table_name,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN ('orders', 'simple_orders')
  AND column_name = 'trace_id';

-- =====================================================
-- MIGRATION COMPLETE
-- =====================================================
