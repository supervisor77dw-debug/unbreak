import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

/**
 * POST /api/checkout/finalize
 * Called from success page to verify payment and clear cart
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { session_id } = req.body;

  if (!session_id || !session_id.startsWith('cs_')) {
    return res.status(400).json({ error: 'Invalid session_id' });
  }

  try {
    const isPreview = req.headers.origin?.includes('vercel.app');
    
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

    // 3. Get order_id from metadata
    const orderId = session.metadata?.order_id;
    
    if (!orderId) {
      console.warn('[FINALIZE] No order_id in session metadata');
      return res.status(400).json({ 
        error: 'No order_id in session metadata',
        cleared: false,
      });
    }

    // 4. Verify order exists and update status
    const { data: order, error: orderError } = await supabase
      .from('simple_orders')
      .select('*')
      .eq('id', orderId)
      .single();

    if (orderError || !order) {
      console.error('[FINALIZE] Order not found:', orderId);
      return res.status(404).json({ 
        error: 'Order not found',
        order_id: orderId,
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

    // 6. Update order status
    const { error: updateError } = await supabase
      .from('simple_orders')
      .update({ 
        status: 'paid',
        payment_status: session.payment_status,
        stripe_payment_intent_id: session.payment_intent?.id || session.payment_intent,
        updated_at: new Date().toISOString(),
      })
      .eq('id', orderId);

    if (updateError) {
      console.error('[FINALIZE] Failed to update order:', updateError);
      return res.status(500).json({ 
        error: 'Failed to update order',
        details: updateError.message,
        cleared: false,
      });
    }

    if (isPreview) {
      console.log('[FINALIZE] cleared=true reason=payment_verified order_id=%s', orderId);
    }

    console.log('✅ [FINALIZE] Order finalized:', orderId);

    // 7. Return success (client will clear cart)
    return res.status(200).json({ 
      ok: true,
      order_id: orderId,
      cleared: true,
      message: 'Payment verified, order finalized',
      order: {
        id: order.id,
        total_amount_cents: order.total_amount_cents,
        currency: order.currency,
        status: 'paid',
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
