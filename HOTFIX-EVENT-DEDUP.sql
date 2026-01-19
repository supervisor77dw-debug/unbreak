-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- HOTFIX: Event Deduplication & Email Tracking
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- Problem: stripe_event_id and event_type are NULL in admin_order_events
-- Solution: 
--   1. Add missing EventType enum value (EMAIL_BLOCKED)
--   2. Add stripe_event_id column to admin_order_events
--   3. Create UNIQUE index on stripe_event_id for idempotency
--   4. Add email tracking fields to admin_orders
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

-- 1. Extend EventType enum with EMAIL_BLOCKED
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'EventType' AND e.enumlabel = 'EMAIL_BLOCKED'
  ) THEN
    ALTER TYPE "EventType" ADD VALUE 'EMAIL_BLOCKED';
  END IF;
END$$;

-- 2. Add stripe_event_id column for event idempotency
ALTER TABLE "admin_order_events" 
  ADD COLUMN IF NOT EXISTS "stripe_event_id" TEXT;

-- 3. Create UNIQUE index on stripe_event_id (partial index to allow NULL)
CREATE UNIQUE INDEX IF NOT EXISTS "admin_order_events_stripe_event_id_key" 
  ON "admin_order_events"("stripe_event_id") 
  WHERE "stripe_event_id" IS NOT NULL;

-- 4. Add email tracking fields to admin_orders
ALTER TABLE "admin_orders" 
  ADD COLUMN IF NOT EXISTS "email_status" TEXT;

ALTER TABLE "admin_orders" 
  ADD COLUMN IF NOT EXISTS "email_last_error" TEXT;

ALTER TABLE "admin_orders" 
  ADD COLUMN IF NOT EXISTS "customer_email_sent_at" TIMESTAMP(3);

ALTER TABLE "admin_orders" 
  ADD COLUMN IF NOT EXISTS "admin_email_sent_at" TIMESTAMP(3);

-- 5. Create indexes for email tracking queries
CREATE INDEX IF NOT EXISTS "admin_orders_customer_email_sent_at_idx" 
  ON "admin_orders"("customer_email_sent_at");

CREATE INDEX IF NOT EXISTS "admin_orders_admin_email_sent_at_idx" 
  ON "admin_orders"("admin_email_sent_at");

-- 6. Verify changes
DO $$
BEGIN
  RAISE NOTICE '✅ Migration complete:';
  RAISE NOTICE '   - EventType enum extended with EMAIL_BLOCKED';
  RAISE NOTICE '   - admin_order_events.stripe_event_id column added';
  RAISE NOTICE '   - UNIQUE index on stripe_event_id created';
  RAISE NOTICE '   - Email tracking fields added to admin_orders';
  RAISE NOTICE '   - Email tracking indexes created';
END$$;
