/**
 * STRIPE CONFIGURATION - Dual Mode Support (Test/Live)
 * 
 * Supports parallel Test/Live mode in a single deployment:
 * - STRIPE_SECRET_KEY_TEST (sk_test_*)
 * - STRIPE_SECRET_KEY_LIVE (sk_live_*)
 * - STRIPE_SECRET_KEY (optional legacy fallback)
 * - STRIPE_CHECKOUT_MODE (test|live) - determines default mode
 * 
 * Mode Detection:
 * 1. If STRIPE_CHECKOUT_MODE is set, use it
 * 2. Otherwise auto-detect from available keys
 */

// ===================================
// DUAL-MODE KEY MANAGEMENT
// ===================================

const testKey = process.env.STRIPE_SECRET_KEY_TEST;
const liveKey = process.env.STRIPE_SECRET_KEY_LIVE;
const legacyKey = process.env.STRIPE_SECRET_KEY; // Optional fallback

// Determine default mode from ENV or auto-detect
function getCheckoutMode() {
  const modeOverride = process.env.STRIPE_CHECKOUT_MODE;
  if (modeOverride === 'test' || modeOverride === 'live') {
    return modeOverride;
  }
  // Auto-detect: prefer live if available, otherwise test
  if (liveKey || legacyKey?.startsWith('sk_live')) {
    return 'live';
  }
  return 'test';
}

// Mode detection (for backwards compatibility)
const IS_TEST_MODE = getCheckoutMode() === 'test';
const IS_LIVE_MODE = getCheckoutMode() === 'live';

// ===================================
// STRIPE KEY RESOLUTION
// ===================================

/**
 * Get secret key for specific mode
 * @param {'test' | 'live'} mode - The mode to use
 * @returns {string|null} Secret key or null if not available
 */
function getSecretKeyForMode(mode) {
  if (mode === 'test') {
    return testKey || (legacyKey?.startsWith('sk_test') ? legacyKey : null);
  } else {
    return liveKey || (legacyKey?.startsWith('sk_live') ? legacyKey : null);
  }
}

/**
 * Validates that at least one Stripe key is configured
 * @throws {Error} if no keys are available
 */
function validateStripeKeys() {
  const hasTestKey = testKey || legacyKey?.startsWith('sk_test');
  const hasLiveKey = liveKey || legacyKey?.startsWith('sk_live');

  if (!hasTestKey && !hasLiveKey) {
    throw new Error('[STRIPE CONFIG] No Stripe keys configured. Set STRIPE_SECRET_KEY_TEST and/or STRIPE_SECRET_KEY_LIVE');
  }

  const mode = getCheckoutMode();
  const activeKey = getSecretKeyForMode(mode);
  
  if (!activeKey) {
    throw new Error(`[STRIPE CONFIG] No key available for ${mode.toUpperCase()} mode. Set STRIPE_SECRET_KEY_${mode.toUpperCase()}`);
  }

  console.log(`✅ [STRIPE CONFIG] Mode: ${mode.toUpperCase()} (from STRIPE_CHECKOUT_MODE or auto-detect)`);
  console.log(`✅ [STRIPE CONFIG] Available keys: TEST=${!!hasTestKey}, LIVE=${!!hasLiveKey}`);
}

// ===================================
// STRIPE CLIENT INITIALIZATION (DUAL MODE)
// ===================================

const Stripe = require('stripe');

// Cache for Stripe instances per mode
const _stripeInstances = {};
let _validationDone = false;

/**
 * Get Stripe instance for specific mode
 * @param {'test' | 'live'} mode - The mode to use (default: from getCheckoutMode())
 * @returns {Stripe} Stripe instance
 */
function getStripeInstance(mode = getCheckoutMode()) {
  // Validate keys on first use
  if (!_validationDone) {
    validateStripeKeys();
    _validationDone = true;
  }
  
  // Return cached instance if available
  if (_stripeInstances[mode]) {
    return _stripeInstances[mode];
  }
  
  const secretKey = getSecretKeyForMode(mode);
  if (!secretKey) {
    throw new Error(`[STRIPE CONFIG] No key available for ${mode.toUpperCase()} mode`);
  }
  
  const instance = new Stripe(secretKey, {
    apiVersion: '2023-10-16',
    typescript: false,
  });
  
  // Add mode flags
  instance.isTestMode = mode === 'test';
  instance.isLiveMode = mode === 'live';
  instance.mode = mode;
  
  _stripeInstances[mode] = instance;
  return instance;
}

/**
 * Get Stripe client for specific mode
 * Alias for getStripeInstance() for consistency with lib/stripe.js
 */
function getStripeClient(mode = getCheckoutMode()) {
  return getStripeInstance(mode);
}

// Default Stripe proxy (uses current checkout mode)
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
 * @param {'test' | 'live'} mode - Optional explicit mode
 */
function guardCheckoutSession(sessionParams, mode = getCheckoutMode()) {
  console.log(`💰 [STRIPE CHECKOUT] ${mode.toUpperCase()} mode`);
  
  sessionParams.metadata = {
    ...sessionParams.metadata,
    stripe_mode: mode,
  };

  return sessionParams;
}

// ===================================
// WEBHOOK VALIDATION
// ===================================

/**
 * Get webhook secret(s)
 * Supports multiple secrets separated by | for dual mode
 * @returns {string} Single secret or pipe-separated secrets
 */
function getWebhookSecret() {
  return process.env.STRIPE_WEBHOOK_SECRETS || process.env.STRIPE_WEBHOOK_SECRET || '';
}

/**
 * Get webhook secrets as array
 * @returns {string[]} Array of secrets
 */
function getWebhookSecrets() {
  const secret = getWebhookSecret();
  return secret.includes('|') 
    ? secret.split('|').map(s => s.trim()).filter(Boolean)
    : [secret.trim()].filter(Boolean);
}

// ===================================
// PUBLISHABLE KEY
// ===================================

/**
 * Get publishable key for specific mode
 * @param {'test' | 'live'} mode - The mode to use
 * @returns {string} Publishable key
 */
function getPublishableKey(mode = getCheckoutMode()) {
  if (mode === 'test') {
    return process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY_TEST || process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
  } else {
    return process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY_LIVE || process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
  }
}

// ===================================
// EXPORTS
// ===================================

module.exports = {
  stripe,
  IS_TEST_MODE,
  IS_LIVE_MODE,
  getCheckoutMode,
  getStripeClient,
  getStripeInstance,
  guardCheckoutSession,
  getWebhookSecret,
  getWebhookSecrets,
  getPublishableKey,
};
