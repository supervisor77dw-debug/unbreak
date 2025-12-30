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
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  console.log('🪝 [Webhook] Stripe webhook received');

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
      console.log('✅ [Webhook] Signature verified:', event.type);
    } catch (err) {
      console.error('❌ [Webhook] Signature verification failed:', err.message);
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
  console.log('💳 [Webhook] Handling checkout.session.completed');
  console.log('💳 [Webhook] Session ID:', session.id);
  console.log('💳 [Webhook] Payment status:', session.payment_status);

  try {
    // 1. Find order by stripe_session_id
    const { data: order, error: fetchError } = await supabase
      .from('simple_orders')
      .select('*')
      .eq('stripe_session_id', session.id)
      .single();

    if (fetchError) {
      console.error('❌ [Webhook] Order lookup failed:', fetchError);
      throw new Error(`Order lookup failed: ${fetchError.message}`);
    }

    if (!order) {
      console.error('❌ [Webhook] No order found for session:', session.id);
      throw new Error(`No order found for session: ${session.id}`);
    }

    console.log('📦 [Webhook] Order found:', order.id);
    console.log('📦 [Webhook] Current status:', order.status);

    // 2. Check if already paid (idempotency)
    if (order.status === 'paid') {
      console.log('✅ [Webhook] Order already paid - idempotent skip');
      return;
    }

    // 3. Update order to paid
    const updateData = {
      status: 'paid',
      stripe_payment_intent_id: session.payment_intent,
      updated_at: new Date().toISOString(),
    };

    // Add paid_at timestamp if column exists
    updateData.paid_at = new Date().toISOString();

    console.log('📝 [Webhook] Updating order to paid:', updateData);

    const { error: updateError } = await supabase
      .from('simple_orders')
      .update(updateData)
      .eq('id', order.id);

    if (updateError) {
      console.error('❌ [Webhook] Order update failed:', updateError);
      throw new Error(`Order update failed: ${updateError.message}`);
    }

    console.log('✅ [Webhook] Order marked as paid:', order.id);

  } catch (error) {
    console.error('❌ [Webhook] handleCheckoutSessionCompleted failed:', error);
    throw error; // Re-throw to trigger retry in Stripe
  }
}
