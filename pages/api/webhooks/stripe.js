import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';
import { buffer } from 'micro';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Disable default body parser - we need raw body for signature verification
export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req, res) {
  // === DIAGNOSTIC LOGGING ===
  console.log('🪝 [WEBHOOK HIT] Method:', req.method);
  console.log('🪝 [WEBHOOK HIT] Has stripe-signature:', !!req.headers['stripe-signature']);
  console.log('🪝 [ENV CHECK] STRIPE_SECRET_KEY present:', !!process.env.STRIPE_SECRET_KEY);
  console.log('🪝 [ENV CHECK] STRIPE_WEBHOOK_SECRET present:', !!process.env.STRIPE_WEBHOOK_SECRET);
  console.log('🪝 [ENV CHECK] SUPABASE_URL present:', !!process.env.SUPABASE_URL);
  console.log('🪝 [ENV CHECK] SUPABASE_SERVICE_ROLE_KEY present:', !!process.env.SUPABASE_SERVICE_ROLE_KEY);

  if (req.method !== 'POST') {
    console.log('⚠️ [Webhook] Non-POST request received:', req.method);
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // 1. Get raw body for signature verification
    const buf = await buffer(req);
    const sig = req.headers['stripe-signature'];

    if (!sig) {
      console.error('❌ [Webhook] No stripe-signature header');
      return res.status(400).json({ error: 'Missing stripe-signature header' });
    }

    // 2. Verify webhook signature
    let event;
    try {
      event = stripe.webhooks.constructEvent(
        buf,
        sig,
        process.env.STRIPE_WEBHOOK_SECRET
      );
      console.log('✅ [SIGNATURE] Verified OK');
      console.log('📥 [EVENT] Type:', event.type);
      console.log('📥 [EVENT] ID:', event.id);
    } catch (err) {
      console.error('❌ [SIGNATURE] Verification FAILED:', err.message);
      return res.status(400).json({ error: `Webhook signature verification failed: ${err.message}` });
    }

    // 3. Handle specific events
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutSessionCompleted(event.data.object);
        break;

      default:
        console.log(`⚠️ [Webhook] Unhandled event type: ${event.type}`);
    }

    // 4. Return success response
    res.status(200).json({ received: true, event: event.type });

  } catch (error) {
    console.error('❌ [Webhook] Fatal error:', error);
    console.error('❌ [Webhook] Error stack:', error.stack);
    res.status(500).json({ 
      error: 'Webhook handler failed',
      message: error.message 
    });
  }
}

