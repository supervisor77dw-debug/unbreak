-- ============================================================
-- UNBREAK ONE - Products Seed Data
-- ============================================================
-- Run this in Supabase SQL Editor to create initial products
-- Inserts 3 initial products into the products table
-- ============================================================

-- Ensure products table exists (from schema.sql)
-- If it doesn't exist yet, you need to run the full schema first

-- Insert 3 Initial Products
INSERT INTO products (
  sku,
  name,
  short_description_de,
  description,
  base_price_cents,
  currency,
  image_url,
  active,
  sort_order
) VALUES 
  (
    'UO-PREMIUM-SET',
    'Premium Set',
    'Starter-Set mit 2 Glashaltern & 1 Flaschenhalter',
    'Perfektes Einsteiger-Set: 2 magnetische Weinglashalter und 1 Flaschenhalter. Made in Germany. Inkl. Montagematerial.',
    14900, -- 149.00 EUR
    'EUR',
    '/images/products/premium-set.jpg',
    true,
    1
  ),
  (
    'UO-GLASS-HOLDER',
    'Weinglashalter',
    'Einzelner magnetischer Weinglashalter',
    'Magnetischer Halter für Weingläser. Hält bis zu 3 Gläser sicher unter dem Tisch oder Regal. Made in Germany.',
    5900, -- 59.00 EUR
    'EUR',
    '/images/products/glass-holder.jpg',
    true,
    2
  ),
  (
    'UO-BOTTLE-HOLDER',
    'Flaschenhalter',
    'Einzelner magnetischer Flaschenhalter',
    'Magnetischer Halter für Weinflaschen. Platzsparende Aufbewahrung. Hält bis zu 1,5 kg sicher. Made in Germany.',
    7900, -- 79.00 EUR
    'EUR',
    '/images/products/bottle-holder.jpg',
    true,
    3
  )
ON CONFLICT (sku) DO UPDATE SET
  name = EXCLUDED.name,
  short_description_de = EXCLUDED.short_description_de,
  description = EXCLUDED.description,
  base_price_cents = EXCLUDED.base_price_cents,
  image_url = EXCLUDED.image_url,
  active = EXCLUDED.active,
  sort_order = EXCLUDED.sort_order,
  updated_at = NOW();

-- Verify insertion
SELECT 
  sku,
  name,
  base_price_cents / 100.0 as price_eur,
  active,
  sort_order
FROM products
ORDER BY sort_order;

-- ============================================================
-- Expected Result:
-- ============================================================
-- sku                | name             | price_eur | active | sort_order
-- -------------------+------------------+-----------+--------+------------
-- UO-PREMIUM-SET     | Premium Set      | 149.00    | true   | 1
-- UO-GLASS-HOLDER    | Weinglashalter   | 59.00     | true   | 2
-- UO-BOTTLE-HOLDER   | Flaschenhalter   | 79.00     | true   | 3
-- ============================================================
