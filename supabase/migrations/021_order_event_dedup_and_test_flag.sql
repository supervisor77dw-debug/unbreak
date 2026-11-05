-- ============================================================
-- MIGRATION 021: Event-Dublettenschutz und Testkennzeichnung
-- Auftrag: AW-20261105-DK-CLAUDE-UNBREAK-SHOP-ABSCHLUSS-001
--
-- Nur additiv: zwei neue Spalten und ein Index auf simple_orders.
-- Keine Bestellung wird geändert oder gelöscht.
-- Der Code läuft mit und ohne diese Migration.
-- Rollback: supabase/rollback/021_order_event_dedup_and_test_flag_rollback.sql
-- ============================================================

BEGIN;

ALTER TABLE public.simple_orders
  ADD COLUMN IF NOT EXISTS stripe_event_id text;

CREATE INDEX IF NOT EXISTS idx_simple_orders_stripe_event_id
  ON public.simple_orders (stripe_event_id)
  WHERE stripe_event_id IS NOT NULL;

-- Kennzeichnet Sandbox-Bestellungen automatisch, auch künftige
ALTER TABLE public.simple_orders
  ADD COLUMN IF NOT EXISTS is_test boolean
  GENERATED ALWAYS AS (coalesce(stripe_session_id, '') LIKE 'cs_test%') STORED;

COMMIT;

-- Kontrolle
SELECT is_test, count(*) AS bestellungen
FROM public.simple_orders
GROUP BY is_test
ORDER BY is_test;
