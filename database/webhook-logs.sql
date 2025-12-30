-- ============================================================
-- Webhook Logs Table - Track Stripe webhook events
-- ============================================================

CREATE TABLE IF NOT EXISTS webhook_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL,
  event_id TEXT,
  stripe_session_id TEXT,
  status TEXT NOT NULL, -- 'success', 'error', 'skipped'
  error_message TEXT,
  order_id UUID REFERENCES simple_orders(id),
  rows_affected INTEGER,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Index for quick lookups
CREATE INDEX IF NOT EXISTS idx_webhook_logs_created_at ON webhook_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_webhook_logs_session_id ON webhook_logs(stripe_session_id);
CREATE INDEX IF NOT EXISTS idx_webhook_logs_status ON webhook_logs(status);

-- RLS: Allow service_role to insert logs
ALTER TABLE webhook_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can insert webhook logs"
ON webhook_logs FOR INSERT
TO service_role
WITH CHECK (true);

CREATE POLICY "Authenticated users can read webhook logs"
ON webhook_logs FOR SELECT
TO authenticated
USING (true);

-- Grant permissions
GRANT SELECT ON webhook_logs TO authenticated;
GRANT ALL ON webhook_logs TO service_role;
