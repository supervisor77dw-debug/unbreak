/**
 * STRIPE CONFIGURATION - Simple Key-Based Mode Detection
 * 
 * Mode is determined by key prefix ONLY:
 * - sk_test_* / pk_test_* = DEBUG/TEST
 * - sk_live_* / pk_live_* = LIVE
 * 
 * NO FLAGS, NO BRANCHES, NO STRIPE_MODE
 */

// ===================================
// MODE DETECTION (KEY PREFIX ONLY)
// ===================================

const secretKey = process.env.STRIPE_SECRET_KEY;
const IS_TEST_MODE = secretKey?.startsWith('sk_test_');
const IS_LIVE_MODE = secretKey?.startsWith('sk_live_');

// ===================================
// STRIPE KEY VALIDATION
// ===================================

/**
 * Validates that Stripe keys have correct prefix
 * @throws {Error} if keys are missing or have wrong format
 */
function validateStripeKeys() {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;

  // Secret key is REQUIRED
  if (!secretKey) {
    throw new Error('[STRIPE CONFIG] Missing STRIPE_SECRET_KEY');
  }

  // Validate prefix
  if (!secretKey.startsWith('sk_test_') && !secretKey.startsWith('sk_live_')) {
    throw new Error('[STRIPE CONFIG] STRIPE_SECRET_KEY must start with sk_test_ or sk_live_');
  }

  // Publishable key is optional (backend only)
  if (publishableKey) {
    if (!publishableKey.startsWith('pk_test_') && !publishableKey.startsWith('pk_live_')) {
      throw new Error('[STRIPE CONFIG] NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY must start with pk_test_ or pk_live_');
    }
  }

  const mode = secretKey.startsWith('sk_test_') ? 'TEST' : 'LIVE';
  console.log(`✅ [STRIPE CONFIG] Mode: ${mode} (detected from key prefix)`);
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
    _stripeInstance.mode = IS_TEST_MODE ? 'test' : 'live';
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
 * Guards checkout creation
 * @param {Object} sessionParams - Stripe checkout session parameters
 */
function guardCheckoutSession(sessionParams) {
  const mode = IS_TEST_MODE ? 'TEST' : 'LIVE';
  console.log(`💰 [STRIPE CHECKOUT] ${mode} mode`);
  
  sessionParams.metadata = {
    ...sessionParams.metadata,
    stripe_mode: mode.toLowerCase(),
  };

  return sessionParams;
}

// ===================================
// WEBHOOK VALIDATION
// ===================================

/**
 * Get webhook secret
 */
function getWebhookSecret() {
  return process.env.STRIPE_WEBHOOK_SECRET;
}

// ===================================
// EXPORTS
// ===================================

module.exports = {
  stripe,
  IS_TEST_MODE,
  IS_LIVE_MODE,
  guardCheckoutSession,
  getWebhookSecret,
  getPublishableKey: () => process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
};
