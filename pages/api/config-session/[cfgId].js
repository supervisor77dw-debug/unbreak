/**
 * Config Session API - GET/DELETE endpoint
 * 
 * GET /api/config-session/[cfgId] - Retrieve session
 * DELETE /api/config-session/[cfgId] - Delete session (cleanup)
 * 
 * Supports both cfgId and sessionId for backward compatibility
 * 
 * Response (GET):
 * { lang: "de"|"en", config: object }
 * 
 * Response (DELETE):
 * { success: true }
 */

import { applyCorsHeaders, handlePreflight } from '../../../lib/cors-config';
import { getSessionStore } from '../../../lib/session-store';

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

  const sessionStore = getSessionStore();

  // GET - Retrieve session
  if (req.method === 'GET') {
    const session = sessionStore.get(sessionId);

    if (!session) {
      console.warn('[CONFIG_SESSION][GET] Session not found:', sessionId);
      return res.status(404).json({ error: 'Session not found or expired' });
    }

    // Check expiry
    if (Date.now() > session.expiresAt) {
      sessionStore.delete(sessionId);
      console.warn('[CONFIG_SESSION][GET] Session expired:', sessionId);
      return res.status(404).json({ error: 'Session expired' });
    }

    console.info('[CONFIG_SESSION][GET] Retrieved:', sessionId);
    
    // Return lang and config (updated key name)
    return res.status(200).json({
      lang: session.lang,
      config: session.config || session.payload  // Support both old and new
    });
  }

  // DELETE - Cleanup after successful add-to-cart
  if (req.method === 'DELETE') {
    const existed = sessionStore.has(sessionId);
    sessionStore.delete(sessionId);

    console.info('[CONFIG_SESSION][DELETE] Deleted:', sessionId, existed ? '(existed)' : '(not found)');
    return res.status(200).json({ success: true, existed });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
