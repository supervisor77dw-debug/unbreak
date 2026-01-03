/**
 * UNBREAK ONE - Stripe Webhook Handler
 * POST /api/stripe/webhook
 * 
 * Processes Stripe webhook events:
 * - checkout.session.completed → Mark order as paid, create production job
 * - payment_intent.succeeded → Confirm payment
 * - charge.refunded → Mark order as refunded
 * 
 * CRITICAL: 
 * - Verify webhook signature
 * - Idempotent processing (stripe_event_id)
 * - Atomic operations
 */

import { buffer } from 'micro';
import { stripe, stripeWebhookSecret } from '../../../lib/stripe';
import { getSupabaseAdmin } from '../../../lib/supabase';

// Disable body parsing - we need raw body for signature verification
export const config = {
  api: {
    bodyParser: false,
  },
};

/**
 * Process checkout.session.completed event
 * Main event: payment successful → sync customer → update order → create production job
 * Supports: configured, standard, bundle, preset order types
 */
async function handleCheckoutCompleted(session) {
  const orderId = session.metadata.order_id;
  const orderNumber = session.metadata.order_number;
  const orderType = session.metadata.type || 'standard';
  const supabaseCustomerId = session.metadata.supabase_customer_id;

  console.log(`[Webhook] Checkout completed for order: ${orderNumber || orderId} (type: ${orderType})`);
  console.log(`[Webhook] Stripe customer:`, session.customer);
  console.log(`[Webhook] Customer details:`, session.customer_details);

  // ========================================
  // 1. SYNC CUSTOMER DATA FROM STRIPE
  // ========================================
  let customerUuid = supabaseCustomerId;
  
  if (session.customer && session.customer_details) {
    const customerEmail = session.customer_details.email;
    const customerName = session.customer_details.name;
    const customerPhone = session.customer_details.phone;
    const shippingAddress = session.customer_details.address;
    const billingAddress = session.customer_details.address; // Same for now

    console.log(`[Webhook] Syncing customer to Supabase:`, {
      stripe_customer_id: session.customer,
      email: customerEmail,
      name: customerName
    });

    // Upsert customer in Supabase (by stripe_customer_id OR email)
    const { data: existingCustomer } = await supabaseAdmin
      .from('customers')
      .select('id, stripe_customer_id')
      .or(`stripe_customer_id.eq.${session.customer},email.eq.${customerEmail}`)
      .single();

    if (existingCustomer) {
      // Update existing customer
      const { data: updatedCustomer, error: updateError } = await supabaseAdmin
        .from('customers')
        .update({
          stripe_customer_id: session.customer,
          name: customerName || existingCustomer.name,
          phone: customerPhone || existingCustomer.phone,
          shipping_address: shippingAddress || existingCustomer.shipping_address,
          billing_address: billingAddress || existingCustomer.billing_address,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingCustomer.id)
        .select()
        .single();

      if (updateError) {
        console.error(`[Webhook] Failed to update customer:`, updateError);
      } else {
        customerUuid = updatedCustomer.id;
        console.log(`[Webhook] ✅ Customer updated:`, customerUuid);
      }
    } else {
      // Create new customer
      const { data: newCustomer, error: insertError } = await supabaseAdmin
        .from('customers')
        .insert({
          stripe_customer_id: session.customer,
          email: customerEmail,
          name: customerName,
          phone: customerPhone,
          shipping_address: shippingAddress,
          billing_address: billingAddress,
        })
        .select()
        .single();

      if (insertError) {
        console.error(`[Webhook] Failed to create customer:`, insertError);
      } else {
        customerUuid = newCustomer.id;
        console.log(`[Webhook] ✅ New customer created:`, customerUuid);
      }
    }

    // Update user profile with stripe_customer_id (if user is logged in)
    if (session.metadata.user_id && session.metadata.user_id !== 'guest') {
      await supabaseAdmin
        .from('profiles')
        .update({ stripe_customer_id: session.customer })
        .eq('id', session.metadata.user_id);
      console.log(`[Webhook] ✅ Profile updated with Stripe customer ID`);
    }
  }

  // ========================================
  // 2. FETCH ORDER WITH RELATED DATA
  // ========================================
  const { data: order, error: orderError } = await supabaseAdmin
    .from('orders')
    .select(`
      *,
      customer:customers(*),
      configuration:configurations(*),
      product:configurations(products(*))
    `)
    .eq('id', orderId)
    .single();

  if (orderError || !order) {
    console.error(`[Webhook] Order not found: ${orderId}`, orderError);
    throw new Error(`Order not found: ${orderId}`);
  }

  // ========================================
  // 3. CHECK IF ALREADY PROCESSED
  // ========================================
  if (order.status === 'paid') {
    console.log(`[Webhook] Order ${orderNumber} already marked as paid - skipping`);
    return { status: 'already_processed' };
  }

  // ========================================
  // 4. UPDATE ORDER STATUS → PAID + CUSTOMER DATA
  // ========================================
  const orderUpdate = {
    status: 'paid',
    stripe_payment_intent_id: session.payment_intent,
    stripe_customer_id: session.customer,
    customer_email: session.customer_details?.email,
    customer_name: session.customer_details?.name,
    customer_phone: session.customer_details?.phone,
    billing_address: session.customer_details?.address,
    updated_at: new Date().toISOString(),
  };

  // Link to customer UUID if we have it
  if (customerUuid) {
    orderUpdate.customer_id = customerUuid;
  }

  const { error: updateError } = await supabaseAdmin
    .from('orders')
    .update(orderUpdate)
    .eq('id', orderId);

  if (updateError) {
    console.error(`[Webhook] Failed to update order ${orderNumber}:`, updateError);
    throw new Error('Failed to update order status');
  }

  console.log(`[Webhook] ✅ Order ${orderNumber} updated with customer data`);

  // ========================================
  // 5. CREATE PRODUCTION JOB PAYLOAD
  // ========================================
  let productionPayload;

  switch (orderType) {
    case 'bundle':
      // Bundle: Multiple items from metadata
      productionPayload = {
        order_number: orderNumber,
        order_type: 'bundle',
        bundle_id: session.metadata.bundle_id,
        bundle_items: order.metadata?.items || [],
        customer: {
          email: order.customer_email,
        },
        pricing: {
          total_cents: order.total_amount_cents,
          currency: order.currency,
        },
        paid_at: new Date().toISOString(),
      };
      break;

    case 'preset':
      // Preset: Pre-configured product
      productionPayload = {
        order_number: orderNumber,
        order_type: 'preset',
        preset_id: session.metadata.preset_id,
        product: {
          sku: order.metadata?.product_sku || 'UNKNOWN',
        },
        configuration: order.metadata?.config || order.configuration?.config_json,
        customer: {
          email: order.customer_email,
        },
        pricing: {
          total_cents: order.total_amount_cents,
          currency: order.currency,
        },
        preview_image_url: order.configuration?.preview_image_url,
        paid_at: new Date().toISOString(),
      };
      break;

    default:
      // Standard or configured product
      productionPayload = {
        order_number: orderNumber,
        order_type: orderType,
        product: {
          sku: order.product?.products?.sku || 'UNKNOWN',
          name: order.product?.products?.name || 'UNKNOWN',
        },
        configuration: order.configuration?.config_json,
        customer: {
          email: order.customer?.email || order.customer_email,
          name: order.customer?.name,
          phone: order.customer?.phone,
        },
        shipping_address: order.shipping_address,
        pricing: {
          subtotal_cents: order.subtotal_cents,
          shipping_cents: order.shipping_cents,
          tax_cents: order.tax_cents,
          total_cents: order.total_cents || order.total_amount_cents,
          currency: order.currency,
        },
        preview_image_url: order.configuration?.preview_image_url,
        model_export_url: order.configuration?.model_export_url,
        paid_at: new Date().toISOString(),
      };
  }

  const { error: jobError } = await supabaseAdmin
    .from('production_jobs')
    .insert({
      order_id: orderId,
      status: 'queued',
      payload_json: productionPayload,
      priority: 0, // Normal priority
    });

  if (jobError) {
    console.error(`[Webhook] Failed to create production job for ${orderNumber}:`, jobError);
    throw new Error('Failed to create production job');
  }

  console.log(`[Webhook] ✅ Order ${orderNumber} → paid + production job created`);

  return {
    status: 'processed',
    order_number: orderNumber,
    order_id: orderId,
  };
}

/**
 * Process payment_intent.succeeded event
 * Backup event - records payment confirmation
 */
async function handlePaymentIntentSucceeded(paymentIntent) {
  const orderId = paymentIntent.metadata?.order_id;

  if (!orderId) {
    console.log('[Webhook] PaymentIntent has no order_id metadata - skipping');
    return { status: 'skipped' };
  }

  console.log(`[Webhook] PaymentIntent succeeded for order: ${orderId}`);

  // Record payment event
  const { error } = await supabaseAdmin
    .from('payments')
    .insert({
      order_id: orderId,
      provider: 'stripe',
      status: 'succeeded',
      stripe_payment_intent_id: paymentIntent.id,
      amount_cents: paymentIntent.amount,
      currency: paymentIntent.currency.toUpperCase(),
      metadata: paymentIntent.metadata,
    });

  if (error) {
    console.error('[Webhook] Failed to record payment:', error);
  }

  return { status: 'recorded' };
}

/**
 * Process charge.refunded event
 * Refund handling - mark order as refunded
 */
async function handleChargeRefunded(charge) {
  const paymentIntentId = charge.payment_intent;

  // Find order by payment_intent_id
  const { data: order } = await supabaseAdmin
    .from('orders')
    .select('id, order_number')
    .eq('stripe_payment_intent_id', paymentIntentId)
    .single();

  if (!order) {
    console.log(`[Webhook] No order found for refunded charge: ${paymentIntentId}`);
    return { status: 'no_order' };
  }

  console.log(`[Webhook] Charge refunded for order: ${order.order_number}`);

  // Update order status
  await supabaseAdmin
    .from('orders')
    .update({
      status: 'refunded',
      updated_at: new Date().toISOString(),
    })
    .eq('id', order.id);

  // Record refund payment event
  await supabaseAdmin
    .from('payments')
    .insert({
      order_id: order.id,
      provider: 'stripe',
      status: 'refunded',
      stripe_payment_intent_id: paymentIntentId,
      amount_cents: charge.amount_refunded,
      currency: charge.currency.toUpperCase(),
    });

  return {
    status: 'refunded',
    order_number: order.order_number,
  };
}

/**
 * Main webhook handler
 */
export default async function handler(req, res) {
  const supabaseAdmin = getSupabaseAdmin();
  
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const sig = req.headers['stripe-signature'];
  const rawBody = await buffer(req);

  let event;

  try {
    // Verify webhook signature
    event = stripe.webhooks.constructEvent(rawBody, sig, stripeWebhookSecret);
  } catch (err) {
    console.error('[Webhook] Signature verification failed:', err.message);
    return res.status(400).json({ error: `Webhook signature verification failed: ${err.message}` });
  }

  console.log(`[Webhook] Received event: ${event.type} (${event.id})`);

  try {
    // ========================================
    // IDEMPOTENCY CHECK
    // ========================================
    const { data: existingEvent } = await supabaseAdmin
      .from('payments')
      .select('id')
      .eq('stripe_event_id', event.id)
      .single();

    if (existingEvent) {
      console.log(`[Webhook] Event ${event.id} already processed - skipping`);
      return res.status(200).json({ received: true, status: 'duplicate' });
    }

    // ========================================
    // PROCESS EVENT
    // ========================================
    let result;

    switch (event.type) {
      case 'checkout.session.completed':
        result = await handleCheckoutCompleted(event.data.object);
        break;

      case 'payment_intent.succeeded':
        result = await handlePaymentIntentSucceeded(event.data.object);
        break;

      case 'charge.refunded':
        result = await handleChargeRefunded(event.data.object);
        break;

      default:
        console.log(`[Webhook] Unhandled event type: ${event.type}`);
        result = { status: 'unhandled' };
    }

    // ========================================
    // RECORD EVENT (for idempotency)
    // ========================================
    if (event.data.object.metadata?.order_id) {
      await supabaseAdmin
        .from('payments')
        .insert({
          order_id: event.data.object.metadata.order_id,
          provider: 'stripe',
          status: result.status || 'processed',
          stripe_event_id: event.id,
          stripe_payment_intent_id: event.data.object.payment_intent || null,
          amount_cents: event.data.object.amount || 0,
          currency: (event.data.object.currency || 'eur').toUpperCase(),
          metadata: { event_type: event.type, result },
        });
    }

    console.log(`[Webhook] ✅ Event ${event.id} processed successfully`);

    return res.status(200).json({
      received: true,
      event_type: event.type,
      result,
    });
  } catch (error) {
    console.error(`[Webhook] Error processing event ${event.id}:`, error);

    return res.status(500).json({
      error: 'Webhook processing failed',
      event_id: event.id,
      message: error.message,
    });
  }
}
