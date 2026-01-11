-- Migration: Create config_sessions table for persistent session storage
-- Replaces in-memory Map (doesn't work on Vercel serverless)

CREATE TABLE IF NOT EXISTS config_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id TEXT UNIQUE NOT NULL,
  lang TEXT NOT NULL DEFAULT 'de',
  config JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  CONSTRAINT valid_lang CHECK (lang IN ('de', 'en'))
);

-- Index for fast lookup by session_id
CREATE INDEX IF NOT EXISTS idx_config_sessions_session_id ON config_sessions(session_id);

-- Index for cleanup of expired sessions
CREATE INDEX IF NOT EXISTS idx_config_sessions_expires_at ON config_sessions(expires_at);

-- RLS Policies: Public can read/write config sessions (no auth required for configurator flow)
ALTER TABLE config_sessions ENABLE ROW LEVEL SECURITY;

-- Allow anonymous POST (configurator creates sessions)
CREATE POLICY "Allow anonymous insert config_sessions"
  ON config_sessions
  FOR INSERT
  WITH CHECK (true);

-- Allow anonymous read (shop reads sessions on return)
CREATE POLICY "Allow anonymous select config_sessions"
  ON config_sessions
  FOR SELECT
  USING (expires_at > NOW());

-- Allow anonymous delete (shop cleans up after add-to-cart)
CREATE POLICY "Allow anonymous delete config_sessions"
  ON config_sessions
  FOR DELETE
  USING (true);

-- Automatic cleanup function for expired sessions (runs periodically)
CREATE OR REPLACE FUNCTION cleanup_expired_config_sessions()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM config_sessions
  WHERE expires_at < NOW();
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute to anon/authenticated
GRANT EXECUTE ON FUNCTION cleanup_expired_config_sessions() TO anon, authenticated;

-- Comment
COMMENT ON TABLE config_sessions IS 'Temporary storage for configurator sessions (TTL 2 hours)';
