-- Create pricing_configs table
CREATE TABLE IF NOT EXISTS public.pricing_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  variant TEXT NOT NULL,
  base_price_cents INTEGER NOT NULL,
  color_prices JSONB NOT NULL DEFAULT '{}'::jsonb,
  finish_prices JSONB NOT NULL DEFAULT '{}'::jsonb,
  arm_prices JSONB DEFAULT NULL,
  module_prices JSONB DEFAULT NULL,
  pattern_prices JSONB DEFAULT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  version TEXT NOT NULL DEFAULT '2026-01-v1',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create unique constraint to ensure only one active config per variant
CREATE UNIQUE INDEX IF NOT EXISTS pricing_configs_variant_active_key 
  ON public.pricing_configs (variant, active) 
  WHERE active = TRUE;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS pricing_configs_variant_idx ON public.pricing_configs (variant);
CREATE INDEX IF NOT EXISTS pricing_configs_active_idx ON public.pricing_configs (active);
