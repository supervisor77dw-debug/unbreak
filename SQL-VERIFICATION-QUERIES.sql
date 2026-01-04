# SQL VERIFICATION QUERIES
# For manual execution in Supabase SQL Editor
# Replace <TRACE_ID> and <EMAIL> with actual values from test

-- =====================================================
-- QUERY 1: Find Order by Trace ID
-- =====================================================
-- Purpose: Verify order was created with correct config
-- Expected: 1 row with trace_id, config_json containing colors object

SELECT 
  id,
  trace_id,
  status,
  customer_email,
  customer_name,
  customer_id,
  stripe_customer_id,
  stripe_checkout_session_id,
  config_json->>'color' as legacy_single_color,
  config_json->'colors' as colors_object,
  jsonb_pretty(config_json) as full_config,
  created_at,
  updated_at
FROM public.simple_orders
WHERE trace_id = '<TRACE_ID>'
ORDER BY created_at DESC
LIMIT 1;

-- PASS CRITERIA:
-- ✅ trace_id matches your test trace_id
-- ✅ config_json IS NOT NULL
-- ✅ colors_object contains {base, top, middle} NOT just "petrol"
-- ✅ customer_email is filled (after checkout)
-- ✅ customer_id is NOT NULL (after webhook)

-- =====================================================
-- QUERY 2: Find Customer by Email
-- =====================================================
-- Purpose: Verify customer record was created after checkout
-- Expected: 1 row with email, stripe_customer_id

SELECT 
  id,
  email,
  name,
  phone,
  stripe_customer_id,
  shipping_address,
  billing_address,
  created_at,
  updated_at
FROM public.customers
WHERE email = '<EMAIL>'
ORDER BY created_at DESC
LIMIT 5;

-- PASS CRITERIA:
-- ✅ At least 1 row exists
-- ✅ stripe_customer_id starts with "cus_" (from Stripe)
-- ✅ email matches checkout email
-- ✅ created_at is recent (within test timeframe)

-- =====================================================
-- QUERY 3: Verify Order ↔ Customer Link
-- =====================================================
-- Purpose: Verify order is properly linked to customer record
-- Expected: 1 row showing both order and customer data

SELECT 
  o.id as order_id,
  o.trace_id,
  o.customer_email as order_email,
  o.customer_id as order_customer_fk,
  o.stripe_customer_id as order_stripe_cust_id,
  o.status,
  c.id as customer_table_id,
  c.email as customer_table_email,
  c.stripe_customer_id as customer_stripe_id,
  c.name as customer_name,
  o.config_json->'colors' as order_colors,
  o.created_at as order_created,
  c.created_at as customer_created
FROM public.simple_orders o
LEFT JOIN public.customers c ON o.customer_id = c.id
WHERE o.trace_id = '<TRACE_ID>'
ORDER BY o.created_at DESC;

-- PASS CRITERIA:
-- ✅ customer_table_id IS NOT NULL (link exists)
-- ✅ order_email = customer_table_email
-- ✅ order_stripe_cust_id = customer_stripe_id
-- ✅ order_colors contains actual selected colors (not "petrol")

-- =====================================================
-- QUERY 4: Check All Recent Orders (Last 24h)
-- =====================================================
-- Purpose: Overview of recent test activity

SELECT 
  id,
  trace_id,
  customer_email,
  status,
  config_json->'colors' as colors,
  total_amount_cents,
  created_at
FROM public.simple_orders
WHERE created_at > NOW() - INTERVAL '24 hours'
ORDER BY created_at DESC
LIMIT 20;

-- PASS CRITERIA:
-- ✅ Your test order appears in list
-- ✅ colors show variety (not all "petrol")

-- =====================================================
-- QUERY 5: Check Trace System Adoption
-- =====================================================
-- Purpose: How many orders have trace_id populated?

SELECT 
  COUNT(*) as total_orders,
  COUNT(trace_id) as orders_with_trace,
  COUNT(customer_id) as orders_with_customer_link,
  COUNT(config_json) as orders_with_config,
  ROUND(100.0 * COUNT(trace_id) / NULLIF(COUNT(*), 0), 2) as trace_adoption_percent
