/**
 * Config Session API - POST endpoint
 * 
 * Stores configurator session for redirect flow
 * POST /api/config-session
 * 
 * Request Body:
 * {
 *   lang: 'de' | 'en',
 *   variantKey: 'glass_holder' | 'bottle_holder',
 *   product_sku: 'UNBREAK-GLAS-01' | 'UNBREAK-WEIN-01',
 *   config: { colors, finish, quantity, ... },
 *   meta: { ... }
 * }
 * 
 * Response:
 * { cfgId: 'uuid-v4' }
 */

import { v4 as uuidv4 } from 'uuid';

// In-memory storage (for development)
// PRODUCTION: Replace with Vercel KV, Upstash Redis, or Database
const sessionStore = new Map();
const TTL_MS = 2 * 60 * 60 * 1000; // 2 hours

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
    const { lang, variantKey, product_sku, config, meta } = req.body;

    // Validation
    if (!lang || !['de', 'en'].includes(lang)) {
      return res.status(400).json({ error: 'Invalid language' });
    }

    if (!variantKey || !['glass_holder', 'bottle_holder'].includes(variantKey)) {
      return res.status(400).json({ error: 'Invalid variantKey' });
    }

    if (!product_sku || !['UNBREAK-GLAS-01', 'UNBREAK-WEIN-01'].includes(product_sku)) {
      return res.status(400).json({ error: 'Invalid product_sku' });
    }

    if (!config || typeof config !== 'object') {
      return res.status(400).json({ error: 'Invalid config' });
    }

    // Generate unique session ID
    const cfgId = uuidv4();
    const expiresAt = Date.now() + TTL_MS;

    // Store session
    const session = {
      cfgId,
      lang,
      variantKey,
      product_sku,
      config,
      meta: meta || {},
      createdAt: new Date().toISOString(),
      expiresAt,
    };

    sessionStore.set(cfgId, session);

    console.info('[CONFIG_SESSION] Created session:', {
      cfgId,
      lang,
      variantKey,
      product_sku,
      ttl: '2h',
    });

    return res.status(201).json({ cfgId });

  } catch (error) {
    console.error('[CONFIG_SESSION] Error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
