-- Add shipping_region field to admin_orders table
-- Values: 'DE' (Germany), 'EU' (EU countries), 'INT' (International)

ALTER TABLE admin_orders 
ADD COLUMN shipping_region VARCHAR(10);

-- Create index for faster filtering by region
CREATE INDEX idx_orders_shipping_region ON admin_orders(shipping_region);

-- Optional: Backfill existing orders based on shipping_address country
-- This can be run separately if needed
-- UPDATE admin_orders 
-- SET shipping_region = CASE 
--   WHEN shipping_address->>'country' = 'DE' THEN 'DE'
--   WHEN shipping_address->>'country' IN ('AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'GR', 'HU', 'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL', 'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE') THEN 'EU'
--   ELSE 'INT'
-- END
-- WHERE shipping_region IS NULL AND shipping_address IS NOT NULL;
