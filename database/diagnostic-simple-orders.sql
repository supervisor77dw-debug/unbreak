-- ============================================================
-- DIAGNOSTIC: Check simple_orders table structure and data
-- ============================================================
-- Run this in Supabase SQL Editor to debug webhook issues
-- ============================================================

-- 1. Check if stripe_session_id column exists
SELECT 
  column_name, 
  data_type, 
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'simple_orders' 
  AND column_name IN ('stripe_session_id', 'paid_at', 'status', 'items')
ORDER BY column_name;

-- Expected: stripe_session_id (text), paid_at (timestamp), status (text), items (jsonb)

-- 2. Check recent orders
SELECT 
  id,
  stripe_session_id,
  status,
  paid_at,
  total_amount_cents,
  created_at
FROM simple_orders
ORDER BY created_at DESC
LIMIT 5;

-- Expected: stripe_session_id should be populated (starts with cs_test_ or cs_live_)

-- 3. Check if any orders have session_id but still pending
SELECT 
  id,
  stripe_session_id,
  status,
  paid_at,
  created_at,
  updated_at
FROM simple_orders
WHERE stripe_session_id IS NOT NULL 
  AND status = 'pending'
ORDER BY created_at DESC;

-- If rows returned: webhook is not firing or failing

-- 4. Check RLS policies (might block service role updates)
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'simple_orders'
ORDER BY policyname;

-- Expected: service_role should have UPDATE permission
