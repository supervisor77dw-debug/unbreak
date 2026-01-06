-- ============================================
-- VERIFICATION QUERIES - Quick Diagnostics
-- ============================================
-- Run these in Supabase SQL Editor to verify your checkout/order data
-- Replace placeholder values (xxx) with your actual IDs/emails

-- --------------------------------------------
-- QUERY 1: Check LATEST ORDER details
-- --------------------------------------------
-- Purpose: Verify config_json, items, and customer_id are stored
-- Expected: config_json should show colors {base, arm, module, pattern} for glass_holder
--           items should be JSONB array with embedded config
--           customer_id should be UUID (not NULL after backfill)

SELECT 
  id,
  customer_id,
  customer_email,
  customer_name,
  status,
  product_sku,
  quantity,
  total_amount_cents,
  -- Show config structure
  jsonb_pretty(config_json) as config_json_formatted,
  config_json->'variant' as variant,
  config_json->'colors' as colors,
  -- Show items structure
  jsonb_pretty(items) as items_formatted,
  -- Timestamps
  created_at,
  updated_at
FROM simple_orders
ORDER BY created_at DESC
LIMIT 5;

-- --------------------------------------------
-- QUERY 2: Check CUSTOMER stats (total_orders, total_spent)
-- --------------------------------------------
-- Purpose: Verify customer stats calculation includes your orders
-- Expected: total_orders > 0, total_spent_cents > 0
-- Replace 'your-email@example.com' with YOUR actual email

SELECT 
  c.id as customer_id,
  c.email,
  c.name,
  c.stripe_customer_id,
  c.created_at as customer_since,
  -- Count ALL orders (both linkage types)
  COUNT(DISTINCT o.id) as total_orders,
  -- Sum total spent
  COALESCE(SUM(o.total_amount_cents), 0) as total_spent_cents,
  COALESCE(SUM(o.total_amount_cents) / 100.0, 0) as total_spent_eur,
  -- Latest order date
  MAX(o.created_at) as last_order_date,
  -- Breakdown by linkage type
  COUNT(DISTINCT CASE WHEN o.customer_id = c.id THEN o.id END) as orders_via_customer_id,
  COUNT(DISTINCT CASE WHEN o.customer_id IS NULL AND lower(o.customer_email) = lower(c.email) THEN o.id END) as orders_via_email_fallback
FROM customers c
LEFT JOIN simple_orders o ON (
  o.customer_id = c.id 
  OR (o.customer_id IS NULL AND lower(o.customer_email) = lower(c.email))
)
WHERE lower(c.email) = lower('your-email@example.com')  -- ← REPLACE THIS
GROUP BY c.id, c.email, c.name, c.stripe_customer_id, c.created_at;

-- --------------------------------------------
-- QUERY 3: Check ORPHANED orders (missing customer_id)
-- --------------------------------------------
-- Purpose: Find orders without customer linkage (should be 0 after backfill)
-- Expected: After backfill, this should return 0 rows (or only anonymous orders)

SELECT 
  o.id,
  o.customer_email,
  o.customer_name,
  o.status,
  o.total_amount_cents / 100.0 as total_eur,
  o.created_at,
  -- Check if customer exists with matching email
  CASE 
    WHEN c.id IS NOT NULL THEN '⚠️ EMAIL MATCH FOUND - run backfill'
    WHEN o.customer_email IS NULL THEN '✓ Anonymous order (OK)'
    ELSE '⚠️ No customer match - investigate'
  END as linkage_status,
  c.id as matching_customer_id
FROM simple_orders o
LEFT JOIN customers c ON lower(o.customer_email) = lower(c.email)
WHERE o.customer_id IS NULL
ORDER BY o.created_at DESC;

-- --------------------------------------------
-- QUERY 4: SUMMARY stats across ALL orders
-- --------------------------------------------
-- Purpose: Overview of data integrity
-- Expected: 
--   - orders_with_customer_id should increase after backfill
--   - config_json_present should be 100% for configured products
--   - items_present should be 100% for all orders

SELECT 
  COUNT(*) as total_orders,
  COUNT(customer_id) as orders_with_customer_id,
  COUNT(*) - COUNT(customer_id) as orders_missing_customer_id,
  COUNT(config_json) as orders_with_config_json,
  COUNT(items) as orders_with_items,
  COUNT(DISTINCT customer_email) as unique_customer_emails,
  COUNT(DISTINCT customer_id) as unique_customer_ids,
  MIN(created_at) as first_order,
  MAX(created_at) as last_order,
  SUM(total_amount_cents) / 100.0 as total_revenue_eur
FROM simple_orders;
