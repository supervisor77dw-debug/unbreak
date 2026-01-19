/**
 * STRIPE MODE API
 * GET /api/stripe-mode
 * 
 * Returns current Stripe mode (test/live) based on:
 * 1. STRIPE_CHECKOUT_MODE env var (explicit)
 * 2. STRIPE_SECRET_KEY_TEST / STRIPE_SECRET_KEY_LIVE availability
 * 3. Fallback to publishable key detection
 */

import { getCheckoutMode, getPublishableKey } from '../../lib/stripe-config.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Primary: Use centralized mode detection
    const mode = getCheckoutMode();
    const isTestMode = mode === 'test';
    const isLiveMode = mode === 'live';
    
    // Get matching publishable key
    const publishableKey = getPublishableKey(mode);
    
    return res.status(200).json({
      mode,
      isTestMode,
      isLiveMode,
      source: process.env.STRIPE_CHECKOUT_MODE ? 'STRIPE_CHECKOUT_MODE' : 'auto-detect',
      publishableKey: publishableKey ? `${publishableKey.substring(0, 12)}...` : 'not-set',
    });
  } catch (error) {
    console.error('[Stripe Mode API] Error:', error);
    return res.status(500).json({ error: 'Failed to determine Stripe mode' });
  }
}
