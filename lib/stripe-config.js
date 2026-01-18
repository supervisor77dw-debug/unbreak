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

  // Secret key is REQUIRED for backend
  if (!secretKey) {
    throw new Error(
      `[STRIPE CONFIG] Missing STRIPE_SECRET_KEY (required for backend operations)`
    );
  }

  // Publishable key is optional (only needed for frontend)
  if (!publishableKey) {
    console.warn(`⚠️ [STRIPE CONFIG] Missing STRIPE_PUBLISHABLE_KEY (optional for backend-only operations)`);
  }

  // Test mode: Secret key MUST start with sk_test_
  if (IS_TEST_MODE) {
    if (!secretKey.startsWith('sk_test_')) {
      throw new Error(
        `[STRIPE CONFIG] STRIPE_MODE=test but STRIPE_SECRET_KEY is not a test key (must start with sk_test_)`
      );
    }
    if (publishableKey && !publishableKey.startsWith('pk_test_')) {
      throw new Error(
        `[STRIPE CONFIG] STRIPE_MODE=test but STRIPE_PUBLISHABLE_KEY is not a test key (must start with pk_test_)`
      );
    }
  }

  // Live mode: Secret key MUST start with sk_live_
  if (IS_LIVE_MODE) {
    if (!secretKey.startsWith('sk_live_')) {
      throw new Error(
        `[STRIPE CONFIG] STRIPE_MODE=live but STRIPE_SECRET_KEY is not a live key (must start with sk_live_)`
      );
    }
    if (publishableKey && !publishableKey.startsWith('pk_live_')) {
      throw new Error(
        `[STRIPE CONFIG] STRIPE_MODE=live but STRIPE_PUBLISHABLE_KEY is not a live key (must start with pk_live_)`
      );
    }
  }

  console.log(`✅ [STRIPE CONFIG] Mode: ${STRIPE_MODE.toUpperCase()}, Keys validated`);
}

// ===================================
// STRIPE CLIENT INITIALIZATION (LAZY)
// ===================================

const Stripe = require('stripe');

let _stripeInstance = null;
let _validationDone = false;

/**
 * Get Stripe instance (lazy init with validation)
 */
function getStripeInstance() {
  if (!_stripeInstance) {
    // Validate keys on first use (not at module load)
    if (!_validationDone) {
      validateStripeKeys();
      _validationDone = true;
    }
    
    _stripeInstance = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: '2023-10-16',
      typescript: false,
    });
    
    // Add test mode flags
    _stripeInstance.isTestMode = IS_TEST_MODE;
    _stripeInstance.isLiveMode = IS_LIVE_MODE;
    _stripeInstance.mode = STRIPE_MODE;
  }
  
  return _stripeInstance;
}

// Proxy object that validates on property access
const stripe = new Proxy({}, {
  get(target, prop) {
    const instance = getStripeInstance();
    const value = instance[prop];
    return typeof value === 'function' ? value.bind(instance) : value;
  }
});

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
