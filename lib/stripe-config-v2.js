/**
 * STRIPE CONFIGURATION V2 - Dual-Key System (LIVE & DEBUG)
 * 
 * NEUE ARCHITEKTUR (Januar 2026):
 * - Eine Domain: www.unbreak-one.com
 * - Ein Webhook: /api/webhooks/stripe
 * - Unterscheidung: event.livemode (true|false)
 * - Zwei Key-Sets parallel verfügbar:
 *   - LIVE: STRIPE_SECRET_KEY + STRIPE_WEBHOOK_SECRET
 *   - DEBUG: STRIPE_TEST_SECRET_KEY + STRIPE_TEST_WEBHOOK_SECRET
 * 
 * KEINE Flags mehr (STRIPE_MODE entfernt)
 * KEINE Branch-basierte Logik
 * KEINE Preview-URL-Wechsel
 */

const Stripe = require('stripe');

// ===================================
// DUAL-KEY VALIDATION
// ===================================

/**
 * Validates that both LIVE and TEST keys are present and correctly formatted
 * @throws {Error} if keys are missing or have wrong prefix
 */
function validateDualKeys() {
  const liveSecret = process.env.STRIPE_SECRET_KEY;
  const testSecret = process.env.STRIPE_TEST_SECRET_KEY;
  const liveWebhook = process.env.STRIPE_WEBHOOK_SECRET;
  const testWebhook = process.env.STRIPE_TEST_WEBHOOK_SECRET;

  // LIVE Keys (required)
  if (!liveSecret) {
    throw new Error('[STRIPE CONFIG] Missing STRIPE_SECRET_KEY (LIVE)');
  }
  if (!liveSecret.startsWith('sk_live_')) {
    throw new Error('[STRIPE CONFIG] STRIPE_SECRET_KEY must start with sk_live_');
  }
  if (!liveWebhook) {
    console.warn('⚠️ [STRIPE CONFIG] Missing STRIPE_WEBHOOK_SECRET (LIVE) - webhooks will fail');
  }

  // TEST Keys (required)
  if (!testSecret) {
    throw new Error('[STRIPE CONFIG] Missing STRIPE_TEST_SECRET_KEY (DEBUG)');
  }
  if (!testSecret.startsWith('sk_test_')) {
    throw new Error('[STRIPE CONFIG] STRIPE_TEST_SECRET_KEY must start with sk_test_');
  }
  if (!testWebhook) {
    console.warn('⚠️ [STRIPE CONFIG] Missing STRIPE_TEST_WEBHOOK_SECRET (DEBUG) - webhooks will fail');
  }

  // Publishable Key (optional for backend, but validate if present)
  const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
  if (publishableKey) {
    if (!publishableKey.startsWith('pk_live_') && !publishableKey.startsWith('pk_test_')) {
      throw new Error('[STRIPE CONFIG] NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY must start with pk_live_ or pk_test_');
    }
  }

  console.log('✅ [STRIPE CONFIG] Dual-Key System validated');
  console.log('✅ [STRIPE CONFIG] LIVE keys: sk_live_***, whsec_*** present');
  console.log('✅ [STRIPE CONFIG] TEST keys: sk_test_***, whsec_*** present');
}

// ===================================
// STRIPE CLIENT (DYNAMIC)
// ===================================

let _validationDone = false;

/**
 * Get Stripe instance for specific mode
 * @param {boolean} isLive - true for LIVE, false for DEBUG
 * @returns {Stripe} Stripe client
 */
function getStripeClient(isLive) {
  // Validate keys on first use
  if (!_validationDone) {
    validateDualKeys();
    _validationDone = true;
  }

  const secretKey = isLive 
    ? process.env.STRIPE_SECRET_KEY 
    : process.env.STRIPE_TEST_SECRET_KEY;

  return new Stripe(secretKey, {
    apiVersion: '2023-10-16',
    typescript: false,
  });
}

/**
 * Default Stripe client (LIVE)
 * Use this for checkout creation from frontend (uses publishable key to determine mode)
 */
