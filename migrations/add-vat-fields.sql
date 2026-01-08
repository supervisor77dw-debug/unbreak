-- Add VAT and proper totals to admin_orders
-- These fields enable proper invoice generation with German tax requirements

ALTER TABLE public.admin_orders 
  ADD COLUMN IF NOT EXISTS subtotal_net INTEGER, -- Netto-Summe Produkte (ohne MwSt, ohne Versand)
  ADD COLUMN IF NOT EXISTS tax_rate DECIMAL(5,4) DEFAULT 0.19, -- MwSt-Satz (0.19 = 19%)
  ADD COLUMN IF NOT EXISTS tax_amount INTEGER, -- MwSt-Betrag in Cents
  ADD COLUMN IF NOT EXISTS total_gross INTEGER; -- Brutto-Gesamtsumme (Netto + MwSt + Versand)

COMMENT ON COLUMN public.admin_orders.subtotal_net IS 'Netto product subtotal in cents (excluding tax and shipping)';
COMMENT ON COLUMN public.admin_orders.tax_rate IS 'Tax rate applied (e.g., 0.19 for 19% German VAT)';
COMMENT ON COLUMN public.admin_orders.tax_amount IS 'Calculated tax amount in cents (subtotal_net + shipping) * tax_rate';
COMMENT ON COLUMN public.admin_orders.total_gross IS 'Gross total in cents: subtotal_net + tax_amount + amount_shipping';

-- Backfill existing orders with calculated values
-- For existing orders: amount_total was gross, so we reverse-calculate net
UPDATE public.admin_orders
SET 
  subtotal_net = ROUND(amount_total / 1.19), -- Assuming 19% VAT was included
  tax_rate = 0.19,
  tax_amount = amount_total - ROUND(amount_total / 1.19),
  total_gross = amount_total
WHERE subtotal_net IS NULL;
