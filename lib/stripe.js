/**
 * Stripe Client Configuration - Dual Mode Support
 * Server-side only
 * 
 * Supports parallel Test/Live mode in a single deployment:
 * - STRIPE_SECRET_KEY_TEST (sk_test_*)
 * - STRIPE_SECRET_KEY_LIVE (sk_live_*)
 * - STRIPE_SECRET_KEY (fallback/default)
 */

import Stripe from 'stripe';

// Get keys from environment
const testKey = process.env.STRIPE_SECRET_KEY_TEST;
const liveKey = process.env.STRIPE_SECRET_KEY_LIVE;
const defaultKey = process.env.STRIPE_SECRET_KEY;

// Determine which key to use as default (for backwards compatibility)
const stripeSecretKey = liveKey || defaultKey;

if (!stripeSecretKey && !testKey) {
  throw new Error('Missing Stripe keys. Set STRIPE_SECRET_KEY_LIVE and/or STRIPE_SECRET_KEY_TEST');
}

/**
 * Default Stripe client instance (for backwards compatibility)
 * Uses STRIPE_SECRET_KEY_LIVE or STRIPE_SECRET_KEY
 */
export const stripe = stripeSecretKey ? new Stripe(stripeSecretKey, {
  apiVersion: '2023-10-16',
  typescript: true,
}) : null;

/**
 * Get Stripe client for specific mode
 * @param {'test' | 'live'} mode - The mode to use
 * @returns {Stripe} Stripe client configured for the mode
 * @throws {Error} If required key is not configured
 */
export function getStripeClient(mode) {
  if (mode === 'test') {
    const key = testKey || (defaultKey?.startsWith('sk_test') ? defaultKey : null);
    if (!key) {
      throw new Error('Missing STRIPE_SECRET_KEY_TEST for test mode');
    }
    return new Stripe(key, { apiVersion: '2023-10-16', typescript: true });
  } else {
    const key = liveKey || (defaultKey?.startsWith('sk_live') ? defaultKey : null);
    if (!key) {
      throw new Error('Missing STRIPE_SECRET_KEY_LIVE for live mode');
    }
    return new Stripe(key, { apiVersion: '2023-10-16', typescript: true });
  }
}

/**
 * Get publishable key for specific mode
 * @param {'test' | 'live'} mode - The mode to use
 * @returns {string} Publishable key
 */
export function getPublishableKey(mode) {
  if (mode === 'test') {
    return process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY_TEST || process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
  } else {
    return process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY_LIVE || process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
  }
}

/**
 * Detect mode from session ID prefix
 * @param {string} sessionId - Stripe session ID (cs_test_* or cs_live_*)
 * @returns {'test' | 'live'}
 */
export function detectModeFromSession(sessionId) {
  if (sessionId?.startsWith('cs_test_')) return 'test';
  if (sessionId?.startsWith('cs_live_')) return 'live';
  // Fallback: check default key
  return defaultKey?.startsWith('sk_test') ? 'test' : 'live';
}

/**
 * Get current checkout mode from environment
 * Override with STRIPE_CHECKOUT_MODE env var, otherwise detect from keys
 * @returns {'test' | 'live'}
 */
export function getCheckoutMode() {
  // Explicit override
  const modeOverride = process.env.STRIPE_CHECKOUT_MODE;
  if (modeOverride === 'test' || modeOverride === 'live') {
    return modeOverride;
  }
  
  // Auto-detect: prefer live if available, otherwise test
  if (liveKey || defaultKey?.startsWith('sk_live')) {
    return 'live';
  }
  return 'test';
}

/**
 * Stripe Webhook Secret for signature verification
 * Supports multiple secrets separated by | for dual mode
 */
export const stripeWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

/**
 * Get webhook secrets as array (for multi-secret verification)
 * @returns {string[]}
 */
export function getWebhookSecrets() {
  const secret = process.env.STRIPE_WEBHOOK_SECRET || process.env.STRIPE_WEBHOOK_SECRETS || '';
  return secret.includes('|') 
    ? secret.split('|').map(s => s.trim()).filter(Boolean)
    : [secret.trim()].filter(Boolean);
}
