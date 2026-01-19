-- Add stripe_event_id to admin_order_events for idempotency
ALTER TABLE "admin_order_events" ADD COLUMN IF NOT EXISTS "stripe_event_id" TEXT;

-- Create UNIQUE index on stripe_event_id
CREATE UNIQUE INDEX IF NOT EXISTS "admin_order_events_stripe_event_id_key" ON "admin_order_events"("stripe_event_id") WHERE "stripe_event_id" IS NOT NULL;

-- Add email tracking fields to admin_orders
ALTER TABLE "admin_orders" ADD COLUMN IF NOT EXISTS "email_status" TEXT;
ALTER TABLE "admin_orders" ADD COLUMN IF NOT EXISTS "email_last_error" TEXT;
ALTER TABLE "admin_orders" ADD COLUMN IF NOT EXISTS "customer_email_sent_at" TIMESTAMP(3);
ALTER TABLE "admin_orders" ADD COLUMN IF NOT EXISTS "admin_email_sent_at" TIMESTAMP(3);

-- Add indexes for email tracking
CREATE INDEX IF NOT EXISTS "admin_orders_customer_email_sent_at_idx" ON "admin_orders"("customer_email_sent_at");
CREATE INDEX IF NOT EXISTS "admin_orders_admin_email_sent_at_idx" ON "admin_orders"("admin_email_sent_at");
