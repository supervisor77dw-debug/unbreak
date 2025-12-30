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

  console.log('🛒 [Checkout] Starting standard checkout');
  console.log('📥 [Checkout] Request body:', req.body);

  try {
    // ENV CHECK
    if (!process.env.STRIPE_SECRET_KEY) {
      console.error('❌ [Checkout] STRIPE_SECRET_KEY not set');
      return res.status(500).json({ error: 'Server configuration error: STRIPE_SECRET_KEY missing' });
    }
    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('❌ [Checkout] Supabase credentials missing');
      return res.status(500).json({ error: 'Server configuration error: Supabase credentials missing' });
    }

    const { sku, email } = req.body;
    console.log('📦 [Checkout] SKU:', sku);
    console.log('📧 [Checkout] Email:', email);

    if (!sku) {
      console.error('❌ [Checkout] Missing SKU in request');
      return res.status(400).json({ error: 'SKU is required' });
    }

    // 1. Fetch product from database
    console.log('🔍 [Checkout] Fetching product:', sku);
    const { data: product, error: productError } = await supabase
      .from('products')
      .select('*')
      .eq('sku', sku)
      .eq('active', true)
      .single();

    if (productError) {
      console.error('❌ [Checkout] Product fetch error:', productError);
      return res.status(404).json({ error: 'Product not found', details: productError.message });
    }
    
    if (!product) {
      console.error('❌ [Checkout] Product not found or inactive:', sku);
      return res.status(404).json({ error: 'Product not found or inactive' });
    }

    console.log('✅ [Checkout] Product found:', {
      sku: product.sku,
      name: product.title_de,
      price: product.base_price_cents,
      active: product.active
    });

    // 2. Get user from session (if logged in)
    let userId = null;
    let customerEmail = email;

    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      console.log('🔐 [Checkout] Auth header present, checking user');
      const token = authHeader.substring(7);
      const { data: { user }, error: authError } = await supabase.auth.getUser(token);
      
      if (!authError && user) {
        userId = user.id;
        if (!customerEmail) {
          customerEmail = user.email;
        }
        console.log('✅ [Checkout] User authenticated:', userId);
      } else {
        console.log('⚠️ [Checkout] Auth header invalid or expired');
      }
    } else {
      console.log('ℹ️ [Checkout] Guest checkout (no auth header)');
    }

    console.log('👤 [Checkout] Customer email:', customerEmail || 'none provided');

    // 3. Create order record
    console.log('📝 [Checkout] Creating order record');
    const orderData = {
      customer_user_id: userId,
      customer_email: customerEmail,
      product_sku: product.sku,
      quantity: 1,
      total_amount_cents: product.base_price_cents,
      status: 'pending',
      order_type: 'standard',
    };
    console.log('📝 [Checkout] Order data:', orderData);

    const { data: order, error: orderError } = await supabase
      .from('simple_orders')
      .insert(orderData)
      .select()
      .single();

    if (orderError) {
      console.error('❌ [Checkout] Order creation failed:', orderError);
      return res.status(500).json({ 
        error: 'Failed to create order', 
        details: orderError.message,
        hint: orderError.hint 
      });
    }
    
    if (!order) {
      console.error('❌ [Checkout] Order created but not returned');
      return res.status(500).json({ error: 'Order creation returned no data' });
    }

    console.log('✅ [Checkout] Order created:', order.id);

    // 4. Create Stripe Checkout Session
    console.log('💳 [Checkout] Creating Stripe session');
    const origin = getOrigin(req);
    console.log('🌐 [Checkout] Origin:', origin);

    const sessionData = {
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
      success_url: `${origin}/success.html?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/cancel.html`,
      customer_email: customerEmail || undefined,
      metadata: {
        order_id: order.id,
        product_sku: product.sku,
        type: 'standard',
        user_id: userId || 'guest',
      },
    };
    console.log('💳 [Checkout] Stripe session data:', {
      mode: sessionData.mode,
      line_items: sessionData.line_items.length,
      success_url: sessionData.success_url,
      customer_email: sessionData.customer_email
    });

    const session = await stripe.checkout.sessions.create(sessionData);
    console.log('✅ [Checkout] Stripe session created:', session.id);

    // 5. Update order with Stripe session ID
    console.log('📝 [Checkout] Updating order with session ID');
    const { error: updateError } = await supabase
      .from('simple_orders')
      .update({ 
        stripe_session_id: session.id,
        updated_at: new Date().toISOString(),
      })
      .eq('id', order.id);

    if (updateError) {
      console.error('⚠️ [Checkout] Failed to update order:', updateError);
      // Don't fail the request - session is created
    }

    // 6. Return checkout URL
    console.log('✅ [Checkout] Success! Returning session URL');
    res.status(200).json({ 
      url: session.url,
      session_id: session.id,
      order_id: order.id,
    });

  } catch (error) {
    console.error('❌ [Checkout] Fatal error:', error);
    console.error('❌ [Checkout] Error stack:', error.stack);
    
    // Specific error handling
    if (error.type === 'StripeInvalidRequestError') {
      return res.status(400).json({ 
        error: 'Invalid payment request',
        details: error.message,
      });
    }
    
    if (error.code === 'PGRST116') {
      return res.status(404).json({
        error: 'Database record not found',
        details: error.message
      });
    }

    res.status(500).json({ 
      error: 'Checkout failed',
      message: error.message || 'Internal server error',
      type: error.type || 'UnknownError',
    });
  }
}
