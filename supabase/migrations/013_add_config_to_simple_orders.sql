-- =====================================================
-- Migration 013: Add Config + Items to Simple Orders
-- =====================================================
-- Description: Adds configurator data fields to simple_orders
--              to support configured products and better tracking
-- =====================================================

-- 1) Add items column (JSONB array for line items)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'simple_orders' 
    AND column_name = 'items'
    AND table_schema = 'public'
  ) THEN
    ALTER TABLE public.simple_orders ADD COLUMN items JSONB DEFAULT '[]';
    COMMENT ON COLUMN public.simple_orders.items IS 'Array of order items with product details and configs';
  END IF;
END $$;

-- 2) Add config_json column (for backward compatibility / direct access)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'simple_orders' 
    AND column_name = 'config_json'
    AND table_schema = 'public'
  ) THEN
    ALTER TABLE public.simple_orders ADD COLUMN config_json JSONB;
    COMMENT ON COLUMN public.simple_orders.config_json IS 'Product configuration (color, finish, etc.)';
  END IF;
END $$;

-- 3) Add preview_image_url column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'simple_orders' 
    AND column_name = 'preview_image_url'
    AND table_schema = 'public'
  ) THEN
    ALTER TABLE public.simple_orders ADD COLUMN preview_image_url TEXT;
    COMMENT ON COLUMN public.simple_orders.preview_image_url IS 'URL to configuration preview image';
  END IF;
END $$;

-- 4) Add bom_json column (Bill of Materials)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'simple_orders' 
    AND column_name = 'bom_json'
    AND table_schema = 'public'
  ) THEN
    ALTER TABLE public.simple_orders ADD COLUMN bom_json JSONB;
    COMMENT ON COLUMN public.simple_orders.bom_json IS 'Bill of materials for configured products';
  END IF;
END $$;

-- 5) Add price_breakdown_json column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'simple_orders' 
    AND column_name = 'price_breakdown_json'
    AND table_schema = 'public'
  ) THEN
    ALTER TABLE public.simple_orders ADD COLUMN price_breakdown_json JSONB;
    COMMENT ON COLUMN public.simple_orders.price_breakdown_json IS 'Detailed price breakdown (base, options, shipping, tax)';
  END IF;
END $$;

-- 6) Add metadata column (flexible key-value store)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'simple_orders' 
    AND column_name = 'metadata'
    AND table_schema = 'public'
  ) THEN
    ALTER TABLE public.simple_orders ADD COLUMN metadata JSONB DEFAULT '{}';
    COMMENT ON COLUMN public.simple_orders.metadata IS 'Additional metadata (utm, referrer, notes, etc.)';
  END IF;
END $$;

-- 7) Add stripe_checkout_session_id column (separate from stripe_session_id for clarity)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'simple_orders' 
    AND column_name = 'stripe_checkout_session_id'
    AND table_schema = 'public'
  ) THEN
    ALTER TABLE public.simple_orders ADD COLUMN stripe_checkout_session_id TEXT UNIQUE;
    CREATE INDEX idx_simple_orders_stripe_checkout_session_id ON public.simple_orders(stripe_checkout_session_id);
    COMMENT ON COLUMN public.simple_orders.stripe_checkout_session_id IS 'Stripe Checkout Session ID (cs_xxx)';
  END IF;
END $$;

-- =====================================================
-- Migration complete
-- =====================================================
-- Added columns:
-- - items: JSONB array for line items with config
-- - config_json: Direct config storage
-- - preview_image_url: Preview image URL
-- - bom_json: Bill of materials
-- - price_breakdown_json: Price details
-- - metadata: Additional metadata
-- - stripe_checkout_session_id: Separate checkout session tracking
-- =====================================================
