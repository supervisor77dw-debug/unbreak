/**
 * 🔥 MESSE-MVP: Admin Orders List API
 * CANONICAL SOURCE: simple_orders (Supabase) via OrderRepository
 * RULE: NO PRISMA, only Supabase
 */

import { requireAuth } from '../../../../lib/auth-helpers';
import { OrderRepository } from '../../../../lib/repositories';
import { mapPaymentStatus } from '../../../../lib/utils/paymentStatusMapper';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const user = await requireAuth(req, res);
  if (!user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const {
      page = '1',
      limit = '20',
      statusPayment,
      statusFulfillment,
      search,
      sortBy = 'created_at',
      sortOrder = 'desc',
    } = req.query;

    // 🔥 USE REPOSITORY - CANONICAL SOURCE (simple_orders with UO-numbers only)
    const result = await OrderRepository.listOrders({
      page: parseInt(page),
      limit: parseInt(limit),
      statusPayment,
      statusFulfillment,
      search,
      sortBy,
      sortOrder,
    });

    // Normalize field names for frontend compatibility
    const normalizedOrders = result.orders.map(order => ({
      ...order,
      // Ensure frontend gets expected field names
      createdAt: order.created_at,
      updatedAt: order.updated_at,
      statusPayment: mapPaymentStatus(order), // 🔥 MESSE-FIX: Consistent UPPERCASE status
      statusFulfillment: order.status_fulfillment,
      stripeCheckoutSessionId: order.stripe_checkout_session_id || order.stripe_session_id,
      totalGross: order.total_amount_cents,
      email: order.customer_email || order.customers?.email,
      customer: order.customers,
    }));

    res.status(200).json({
      orders: normalizedOrders,
      pagination: {
        total: result.total,
        page: result.page,
        limit: result.limit,
        totalPages: result.totalPages,
      },
    });

  } catch (error) {
    console.error('❌ [ADMIN ORDERS] Error:', error);
    res.status(500).json({ error: 'Failed to fetch orders', details: error.message });
  }
}
