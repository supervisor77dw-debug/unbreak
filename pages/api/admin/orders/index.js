/**
 * ✅ SSOT: Admin Orders List API
 * CANONICAL SOURCE: simple_orders (Supabase)
 * UPDATED: 2026-01-19 - Switched from admin_orders to simple_orders
 */

import { requireAuth } from '../../../../lib/auth-helpers';
import { createClient } from '@supabase/supabase-js';
import { logDataSourceFingerprint } from '../../../../lib/dataSourceFingerprint';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  // Log data source fingerprint
  logDataSourceFingerprint('admin_orders_api', {
    readTables: ['simple_orders'],
    writeTables: [],
  });

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

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const offset = (pageNum - 1) * limitNum;

    // Build query
    // CRITICAL: Only show REAL orders (UO- prefix), exclude DRAFT- orders (unpaid checkouts)
    let query = supabase
      .from('simple_orders')
      .select('*', { count: 'exact' })
      .not('order_number', 'is', null)
      .not('order_number', 'like', 'DRAFT-%'); // ← Exclude unpaid draft orders

    // Filters
    if (statusPayment) {
      // Map PAID/PENDING to simple_orders status field
      const statusMap = {
        'PENDING': 'pending',
        'PAID': 'paid',
        'FAILED': 'failed',
        'REFUNDED': 'refunded'
      };
      query = query.eq('status', statusMap[statusPayment] || statusPayment.toLowerCase());
    }

    if (statusFulfillment) {
      query = query.eq('fulfillment_status', statusFulfillment.toLowerCase());
    }

    if (search) {
      query = query.or(`customer_email.ilike.%${search}%,customer_name.ilike.%${search}%,order_number.ilike.%${search}%`);
    }

    // Sorting (map camelCase to snake_case)
    const sortFieldMap = {
      'createdAt': 'created_at',
      'updatedAt': 'updated_at',
      'totalGross': 'total_amount_cents',
      'status': 'status'
    };
    const sortField = sortFieldMap[sortBy] || sortBy;

    query = query
      .order(sortField, { ascending: sortOrder === 'asc' })
      .range(offset, offset + limitNum - 1);

    const { data: orders, error, count } = await query;

    if (error) {
      console.error('❌ [ADMIN ORDERS] Supabase error:', error);
      throw error;
    }

    // Transform to match Admin UI expectations
    const transformedOrders = orders.map(order => ({
      id: order.id,
      order_number: order.order_number,
      email: order.customer_email,
      shippingName: order.customer_name,
      customer: {
        name: order.customer_name,
        email: order.customer_email,
        phone: order.customer_phone
      },
      // Map simple_orders status to Admin UI format
      statusPayment: (order.status || 'pending').toUpperCase(),
      statusFulfillment: (order.fulfillment_status || 'NEW').toUpperCase(),
      amountTotal: order.total_amount_cents,
      totalGross: order.total_amount_cents,
      currency: order.currency || 'EUR',
      // Items from JSON
      items: order.items || [],
      // Addresses from JSON
      shippingAddress: order.shipping_address,
      billingAddress: order.billing_address,
      // Dates
      createdAt: order.created_at,
      updatedAt: order.updated_at,
      paidAt: order.paid_at,
      // Stripe
      stripeSessionId: order.stripe_session_id,
      stripePaymentIntentId: order.stripe_payment_intent_id,
      // Email tracking
      customerEmailSentAt: order.customer_email_sent_at,
      adminEmailSentAt: order.admin_email_sent_at,
      emailStatus: order.email_status
    }));

    console.log(`✅ [ADMIN ORDERS] Fetched ${transformedOrders.length} orders from simple_orders`);

    res.status(200).json({
      orders: transformedOrders,
      pagination: {
        total: count || 0,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil((count || 0) / limitNum),
      },
    });

  } catch (error) {
    console.error('❌ [ADMIN ORDERS] Error:', error);
    res.status(500).json({ error: 'Failed to fetch orders', details: error.message });
  }
}
