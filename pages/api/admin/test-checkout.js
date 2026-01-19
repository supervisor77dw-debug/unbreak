/**
 * Admin Test Checkout API
 * Creates a Stripe test checkout session for admin testing
 * Requires NextAuth session with admin role
 */

import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]';
import { getStripeClient } from '../../../lib/stripe-config';

const PRODUCTION_URL = 'https://unbreak-one.com';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Require NextAuth session
  const session = await getServerSession(req, res, authOptions);
  
  if (!session) {
    return res.status(401).json({ 
      error: 'Unauthorized',
      message: 'Admin login required'
    });
  }

  console.log('🔑 [ADMIN TEST CHECKOUT] User:', session.user?.email);

  try {
    // Get test mode Stripe client
    const stripe = getStripeClient('test');
    
    // Create a simple test product checkout
    const checkoutSession = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'eur',
            unit_amount: 100, // 1.00 EUR
            product_data: {
              name: '🧪 Admin Test Order',
              description: 'Test-Bestellung für Admin-Verifizierung',
            },
          },
          quantity: 1,
        },
      ],
      customer_email: session.user?.email,
      success_url: `${PRODUCTION_URL}/success?session_id={CHECKOUT_SESSION_ID}&test=true`,
      cancel_url: `${PRODUCTION_URL}/admin/orders?canceled=true`,
      metadata: {
        source: 'admin_test_checkout',
        admin_email: session.user?.email,
        test_mode: 'true',
      },
    });

    console.log('✅ [ADMIN TEST CHECKOUT] Session created:', checkoutSession.id);

    return res.status(200).json({
      success: true,
      url: checkoutSession.url,
      session_id: checkoutSession.id,
    });

  } catch (error) {
    console.error('❌ [ADMIN TEST CHECKOUT] Error:', error.message);
    return res.status(500).json({
      error: 'Failed to create test checkout',
      message: error.message,
    });
  }
}
