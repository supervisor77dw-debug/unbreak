-- =====================================================
-- PRODUCTION DEPLOYMENT: Pricing Snapshot Schema Fix
-- =====================================================
-- Execute this in Supabase SQL Editor (Production DB)
-- =====================================================

-- Step 1: Verify current schema
SELECT 
  column_name, 
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'simple_orders'
  AND column_name IN ('price_breakdown_json', 'metadata', 'snapshot_id', 'trace_id', 'has_snapshot')
ORDER BY column_name;

-- Expected BEFORE migration:
-- price_breakdown_json | jsonb | YES
-- metadata | jsonb | YES
-- (snapshot_id, trace_id, has_snapshot should NOT exist yet)

-- =====================================================
-- Step 2: Run Migration 014
-- =====================================================
-- Copy-paste the ENTIRE content of:
-- supabase/migrations/014_add_pricing_snapshot_columns.sql

-- Or if you prefer, run it directly here:

-- Add snapshot_id column
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

-- Add trace_id column
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

-- Add has_snapshot boolean (generated column or trigger-based)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'simple_orders' 
    AND column_name = 'has_snapshot'
    AND table_schema = 'public'
  ) THEN
    -- Try GENERATED column first (PostgreSQL 12+)
    BEGIN
      ALTER TABLE public.simple_orders ADD COLUMN has_snapshot BOOLEAN 
        GENERATED ALWAYS AS (price_breakdown_json IS NOT NULL) STORED;
      COMMENT ON COLUMN public.simple_orders.has_snapshot IS 'Computed: true if price_breakdown_json exists';
      RAISE NOTICE 'Added has_snapshot generated column to simple_orders';
    EXCEPTION
      WHEN feature_not_supported THEN
        -- Fallback for PostgreSQL < 12: Regular column + trigger
        RAISE NOTICE 'GENERATED columns not supported, creating regular boolean + trigger';
        
        ALTER TABLE public.simple_orders ADD COLUMN has_snapshot BOOLEAN;
        
        -- Create trigger function
        CREATE OR REPLACE FUNCTION update_has_snapshot()
        RETURNS TRIGGER AS $trigger$
        BEGIN
          NEW.has_snapshot := (NEW.price_breakdown_json IS NOT NULL);
          RETURN NEW;
        END;
        $trigger$ LANGUAGE plpgsql;
        
        -- Create trigger
        DROP TRIGGER IF EXISTS trg_update_has_snapshot ON public.simple_orders;
        CREATE TRIGGER trg_update_has_snapshot
          BEFORE INSERT OR UPDATE ON public.simple_orders
          FOR EACH ROW
          EXECUTE FUNCTION update_has_snapshot();
        
        RAISE NOTICE 'Created trigger-based has_snapshot column';
    END;
  ELSE
    RAISE NOTICE 'has_snapshot column already exists in simple_orders';
  END IF;
END $$;

-- =====================================================
-- Step 3: Backfill existing orders
-- =====================================================
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

-- =====================================================
-- Step 4: Verify Migration Success
-- =====================================================
SELECT 
  column_name, 
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'simple_orders'
  AND column_name IN ('price_breakdown_json', 'metadata', 'snapshot_id', 'trace_id', 'has_snapshot')
ORDER BY column_name;

-- Expected AFTER migration:
-- has_snapshot         | boolean | YES/NO (depending on GENERATED vs trigger)
-- metadata             | jsonb   | YES
-- price_breakdown_json | jsonb   | YES
-- snapshot_id          | text    | YES
-- trace_id             | text    | YES

-- =====================================================
-- Step 5: Test with Recent Orders
-- =====================================================
SELECT 
  id,
  created_at,
  has_snapshot,
  trace_id,
  snapshot_id,
  price_breakdown_json IS NOT NULL AS has_price_json,
  metadata->>'trace_id' AS meta_trace_id,
  metadata->>'snapshot_id' AS meta_snapshot_id
FROM public.simple_orders
ORDER BY created_at DESC
LIMIT 5;

-- =====================================================
-- Step 6: Statistics
-- =====================================================
SELECT
  COUNT(*) AS total_orders,
  COUNT(CASE WHEN has_snapshot = true THEN 1 END) AS orders_with_snapshot,
  COUNT(CASE WHEN trace_id IS NOT NULL THEN 1 END) AS orders_with_trace,
  COUNT(CASE WHEN snapshot_id IS NOT NULL THEN 1 END) AS orders_with_snapshot_id,
  ROUND(
    100.0 * COUNT(CASE WHEN has_snapshot = true THEN 1 END) / NULLIF(COUNT(*), 0),
    1
  ) AS snapshot_percentage
FROM public.simple_orders;

-- Expected Result:
-- - Old orders (before 2026-01-12): has_snapshot = false (or NULL), no trace_id
-- - New orders (after 2026-01-12): has_snapshot = true, trace_id present

-- =====================================================
-- MIGRATION COMPLETE ✅
-- =====================================================
-- Next: Deploy new code to Vercel
-- Then: Create test order and verify snapshot is saved
-- =====================================================
