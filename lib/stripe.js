/**
 * Stripe Client Configuration
 * Server-side only
 */

import Stripe from 'stripe';

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;

if (!stripeSecretKey) {
  throw new Error('Missing STRIPE_SECRET_KEY in environment variables');
}

/**
 * Stripe client instance
 * Use Test Mode key for development, Live Mode for production
 */
export const stripe = new Stripe(stripeSecretKey, {
  apiVersion: '2023-10-16', // Latest stable API version
  typescript: true,
});

/**
 * Stripe Webhook Secret for signature verification
 */
export const stripeWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
