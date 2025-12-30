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
      throw new Error(`Order lookup failed: ${fetchError.message}`);
    }

    if (!order) {
      console.error('❌ [DB QUERY] No order found for session:', session.id);
      console.error('❌ [DB QUERY] Check if stripe_session_id was saved during checkout');
      throw new Error(`No order found for session: ${session.id}`);
    }

    console.log('✅ [DB QUERY] Order found - ID:', order.id);
    console.log('📊 [ORDER] Current status:', order.status);
    console.log('📊 [ORDER] Created at:', order.created_at);

    // 2. Check if already paid (idempotency)
    if (order.status === 'paid') {
      console.log('✅ [IDEMPOTENT] Order already paid - skipping');
      return;
    }

    // 3. Update order to paid
    const updateData = {
      status: 'paid',
      stripe_payment_intent_id: session.payment_intent,
      paid_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    console.log('📝 [DB UPDATE] Updating order to paid...');
    console.log('📝 [DB UPDATE] Data:', updateData);

    const { data: updatedOrder, error: updateError } = await supabase
      .from('simple_orders')
      .update(updateData)
      .eq('id', order.id)
      .select();

    if (updateError) {
      console.error('❌ [DB UPDATE] Failed:', updateError.message);
      console.error('❌ [DB UPDATE] Code:', updateError.code);
      console.error('❌ [DB UPDATE] Details:', updateError.details);
      throw new Error(`Order update failed: ${updateError.message}`);
    }

    console.log('✅ [DB UPDATE] Success - Rows affected:', updatedOrder?.length || 0);
    console.log('✅ [DB UPDATE] Updated order:', updatedOrder?.[0]?.id, 'Status:', updatedOrder?.[0]?.status);
    console.log('✅ [WEBHOOK] Order marked as paid:', order.id);

  } catch (error) {
    console.error('❌ [Webhook] handleCheckoutSessionCompleted failed:', error);
    throw error; // Re-throw to trigger retry in Stripe
  }
}
