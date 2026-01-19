/**
 * GET /api/admin/customers
 * List all customers - extracts unique customers from simple_orders
 */

import { getSupabaseAdmin } from '../../../../lib/supabase';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]';
import { logDataSourceFingerprint } from '../../../../lib/dataSourceFingerprint';

export default async function handler(req, res) {
  // Log data source fingerprint
  logDataSourceFingerprint('customers_api', {
    readTables: ['simple_orders'],
    writeTables: [],
  });

  // Only GET allowed
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Check authentication
    const session = await getServerSession(req, res, authOptions);
    if (!session || !session.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Get query params
    const {
      search = '',
      limit = '50',
      offset = '0',
      sort_by = 'created_at',
      sort_order = 'desc',
    } = req.query;

    const supabase = getSupabaseAdmin();

    console.log('[Customers API] Extracting customers from simple_orders...');

    // Get all orders with customer data
    let query = supabase
      .from('simple_orders')
      .select('customer_email, customer_name, customer_phone, shipping_address, total_amount_cents, created_at')
      .not('customer_email', 'is', null);

    if (search) {
      query = query.or(`customer_email.ilike.%${search}%,customer_name.ilike.%${search}%`);
    }

    const { data: orders, error } = await query;

    if (error) {
      console.error('❌ [Customers API] Supabase error:', error);
      return res.status(500).json({
        error: 'Failed to fetch customers',
        details: error.message,
      });
    }

    // Aggregate by email
    const customerMap = new Map();
    for (const order of orders || []) {
      const email = order.customer_email?.toLowerCase();
      if (!email) continue;

      if (!customerMap.has(email)) {
        customerMap.set(email, {
          id: email,
          email: order.customer_email,
          name: order.customer_name || null,
          phone: order.customer_phone || null,
          shipping_address: order.shipping_address || null,
          total_orders: 0,
          total_spent_cents: 0,
          first_order_at: order.created_at,
          last_order_at: order.created_at,
        });
      }

      const customer = customerMap.get(email);
      customer.total_orders++;
      customer.total_spent_cents += order.total_amount_cents || 0;
      
      // Update name/phone if missing
      if (!customer.name && order.customer_name) customer.name = order.customer_name;
      if (!customer.phone && order.customer_phone) customer.phone = order.customer_phone;
      if (!customer.shipping_address && order.shipping_address) customer.shipping_address = order.shipping_address;
      
      // Track first and last order
      if (new Date(order.created_at) < new Date(customer.first_order_at)) {
        customer.first_order_at = order.created_at;
      }
      if (new Date(order.created_at) > new Date(customer.last_order_at)) {
        customer.last_order_at = order.created_at;
      }
    }

    // Convert to array with calculated fields
    let customers = Array.from(customerMap.values()).map(c => ({
      ...c,
      created_at: c.first_order_at, // Use first order as "created"
      total_spent_eur: (c.total_spent_cents / 100).toFixed(2),
    }));

    // Sort
    if (sort_by === 'created_at' || sort_by === 'first_order_at') {
      customers.sort((a, b) => sort_order === 'asc' 
        ? new Date(a.first_order_at) - new Date(b.first_order_at)
        : new Date(b.first_order_at) - new Date(a.first_order_at));
    } else if (sort_by === 'last_order_at') {
      customers.sort((a, b) => sort_order === 'asc'
        ? new Date(a.last_order_at) - new Date(b.last_order_at)
        : new Date(b.last_order_at) - new Date(a.last_order_at));
    } else if (sort_by === 'total_orders') {
      customers.sort((a, b) => sort_order === 'asc'
        ? a.total_orders - b.total_orders
        : b.total_orders - a.total_orders);
    } else if (sort_by === 'total_spent_cents') {
      customers.sort((a, b) => sort_order === 'asc'
        ? a.total_spent_cents - b.total_spent_cents
        : b.total_spent_cents - a.total_spent_cents);
    }

    const totalCount = customers.length;
    
    // Paginate
    const limitNum = parseInt(limit, 10);
    const offsetNum = parseInt(offset, 10);
    customers = customers.slice(offsetNum, offsetNum + limitNum);

    console.log(`✅ [Customers API] Found ${totalCount} unique customers, returning ${customers.length}`);

    // Return response
    return res.status(200).json({
      customers,
      pagination: {
        total: totalCount,
        limit: limitNum,
        offset: offsetNum,
        has_more: (offsetNum + limitNum) < totalCount,
      },
    });

  } catch (error) {
    console.error('❌ [Customers API] Fatal error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message,
    });
  }
}
