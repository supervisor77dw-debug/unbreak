/**
 * P0 FIX: Update configurator product prices to match user expectations
 * 
 * Current DB prices (WRONG):
 * - UNBREAK-GLAS-01: €49.90 (4990 cents)
 * - UNBREAK-WEIN-01: €59.90 (5990 cents)
 * 
 * Expected prices (USER REQUIREMENT):
 * - UNBREAK-GLAS-01: €19.90 (1990 cents) - Glashalter
 * - UNBREAK-WEIN-01: €24.90 (2490 cents) - Flaschenhalter
 */

-- Update Glashalter price
UPDATE products 
SET base_price_cents = 1990
WHERE sku = 'UNBREAK-GLAS-01';

-- Update Flaschenhalter price  
UPDATE products
SET base_price_cents = 2490
WHERE sku = 'UNBREAK-WEIN-01';

-- Verify changes
SELECT sku, name, base_price_cents 
FROM products 
WHERE sku IN ('UNBREAK-GLAS-01', 'UNBREAK-WEIN-01');
