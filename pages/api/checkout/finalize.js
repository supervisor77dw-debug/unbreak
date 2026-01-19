import { createClient } from '@supabase/supabase-js';
import { getStripeClient } from '../../../lib/stripe-config.js';
import { logDataSourceFingerprint } from '../../../lib/dataSourceFingerprint';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

/**
 * POST /api/checkout/finalize
 * Called from success page to verify payment and clear cart
 */
export default async function handler(req, res) {
  // Log data source fingerprint
  logDataSourceFingerprint('checkout_finalize', {
    readTables: ['simple_orders'],
    writeTables: ['simple_orders'],
  });

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { session_id } = req.body;

  if (!session_id || !session_id.startsWith('cs_')) {
    return res.status(400).json({ error: 'Invalid session_id' });
  }

  try {
    const isPreview = req.headers.origin?.includes('vercel.app');
    
    // Detect mode from session ID prefix
    const mode = session_id.startsWith('cs_test_') ? 'test' : 'live';
    const stripe = getStripeClient(mode);
    
    console.log('[FINALIZE] Using Stripe mode:', mode.toUpperCase());
    
    // 1. Retrieve session from Stripe (with expanded payment_intent)
    const session = await stripe.checkout.sessions.retrieve(session_id, {
      expand: ['payment_intent', 'line_items'],
    });

    if (isPreview) {
      console.log('[FINALIZE] session_id=%s', session_id);
      console.log('[FINALIZE] payment_status=%s', session.payment_status);
      console.log('[FINALIZE] metadata.order_id=%s', session.metadata?.order_id);
    }

    // 2. Verify payment status
    if (session.payment_status !== 'paid') {
      console.warn('[FINALIZE] Payment not completed:', session.payment_status);
      return res.status(400).json({ 
        error: 'Payment not completed',
        status: session.payment_status,
        cleared: false,
      });
    }

    // 3. Get order_id from metadata OR find by stripe_session_id
    let orderId = session.metadata?.order_id;
    let order = null;
    
    if (orderId) {
      // Primary: Find by id in metadata (orderId is the UUID)
      const { data, error: orderError } = await supabase
        .from('simple_orders')
        .select('*')
        .eq('id', orderId)
        .single();
      
      if (!orderError && data) {
        order = data;
        console.log('[FINALIZE] Found order by id:', orderId);
      }
    }
    
    // Fallback: Find by stripe_session_id
    if (!order) {
      console.log('[FINALIZE] Trying fallback: find by stripe_session_id');
      const { data, error: sessionError } = await supabase
        .from('simple_orders')
        .select('*')
        .eq('stripe_session_id', session_id)
        .single();
      
      if (!sessionError && data) {
        order = data;
        orderId = data.order_id;
        console.log('[FINALIZE] Found order by stripe_session_id:', orderId);
      }
    }
    
    if (!order) {
      console.warn('[FINALIZE] Order not found by any method');
      // For test checkouts without pre-created order, just return success
      if (session.metadata?.source === 'admin_test_checkout') {
        console.log('[FINALIZE] Admin test checkout - returning success without order');
        return res.status(200).json({
          ok: true,
          test_mode: true,
          cleared: true,
          message: 'Test payment verified (no order tracking)',
        });
      }
      return res.status(400).json({ 
        error: 'Order not found',
        session_id: session_id,
        cleared: false,
      });
    }

    // 5. Check if already finalized (idempotency)
    if (order.status === 'paid' || order.status === 'completed') {
      console.log('[FINALIZE] Order already finalized:', orderId);
      return res.status(200).json({ 
        ok: true,
        already_finalized: true,
        order_id: orderId,
        cleared: true,
        message: 'Order already processed',
      });
    }

    // 6. Update order status with customer data from Stripe
    const customerDetails = session.customer_details || {};
    const shippingDetails = session.shipping_details || session.customer_details || {};
    
    const updateData = { 
      status: 'paid',
      paid_at: new Date().toISOString(),
      stripe_payment_intent_id: session.payment_intent?.id || session.payment_intent,
      customer_email: customerDetails.email || order.customer_email,
      customer_name: customerDetails.name || shippingDetails.name || order.customer_name,
      customer_phone: customerDetails.phone || order.customer_phone,
      updated_at: new Date().toISOString(),
    };
    
    // Add shipping address if available
    if (shippingDetails.address) {
      updateData.shipping_address = {
        name: shippingDetails.name,
        line1: shippingDetails.address.line1,
        line2: shippingDetails.address.line2,
        city: shippingDetails.address.city,
        state: shippingDetails.address.state,
        postal_code: shippingDetails.address.postal_code,
        country: shippingDetails.address.country,
      };
    }
    
    const { error: updateError } = await supabase
      .from('simple_orders')
      .update(updateData)
      .eq('id', order.id);

    if (updateError) {
      console.error('[FINALIZE] Failed to update order:', {
        error: updateError,
        code: updateError.code,
        message: updateError.message,
        details: updateError.details,
        hint: updateError.hint,
        order_id: orderId,
      });
      return res.status(500).json({ 
        error: 'Failed to update order',
        code: updateError.code,
        message: updateError.message,
        hint: updateError.hint,
        cleared: false,
      });
    }

    if (isPreview) {
      console.log('[FINALIZE] cleared=true reason=payment_verified order_id=%s', orderId);
    }

    console.log('✅ [FINALIZE] Order finalized:', orderId);

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // EMAIL NOTIFICATION
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // NOTE: Email sending is handled by Stripe webhook (checkout.session.completed)
    // This finalize endpoint is called from frontend after successful payment
    // to update order status and clear cart.
    // 
    // Emails are sent by: pages/api/webhooks/stripe.js
    // Trigger: checkout.session.completed event
    // 
    // Why not send email here?
    // 1. Webhook is more reliable (retries on failure)
    // 2. Finalize can be called multiple times (idempotent)
    // 3. Email should only be sent once per order
    // 
    // Logging for diagnostics:
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`📧 [FINALIZE] Email notification status for order ${orderId}:`);
    console.log(`📧 [FINALIZE] Email is sent via Stripe webhook (checkout.session.completed)`);
    console.log(`📧 [FINALIZE] Check webhook logs for: [EMAIL ATTEMPT] trace_id=...`);
    console.log(`📧 [FINALIZE] Session ID: ${session_id}`);
    console.log(`📧 [FINALIZE] Customer: ${session.customer_details?.email || 'N/A'}`);
    console.log(`📧 [FINALIZE] Payment Status: ${session.payment_status}`);
    console.log(`📧 [FINALIZE] Order Status: paid (just updated)`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    // 7. Return success (client will clear cart)
    return res.status(200).json({ 
      ok: true,
      order_id: order.id,
      order_number: order.order_number,
      total_amount_cents: order.total_amount_cents,
      customer_email: updateData.customer_email,
      cleared: true,
      message: 'Payment verified, order finalized',
      order: {
        id: order.id,
        order_number: order.order_number,
        total_amount_cents: order.total_amount_cents,
        currency: order.currency,
        status: 'paid',
        customer_email: updateData.customer_email,
        customer_name: updateData.customer_name,
      },
    });

  } catch (error) {
    console.error('❌ [FINALIZE] Error:', error);
    
    if (error.type === 'StripeInvalidRequestError') {
      return res.status(400).json({ 
        error: 'Invalid Stripe session',
        details: error.message,
        cleared: false,
      });
    }

    return res.status(500).json({ 
      error: 'Finalize failed',
      message: error.message,
      cleared: false,
    });
  }
}
