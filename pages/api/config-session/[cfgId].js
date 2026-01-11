/**
 * Config Session API - GET/DELETE endpoint
 * 
 * GET /api/config-session/[cfgId] - Retrieve session
 * DELETE /api/config-session/[cfgId] - Delete session (cleanup after add-to-cart)
 * 
 * Response (GET):
 * {
 *   cfgId, lang, variantKey, product_sku, config, meta, createdAt, expiresAt
 * }
 * 
 * Response (DELETE):
 * { success: true }
 */

// Import the same store from parent route
// NOTE: In production, use external storage (Vercel KV, Redis, DB)
const sessionStore = new Map();

export default async function handler(req, res) {
  const { cfgId } = req.query;

  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (!cfgId) {
    return res.status(400).json({ error: 'Missing cfgId' });
  }

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

    console.info('[CONFIG_SESSION] Retrieved session:', cfgId);
    return res.status(200).json(session);
  }

  // DELETE - Cleanup after successful add-to-cart
  if (req.method === 'DELETE') {
    const existed = sessionStore.has(cfgId);
    sessionStore.delete(cfgId);

    console.info('[CONFIG_SESSION] Deleted session:', cfgId, existed ? '(existed)' : '(not found)');
    return res.status(200).json({ success: true, existed });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
