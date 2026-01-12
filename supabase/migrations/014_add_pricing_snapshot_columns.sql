-- =====================================================
-- Migration 014: Add Pricing Snapshot Traceability Columns
-- =====================================================
-- Description: Adds explicit columns for pricing snapshot tracking
--              - snapshot_id: Unique ID for each pricing calculation
--              - trace_id: Request trace ID for debugging
--              - has_snapshot: Boolean indicator (generated column)
-- 
-- Context: pricing_snapshot data is stored in price_breakdown_json,
--          but we need explicit trace columns for debugging and admin UI
-- =====================================================

-- 1) Add snapshot_id column (UUID for each snapshot)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'simple_orders' 
    AND column_name = 'snapshot_id'
    AND table_schema = 'public'
  ) THEN
    ALTER TABLE public.simple_orders ADD COLUMN snapshot_id TEXT;
    CREATE INDEX IF NOT EXISTS idx_simple_orders_snapshot_id ON public.simple_orders(snapshot_id);
    COMMENT ON COLUMN public.simple_orders.snapshot_id IS 'Pricing snapshot unique ID (from metadata.snapshot_id)';
    RAISE NOTICE 'Added snapshot_id column to simple_orders';
  ELSE
    RAISE NOTICE 'snapshot_id column already exists in simple_orders';
  END IF;
END $$;

-- 2) Add trace_id column (UUID for request tracing)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'simple_orders' 
    AND column_name = 'trace_id'
    AND table_schema = 'public'
  ) THEN
    ALTER TABLE public.simple_orders ADD COLUMN trace_id TEXT;
    CREATE INDEX IF NOT EXISTS idx_simple_orders_trace_id ON public.simple_orders(trace_id);
    COMMENT ON COLUMN public.simple_orders.trace_id IS 'Request trace ID for debugging (from metadata.trace_id)';
    RAISE NOTICE 'Added trace_id column to simple_orders';
  ELSE
    RAISE NOTICE 'trace_id column already exists in simple_orders';
  END IF;
END $$;

-- 3) Add has_snapshot boolean (virtual/generated column)
-- This is a convenience field that checks if price_breakdown_json exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'simple_orders' 
    AND column_name = 'has_snapshot'
    AND table_schema = 'public'
  ) THEN
    -- Note: PostgreSQL 12+ supports GENERATED columns
    -- Fallback: Use a regular boolean column with triggers if needed
    ALTER TABLE public.simple_orders ADD COLUMN has_snapshot BOOLEAN 
      GENERATED ALWAYS AS (price_breakdown_json IS NOT NULL) STORED;
    COMMENT ON COLUMN public.simple_orders.has_snapshot IS 'Computed: true if price_breakdown_json exists';
    RAISE NOTICE 'Added has_snapshot generated column to simple_orders';
  ELSE
    RAISE NOTICE 'has_snapshot column already exists in simple_orders';
  END IF;
EXCEPTION
  WHEN feature_not_supported THEN
    -- PostgreSQL < 12: Use regular column + trigger
    RAISE NOTICE 'GENERATED columns not supported, creating regular boolean + trigger';
    
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'simple_orders' 
      AND column_name = 'has_snapshot'
      AND table_schema = 'public'
    ) THEN
      ALTER TABLE public.simple_orders ADD COLUMN has_snapshot BOOLEAN;
      
      -- Create trigger to auto-update
      CREATE OR REPLACE FUNCTION update_has_snapshot()
      RETURNS TRIGGER AS $trigger$
      BEGIN
        NEW.has_snapshot := (NEW.price_breakdown_json IS NOT NULL);
        RETURN NEW;
      END;
      $trigger$ LANGUAGE plpgsql;
      
      DROP TRIGGER IF EXISTS trg_update_has_snapshot ON public.simple_orders;
      CREATE TRIGGER trg_update_has_snapshot
        BEFORE INSERT OR UPDATE ON public.simple_orders
        FOR EACH ROW
        EXECUTE FUNCTION update_has_snapshot();
    END IF;
END $$;

-- 4) Backfill trace_id and snapshot_id from metadata for existing orders
DO $$
DECLARE
  updated_count INTEGER;
BEGIN
  UPDATE public.simple_orders
  SET 
    trace_id = metadata->>'trace_id',
    snapshot_id = metadata->>'snapshot_id'
  WHERE 
    metadata IS NOT NULL 
    AND (
      (trace_id IS NULL AND metadata->>'trace_id' IS NOT NULL)
      OR
      (snapshot_id IS NULL AND metadata->>'snapshot_id' IS NOT NULL)
    );
  
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RAISE NOTICE 'Backfilled trace_id/snapshot_id for % existing orders', updated_count;
END $$;

-- 5) Verification query
DO $$
DECLARE
  total_orders INTEGER;
  orders_with_snapshot INTEGER;
  orders_with_trace INTEGER;
BEGIN
  SELECT COUNT(*) INTO total_orders FROM public.simple_orders;
  SELECT COUNT(*) INTO orders_with_snapshot FROM public.simple_orders WHERE has_snapshot = true;
  SELECT COUNT(*) INTO orders_with_trace FROM public.simple_orders WHERE trace_id IS NOT NULL;
  
  RAISE NOTICE '==============================================';
  RAISE NOTICE 'Migration 014: Pricing Snapshot Columns Added';
  RAISE NOTICE '==============================================';
  RAISE NOTICE 'Total orders: %', total_orders;
  RAISE NOTICE 'Orders with snapshot: % (%.1f%%)', orders_with_snapshot, 
    CASE WHEN total_orders > 0 THEN (orders_with_snapshot::FLOAT / total_orders * 100) ELSE 0 END;
  RAISE NOTICE 'Orders with trace_id: % (%.1f%%)', orders_with_trace,
    CASE WHEN total_orders > 0 THEN (orders_with_trace::FLOAT / total_orders * 100) ELSE 0 END;
  RAISE NOTICE '==============================================';
END $$;
