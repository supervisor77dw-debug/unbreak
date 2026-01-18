/**
 * STRIPE MODE API
 * GET /api/stripe-mode
 * 
 * Returns current Stripe mode (test/live) for client-side checks
 */

import { IS_TEST_MODE, STRIPE_MODE } from '../../lib/stripe-config.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    return res.status(200).json({
      mode: STRIPE_MODE,
      isTestMode: IS_TEST_MODE,
      isLiveMode: !IS_TEST_MODE,
    });
  } catch (error) {
    console.error('[Stripe Mode API] Error:', error);
    return res.status(500).json({ error: 'Failed to determine Stripe mode' });
  }
}
