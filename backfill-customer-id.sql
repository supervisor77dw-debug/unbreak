-- ============================================
-- BACKFILL: Link existing simple_orders to customers
-- ============================================
-- Purpose: Set customer_id for orders where it's NULL but email matches
-- Execution: Run in Supabase SQL Editor
-- Safety: Uses WHERE customer_id IS NULL to avoid overwriting existing links

-- BEFORE running: Verify orders missing customer_id
SELECT 
  COUNT(*) as orders_missing_customer_id,
  COUNT(DISTINCT customer_email) as unique_emails
FROM simple_orders
WHERE customer_id IS NULL
  AND customer_email IS NOT NULL;

-- BACKFILL UPDATE: Match by email (case-insensitive)
UPDATE simple_orders
SET customer_id = customers.id
FROM customers
WHERE simple_orders.customer_id IS NULL
  AND simple_orders.customer_email IS NOT NULL
  AND lower(simple_orders.customer_email) = lower(customers.email);

-- AFTER running: Verify results
SELECT 
  COUNT(*) as total_orders,
  COUNT(customer_id) as orders_with_customer_id,
  COUNT(*) - COUNT(customer_id) as orders_still_missing
FROM simple_orders;

-- ============================================
-- VERIFICATION QUERIES (requested by user)
-- ============================================

-- QUERY 1: Check specific order (replace 'xxx' with actual order ID)
SELECT 
  id,
  customer_id,
  customer_email,
  customer_name,
  status,
  total_amount_cents,
  config_json,
  items,
  created_at
FROM simple_orders
WHERE id = 'xxx';  -- Replace with your order ID

-- QUERY 2: Check customer stats (replace 'xxx' with customer ID or email)
SELECT 
  c.id as customer_id,
  c.email,
  c.name,
  c.stripe_customer_id,
  COUNT(o.id) as total_orders,
  SUM(o.total_amount_cents) as total_spent_cents,
  MAX(o.created_at) as last_order_date
FROM customers c
LEFT JOIN simple_orders o ON (
  o.customer_id = c.id 
  OR lower(o.customer_email) = lower(c.email)
)
WHERE c.id = 'xxx'  -- Replace with customer ID
  OR lower(c.email) = lower('xxx')  -- OR replace with email
GROUP BY c.id, c.email, c.name, c.stripe_customer_id;

-- QUERY 3: Find orders without customer linkage (orphaned orders)
SELECT 
  o.id,
  o.customer_email,
  o.customer_name,
  o.status,
  o.total_amount_cents,
  o.created_at,
  CASE 
    WHEN c.id IS NOT NULL THEN 'Email match found'
    ELSE 'No customer match'
  END as match_status
FROM simple_orders o
LEFT JOIN customers c ON lower(o.customer_email) = lower(c.email)
WHERE o.customer_id IS NULL
  AND o.customer_email IS NOT NULL
ORDER BY o.created_at DESC;
