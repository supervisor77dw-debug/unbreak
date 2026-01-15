-- Migration: 017 - Create Processed Events Table
-- Purpose: Idempotent webhook processing (Stripe events)
-- Created: 2026-01-15

-- Create processed_events table for idempotency
CREATE TABLE IF NOT EXISTS public.processed_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Event identification
  stripe_event_id TEXT UNIQUE NOT NULL,
  event_type TEXT NOT NULL,
  
  -- Processing metadata
  processed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE,
  
  -- Event payload (for debugging)
  event_data JSONB,
  
  -- Processing result
  processing_status TEXT NOT NULL DEFAULT 'success', -- success, failed, skipped
  error_message TEXT,
  
  -- Indexing
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for fast lookup
CREATE INDEX idx_processed_events_stripe_event_id ON public.processed_events(stripe_event_id);
CREATE INDEX idx_processed_events_order_id ON public.processed_events(order_id);
CREATE INDEX idx_processed_events_event_type ON public.processed_events(event_type);
CREATE INDEX idx_processed_events_created_at ON public.processed_events(created_at);

-- Comments
COMMENT ON TABLE public.processed_events IS 'Idempotency tracking for Stripe webhook events';
COMMENT ON COLUMN public.processed_events.stripe_event_id IS 'Unique Stripe event ID (evt_...)';
COMMENT ON COLUMN public.processed_events.event_type IS 'Stripe event type (checkout.session.completed, etc.)';
COMMENT ON COLUMN public.processed_events.processing_status IS 'Result: success, failed, skipped';
COMMENT ON COLUMN public.processed_events.event_data IS 'Full event payload for debugging';

-- Grant permissions
GRANT SELECT, INSERT ON public.processed_events TO authenticated;
GRANT SELECT, INSERT ON public.processed_events TO service_role;
