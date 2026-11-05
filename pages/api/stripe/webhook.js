/**
 * Retired Stripe webhook endpoint.
 *
 * It worked on the legacy `orders` table, while checkout writes to `simple_orders`.
 * Stripe events belong to POST /api/webhooks/stripe. The 410 makes a forgotten
 * endpoint visible in the Stripe delivery log instead of failing silently.
 */

export const config = {
  api: {
    bodyParser: false,
  },
};

export default function handler(req, res) {
  console.warn('[Webhook] Retired endpoint /api/stripe/webhook called');
  return res.status(410).json({
    error: 'Endpoint retired',
    use: '/api/webhooks/stripe',
  });
}
