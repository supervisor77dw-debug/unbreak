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

    // STRIPE ACCOUNT VERIFICATION
    const secretKey = process.env.STRIPE_SECRET_KEY;
    const keyPrefix = secretKey.substring(0, 8); // sk_test_ or sk_live_
    const isTestMode = keyPrefix.includes('test');
    
    console.log('🔑 [STRIPE ACCOUNT] Key prefix:', keyPrefix);
    console.log('🔑 [STRIPE ACCOUNT] Mode:', isTestMode ? 'TEST' : 'LIVE');
    
    // Get Stripe account ID
    try {
      const account = await stripe.accounts.retrieve();
      console.log('🔑 [STRIPE ACCOUNT] Account ID:', account.id);
      console.log('🔑 [STRIPE ACCOUNT] Email:', account.email || 'N/A');
      console.log('🔑 [STRIPE ACCOUNT] Country:', account.country);
    } catch (accError) {
      console.warn('⚠️ [STRIPE ACCOUNT] Could not retrieve account:', accError.message);
    }

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('❌ [Checkout] Supabase credentials missing');
      return res.status(500).json({ error: 'Server configuration error: Supabase credentials missing' });
    }

    // Support both single product (legacy) and cart items (new)
    const { sku, email, items } = req.body;
    console.log('📦 [Checkout] Request:', { sku, email, items: items?.length });

    // Validate input
    if (!items && !sku) {
      console.error('❌ [Checkout] Missing items or sku');
      return res.status(400).json({ error: 'Either items array or sku is required' });
    }

    if (items && (!Array.isArray(items) || items.length === 0)) {
      console.error('❌ [Checkout] Invalid items array');
      return res.status(400).json({ error: 'Items must be a non-empty array' });
    }

    // 1. Fetch and validate products
    let cartItems = [];
    let totalAmount = 0;

    if (items) {
      // New cart flow: multiple items with quantities
      console.log('🛒 [Checkout] Processing cart with', items.length, 'items');

      for (const item of items) {
        if (!item.product_id || !item.quantity || item.quantity < 1) {
          console.error('❌ [Checkout] Invalid item:', item);
          return res.status(400).json({ 
            error: 'Each item must have product_id and quantity >= 1',
            invalid_item: item
          });
        }

        // Fetch product from database (server-side price validation)
        const { data: product, error: productError } = await supabase
          .from('products')
          .select('*')
          .eq('id', item.product_id)
          .eq('active', true)
          .single();

        if (productError || !product) {
          console.error('❌ [Checkout] Product not found:', item.product_id);
          return res.status(404).json({ 
            error: 'Product not found or inactive',
            product_id: item.product_id 
          });
        }

        const itemTotal = product.base_price_cents * item.quantity;
        totalAmount += itemTotal;

        cartItems.push({
          product_id: product.id,
          sku: product.sku,
          name: product.title_de || product.name || product.sku,
          unit_price_cents: product.base_price_cents,
          quantity: item.quantity,
          image_url: product.image_url || null,
        });

        console.log('✅ [Checkout] Item validated:', {
          sku: product.sku,
          quantity: item.quantity,
          unit_price: product.base_price_cents,
          subtotal: itemTotal
        });
      }

      console.log('💰 [Checkout] Total amount:', totalAmount, 'cents');

    } else {
      // Legacy flow: single product
      console.log('🔍 [Checkout] Fetching single product:', sku);
      const { data: product, error: productError } = await supabase
        .from('products')
        .select('*')
        .eq('sku', sku)
        .eq('active', true)
        .single();

      if (productError || !product) {
        console.error('❌ [Checkout] Product not found:', sku);
        return res.status(404).json({ error: 'Product not found or inactive' });
      }

      totalAmount = product.base_price_cents;
      cartItems = [{
        product_id: product.id,
        sku: product.sku,
        name: product.title_de || product.name || product.sku,
        unit_price_cents: product.base_price_cents,
        quantity: 1,
        image_url: product.image_url || null,
      }];

      console.log('✅ [Checkout] Product found:', {
        sku: product.sku,
        price: product.base_price_cents
      });
    }

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
      items: cartItems, // JSON array of cart items
      total_amount_cents: totalAmount,
      currency: 'EUR',
      status: 'pending',
      order_type: 'standard',
      // Legacy fields for backwards compatibility
      product_sku: cartItems[0]?.sku || null,
      quantity: items ? items.reduce((sum, item) => sum + item.quantity, 0) : 1,
    };
    console.log('📝 [Checkout] Order data:', {
      items: orderData.items.length,
      total: orderData.total_amount_cents,
      customer: orderData.customer_email
    });

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

    // Build line_items from cart
    const lineItems = cartItems.map(item => ({
      price_data: {
        currency: 'eur',
        product_data: {
          name: item.name,
          images: item.image_url ? [item.image_url] : undefined,
        },
        unit_amount: item.unit_price_cents,
      },
      quantity: item.quantity,
    }));

    const sessionData = {
      payment_method_types: ['card'],
      line_items: lineItems,
      mode: 'payment',
      success_url: `${origin}/success.html?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/cancel.html`,
      customer_email: customerEmail || undefined,
      metadata: {
        order_id: order.id,
        type: 'standard',
        user_id: userId || 'guest',
        item_count: cartItems.length,
      },
    };
    console.log('💳 [Checkout] Stripe session data:', {
      mode: sessionData.mode,
      line_items: sessionData.line_items.length,
      total_items: cartItems.reduce((sum, item) => sum + item.quantity, 0),
      success_url: sessionData.success_url,
      customer_email: sessionData.customer_email
    });

    const session = await stripe.checkout.sessions.create(sessionData);
    
    console.log('✅ [Checkout] Stripe session created:', session.id);
    console.log('🔍 [SESSION CREATED] ID:', session.id);
    console.log('🔍 [SESSION CREATED] Mode:', session.mode);
    console.log('🔍 [SESSION CREATED] URL:', session.url);
    console.log('🔍 [SESSION CREATED] Amount total:', session.amount_total);
    console.log('🔍 [SESSION CREATED] Currency:', session.currency);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📋 [ACTION REQUIRED] Search for this Session ID in Stripe Dashboard:');
    console.log('📋 Session ID:', session.id);
    console.log('📋 If NOT found in your dashboard → Wrong Stripe account/key!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

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
