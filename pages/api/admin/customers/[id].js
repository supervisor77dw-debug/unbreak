/**
 * Admin Customer Details API
 * GET /api/admin/customers/[id] - Get customer details (id = email)
 * Extracts customer data from simple_orders
 */

import { getSupabaseAdmin } from '../../../../lib/supabase';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]';
import { logDataSourceFingerprint } from '../../../../lib/dataSourceFingerprint';

export default async function handler(req, res) {
  // Log data source fingerprint
  logDataSourceFingerprint('customer_detail_api', {
    readTables: ['simple_orders'],
    writeTables: [],
  });

  // Session-based auth (consistent with other admin APIs)
  const session = await getServerSession(req, res, authOptions);
  if (!session || !session.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { id } = req.query; // id is the customer email

  if (req.method === 'GET') {
    return handleGetCustomerDetails(req, res, id);
  }

  return res.status(405).json({ error: 'Method not allowed' });
}

async function handleGetCustomerDetails(req, res, customerEmail) {
  const supabaseAdmin = getSupabaseAdmin();

  try {
    console.log(`[Customer Details API] Fetching customer: ${customerEmail}`);

    // Get all orders for this customer from simple_orders
    const { data: orders, error } = await supabaseAdmin
      .from('simple_orders')
      .select('*')
      .ilike('customer_email', customerEmail)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('❌ [Customer Details API] Error:', error);
      return res.status(500).json({ error: 'Failed to fetch customer', details: error.message });
    }

    if (!orders || orders.length === 0) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    // Aggregate customer data from orders
    const firstOrder = orders[orders.length - 1]; // Oldest order
    const latestOrder = orders[0]; // Newest order

    const customer = {
      id: customerEmail, // Use email as ID
      email: latestOrder.customer_email,
      name: latestOrder.customer_name || firstOrder.customer_name || null,
      phone: latestOrder.customer_phone || firstOrder.customer_phone || null,
      shipping_address: latestOrder.shipping_address || firstOrder.shipping_address || null,
      created_at: firstOrder.created_at,
      updated_at: latestOrder.created_at,
    };

    // Calculate stats
    const totalOrders = orders.length;
    const totalSpentCents = orders.reduce((sum, order) => sum + (order.total_amount_cents || 0), 0);

    // Format orders for display
    const formattedOrders = orders.map(order => ({
      id: order.id,
      order_number: order.order_number || `UO-${order.id?.substring(0, 8)}`,
      product_name: order.product_name,
      product_sku: order.product_sku,
      total_amount_cents: order.total_amount_cents,
      total_amount_eur: ((order.total_amount_cents || 0) / 100).toFixed(2),
      payment_status: order.payment_status,
      fulfillment_status: order.fulfillment_status,
      created_at: order.created_at,
    }));

    console.log(`✅ [Customer Details API] Found ${totalOrders} orders for ${customerEmail}`);

    return res.status(200).json({
      success: true,
      customer: {
        ...customer,
        total_spent_eur: (totalSpentCents / 100).toFixed(2),
      },
      orders: formattedOrders,
      tickets: [], // Tickets not implemented yet
      stats: {
        total_orders: totalOrders,
        total_spent_cents: totalSpentCents,
        total_spent_eur: (totalSpentCents / 100).toFixed(2),
        open_tickets: 0,
      },
    });

  } catch (error) {
    console.error('❌ [Customer Details API] Exception:', error);
    return res.status(500).json({
      error: 'Failed to fetch customer details',
      message: error.message,
    });
  }
}
