/**
 * API Endpoint: Get Order by Stripe Session ID
 * 
 * Purpose: Retrieve order status for success page
 * SSOT: simple_orders (Supabase) - Updated 2026-01-19
 * 
 * Usage: /api/order/by-session?session_id=cs_xxx
 * 
 * Returns: { found: boolean, order: {...} }
 */

import { createClient } from '@supabase/supabase-js';
import { logDataSourceFingerprint } from '../../../lib/dataSourceFingerprint';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  // Log data source fingerprint
  logDataSourceFingerprint('order_by_session_api', {
    readTables: ['simple_orders'],
    writeTables: [],
  });

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { session_id } = req.query;

  if (!session_id) {
    console.error('[ORDER_BY_SESSION] Missing session_id parameter');
    return res.status(400).json({ error: 'session_id parameter required' });
  }

  if (!session_id.startsWith('cs_')) {
    return res.status(400).json({ error: 'Invalid session_id format' });
  }

  try {
    console.log(`[ORDER_BY_SESSION] Looking up order in simple_orders for session: ${session_id}`);

    // SSOT: Query simple_orders (Supabase)
    const { data: order, error } = await supabase
      .from('simple_orders')
      .select('*')
      .eq('stripe_session_id', session_id)
      .single();

    if (error || !order) {
      // Order not yet created - webhook may still be processing
      console.log(`[ORDER_BY_SESSION] ⏳ Order not found yet for session: ${session_id}`);
      return res.status(200).json({
        found: false,
        session_id,
        message: 'Order is being processed. Please wait...'
      });
    }

    // Generate order number from ID if not set
    const orderNumber = order.order_number || `UO-${order.id.substring(0, 8).toUpperCase()}`;

    // Order found
    console.log(`[ORDER_BY_SESSION] ✅ Found order: ${orderNumber}`);
    return res.status(200).json({
      found: true,
      order_id: order.id,
      order_number: orderNumber,
      status_payment: order.status?.toUpperCase() || 'PENDING',
      status_fulfillment: order.fulfillment_status?.toUpperCase() || 'NEW',
      total_amount_cents: order.total_amount_cents,
      customer_email: order.customer_email,
      customer_name: order.customer_name,
      currency: order.currency || 'EUR',
      email_sent: !!order.customer_email_sent_at,
      email_status: order.email_status,
      created_at: order.created_at,
      shipping_address: order.shipping_address,
      // Legacy compat for existing success page
      order: {
        id: order.id,
        orderNumber: orderNumber,
        statusPayment: order.status?.toUpperCase() || 'PENDING',
        statusFulfillment: order.fulfillment_status?.toUpperCase() || 'NEW',
        email: order.customer_email,
        customerName: order.customer_name,
        totalGross: order.total_amount_cents,
        currency: order.currency || 'EUR',
        emailSent: !!order.customer_email_sent_at,
        emailStatus: order.email_status,
        createdAt: order.created_at,
        shippingAddress: order.shipping_address
      }
    });

  } catch (error) {
    console.error('[ORDER_BY_SESSION] Database error:', error);
    console.error('[ORDER_BY_SESSION] Error details:', error.message);
    return res.status(500).json({ 
      error: 'Failed to retrieve order',
      message: error.message,
      code: error.code
    });
  }
}
