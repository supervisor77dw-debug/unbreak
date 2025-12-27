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

import { supabaseAdmin } from '../../lib/supabase';
import { stripe } from '../../lib/stripe';
import { calculatePrice, calculateShipping, calculateTax } from '../../lib/pricing';

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
  // Only POST allowed
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { product_sku, config, customer } = req.body;

    // ========================================
    // 1. VALIDATE INPUT
    // ========================================
    if (!product_sku || !config || !customer?.email) {
      return res.status(400).json({
        error: 'Missing required fields',
        required: ['product_sku', 'config', 'customer.email'],
      });
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(customer.email)) {
      return res.status(400).json({ error: 'Invalid email address' });
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
    // 3. UPSERT CUSTOMER
    // ========================================
    const { data: existingCustomer } = await supabaseAdmin
      .from('customers')
      .select('id')
      .eq('email', customer.email.toLowerCase())
      .single();

    let customerId;

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

    // ========================================
    // 4. CREATE CONFIGURATION
    // ========================================
    const { data: configuration, error: configError } = await supabaseAdmin
      .from('configurations')
      .insert({
        product_id: product.id,
        config_json: config,
        price_cents: price_cents,
        currency: product.currency,
        preview_image_url: config.previewImageUrl || null,
        model_export_url: config.modelExportUrl || null,
      })
      .select()
      .single();

    if (configError) {
      console.error('Configuration creation error:', configError);
      return res.status(500).json({ error: 'Failed to save configuration' });
    }

    // ========================================
    // 5. CREATE ORDER (pending_payment)
    // ========================================
    const orderNumber = generateOrderNumber();

    const { data: order, error: orderError } = await supabaseAdmin
      .from('orders')
      .insert({
        order_number: orderNumber,
        customer_id: customerId,
        configuration_id: configuration.id,
        status: 'pending_payment',
        subtotal_cents: subtotalCents,
        shipping_cents: shippingCents,
        tax_cents: taxCents,
        total_cents: totalCents,
        currency: product.currency,
        shipping_address: customer.address || null,
      })
      .select()
      .single();

    if (orderError) {
      console.error('Order creation error:', orderError);
      return res.status(500).json({ error: 'Failed to create order' });
    }

    // ========================================
    // 6. CREATE STRIPE CHECKOUT SESSION
    // ========================================
    const checkoutSession = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card', 'sepa_debit', 'giropay'],
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
      customer_email: customer.email,
      metadata: {
        order_id: order.id,
        order_number: orderNumber,
        configuration_id: configuration.id,
        product_sku: product.sku,
      },
      success_url: `${process.env.NEXT_PUBLIC_BASE_URL}/success?session_id={CHECKOUT_SESSION_ID}&order_number=${orderNumber}`,
      cancel_url: `${process.env.NEXT_PUBLIC_BASE_URL}/configurator?canceled=true`,
      expires_at: Math.floor(Date.now() / 1000) + 3600, // 1 hour expiry
    });

    // ========================================
    // 7. UPDATE ORDER WITH STRIPE SESSION ID
    // ========================================
    await supabaseAdmin
      .from('orders')
      .update({
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
      order_number: orderNumber,
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
