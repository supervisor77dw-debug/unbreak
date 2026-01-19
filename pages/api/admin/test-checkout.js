/**
 * Admin Test Checkout API
 * Creates a Stripe test checkout session for admin testing
 * Requires NextAuth session with admin role
 * 
 * Version: 3.0.0 - Creates simple_orders entry first
 */

import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]';
import { getStripeClient } from '../../../lib/stripe-config';
import { createClient } from '@supabase/supabase-js';

const PRODUCTION_URL = 'https://unbreak-one.com';

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

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
    // Check if test key is available
    const testKey = process.env.STRIPE_SECRET_KEY_TEST || 
                    (process.env.STRIPE_SECRET_KEY?.startsWith('sk_test') ? process.env.STRIPE_SECRET_KEY : null);
    
    if (!testKey) {
      console.error('❌ [ADMIN TEST CHECKOUT] No test key available');
      return res.status(500).json({
        error: 'No test key configured',
        message: 'STRIPE_SECRET_KEY_TEST ist nicht konfiguriert. Bitte in Vercel Environment setzen.',
      });
    }
    
    // Get test mode Stripe client
    const stripe = getStripeClient('test');
    
    // 1. First, create an order in simple_orders
    const orderId = `TEST-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
    
    const orderData = {
      order_id: orderId,
      customer_email: session.user?.email,
      status: 'pending',
      amount_total: 100, // 1.00 EUR in cents
      currency: 'eur',
      items: JSON.stringify([{
        name: '🧪 Admin Test Order',
        description: 'Test-Bestellung für Admin-Verifizierung',
        quantity: 1,
        price: 100,
      }]),
      shipping_address: JSON.stringify({
        name: 'Admin Test',
        line1: 'Test Street 1',
        city: 'Test City',
        postal_code: '12345',
        country: 'DE',
      }),
      metadata: JSON.stringify({
        source: 'admin_test_checkout',
        admin_email: session.user?.email,
        test_mode: true,
      }),
      created_at: new Date().toISOString(),
    };

    console.log('📝 [ADMIN TEST CHECKOUT] Creating order:', orderId);

    const { error: insertError } = await supabase
      .from('simple_orders')
      .insert([orderData]);

    if (insertError) {
      console.error('❌ [ADMIN TEST CHECKOUT] Failed to create order:', insertError.message);
      return res.status(500).json({
        error: 'Failed to create order',
        message: insertError.message,
      });
    }

    console.log('✅ [ADMIN TEST CHECKOUT] Order created:', orderId);

    // 2. Create Stripe checkout session with order_id in metadata
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
        order_id: orderId,
        source: 'admin_test_checkout',
        admin_email: session.user?.email,
        test_mode: 'true',
      },
    });

    // 3. Update order with stripe_session_id
    const { error: updateError } = await supabase
      .from('simple_orders')
      .update({ stripe_session_id: checkoutSession.id })
      .eq('order_id', orderId);

    if (updateError) {
      console.error('⚠️ [ADMIN TEST CHECKOUT] Failed to update stripe_session_id:', updateError.message);
      // Continue anyway - webhook can still find by metadata
    }

    console.log('✅ [ADMIN TEST CHECKOUT] Stripe session created:', checkoutSession.id);

    return res.status(200).json({
      success: true,
      url: checkoutSession.url,
      session_id: checkoutSession.id,
      order_id: orderId,
    });

  } catch (error) {
    console.error('❌ [ADMIN TEST CHECKOUT] Error:', error.message);
    return res.status(500).json({
      error: 'Failed to create test checkout',
      message: error.message,
    });
  }
}
