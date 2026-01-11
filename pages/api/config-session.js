/**
 * Config Session API - POST endpoint
 * 
 * Session storage for configurator → shop flow
 * POST /api/config-session
 * 
 * Request Body:
 * {
 *   sessionId?: string,           // Optional: reuse existing session
 *   lang?: 'de' | 'en',           // Optional: language preference
 *   config: object                // Required: configuration data
 * }
 * 
 * Response:
 * { ok: true, sessionId: string }
 */

import { v4 as uuidv4 } from 'uuid';
import { applyCorsHeaders, handlePreflight } from '../../lib/cors-config';
import { getSessionStore, getTTL } from '../../lib/session-store';

export default async function handler(req, res) {
  // CRITICAL: Apply CORS headers to ALL responses (including errors)
  applyCorsHeaders(req, res, {
    methods: 'POST, OPTIONS',
    headers: 'Content-Type',
  });
  
  // Handle OPTIONS preflight
  if (handlePreflight(req, res)) return;

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { sessionId, lang, config } = req.body;

    // Validation: config is required
    if (!config || typeof config !== 'object') {
      return res.status(400).json({ error: 'Invalid or missing config (must be object)' });
    }

    // Validation: lang is optional but must be valid if provided
    if (lang && !['de', 'en'].includes(lang)) {
      return res.status(400).json({ error: 'Invalid lang (must be "de" or "en")' });
    }

    // Use provided sessionId or generate new one
    const finalSessionId = sessionId || uuidv4();
    const sessionStore = getSessionStore();
    const ttl = getTTL();
    const expiresAt = Date.now() + ttl;

    // Store session
    const session = {
      lang: lang || 'de',           // Default to DE
      config,                        // Store as 'config' not 'payload'
      createdAt: new Date().toISOString(),
      expiresAt,
    };

    sessionStore.set(finalSessionId, session);

    console.info('[CONFIG_SESSION] Created:', {
      sessionId: finalSessionId,
      lang: session.lang,
      configKeys: Object.keys(config),
      ttl: '45min',
      origin: req.headers.origin || 'unknown',
    });

    return res.status(201).json({ ok: true, sessionId: finalSessionId });

  } catch (error) {
    console.error('[CONFIG_SESSION] Error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
