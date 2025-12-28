-- ============================================================
-- UNBREAK ONE - Additional Bundle Products
-- ============================================================
-- Adds 2 more bundle options to the shop
-- ============================================================

-- Bundle 2: 2 Glashalter + 1 Flaschenhalter (bereits vorhanden als Premium Set)
-- Bundle 3: 4 Glashalter + 2 Flaschenhalter
-- Bundle 4: Gastro Edition (größeres Bundle)

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
    'UO-BUNDLE-GASTRO',
    'Gastro Edition',
    '4 Glashalter & 2 Flaschenhalter für die professionelle Gastronomie',
    'Komplettes Gastro-Set: 4 magnetische Weinglashalter und 2 Flaschenhalter. Ideal für Restaurants und Bars. Made in Germany. Inkl. Montagematerial.',
    29900, -- 299.00 EUR (Einzelpreis wäre 394 EUR, ca. 24% Rabatt)
    'EUR',
    '/images/products/premium-set.jpg',
    true,
    4
  ),
  (
    'UO-BUNDLE-STARTER',
    'Starter Bundle',
    '2 Glashalter für den perfekten Einstieg',
    'Kompaktes Starter-Set: 2 magnetische Weinglashalter. Perfekt für kleine Küchen oder als Geschenk. Made in Germany. Inkl. Montagematerial.',
    10900, -- 109.00 EUR (Einzelpreis wäre 118 EUR, ca. 8% Rabatt)
    'EUR',
    '/images/products/glass-holder.jpg',
    true,
    5
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

-- Verify all products
SELECT
  sku,
  name,
  short_description_de,
  base_price_cents / 100.0 as price_eur,
  active,
  sort_order
FROM products
ORDER BY sort_order;

-- ============================================================
-- Expected Products After This Migration:
-- ============================================================
-- 1. Premium Set (2 Glas + 1 Flasche) - 149 EUR
-- 2. Weinglashalter (einzeln) - 59 EUR
-- 3. Flaschenhalter (einzeln) - 79 EUR
-- 4. Gastro Edition (4 Glas + 2 Flasche) - 299 EUR
-- 5. Starter Bundle (2 Glas) - 109 EUR
-- ============================================================
