import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Helper: Get origin from request (no hardcoded domains)
function getOrigin(req) {
  // 1. Try ENV variable first (most reliable for production)
  if (process.env.NEXT_PUBLIC_SITE_URL) {
    return process.env.NEXT_PUBLIC_SITE_URL;
  }
  
  // 2. Try origin header
  if (req.headers.origin) {
    return req.headers.origin;
  }
  
  // 3. Fallback: construct from host header
  const host = req.headers.host || 'localhost:3000';
  const protocol = req.headers['x-forwarded-proto'] || (host.includes('localhost') ? 'http' : 'https');
  return `${protocol}://${host}`;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { bundle_id, email } = req.body;

    if (!bundle_id) {
      return res.status(400).json({ error: 'bundle_id is required' });
    }

    // 1. Fetch bundle from database
    const { data: bundle, error: bundleError } = await supabase
      .from('bundles')
      .select('*')
      .eq('id', bundle_id)
      .eq('active', true)
      .single();

    if (bundleError || !bundle) {
      return res.status(404).json({ error: 'Bundle not found or inactive' });
    }

    // 2. Get user from session (if logged in)
    let userId = null;
    let customerEmail = email;

    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const { data: { user }, error: authError } = await supabase.auth.getUser(token);
      
      if (!authError && user) {
        userId = user.id;
        if (!customerEmail) {
          customerEmail = user.email;
        }
      }
    }

    // 3. Create order record
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert({
        customer_user_id: userId,
        customer_email: customerEmail || null,
        total_amount_cents: bundle.price_cents,
        currency: bundle.currency || 'EUR',
        status: 'pending',
        order_type: 'bundle',
        metadata: {
          bundle_id: bundle.id,
          bundle_title: bundle.title_de,
          items: bundle.items_json
        }
      })
      .select()
      .single();

    if (orderError) {
      console.error('Order creation error:', orderError);
      return res.status(500).json({ error: 'Failed to create order' });
    }

    // 4. Create Stripe Checkout Session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: bundle.currency?.toLowerCase() || 'eur',
            unit_amount: bundle.price_cents,
            product_data: {
              name: `UNBREAK ONE Bundle – ${bundle.title_de}`,
              description: bundle.description_de || undefined,
              images: bundle.image_url ? [bundle.image_url] : undefined,
            },
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${getOrigin(req)}/success.html?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${getOrigin(req)}/cancel.html`,
      customer_email: customerEmail || undefined,
      metadata: {
        order_id: order.id,
        bundle_id: bundle.id,
        type: 'bundle',
        user_id: userId || 'guest',
      },
    });

    // 5. Update order with payment intent
    await supabase
      .from('orders')
      .update({
        stripe_payment_intent_id: session.payment_intent,
        stripe_checkout_session_id: session.id,
      })
      .eq('id', order.id);

    // 6. Return checkout URL
    return res.status(200).json({
      url: session.url,
      order_id: order.id,
      session_id: session.id,
    });

  } catch (error) {
    console.error('Bundle checkout error:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  }
}
