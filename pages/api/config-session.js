/**
 * Config Session API - POST endpoint
 * 
 * Simplified session storage for configurator → shop flow
 * POST /api/config-session
 * 
 * Request Body:
 * {
 *   lang: 'de' | 'en',
 *   payload: object  // Arbitrary config data from configurator
 * }
 * 
 * Response:
 * { cfgId: string }
 */

import { v4 as uuidv4 } from 'uuid';

// In-memory storage (for development)
// PRODUCTION: Replace with Vercel KV, Upstash Redis, or Database
const sessionStore = new Map();
const TTL_MS = 45 * 60 * 1000; // 45 minutes (30-60 min range)

// Cleanup expired sessions every 10 minutes
setInterval(() => {
  const now = Date.now();
  for (const [cfgId, session] of sessionStore.entries()) {
    if (now > session.expiresAt) {
      sessionStore.delete(cfgId);
      console.log('[CONFIG_SESSION] Cleaned up expired session:', cfgId);
    }
  }
}, 10 * 60 * 1000);

export default async function handler(req, res) {
  // CORS headers for cross-domain configurator
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { lang, payload } = req.body;

    // Validation
    if (!lang || !['de', 'en'].includes(lang)) {
      return res.status(400).json({ error: 'Invalid or missing lang (must be "de" or "en")' });
    }

    if (!payload || typeof payload !== 'object') {
      return res.status(400).json({ error: 'Invalid or missing payload (must be object)' });
    }

    // Generate unique session ID
    const cfgId = uuidv4();
    const expiresAt = Date.now() + TTL_MS;

    // Store session
    const session = {
      lang,
      payload,
      createdAt: new Date().toISOString(),
      expiresAt,
    };

    sessionStore.set(cfgId, session);

    console.info('[CONFIG_SESSION] Created:', {
      cfgId,
      lang,
      payloadKeys: Object.keys(payload),
      ttl: '45min',
    });

    return res.status(201).json({ cfgId });

  } catch (error) {
    console.error('[CONFIG_SESSION] Error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
