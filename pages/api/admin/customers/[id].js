/**
 * Admin API: Customer Details
 * GET /api/admin/customers/[id] - Get customer details with order history
 */

import { getSupabaseAdmin } from '../../../../lib/supabase';
import { requireAdminAuth } from '../../../../lib/auth-helpers';

export default async function handler(req, res) {
  // Require admin/ops/support role
  const user = await requireAdminAuth(req, res, ['admin', 'ops', 'support']);
  if (!user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { id } = req.query;

  if (req.method === 'GET') {
    return handleGetCustomerDetails(req, res, id);
  }

  if (req.method === 'PATCH') {
    return handleUpdateCustomer(req, res, id);
  }

  return res.status(405).json({ error: 'Method not allowed' });
}

async function handleGetCustomerDetails(req, res, customerId) {
  const supabaseAdmin = getSupabaseAdmin();

  try {
    // Get customer with full details
    const { data: customer, error: customerError } = await supabaseAdmin
      .from('customers')
      .select('*')
      .eq('id', customerId)
      .single();

    if (customerError || !customer) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    // Get order history (configurator orders)
    // FALLBACK MATCHING: customer_id OR stripe_customer_id OR email
    const { data: orders, error: ordersError } = await supabaseAdmin
      .from('orders')
      .select(`
        id,
        order_number,
        status,
        total_cents,
        currency,
        created_at,
        updated_at,
        customer_id,
        stripe_customer_id,
        customer_email,
        configurations:configuration_id (
          id,
          config_json,
          preview_image_url
        )
      `)
      .or(`customer_id.eq.${customerId},stripe_customer_id.eq.${customer.stripe_customer_id},customer_email.ilike.${customer.email}`)
      .order('created_at', { ascending: false });

    // Get simple orders (shop orders)
    // FALLBACK MATCHING: customer_id OR stripe_customer_id OR email
    const { data: simpleOrders, error: simpleOrdersError } = await supabaseAdmin
      .from('simple_orders')
      .select('*')
      .or(`customer_id.eq.${customerId},stripe_customer_id.eq.${customer.stripe_customer_id},customer_email.ilike.${customer.email}`)
      .order('created_at', { ascending: false });

    // Get tickets
    const { data: tickets, error: ticketsError } = await supabaseAdmin
      .from('tickets')
      .select(`
        id,
        ticket_number,
        subject,
        status,
        priority,
        category,
        created_at,
        updated_at
      `)
      .eq('customer_id', customerId)
      .order('created_at', { ascending: false });

    // Calculate stats
    const allOrders = [...(orders || []), ...(simpleOrders || [])];
    const totalOrders = allOrders.length;
    const totalSpentCents = allOrders.reduce((sum, order) => {
      return sum + (order.total_cents || order.total_amount_cents || 0);
    }, 0);

    return res.status(200).json({
      success: true,
      customer: {
        ...customer,
        total_spent_eur: (totalSpentCents / 100).toFixed(2),
      },
      orders: orders || [],
      simple_orders: simpleOrders || [],
      tickets: tickets || [],
      stats: {
        total_orders: totalOrders,
        total_spent_cents: totalSpentCents,
        total_spent_eur: (totalSpentCents / 100).toFixed(2),
        open_tickets: (tickets || []).filter(t => t.status === 'open').length,
      },
    });

  } catch (error) {
    console.error('❌ [ADMIN CUSTOMER DETAILS] Error:', error);
    return res.status(500).json({
      error: 'Failed to fetch customer details',
      message: error.message,
    });
  }
}

async function handleUpdateCustomer(req, res, customerId) {
  const supabaseAdmin = getSupabaseAdmin();

  try {
    const { name, phone, shipping_address, billing_address, metadata } = req.body;

    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (phone !== undefined) updateData.phone = phone;
    if (shipping_address !== undefined) updateData.shipping_address = shipping_address;
    if (billing_address !== undefined) updateData.billing_address = billing_address;
    if (metadata !== undefined) updateData.metadata = { ...(metadata || {}) };
    
    updateData.updated_at = new Date().toISOString();

    const { data: customer, error } = await supabaseAdmin
      .from('customers')
      .update(updateData)
      .eq('id', customerId)
      .select()
      .single();

    if (error) {
      console.error('❌ [ADMIN CUSTOMER UPDATE] Error:', error);
      return res.status(500).json({ error: 'Failed to update customer', details: error.message });
    }

    return res.status(200).json({
      success: true,
      customer,
    });

  } catch (error) {
    console.error('❌ [ADMIN CUSTOMER UPDATE] Exception:', error);
    return res.status(500).json({
      error: 'Failed to update customer',
      message: error.message,
    });
  }
}
