/**
 * UNBREAK ONE - Checkout API
 * POST /api/checkout/create
 * 
 * Creates a Stripe Checkout Session for configured product
 * 
 * Flow:
 * 1. Validate product + config
 * 2. Calculate price (server-side, trusted)
 * 3. Upsert customer
 * 4. Create configuration record
 * 5. Create order (pending_payment)
 * 6. Create Stripe Checkout Session
 * 7. Return checkout_url
 */

import { getSupabaseAdmin } from '../../../lib/supabase';
import { stripe } from '../../../lib/stripe';
import { calculatePrice, calculateShipping, calculateTax } from '../../../lib/pricing';

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

/**
 * Generate unique order number
 * Format: UB-YYYYMMDD-XXXX
 */
function generateOrderNumber() {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `UB-${date}-${random}`;
}

export default async function handler(req, res) {
  const supabaseAdmin = getSupabaseAdmin();
  
  // Only POST allowed
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { product_sku, config, customer } = req.body;

    // ========================================
    // 1. VALIDATE INPUT
    // ========================================
    if (!product_sku || !config) {
      return res.status(400).json({
        error: 'Missing required fields',
        required: ['product_sku', 'config'],
      });
    }

    // Email is optional - will be collected in Stripe Checkout
    if (customer?.email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(customer.email)) {
        return res.status(400).json({ error: 'Invalid email address' });
      }
    }

    // ========================================
    // 2. CALCULATE PRICE (server-side)
    // ========================================
    const { product, price_cents, breakdown } = await calculatePrice(
      product_sku,
      config
    );

    // Calculate shipping & tax
    const shippingCents = calculateShipping(customer.country || 'DE');
    const subtotalCents = price_cents;
    const taxCents = calculateTax(subtotalCents + shippingCents, customer.country || 'DE');
    const totalCents = subtotalCents + shippingCents + taxCents;

    // ========================================
    // 3. UPSERT CUSTOMER (if email provided)
    // ========================================
    let customerId = null;
    
    if (customer?.email) {
      const { data: existingCustomer } = await supabaseAdmin
        .from('customers')
        .select('id')
        .eq('email', customer.email.toLowerCase())
        .single();

      if (existingCustomer) {
        customerId = existingCustomer.id;
        
        // Update name if provided and different
        if (customer.name) {
          await supabaseAdmin
            .from('customers')
            .update({ name: customer.name, updated_at: new Date().toISOString() })
            .eq('id', customerId);
        }
      } else {
        // Create new customer
        const { data: newCustomer, error: customerError } = await supabaseAdmin
          .from('customers')
          .insert({
            email: customer.email.toLowerCase(),
            name: customer.name || null,
            phone: customer.phone || null,
          })
          .select()
          .single();

        if (customerError) {
          console.error('Customer creation error:', customerError);
          return res.status(500).json({ error: 'Failed to create customer' });
        }

        customerId = newCustomer.id;
      }
    }

    // ========================================
    // 4. CREATE ORDER (pending_payment)
    // ========================================
    // Use simple_orders for guest checkout (no customer_id required)

    const { data: order, error: orderError } = await supabaseAdmin
      .from('simple_orders')
      .insert({
        customer_email: customer?.email || null,
        customer_name: customer?.name || null,
        product_sku: product_sku,
        quantity: config.quantity || 1,
        total_amount_cents: totalCents,
        currency: product.currency,
        status: 'pending',
        order_type: 'configured',
        // Store items as JSON (simple_orders has 'items' column as JSONB)
        items: [{
          product_id: product.id,
          sku: product.sku,
          name: product.title_de || product.name,
          unit_price_cents: price_cents,
          quantity: config.quantity || 1,
          // Store config in item metadata
          config: config
        }]
      })
      .select()
      .single();

    if (orderError) {
      console.error('Order creation error:', orderError);
      console.error('Order error details:', {
        message: orderError.message,
        details: orderError.details,
        hint: orderError.hint,
        code: orderError.code
      });
      return res.status(500).json({ 
        error: 'Failed to create order',
        details: orderError.message,
        hint: orderError.hint
      });
    }

    // ========================================
    // 6. CREATE STRIPE CHECKOUT SESSION
    // ========================================
    
    // Try to get existing Stripe customer ID from profiles (if user is logged in)
    let stripeCustomerId = null;
    if (req.headers.authorization) {
      const token = req.headers.authorization.replace('Bearer ', '');
      const { data: { user } } = await supabaseAdmin.auth.getUser(token);
      if (user) {
        const { data: profile } = await supabaseAdmin
          .from('profiles')
          .select('stripe_customer_id')
          .eq('id', user.id)
          .single();
        if (profile?.stripe_customer_id) {
          stripeCustomerId = profile.stripe_customer_id;
          console.log('✅ [Checkout] Using existing Stripe customer:', stripeCustomerId);
        }
      }
    }

    const checkoutSession = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      
      // CUSTOMER CREATION - Use existing or create new
      ...(stripeCustomerId ? {
        customer: stripeCustomerId,
      } : {
        customer_creation: 'always',
        customer_email: customer?.email || undefined,
      }),
      
      line_items: [
        {
          price_data: {
            currency: product.currency.toLowerCase(),
            unit_amount: totalCents,
            product_data: {
              name: product.name,
              description: `${product.description} - Konfiguration: ${JSON.stringify(config)}`,
              images: config.previewImageUrl ? [config.previewImageUrl] : [],
              metadata: {
                product_sku: product.sku,
                order_number: orderNumber,
              },
            },
          },
          quantity: 1,
        },
      ],
      
      metadata: {
        order_id: order.id,
        product_sku: product.sku,
        order_type: 'configured',
        config_json: JSON.stringify(config),
      },
      
      success_url: `${getOrigin(req)}/success?session_id={CHECKOUT_SESSION_ID}&order_number=${orderNumber}`,
      cancel_url: `${getOrigin(req)}/configurator?canceled=true`,
      expires_at: Math.floor(Date.now() / 1000) + 3600, // 1 hour expiry
    });

    // ========================================
    // 7. UPDATE ORDER WITH STRIPE SESSION ID
    // ========================================
    await supabaseAdmin
      .from('simple_orders')
      .update({
        stripe_session_id: checkoutSession.id,
        stripe_checkout_session_id: checkoutSession.id,
        updated_at: new Date().toISOString(),
      })
      .eq('id', order.id);

    // ========================================
    // 8. RETURN CHECKOUT URL
    // ========================================
    return res.status(200).json({
      success: true,
      checkout_url: checkoutSession.url,
      order_id: order.id,
      session_id: checkoutSession.id,
      total_cents: totalCents,
      currency: product.currency,
      breakdown: {
        subtotal: subtotalCents,
        shipping: shippingCents,
        tax: taxCents,
        total: totalCents,
      },
    });
  } catch (error) {
    console.error('Checkout API error:', error);
    
    return res.status(500).json({
      error: 'Checkout failed',
      message: error.message,
      ...(process.env.NODE_ENV === 'development' && { stack: error.stack }),
    });
  }
}

