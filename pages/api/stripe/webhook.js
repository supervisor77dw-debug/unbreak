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
import { sendOrderConfirmation } from '../../../lib/email/emailService';

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

  // ========================================
  // 6. SEND ORDER CONFIRMATION EMAIL
  // ========================================
  if (order.customer_email) {
    console.log(`[Webhook] Sending order confirmation email to ${order.customer_email}`);
    
    try {
      // Build items array for email
      const emailItems = order.items || [{
        name: order.product?.products?.name || 'Custom Product',
        quantity: 1,
        price_cents: order.total_amount_cents || order.total_cents,
      }];

      const emailResult = await sendOrderConfirmation({
        orderId: orderId,
        orderNumber: orderNumber,
        customerEmail: order.customer_email,
        customerName: order.customer_name,
        items: emailItems,
        totalAmount: order.total_amount_cents || order.total_cents,
        language: session.metadata?.language || 'de',
        shippingAddress: order.shipping_address || session.customer_details?.address,
      });

      if (emailResult.sent) {
        console.log(`[Webhook] ✅ Order confirmation sent - Email ID: ${emailResult.id}`);
        
        // Update order with email status
        await supabaseAdmin
          .from('orders')
          .update({
            email_sent: true,
            email_sent_at: new Date().toISOString(),
            metadata: {
              ...order.metadata,
              email_id: emailResult.id,
            },
          })
          .eq('id', orderId);
      } else if (emailResult.preview) {
        console.log(`[Webhook] 📧 Email preview mode (EMAILS_ENABLED=false)`);
      } else {
        console.error(`[Webhook] ⚠️ Email failed: ${emailResult.error}`);
        
        // Update order with email error (but don't throw - order is still paid!)
        await supabaseAdmin
          .from('orders')
          .update({
            email_sent: false,
            metadata: {
              ...order.metadata,
              email_error: emailResult.error,
            },
          })
          .eq('id', orderId);
      }
    } catch (emailError) {
      console.error(`[Webhook] ⚠️ Email error (non-fatal):`, emailError.message);
      // Don't throw - email failure shouldn't fail the webhook
    }
  } else {
    console.log(`[Webhook] ⚠️ No customer email - skipping order confirmation`);
  }

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
    // IDEMPOTENCY CHECK (use processed_events table)
    // ========================================
    const { data: existingEvent } = await supabaseAdmin
      .from('processed_events')
      .select('id, processing_status')
      .eq('stripe_event_id', event.id)
      .single();

    if (existingEvent) {
      console.log(`[Webhook] Event ${event.id} already processed (status: ${existingEvent.processing_status}) - skipping`);
      return res.status(200).json({ 
        received: true, 
        status: 'duplicate',
        previous_status: existingEvent.processing_status,
      });
    }

    // ========================================
    // PROCESS EVENT
    // ========================================
    let result;
    let processingStatus = 'success';
    let errorMessage = null;
    let orderId = null;

    try {
      switch (event.type) {
        case 'checkout.session.completed':
          result = await handleCheckoutCompleted(event.data.object);
          orderId = result.order_id;
          break;

        case 'payment_intent.succeeded':
          result = await handlePaymentIntentSucceeded(event.data.object);
          orderId = result.order_id || event.data.object.metadata?.order_id;
          break;

        case 'charge.refunded':
          result = await handleChargeRefunded(event.data.object);
          orderId = result.order_id;
          break;

        default:
          console.log(`[Webhook] Unhandled event type: ${event.type}`);
          result = { status: 'unhandled' };
          processingStatus = 'skipped';
      }
    } catch (processingError) {
      console.error(`[Webhook] Error processing event ${event.id}:`, processingError);
      processingStatus = 'failed';
      errorMessage = processingError.message;
      throw processingError; // Re-throw to trigger error response
    }

    // ========================================
    // RECORD EVENT (for idempotency)
    // ========================================
    await supabaseAdmin
      .from('processed_events')
      .insert({
        stripe_event_id: event.id,
        event_type: event.type,
        order_id: orderId,
        event_data: event.data.object,
        processing_status: processingStatus,
        error_message: errorMessage,
      });

    console.log(`[Webhook] ✅ Event ${event.id} processed successfully (status: ${processingStatus})`);

    return res.status(200).json({
      received: true,
      event_type: event.type,
      result,
    });
  } catch (error) {
    console.error(`[Webhook] Error processing event ${event.id}:`, error);

    // Try to record failed event (best effort)
    try {
      await supabaseAdmin
        .from('processed_events')
        .insert({
          stripe_event_id: event.id,
          event_type: event.type,
          event_data: event.data.object,
          processing_status: 'failed',
          error_message: error.message,
        });
    } catch (recordError) {
      console.error(`[Webhook] Failed to record error event:`, recordError);
    }

    return res.status(500).json({
      error: 'Webhook processing failed',
      event_id: event.id,
      message: error.message,
    });
  }
}
