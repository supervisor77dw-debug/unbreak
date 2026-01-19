/**
 * API Endpoint: Get Order by Stripe Session ID
 * 
 * Purpose: Retrieve order status for success page (SSOT: admin_orders ONLY)
 * 
 * Usage: /api/order/by-session?session_id=cs_xxx
 * 
 * Returns: { found: boolean, order: {...} }
 */

import prisma from '../../../lib/prisma';

export default async function handler(req, res) {
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
    console.log(`[ORDER_BY_SESSION] Looking up order in admin_orders for session: ${session_id}`);

    // SSOT: Query admin_orders ONLY
    const order = await prisma.order.findFirst({
      where: {
        stripeCheckoutSessionId: session_id
      },
      select: {
        id: true,
        statusPayment: true,
        statusFulfillment: true,
        email: true,
        totalGross: true,
        currency: true,
        emailStatus: true,
        customerEmailSentAt: true,
        createdAt: true
      }
    });

    if (!order) {
      // Order not yet created - webhook may still be processing
      console.log(`[ORDER_BY_SESSION] ⏳ Order not found yet for session: ${session_id}`);
      return res.status(200).json({
        found: false,
        session_id,
        message: 'Order is being processed. Please wait...'
      });
    }

    // Order found
    console.log(`[ORDER_BY_SESSION] ✅ Found order: ${order.id.substring(0, 8)}`);
    return res.status(200).json({
      found: true,
      order_id: order.id,
      order_number: order.id.substring(0, 8).toUpperCase(),
      status_payment: order.statusPayment,
      status_fulfillment: order.statusFulfillment,
      total_amount_cents: order.totalGross,
      customer_email: order.email,
      currency: order.currency,
      email_sent: !!order.customerEmailSentAt,
      email_status: order.emailStatus,
      created_at: order.createdAt,
      // Legacy compat for existing success page
      order: {
        id: order.id,
        orderNumber: order.id.substring(0, 8).toUpperCase(),
        statusPayment: order.statusPayment,
        statusFulfillment: order.statusFulfillment,
        email: order.email,
        totalGross: order.totalGross,
        currency: order.currency,
        emailSent: !!order.customerEmailSentAt,
        emailStatus: order.emailStatus,
        createdAt: order.createdAt
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
