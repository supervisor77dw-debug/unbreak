-- Add stripe_event_id column to simple_orders for webhook deduplication
-- Run this in Supabase SQL Editor

-- Add the column
ALTER TABLE simple_orders 
ADD COLUMN IF NOT EXISTS stripe_event_id TEXT;

-- Create index for fast dedup lookups
CREATE INDEX IF NOT EXISTS idx_simple_orders_stripe_event_id 
ON simple_orders(stripe_event_id) 
WHERE stripe_event_id IS NOT NULL;

-- Verify
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'simple_orders' 
AND column_name = 'stripe_event_id';
