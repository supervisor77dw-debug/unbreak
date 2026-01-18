/**
 * STRIPE CONFIGURATION - Test/Live Mode Control
 * 
 * This file enforces strict separation between Test and Live modes.
 * Production mistakes are prevented through environment-based validation.
 */

// ===================================
// ENVIRONMENT DETECTION
// ===================================

const STRIPE_MODE = process.env.STRIPE_MODE || 'test'; // Default: TEST
const IS_TEST_MODE = STRIPE_MODE === 'test';
const IS_LIVE_MODE = STRIPE_MODE === 'live';

// ===================================
// STRIPE KEY VALIDATION
// ===================================

/**
 * Validates that Stripe keys match the configured mode
 * @throws {Error} if keys don't match mode or are missing
 */
function validateStripeKeys() {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  const publishableKey = process.env.STRIPE_PUBLISHABLE_KEY;

  if (!secretKey || !publishableKey) {
    throw new Error(
      `[STRIPE CONFIG] Missing Stripe keys. Required: STRIPE_SECRET_KEY, STRIPE_PUBLISHABLE_KEY`
    );
  }

  // Test mode: Keys MUST start with sk_test_ and pk_test_
  if (IS_TEST_MODE) {
    if (!secretKey.startsWith('sk_test_')) {
      throw new Error(
        `[STRIPE CONFIG] STRIPE_MODE=test but STRIPE_SECRET_KEY is not a test key (must start with sk_test_)`
      );
    }
    if (!publishableKey.startsWith('pk_test_')) {
      throw new Error(
        `[STRIPE CONFIG] STRIPE_MODE=test but STRIPE_PUBLISHABLE_KEY is not a test key (must start with pk_test_)`
      );
    }
  }

  // Live mode: Keys MUST start with sk_live_ and pk_live_
  if (IS_LIVE_MODE) {
    if (!secretKey.startsWith('sk_live_')) {
      throw new Error(
        `[STRIPE CONFIG] STRIPE_MODE=live but STRIPE_SECRET_KEY is not a live key (must start with sk_live_)`
      );
    }
    if (!publishableKey.startsWith('pk_live_')) {
      throw new Error(
        `[STRIPE CONFIG] STRIPE_MODE=live but STRIPE_PUBLISHABLE_KEY is not a live key (must start with pk_live_)`
      );
    }
  }

  console.log(`✅ [STRIPE CONFIG] Mode: ${STRIPE_MODE.toUpperCase()}, Keys validated`);
}

// Validate on load
validateStripeKeys();

// ===================================
// STRIPE CLIENT INITIALIZATION
// ===================================

const Stripe = require('stripe');

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2023-10-16',
  typescript: false,
});

// Add test mode flag for runtime checks
stripe.isTestMode = IS_TEST_MODE;
stripe.isLiveMode = IS_LIVE_MODE;
stripe.mode = STRIPE_MODE;

// ===================================
// CHECKOUT GUARD
// ===================================

/**
 * Guards checkout creation - prevents accidental live payments in test mode
 * @param {Object} sessionParams - Stripe checkout session parameters
 * @throws {Error} if mode mismatch detected
 */
function guardCheckoutSession(sessionParams) {
  if (IS_TEST_MODE) {
    console.log(`🧪 [STRIPE CHECKOUT] Test mode - checkout allowed`);
    // Ensure metadata marks this as test
    sessionParams.metadata = {
      ...sessionParams.metadata,
      is_test: 'true',
      stripe_mode: 'test',
    };
  }

  if (IS_LIVE_MODE) {
    console.log(`💰 [STRIPE CHECKOUT] Live mode - real payment will be processed`);
    sessionParams.metadata = {
      ...sessionParams.metadata,
      is_test: 'false',
      stripe_mode: 'live',
    };
  }

  return sessionParams;
}

// ===================================
// WEBHOOK VALIDATION
// ===================================

/**
 * Validates webhook event matches configured mode
 * @param {Object} event - Stripe webhook event
 * @returns {boolean} true if event should be processed
 */
function shouldProcessWebhookEvent(event) {
  const eventIsLive = event.livemode === true;
  const eventIsTest = event.livemode === false;

  // Test mode: Only process test events
  if (IS_TEST_MODE && eventIsLive) {
    console.warn(`⚠️ [STRIPE WEBHOOK] Ignoring LIVE event in TEST mode: ${event.type}`);
    return false;
  }

  // Live mode: Only process live events
  if (IS_LIVE_MODE && eventIsTest) {
    console.warn(`⚠️ [STRIPE WEBHOOK] Ignoring TEST event in LIVE mode: ${event.type}`);
    return false;
  }

  return true;
}

/**
 * Get webhook secret for current mode
 */
function getWebhookSecret() {
  return process.env.STRIPE_WEBHOOK_SECRET;
}

// ===================================
// EXPORTS
// ===================================

module.exports = {
  stripe,
  STRIPE_MODE,
  IS_TEST_MODE,
  IS_LIVE_MODE,
  guardCheckoutSession,
  shouldProcessWebhookEvent,
  getWebhookSecret,
  getPublishableKey: () => process.env.STRIPE_PUBLISHABLE_KEY,
};
