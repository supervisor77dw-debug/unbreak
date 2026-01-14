-- =====================================================
-- 🔥 MESSE-FIX: Customer Linking Repair
-- =====================================================
-- Description: Link all orders to customers via stripe_customer_id or email
-- Run this ONCE before Messe to fix "Customer nicht verknüpft" issues
-- =====================================================

-- Step 1: Link via stripe_customer_id (most reliable)
UPDATE simple_orders so
SET customer_id = c.id,
    updated_at = NOW()
FROM customers c
WHERE so.customer_id IS NULL
  AND so.stripe_customer_id IS NOT NULL
  AND c.stripe_customer_id = so.stripe_customer_id;

-- Step 2: Link via email (fallback, only if unique match)
UPDATE simple_orders so
SET customer_id = c.id,
    updated_at = NOW()
FROM customers c
WHERE so.customer_id IS NULL
  AND so.customer_email IS NOT NULL
  AND c.email = so.customer_email
  AND NOT EXISTS (
    -- Ensure email is unique (don't link if multiple customers with same email)
    SELECT 1 FROM customers c2 
    WHERE c2.email = so.customer_email 
    AND c2.id != c.id
  );

-- Verification: Show stats
SELECT 
  COUNT(*) as total_orders,
  COUNT(customer_id) as orders_with_customer,
  COUNT(*) FILTER (WHERE customer_id IS NULL) as orders_without_customer,
  ROUND(COUNT(customer_id)::NUMERIC / COUNT(*) * 100, 1) as customer_link_percentage
FROM simple_orders
WHERE order_number IS NOT NULL; -- Only count visible orders

-- Show orders still without customer (for manual review)
SELECT 
  order_number,
  id,
  customer_email,
  stripe_customer_id,
  created_at
FROM simple_orders
WHERE customer_id IS NULL
  AND order_number IS NOT NULL
ORDER BY created_at DESC
LIMIT 10;