async function handleCheckoutSessionCompleted(session) {
  console.log('💳 [SESSION] ID:', session.id);
  console.log('💳 [SESSION] Payment status:', session.payment_status);
  console.log('💳 [SESSION] Amount total:', session.amount_total);
  console.log('💳 [SESSION] Customer email:', session.customer_email || session.customer_details?.email);

  let logData = {
    event_type: 'checkout.session.completed',
    stripe_session_id: session.id,
    status: 'processing',
    error_message: null,
    order_id: null,
    rows_affected: 0
  };

  try {
    // 1. Find order by stripe_session_id
    console.log('🔍 [DB QUERY] Looking for stripe_session_id:', session.id);
    
    const { data: order, error: fetchError } = await supabase
      .from('simple_orders')
      .select('*')
      .eq('stripe_session_id', session.id)
      .single();

    if (fetchError) {
      console.error('❌ [DB QUERY] Failed:', fetchError.message);
      console.error('❌ [DB QUERY] Code:', fetchError.code);
      console.error('❌ [DB QUERY] Details:', fetchError.details);
      logData.status = 'error';
      logData.error_message = `Order lookup failed: ${fetchError.message}`;
      await logWebhookEvent(logData);
      throw new Error(`Order lookup failed: ${fetchError.message}`);
    }

    if (!order) {
      console.error('❌ [DB QUERY] No order found for session:', session.id);
      console.error('❌ [DB QUERY] Check if stripe_session_id was saved during checkout');
      logData.status = 'error';
      logData.error_message = `No order found for session: ${session.id}`;
      await logWebhookEvent(logData);
      throw new Error(`No order found for session: ${session.id}`);
    }

    console.log('✅ [DB QUERY] Order found - ID:', order.id);
    console.log('📊 [ORDER BEFORE UPDATE] ID:', order.id);
    console.log('📊 [ORDER BEFORE UPDATE] stripe_session_id:', order.stripe_session_id);
    console.log('📊 [ORDER BEFORE UPDATE] status:', order.status);
    console.log('📊 [ORDER BEFORE UPDATE] created_at:', order.created_at);

    logData.order_id = order.id;

    // 2. Check if already paid (idempotency)
    if (order.status === 'paid') {
      console.log('✅ [IDEMPOTENT] Order already paid - skipping');
      logData.status = 'skipped';
      logData.error_message = 'Order already paid (idempotent)';
      await logWebhookEvent(logData);
      return;
    }

    // 3. Update order to paid
    const updateData = {
      status: 'paid',
      stripe_payment_intent_id: session.payment_intent,
      paid_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    console.log('📝 [DB UPDATE] Attempting update...');
    console.log('📝 [DB UPDATE] WHERE order.id =', order.id);
    console.log('📝 [DB UPDATE] SET data:', JSON.stringify(updateData));

    const { data: updatedRows, error: updateError } = await supabase
      .from('simple_orders')
      .update(updateData)
      .eq('id', order.id)
      .select();

    if (updateError) {
      console.error('❌ [DB UPDATE] Failed:', updateError.message);
      console.error('❌ [DB UPDATE] Code:', updateError.code);
      console.error('❌ [DB UPDATE] Details:', updateError.details);
      console.error('❌ [DB UPDATE] Hint:', updateError.hint);
      throw new Error(`Order update failed: ${updateError.message}`);
    }

    const rowCount = updatedRows?.length || 0;
    console.log('✅ [DB UPDATE] Complete - Rows affected:', rowCount);

    if (rowCount === 0) {
      console.error('❌ [DB UPDATE] WARNING: 0 rows affected!');
      console.error('❌ [DB UPDATE] Order ID:', order.id);
      console.error('❌ [DB UPDATE] Session ID:', session.id);
      console.error('❌ [DB UPDATE] This means WHERE clause matched nothing');
      logData.status = 'error';
      logData.error_message = `Update affected 0 rows for order ${order.id}`;
      logData.rows_affected = 0;
      await logWebhookEvent(logData);
      throw new Error(`Update affected 0 rows for order ${order.id}`);
    }

    logData.rows_affected = rowCount;

    if (rowCount > 0 && updatedRows[0]) {
      console.log('✅ [DB UPDATE] Updated order ID:', updatedRows[0].id);
      console.log('✅ [DB UPDATE] New status:', updatedRows[0].status);
      console.log('✅ [DB UPDATE] Paid at:', updatedRows[0].paid_at);
    }

    console.log('✅ [WEBHOOK] Order successfully marked as paid:', order.id);
    logData.status = 'success';
    await logWebhookEvent(logData);

    // === SEND ORDER CONFIRMATION EMAIL ===
    await sendOrderConfirmationEmail(session, order);

  } catch (error) {
    console.error('❌ [Webhook] handleCheckoutSessionCompleted failed:', error);
    if (logData.status !== 'error') {
      logData.status = 'error';
      logData.error_message = error.message;
      await logWebhookEvent(logData);
    }
    throw error; // Re-throw to trigger retry in Stripe
  }
}

async function logWebhookEvent(logData) {
  try {
    const { error } = await supabase
      .from('webhook_logs')
      .insert({
        event_type: logData.event_type,
        stripe_session_id: logData.stripe_session_id,
        status: logData.status,
        error_message: logData.error_message,
        order_id: logData.order_id,
        rows_affected: logData.rows_affected
      });

    if (error) {
      console.error('❌ [WEBHOOK LOG] Failed to log event:', error.message);
    } else {
      console.log('✅ [WEBHOOK LOG] Event logged successfully');
    }
  } catch (err) {
    console.error('❌ [WEBHOOK LOG] Exception:', err.message);
  }
}

async function sendOrderConfirmationEmail(session, order) {
  try {
    console.log('📧 [EMAIL] Preparing to send order confirmation...');

    // Extract customer data from Stripe session
    const customerEmail = session.customer_details?.email || session.customer_email;
    const customerName = session.customer_details?.name;
    const shippingAddress = session.shipping_details?.address;

    if (!customerEmail) {
      console.warn('⚠️ [EMAIL] No customer email found in session - skipping email');
      return;
    }

    // Parse items from order
    let items = [];
    try {
      items = typeof order.items === 'string' ? JSON.parse(order.items) : order.items;
    } catch (err) {
      console.error('❌ [EMAIL] Failed to parse order items:', err.message);
      items = [{ name: 'Order', quantity: 1, price_cents: order.total_amount_cents }];
    }

    // Detect language from customer data (default to German)
    let language = 'de';
    if (session.locale) {
      language = session.locale.startsWith('en') ? 'en' : 'de';
    } else if (shippingAddress?.country) {
      // English for UK, US, etc.
      language = ['GB', 'US', 'CA', 'AU', 'NZ'].includes(shippingAddress.country) ? 'en' : 'de';
    }

    const emailPayload = {
      orderId: order.id,
      orderNumber: order.id.substring(0, 8).toUpperCase(),
      customerEmail,
      customerName,
      items,
      totalAmount: order.total_amount_cents,
      language,
      shippingAddress
    };

    console.log('📧 [EMAIL] Calling email API with payload:', JSON.stringify({
      orderId: emailPayload.orderId,
      customerEmail: emailPayload.customerEmail,
      language: emailPayload.language,
      itemCount: items.length
    }));

    // Call internal email API
    const baseUrl = process.env.VERCEL_URL 
      ? `https://${process.env.VERCEL_URL}` 
      : 'http://localhost:3000';

    const emailResponse = await fetch(`${baseUrl}/api/email/order`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(emailPayload)
    });

    if (!emailResponse.ok) {
      const errorText = await emailResponse.text();
      console.error('❌ [EMAIL] API returned error:', emailResponse.status, errorText);
      // Don't throw - email failure shouldn't block webhook
      return;
    }

    const emailResult = await emailResponse.json();
    console.log('✅ [EMAIL] Order confirmation sent successfully:', emailResult.emailId);

  } catch (error) {
    // Log but don't throw - email failure shouldn't block webhook processing
    console.error('❌ [EMAIL] Failed to send order confirmation:', error.message);
    console.error('❌ [EMAIL] Stack:', error.stack);
  }
}
