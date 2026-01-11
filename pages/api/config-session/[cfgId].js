/**
 * Config Session API - GET/DELETE endpoint
 * 
 * GET /api/config-session/[cfgId] - Retrieve session
 * DELETE /api/config-session/[cfgId] - Delete session (cleanup)
 * 
 * Response (GET):
 * { lang: "de"|"en", config: object }
 * 
 * Response (DELETE):
 * { success: true }
 */

import { handleCors } from '../../../lib/cors-config';
import { getSessionStore } from '../../../lib/session-store';

export default async function handler(req, res) {
  const { cfgId } = req.query;

  // Handle CORS with preflight
  if (handleCors(req, res)) return;

  if (!cfgId) {
    return res.status(400).json({ error: 'Missing cfgId' });
  }

  const sessionStore = getSessionStore();

  // GET - Retrieve session
  if (req.method === 'GET') {
    const session = sessionStore.get(cfgId);

    if (!session) {
      console.warn('[CONFIG_SESSION] Session not found:', cfgId);
      return res.status(404).json({ error: 'Session not found or expired' });
    }

    // Check expiry
    if (Date.now() > session.expiresAt) {
      sessionStore.delete(cfgId);
      console.warn('[CONFIG_SESSION] Session expired:', cfgId);
      return res.status(404).json({ error: 'Session expired' });
    }

    console.info('[CONFIG_SESSION] Retrieved:', cfgId);
    
    // Return lang and config (updated key name)
    return res.status(200).json({
      lang: session.lang,
      config: session.config || session.payload  // Support both old and new
    });
  }

  // DELETE - Cleanup after successful add-to-cart
  if (req.method === 'DELETE') {
    const existed = sessionStore.has(cfgId);
    sessionStore.delete(cfgId);

    console.info('[CONFIG_SESSION] Deleted:', cfgId, existed ? '(existed)' : '(not found)');
    return res.status(200).json({ success: true, existed });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
