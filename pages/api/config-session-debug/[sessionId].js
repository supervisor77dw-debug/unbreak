/**
 * Debug Endpoint for Config Sessions
 * GET /api/config-session-debug/[sessionId]
 * 
 * Returns metadata about session (exists, ttl, etc.)
 * Only enabled in preview/dev environments
 */

import { getSession } from '../../../lib/session-store';

export default async function handler(req, res) {
  // Only allow in non-production
  if (process.env.NODE_ENV === 'production' && !process.env.VERCEL_ENV?.includes('preview')) {
    return res.status(403).json({ error: 'Debug endpoint disabled in production' });
  }

  const { sessionId } = req.query;

  if (!sessionId) {
    return res.status(400).json({ error: 'Missing sessionId' });
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const session = await getSession(sessionId);
    
    if (!session) {
      return res.status(200).json({
        sessionId,
        exists: false,
        message: 'Session not found or expired',
      });
    }

    const now = Date.now();
    const ttlRemaining = Math.max(0, session.expiresAt - now);
    const ttlMinutes = Math.floor(ttlRemaining / 60000);

    return res.status(200).json({
      sessionId,
      exists: true,
      lang: session.lang,
      createdAt: session.createdAt,
      expiresAt: new Date(session.expiresAt).toISOString(),
      ttlRemainingMs: ttlRemaining,
      ttlRemainingMinutes: ttlMinutes,
      configKeys: Object.keys(session.config || {}),
      isExpired: now > session.expiresAt,
    });

  } catch (error) {
    console.error('[DEBUG][CONFIG_SESSION] Error:', error);
    return res.status(500).json({ error: 'Internal server error', message: error.message });
  }
}
