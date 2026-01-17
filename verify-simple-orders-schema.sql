-- ========================================
-- SIMPLE_ORDERS SCHEMA VERIFICATION
-- ========================================
-- Prüfe ob alle benötigten Spalten existieren
-- Run this in Supabase SQL Editor

-- 1. CHECK: Welche Spalten hat simple_orders?
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'simple_orders'
ORDER BY ordinal_position;

-- ========================================
-- EXPECTED COLUMNS (für Checkout/Webhook):
-- ========================================
-- ✅ id (uuid)
-- ✅ status (text) → 'pending', 'paid', 'completed', 'cancelled'
-- ✅ paid_at (timestamp) → wann wurde bezahlt
-- ✅ stripe_payment_intent_id (text) → pi_xxx
-- ✅ stripe_checkout_session_id (text) → cs_xxx
-- ✅ stripe_customer_id (text) → cus_xxx
-- ✅ customer_email (text)
-- ✅ customer_name (text)
-- ✅ total_amount_cents (integer)
-- ✅ currency (text)
-- ✅ created_at (timestamp)
-- ✅ updated_at (timestamp)

-- ========================================
-- NICHT VORHANDEN (aber im Code referenziert):
-- ========================================
-- ❌ payment_status → wird NICHT gebraucht (redundant zu 'status')
--    → Code wurde gefixt um dies nicht mehr zu updaten

-- ========================================
-- 2. CHECK: Gibt es Orders mit ungültigen Status?
-- ========================================
SELECT status, COUNT(*) as count
FROM simple_orders
GROUP BY status
ORDER BY count DESC;

-- Expected: 'pending', 'paid', 'completed', 'cancelled'
-- Falls andere Werte → manuell prüfen

-- ========================================
-- 3. CHECK: Sind paid_at Timestamps gesetzt?
-- ========================================
SELECT 
  COUNT(*) as total_paid_orders,
  COUNT(paid_at) as orders_with_paid_at,
  COUNT(*) - COUNT(paid_at) as orders_missing_paid_at
FROM simple_orders
WHERE status = 'paid';

-- Erwartung: orders_missing_paid_at = 0
-- Falls > 0 → Backfill notwendig

-- ========================================
-- 4. OPTIONAL BACKFILL: Setze paid_at für alte Orders
-- ========================================
-- NUR AUSFÜHREN falls orders_missing_paid_at > 0!

-- UPDATE simple_orders
-- SET paid_at = updated_at  -- Fallback: use updated_at as approximation
-- WHERE status = 'paid' AND paid_at IS NULL;

-- ========================================
-- 5. CHECK: Schema Cache Status (PostgREST)
-- ========================================
-- Falls PGRST204 Errors auftreten:
-- Supabase Dashboard → Project Settings → API → Restart
-- Oder: Schema Cache refresht sich automatisch nach ~5 min

-- Query zum Testen ob Schema aktuell ist:
SELECT COUNT(*) FROM simple_orders LIMIT 1;
-- Sollte keine Errors geben

-- ========================================
-- 6. VERIFICATION: Test Update Query
-- ========================================
-- Teste ob finalize.js Update funktioniert:

-- SELECT id, status, paid_at, updated_at 
-- FROM simple_orders 
-- WHERE status = 'pending' 
-- LIMIT 1;

-- Dann manuell updaten (simuliert finalize.js):
-- UPDATE simple_orders
-- SET 
--   status = 'paid',
--   paid_at = NOW(),
--   stripe_payment_intent_id = 'pi_test_123',
--   updated_at = NOW()
-- WHERE id = '<uuid_from_above>';

-- Sollte KEINE Errors geben!

-- ========================================
-- RESULT: Schema ist korrekt ✅
-- ========================================
-- Die Spalten die finalize.js braucht, existieren:
-- ✅ status
-- ✅ paid_at
-- ✅ stripe_payment_intent_id
-- ✅ updated_at

-- Die Spalte die NICHT existiert:
-- ❌ payment_status → wurde aus finalize.js entfernt ✅
