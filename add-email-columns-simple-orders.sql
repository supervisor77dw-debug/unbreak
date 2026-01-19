-- ═══════════════════════════════════════════════════════════════════════════
-- ADD EMAIL TRACKING COLUMNS TO simple_orders
-- Run this in Supabase SQL Editor BEFORE deploying
-- Date: 2026-01-19
-- ═══════════════════════════════════════════════════════════════════════════

-- 1. Add email tracking columns (if not exist)
ALTER TABLE simple_orders 
ADD COLUMN IF NOT EXISTS customer_email_sent_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS admin_email_sent_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS email_status TEXT DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS email_last_error TEXT;

-- 2. Add fulfillment status column (if not exist)
ALTER TABLE simple_orders 
ADD COLUMN IF NOT EXISTS fulfillment_status TEXT DEFAULT 'new';

-- 3. Add notes column for admin comments
ALTER TABLE simple_orders 
ADD COLUMN IF NOT EXISTS notes TEXT;

-- 4. Add index for faster email status queries
CREATE INDEX IF NOT EXISTS idx_simple_orders_email_status ON simple_orders(email_status);
CREATE INDEX IF NOT EXISTS idx_simple_orders_status ON simple_orders(status);
CREATE INDEX IF NOT EXISTS idx_simple_orders_created_at ON simple_orders(created_at DESC);

-- 5. Verify columns were added
SELECT column_name, data_type, column_default 
FROM information_schema.columns 
WHERE table_name = 'simple_orders' 
AND column_name IN ('customer_email_sent_at', 'admin_email_sent_at', 'email_status', 'email_last_error', 'fulfillment_status', 'notes')
ORDER BY column_name;

-- ═══════════════════════════════════════════════════════════════════════════
-- EXPECTED OUTPUT:
-- column_name            | data_type                   | column_default
-- -----------------------+-----------------------------+----------------
-- admin_email_sent_at    | timestamp with time zone    | 
-- customer_email_sent_at | timestamp with time zone    | 
-- email_last_error       | text                        | 
-- email_status           | text                        | 'pending'
-- fulfillment_status     | text                        | 'new'
-- notes                  | text                        | 
-- ═══════════════════════════════════════════════════════════════════════════
