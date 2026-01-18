/**
 * API Endpoint: Get Order by Stripe Session ID
 * 
 * Purpose: Retrieve order number for success page display
 * 
 * Usage: /api/order/by-session?session_id=cs_xxx
 * 
 * Returns: { order_number: 'UO-2026-000123', order_id: 'uuid' }
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { session_id } = req.query;

  if (!session_id) {
    console.error('[ORDER_BY_SESSION] Missing session_id parameter');
    return res.status(400).json({ error: 'session_id parameter required' });
  }

  try {
    console.log(`[ORDER_BY_SESSION] Looking up order for session: ${session_id}`);

    // Try simple_orders first (shop orders)
    const { data: shopOrder, error: shopError } = await supabase
      .from('simple_orders')
      .select('id, order_number, status, total_amount_cents, customer_email')
      .or(`stripe_session_id.eq.${session_id},stripe_checkout_session_id.eq.${session_id}`)
      .maybeSingle();

    if (shopOrder) {
      console.log(`[ORDER_BY_SESSION] ✅ Found shop order: ${shopOrder.order_number || shopOrder.id}`);
      return res.status(200).json({
        order_id: shopOrder.id,
        order_number: shopOrder.order_number,
        status: shopOrder.status,
        total_amount_cents: shopOrder.total_amount_cents,
        customer_email: shopOrder.customer_email,
      });
    }

    // Try configurator orders (orders table)
    const { data: configuratorOrder, error: configError } = await supabase
      .from('orders')
      .select('id, order_number, status, total_amount_cents, customer_email')
      .eq('stripe_checkout_session_id', session_id)
      .maybeSingle();

    if (configuratorOrder) {
      console.log(`[ORDER_BY_SESSION] ✅ Found configurator order: ${configuratorOrder.order_number || configuratorOrder.id}`);
      return res.status(200).json({
        order_id: configuratorOrder.id,
        order_number: configuratorOrder.order_number,
        status: configuratorOrder.status,
        total_amount_cents: configuratorOrder.total_amount_cents,
        customer_email: configuratorOrder.customer_email,
      });
    }

    // Not found in either table
    console.error(`[ORDER_BY_SESSION] ❌ Order not found for session: ${session_id}`);
    return res.status(404).json({ error: 'Order not found for this session' });

  } catch (error) {
    console.error('[ORDER_BY_SESSION] Database error:', error);
    return res.status(500).json({ 
      error: 'Failed to retrieve order',
      message: error.message 
    });
  }
}
