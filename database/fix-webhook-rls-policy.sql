-- ============================================================
-- FIX: Add service_role UPDATE policy for simple_orders
-- ============================================================
-- ISSUE: Webhook cannot update orders from 'pending' to 'paid'
-- CAUSE: service_role only has INSERT permission, not UPDATE
-- ============================================================

-- Add UPDATE policy for service_role
CREATE POLICY "Service role can update simple orders"
ON simple_orders FOR UPDATE
TO service_role
USING (true)
WITH CHECK (true);

-- Verification: Check all policies
SELECT 
  policyname,
  roles,
  cmd
FROM pg_policies
WHERE tablename = 'simple_orders'
ORDER BY policyname;

-- Expected output should now include:
-- "Service role can create simple orders"  | {service_role} | INSERT
-- "Service role can update simple orders"  | {service_role} | UPDATE
