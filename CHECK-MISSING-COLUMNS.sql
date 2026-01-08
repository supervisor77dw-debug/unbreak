-- CHECK: Which columns are missing from admin_orders?
-- Run this to diagnose the issue

-- 1. List ALL columns in admin_orders
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'admin_orders'
ORDER BY ordinal_position;

-- 2. Check for specific columns that might be missing
SELECT 
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'admin_orders' AND column_name = 'shipping_region'
  ) THEN '✅ shipping_region exists' 
  ELSE '❌ shipping_region MISSING' END AS shipping_region_status,
  
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'admin_orders' AND column_name = 'subtotal_net'
  ) THEN '✅ subtotal_net exists' 
  ELSE '❌ subtotal_net MISSING' END AS subtotal_net_status,
  
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'admin_orders' AND column_name = 'tax_rate'
  ) THEN '✅ tax_rate exists' 
  ELSE '❌ tax_rate MISSING' END AS tax_rate_status,
  
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'admin_orders' AND column_name = 'tax_amount'
  ) THEN '✅ tax_amount exists' 
  ELSE '❌ tax_amount MISSING' END AS tax_amount_status,
  
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'admin_orders' AND column_name = 'total_gross'
  ) THEN '✅ total_gross exists' 
  ELSE '❌ total_gross MISSING' END AS total_gross_status,
  
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'admin_orders' AND column_name = 'config_json'
  ) THEN '✅ config_json exists' 
  ELSE '❌ config_json MISSING' END AS config_json_status;