const stripe = new Proxy({}, {
  get(target, prop) {
    // Determine mode from publishable key if available
    const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
    const isLive = !publishableKey || publishableKey.startsWith('pk_live_');
    
    const instance = getStripeClient(isLive);
    const value = instance[prop];
    return typeof value === 'function' ? value.bind(instance) : value;
  }
});

// ===================================
// WEBHOOK VERIFICATION (CRITICAL)
// ===================================

/**
 * Verify webhook signature and return event
 * AUTOMATIC mode detection via event.livemode
 * 
 * @param {Buffer} rawBody - Raw request body
 * @param {string} signature - Stripe signature header
 * @returns {Object} Verified Stripe event
 * @throws {Error} if signature verification fails
 */
function verifyWebhookEvent(rawBody, signature) {
  if (!signature) {
    throw new Error('Missing stripe-signature header');
  }

  // CRITICAL: We need to try BOTH secrets because we don't know the mode yet
  // Try LIVE first (more common in production)
  let event = null;
  let usedMode = null;

  try {
    const liveSecret = process.env.STRIPE_WEBHOOK_SECRET;
    const liveStripe = getStripeClient(true);
    event = liveStripe.webhooks.constructEvent(rawBody, signature, liveSecret);
    usedMode = 'LIVE';
    console.log('✅ [WEBHOOK] Verified with LIVE secret');
  } catch (liveError) {
    // LIVE failed, try TEST
    try {
      const testSecret = process.env.STRIPE_TEST_WEBHOOK_SECRET;
      const testStripe = getStripeClient(false);
      event = testStripe.webhooks.constructEvent(rawBody, signature, testSecret);
      usedMode = 'DEBUG';
      console.log('✅ [WEBHOOK] Verified with TEST secret');
    } catch (testError) {
      // Both failed
      console.error('❌ [WEBHOOK] LIVE verification failed:', liveError.message);
      console.error('❌ [WEBHOOK] TEST verification failed:', testError.message);
      throw new Error(`Webhook signature verification failed with both LIVE and TEST secrets`);
    }
  }

  // Double-check: event.livemode should match the secret that worked
  const eventMode = event.livemode ? 'LIVE' : 'DEBUG';
  if (eventMode !== usedMode) {
    console.warn(`⚠️ [WEBHOOK] Mode mismatch: event.livemode=${event.livemode} but verified with ${usedMode} secret`);
  }

  console.log(`🔒 [WEBHOOK] Event verified: ${eventMode} mode (event.livemode=${event.livemode})`);
  return event;
}

/**
 * Get appropriate Stripe client for webhook event processing
 * @param {Object} event - Verified Stripe event
 * @returns {Stripe} Stripe client matching event mode
 */
function getStripeForEvent(event) {
  const isLive = event.livemode === true;
  console.log(`🔑 [STRIPE CLIENT] Using ${isLive ? 'LIVE' : 'DEBUG'} client for event`);
  return getStripeClient(isLive);
}

// ===================================
// CHECKOUT GUARD
// ===================================

/**
 * Guards checkout session creation
 * @param {Object} sessionParams - Stripe checkout session parameters
 * @returns {Object} Enhanced session parameters with metadata
 */
function guardCheckoutSession(sessionParams) {
  const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
  const isLive = publishableKey?.startsWith('pk_live_');
  
  if (isLive) {
    console.log('💰 [STRIPE CHECKOUT] LIVE mode - real payment will be processed');
    sessionParams.metadata = {
      ...sessionParams.metadata,
      stripe_mode: 'live',
    };
  } else {
    console.log('🧪 [STRIPE CHECKOUT] DEBUG mode - test payment');
    sessionParams.metadata = {
      ...sessionParams.metadata,
      stripe_mode: 'test',
    };
  }

  return sessionParams;
}

// ===================================
// EXPORTS
// ===================================

module.exports = {
  stripe,
  getStripeClient,
  verifyWebhookEvent,
  getStripeForEvent,
  guardCheckoutSession,
  getPublishableKey: () => process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
};
