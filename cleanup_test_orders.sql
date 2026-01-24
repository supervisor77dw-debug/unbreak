-- ============================================================================
-- CLEANUP TEST ORDERS SCRIPT
-- ============================================================================
-- Erstellt: 2026-01-19
-- Zweck: Entfernung aller Test- und Abbruchdaten vor Production Go-Live
-- 
-- WICHTIG: Dieses Script entfernt ALLE Orders, da keine echten
--          bezahlten Live-Orders (cs_live_ + paid_at) existieren.
--
-- ANALYSE VOR CLEANUP:
--   Total Orders: 67
--   - cs_test_ Sessions: 56 (alle Test-Stripe)
--   - cs_live_ Sessions (pending): 10 (abgebrochene Checkouts)
--   - DRAFT- Orders: 3 (neue DRAFT/Paid Pattern)
--   - Bezahlte LIVE Orders: 0
--
-- ============================================================================

-- ============================================================================
-- SCHRITT 1: SICHERHEITS-CHECK (READ-ONLY)
-- ============================================================================
-- Zeige alle Orders die gelöscht werden sollen:

-- SELECT 
--   order_number,
--   status,
--   paid_at,
--   total_amount_cents / 100.0 as amount_eur,
--   stripe_session_id,
--   customer_email,
--   created_at
-- FROM simple_orders
-- ORDER BY created_at DESC;

-- Prüfe auf echte bezahlte LIVE-Orders (sollte 0 sein):
-- SELECT COUNT(*) as real_paid_orders
-- FROM simple_orders 
-- WHERE status = 'paid' 
--   AND paid_at IS NOT NULL
--   AND stripe_session_id LIKE 'cs_live_%';

-- ============================================================================
-- SCHRITT 2: WEBHOOK LOGS LÖSCHEN (FK-Constraint!)
-- ============================================================================
-- webhook_logs hat Foreign Key auf simple_orders.id
-- Muss ZUERST gelöscht werden!

DELETE FROM webhook_logs;

-- ============================================================================
-- SCHRITT 3: ALLE TEST-ORDERS LÖSCHEN
-- ============================================================================
-- Da alle Orders entweder cs_test_ oder pending/unpaid cs_live_ sind,
-- können alle gelöscht werden.

DELETE FROM simple_orders;

-- ============================================================================
-- SCHRITT 4: ORDER NUMBER SEQUENCE ZURÜCKSETZEN
-- ============================================================================
-- Setze die Sequenz auf 0 zurück, sodass die erste echte Order
-- bei UO-2026-0000001 beginnt.

-- Prüfe aktuelle Sequenz:
-- SELECT last_value FROM simple_order_number_seq;

-- Setze Sequenz zurück:
ALTER SEQUENCE simple_order_number_seq RESTART WITH 1;

-- ============================================================================
-- SCHRITT 5: KUNDEN-BEREINIGUNG
-- ============================================================================
-- Lösche Kunden ohne Bestellungen (nach Order-Löschung haben alle 0 Orders)

DELETE FROM customers
WHERE id NOT IN (
  SELECT DISTINCT customer_id 
  FROM simple_orders 
  WHERE customer_id IS NOT NULL
);

-- ============================================================================
-- SCHRITT 6: VERIFIKATION
-- ============================================================================
-- Prüfe Ergebnis:

-- SELECT COUNT(*) as remaining_orders FROM simple_orders;
-- SELECT COUNT(*) as remaining_customers FROM customers;
-- SELECT COUNT(*) as remaining_webhook_logs FROM webhook_logs;
-- SELECT last_value as sequence_value FROM simple_order_number_seq;

-- ============================================================================
-- ERGEBNIS NACH CLEANUP:
-- ============================================================================
-- - Orders: 0
-- - Customers: 0 (oder nur echte mit Paid-Orders)
-- - Webhook Logs: 0
-- - Ordernummer-Sequenz: beginnt bei 1
-- - Nächste echte Order: UO-2026-0000001
-- ============================================================================
