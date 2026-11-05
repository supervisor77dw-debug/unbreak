-- Rollback zu Migration 021 (AW-20261105-DK-CLAUDE-UNBREAK-SHOP-ABSCHLUSS-001)
-- Entfernt nur die zusätzlichen Spalten; Bestellungen bleiben unverändert.

BEGIN;

DROP INDEX IF EXISTS public.idx_simple_orders_stripe_event_id;

ALTER TABLE public.simple_orders
  DROP COLUMN IF EXISTS is_test,
  DROP COLUMN IF EXISTS stripe_event_id;

COMMIT;
