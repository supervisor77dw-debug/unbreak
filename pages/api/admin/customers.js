/**
 * Admin API: Customers Management
 * GET /api/admin/customers - List customers with filters
 * GET /api/admin/customers/[id] - Get customer details
 */

import { getSupabaseAdmin } from '../../../lib/supabase';
import { requireAdminAuth } from '../../../lib/auth-helpers';

export default async function handler(req, res) {
  // Require admin/ops/support role
  const user = await requireAdminAuth(req, res, ['admin', 'ops', 'support']);
  if (!user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (req.method === 'GET') {
    return handleGetCustomers(req, res);
  }

  return res.status(405).json({ error: 'Method not allowed' });
}

async function handleGetCustomers(req, res) {
  const supabaseAdmin = getSupabaseAdmin();
  
  try {
    const { 
      search, 
      limit = 50, 
      offset = 0,
      sort_by = 'created_at',
      sort_order = 'desc',
    } = req.query;

    // Build query
    let query = supabaseAdmin
      .from('customers')
      .select('*');

    // Search filter
    if (search) {
      query = query.or(`email.ilike.%${search}%,name.ilike.%${search}%,stripe_customer_id.ilike.%${search}%`);
    }

    // Sorting
    query = query.order(sort_by, { ascending: sort_order === 'asc' });

    // Pagination
    query = query.range(parseInt(offset), parseInt(offset) + parseInt(limit) - 1);

    const { data: customers, error, count } = await query;

    if (error) {
      console.error('❌ [ADMIN CUSTOMERS] Database error:', error);
      return res.status(500).json({ error: 'Failed to fetch customers', details: error.message });
    }

    // Get total count for pagination
    const { count: totalCount } = await supabaseAdmin
      .from('customers')
      .select('*', { count: 'exact', head: true });

    // ✅ Calculate stats for each customer (with email fallback like [id].js)
    const formattedCustomers = await Promise.all(customers.map(async (customer) => {
      // Get orders with fallback: customer_id OR email
      const { data: orders } = await supabaseAdmin
        .from('orders')
        .select('total_cents, created_at')
        .or(`customer_id.eq.${customer.id},customer_email.ilike.${customer.email}`);

      const { data: simpleOrders } = await supabaseAdmin
        .from('simple_orders')
        .select('total_amount_cents, created_at')
        .or(`customer_id.eq.${customer.id},customer_email.ilike.${customer.email}`);

      const allOrders = [...(orders || []), ...(simpleOrders || [])];
      const totalOrders = allOrders.length;
      const totalSpentCents = allOrders.reduce((sum, order) => {
        return sum + (order.total_cents || order.total_amount_cents || 0);
      }, 0);
      const lastOrderAt = allOrders.length > 0 
        ? allOrders.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0].created_at
        : null;

      return {
        id: customer.id,
        email: customer.email,
        name: customer.name,
        phone: customer.phone,
        stripe_customer_id: customer.stripe_customer_id,
        total_orders: totalOrders,
        total_spent_cents: totalSpentCents,
        total_spent_eur: (totalSpentCents / 100).toFixed(2),
        last_order_at: lastOrderAt,
        created_at: customer.created_at,
        updated_at: customer.updated_at,
        shipping_address: customer.shipping_address,
        billing_address: customer.billing_address,
      };
    }));

    return res.status(200).json({
      success: true,
      customers: formattedCustomers,
      pagination: {
        total: totalCount,
        limit: parseInt(limit),
        offset: parseInt(offset),
        has_more: parseInt(offset) + parseInt(limit) < totalCount,
      },
    });

  } catch (error) {
    console.error('❌ [ADMIN CUSTOMERS] Error:', error);
    return res.status(500).json({ 
      error: 'Failed to fetch customers',
      message: error.message,
    });
  }
}
