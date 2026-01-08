-- Shipping Rates Table
-- Enables country-specific shipping costs that can be edited in admin panel

CREATE TABLE IF NOT EXISTS public.shipping_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  country_code VARCHAR(10) NOT NULL, -- e.g., "DE", "EU", "INT", "WORLD"
  label_de VARCHAR(100) NOT NULL, -- e.g., "Deutschland"
  label_en VARCHAR(100) NOT NULL, -- e.g., "Germany"
  price_net INTEGER NOT NULL DEFAULT 0, -- Shipping cost in cents (net, excluding VAT)
  active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0, -- For display ordering
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_shipping_rates_active ON public.shipping_rates(active);
CREATE INDEX IF NOT EXISTS idx_shipping_rates_sort ON public.shipping_rates(sort_order);

-- Seed with default German shipping rates
INSERT INTO public.shipping_rates (country_code, label_de, label_en, price_net, active, sort_order)
VALUES 
  ('DE', 'Deutschland', 'Germany', 490, true, 1),
  ('EU', 'EU-Ausland', 'EU Countries', 990, true, 2),
  ('INT', 'International', 'International', 1990, true, 3)
ON CONFLICT DO NOTHING;

COMMENT ON TABLE public.shipping_rates IS 'Country-specific shipping rates (net prices in cents)';
COMMENT ON COLUMN public.shipping_rates.price_net IS 'Shipping cost in cents, excluding VAT';
COMMENT ON COLUMN public.shipping_rates.country_code IS 'ISO country code or zone (DE, EU, INT, etc.)';
