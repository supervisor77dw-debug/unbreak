/**
 * 🔥 MESSE-MVP: Admin Customer Details API
 * CANONICAL SOURCE: customers + simple_orders (Supabase) via Repositories
 * RULE: NO DUAL-SOURCE, only canonical simple_orders
 */

import { getSupabaseAdmin } from '../../../../lib/supabase';
import { requireAdmin } from '../../../../lib/adminAuth';
import { OrderRepository, CustomerRepository } from '../../../../lib/repositories';

export default async function handler(req, res) {
  // Require admin API key
  if (!requireAdmin(req, res)) return;

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
    // Get customer
    const customer = await CustomerRepository.getCustomerById(customerId);

    if (!customer) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    // 🔥 Get orders - ONLY FROM CANONICAL TABLE (simple_orders with UO-numbers)
    const orders = await OrderRepository.listOrdersByCustomer(customer);

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

    // Calculate stats (only from canonical orders)
    const totalOrders = orders.length;
    const totalSpentCents = orders.reduce((sum, order) => {
      return sum + (order.total_amount_cents || 0);
    }, 0);

    return res.status(200).json({
      success: true,
      customer: {
        ...customer,
        total_spent_eur: (totalSpentCents / 100).toFixed(2),
      },
      orders, // 🔥 CANONICAL ONLY - no more dual-source
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
