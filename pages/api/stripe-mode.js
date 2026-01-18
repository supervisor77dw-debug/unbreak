/**
 * STRIPE MODE API
 * GET /api/stripe-mode
 * 
 * Returns current Stripe mode (test/live) based on publishable key
 */

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || '';
    const isTestMode = publishableKey.startsWith('pk_test_');
    const isLiveMode = publishableKey.startsWith('pk_live_');
    
    return res.status(200).json({
      mode: isTestMode ? 'test' : 'live',
      isTestMode,
      isLiveMode,
    });
  } catch (error) {
    console.error('[Stripe Mode API] Error:', error);
    return res.status(500).json({ error: 'Failed to determine Stripe mode' });
  }
}
