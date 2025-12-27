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
import { stripe, stripeWebhookSecret } from '../../lib/stripe';
import { supabaseAdmin } from '../../lib/supabase';

// Disable body parsing - we need raw body for signature verification
export const config = {
  api: {
    bodyParser: false,
  },
};

/**
 * Process checkout.session.completed event
 * Main event: payment successful → update order → create production job
 */
async function handleCheckoutCompleted(session) {
  const orderId = session.metadata.order_id;
  const orderNumber = session.metadata.order_number;

  console.log(`[Webhook] Checkout completed for order: ${orderNumber}`);

  // 1. Fetch order with related data
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

  // 2. Check if already processed
  if (order.status === 'paid') {
    console.log(`[Webhook] Order ${orderNumber} already marked as paid - skipping`);
    return { status: 'already_processed' };
  }

  // 3. Update order status → paid
  const { error: updateError } = await supabaseAdmin
    .from('orders')
    .update({
      status: 'paid',
      stripe_payment_intent_id: session.payment_intent,
      updated_at: new Date().toISOString(),
    })
    .eq('id', orderId);

  if (updateError) {
    console.error(`[Webhook] Failed to update order ${orderNumber}:`, updateError);
    throw new Error('Failed to update order status');
  }

  // 4. Create production job
  const productionPayload = {
    order_number: orderNumber,
    product: {
      sku: order.product?.products?.sku || 'UNKNOWN',
      name: order.product?.products?.name || 'UNKNOWN',
    },
    configuration: order.configuration.config_json,
    customer: {
      email: order.customer.email,
      name: order.customer.name,
      phone: order.customer.phone,
    },
    shipping_address: order.shipping_address,
    pricing: {
      subtotal_cents: order.subtotal_cents,
      shipping_cents: order.shipping_cents,
      tax_cents: order.tax_cents,
      total_cents: order.total_cents,
      currency: order.currency,
    },
    preview_image_url: order.configuration.preview_image_url,
    model_export_url: order.configuration.model_export_url,
    paid_at: new Date().toISOString(),
  };

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