FROM public.simple_orders
WHERE created_at > NOW() - INTERVAL '7 days';

-- PASS CRITERIA:
-- ✅ trace_adoption_percent > 0 (trace system is being used)
-- ✅ orders_with_customer_link > 0 (webhook is working)

-- =====================================================
-- QUERY 6: Color Distribution Analysis
-- =====================================================
-- Purpose: Verify colors are diverse (not just petrol)

SELECT 
  config_json->'colors'->>'base' as base_color,
  COUNT(*) as order_count
FROM public.simple_orders
WHERE created_at > NOW() - INTERVAL '7 days'
  AND config_json IS NOT NULL
  AND config_json->'colors' IS NOT NULL
GROUP BY base_color
ORDER BY order_count DESC;

-- PASS CRITERIA:
-- ✅ Multiple different colors appear
-- ✅ NOT 100% "petrol"
-- ✅ Test colors (graphite, anthracite, etc.) appear

-- =====================================================
-- QUERY 7: Webhook Success Rate
-- =====================================================
-- Purpose: How many orders got customer data via webhook?

SELECT 
  status,
  COUNT(*) as count,
  COUNT(customer_id) as with_customer,
  COUNT(stripe_customer_id) as with_stripe_customer,
  ROUND(100.0 * COUNT(customer_id) / NULLIF(COUNT(*), 0), 2) as link_success_rate
FROM public.simple_orders
WHERE created_at > NOW() - INTERVAL '7 days'
GROUP BY status
ORDER BY count DESC;

-- PASS CRITERIA:
-- ✅ link_success_rate > 80% for 'paid' orders
-- ✅ 'pending' orders have lower rate (expected - webhook hasn't run yet)

-- =====================================================
-- DEBUGGING QUERY: Find "Petrol Problem" Orders
-- =====================================================
-- Purpose: Find orders that still have default "petrol" color

SELECT 
  id,
  trace_id,
  customer_email,
  config_json->'colors' as colors,
  config_json->>'color' as single_color,
  created_at
FROM public.simple_orders
WHERE 
  (config_json->'colors'->>'base' = 'petrol'
   OR config_json->>'color' = 'petrol')
  AND created_at > NOW() - INTERVAL '7 days'
ORDER BY created_at DESC
LIMIT 10;

-- If this returns rows:
-- ❌ Petrol bug still present
-- Check browser console logs for those trace_ids

-- =====================================================
-- ADMIN CHECK: Verify Columns Exist
-- =====================================================
-- Purpose: Ensure all required columns exist

SELECT 
  column_name, 
  data_type, 
  is_nullable
FROM information_schema.columns
WHERE table_name = 'simple_orders'
  AND table_schema = 'public'
  AND column_name IN (
    'trace_id',
    'customer_id',
    'customer_email',
    'customer_name',
    'stripe_customer_id',
    'config_json',
    'items'
  )
ORDER BY column_name;

-- PASS CRITERIA:
-- ✅ All 7 columns exist
-- ✅ config_json type is 'jsonb'

-- =====================================================
-- USAGE INSTRUCTIONS
-- =====================================================

/*
HOW TO USE THIS FILE:

1. Run a test checkout in browser with ?trace=1
2. Note the trace_id from debug UI (e.g., "abc-123-xyz")
3. Note the email used in checkout (e.g., "test@example.com")

4. Replace placeholders in queries above:
   - <TRACE_ID> → your actual trace_id
   - <EMAIL> → your actual email

5. Execute queries in Supabase Dashboard → SQL Editor

6. Compare results with PASS CRITERIA comments

7. If any query fails criteria:
   - Check browser console logs
   - Check Vercel function logs (filter by trace_id)
   - Check Stripe Dashboard webhook events
   - Run debugging queries at bottom

EXPECTED WORKFLOW:
- Query 1: Order exists ✅
- Query 2: Customer exists ✅  
- Query 3: Link verified ✅
- Query 4: Order in recent list ✅
- Query 5: Trace adoption > 0% ✅
- Query 6: Colors diverse ✅
- Query 7: Webhook success > 80% ✅
- Debug query: No petrol ✅

If ALL queries pass → E2E test SUCCESS ✅
If ANY query fails → Check logs, fix issue, retest ❌
*/
