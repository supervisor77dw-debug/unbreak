import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Helper: Get origin from request (no hardcoded domains)
function getOrigin(req) {
  // Try origin header first (most reliable)
  if (req.headers.origin) {
    return req.headers.origin;
  }
  
  // Fallback: construct from host header
  const host = req.headers.host || 'localhost:3000';
  const protocol = req.headers['x-forwarded-proto'] || (host.includes('localhost') ? 'http' : 'https');
  return `${protocol}://${host}`;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { sku, email } = req.body;

    if (!sku) {
      return res.status(400).json({ error: 'sku is required' });
    }

    // 1. Fetch product from database
    const { data: product, error: productError } = await supabase
      .from('products')
      .select('*')
      .eq('sku', sku)
      .eq('active', true)
      .single();

    if (productError || !product) {
      return res.status(404).json({ error: 'Product not found or inactive' });
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
        product_sku: product.sku,
        quantity: 1,
        total_amount_cents: product.base_price_cents,
        status: 'pending',
        order_type: 'standard',
      })
      .select()
      .single();

    if (orderError || !order) {
      console.error('Order creation error:', orderError);
      return res.status(500).json({ error: 'Failed to create order' });
    }

    // 4. Create Stripe Checkout Session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'eur',
            product_data: {
              name: product.title_de || product.sku,
              description: product.description_de || undefined,
              images: product.image_url ? [product.image_url] : undefined,
            },
            unit_amount: product.base_price_cents,
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
        product_sku: product.sku,
        type: 'standard',
        user_id: userId || 'guest',
      },
    });

    // 5. Update order with Stripe session ID
    await supabase
      .from('orders')
      .update({ 
        stripe_session_id: session.id,
        updated_at: new Date().toISOString(),
      })
      .eq('id', order.id);

    // 6. Return checkout URL
    res.status(200).json({ 
      url: session.url,
      session_id: session.id,
      order_id: order.id,
    });

  } catch (error) {
    console.error('Checkout error:', error);
    res.status(500).json({ 
      error: error.message || 'Internal server error',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    });
  }
}
