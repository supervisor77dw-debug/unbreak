/**
 * Config Session API - GET/DELETE endpoint
 * 
 * GET /api/config-session/[cfgId] - Retrieve session
 * DELETE /api/config-session/[cfgId] - Delete session (cleanup)
 * 
 * Supports both cfgId and sessionId for backward compatibility
 * Now uses Supabase for persistent storage (not in-memory)
 * 
 * Response (GET):
 * { ok: true, data: { lang: "de"|"en", config: object } }
 * 
 * Response (DELETE):
 * { ok: true, existed: boolean }
 */

import { applyCorsHeaders, handlePreflight } from '../../../lib/cors-config';
import { getSession, deleteSession, hasSession } from '../../../lib/session-store';

export default async function handler(req, res) {
  // Support both cfgId and sessionId param names
  const sessionId = req.query.cfgId || req.query.sessionId;

  // CORS headers for all responses
  applyCorsHeaders(req, res, {
    methods: 'GET, DELETE, OPTIONS',
    headers: 'Content-Type',
  });
  
  // Handle OPTIONS preflight
  if (handlePreflight(req, res)) return;

  if (!sessionId) {
    return res.status(400).json({ error: 'Missing sessionId or cfgId' });
  }

  // GET - Retrieve session
  if (req.method === 'GET') {
    console.log('[API][CONFIG_SESSION][GET] Lookup sessionId=', sessionId);
    
    const session = await getSession(sessionId);

    if (!session) {
      console.warn('[API][CONFIG_SESSION][GET] Not found: sessionId=', sessionId);
      return res.status(404).json({ error: 'Session not found or expired' });
    }

    // Check expiry (already filtered in getSession, but double-check)
    if (Date.now() > session.expiresAt) {
      await deleteSession(sessionId);
      console.warn('[API][CONFIG_SESSION][GET] Expired: sessionId=', sessionId);
      return res.status(404).json({ error: 'Session expired' });
    }

    console.info('[API][CONFIG_SESSION][GET] Found sessionId=', sessionId, 'found=true');
    
    // Return in consistent format
    return res.status(200).json({
      ok: true,
      data: {
        lang: session.lang,
        config: session.config,
      }
    });
  }

  // DELETE - Cleanup after successful add-to-cart
  if (req.method === 'DELETE') {
    const existed = await hasSession(sessionId);
    const success = await deleteSession(sessionId);

    console.info('[API][CONFIG_SESSION][DELETE] sessionId=', sessionId, existed ? '(existed)' : '(not found)');
    return res.status(200).json({ ok: true, existed, success });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
