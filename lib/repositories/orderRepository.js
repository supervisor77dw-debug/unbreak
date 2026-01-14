/**
 * 🔥 MESSE-MVP: Order Repository - Single Source of Truth
 * CANONICAL TABLE: simple_orders (Supabase)
 * RULE: Only orders with order_number LIKE 'UO-%' are visible in admin
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

let supabase;
const getSupabase = () => {
  if (!supabase) {
    supabase = createClient(supabaseUrl, supabaseServiceKey);
  }
  return supabase;
};

const CANONICAL_TABLE = 'simple_orders';

export const OrderRepository = {
  /**
   * List all VISIBLE orders (only with UO-number)
   * MESSE-RULE: Hide all orders without order_number
   */
  async listOrders({ 
    page = 1, 
    limit = 20, 
    statusPayment, 
    statusFulfillment, 
    search,
    sortBy = 'created_at',
    sortOrder = 'desc'
  }) {
    const supabase = getSupabase();
    const offset = (page - 1) * limit;

    let query = supabase
      .from(CANONICAL_TABLE)
      .select(`
        *,
        customers:customer_id (
          id,
          email,
          name,
          stripe_customer_id
        )
      `, { count: 'exact' });

    // 🔥 CRITICAL: Only show orders with UO-number
    query = query.not('order_number', 'is', null);
    query = query.like('order_number', 'UO-%');

    // Filters
    if (statusPayment) {
      query = query.eq('status_payment', statusPayment);
    }
    if (statusFulfillment) {
      query = query.eq('status_fulfillment', statusFulfillment);
    }
    if (search) {
      query = query.or(`order_number.ilike.%${search}%,id::text.ilike.%${search}%,public_id.ilike.%${search}%,customer_email.ilike.%${search}%,stripe_session_id.ilike.%${search}%,stripe_checkout_session_id.ilike.%${search}%`);
    }

    // Sort & Paginate
    query = query
      .order(sortBy, { ascending: sortOrder === 'asc' })
      .range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) {
      console.error('❌ [OrderRepository.listOrders] Error:', error);
      throw error;
    }

    return {
      orders: data || [],
      total: count || 0,
      page,
      limit,
      totalPages: Math.ceil((count || 0) / limit),
    };
  },

  /**
   * Get single order by ID (UUID) or order_number or public_id
   * MESSE-RULE: Only return if has UO-number
   */
  async getOrderById(identifier) {
    const supabase = getSupabase();

    let query = supabase
      .from(CANONICAL_TABLE)
      .select(`
        *,
        customers:customer_id (
          id,
          email,
          name,
          stripe_customer_id,
          phone,
          default_shipping,
          metadata
        )
      `);

    // Check if identifier is UUID (contains dashes) or order_number or public_id
    if (identifier.includes('-') && identifier.length > 20) {
      // UUID
      query = query.eq('id', identifier);
    } else if (identifier.startsWith('UO-')) {
      // Order number
      query = query.eq('order_number', identifier);
    } else {
      // Public ID (8-char)
      query = query.eq('public_id', identifier);
    }

    const { data, error } = await query.maybeSingle();

    if (error) {
      console.error('❌ [OrderRepository.getOrderById] Error:', error);
      throw error;
    }

    // 🔥 MESSE-RULE: Don't return orders without UO-number
    if (data && (!data.order_number || !data.order_number.startsWith('UO-'))) {
      console.warn('⚠️ [OrderRepository.getOrderById] Order found but has no UO-number, hiding:', identifier);
      return null;
    }

    return data;
  },

  /**
   * Get orders by customer (with fallback matching)
   * MESSE-RULE: Only return orders with UO-number
   */
  async listOrdersByCustomer(customer) {
    const supabase = getSupabase();

    // Build OR condition for customer matching
    const orConditions = [];
    if (customer.id) orConditions.push(`customer_id.eq.${customer.id}`);
    if (customer.stripe_customer_id) orConditions.push(`stripe_customer_id.eq.${customer.stripe_customer_id}`);
    if (customer.email) orConditions.push(`customer_email.ilike.${customer.email}`);

    if (orConditions.length === 0) {
      return [];
    }

    const { data, error } = await supabase
      .from(CANONICAL_TABLE)
      .select('*')
      .or(orConditions.join(','))
      .not('order_number', 'is', null) // 🔥 CRITICAL
      .like('order_number', 'UO-%')     // 🔥 CRITICAL
      .order('created_at', { ascending: false });

    if (error) {
      console.error('❌ [OrderRepository.listOrdersByCustomer] Error:', error);
      throw error;
    }

    return data || [];
  },

  /**
   * Update order status
   */
  async updateOrderStatus(orderId, updates) {
    const supabase = getSupabase();

    const allowedFields = ['status_payment', 'status_fulfillment', 'notes', 'metadata'];
    const filteredUpdates = {};
    
    for (const field of allowedFields) {
      if (updates[field] !== undefined) {
        filteredUpdates[field] = updates[field];
      }
    }

    filteredUpdates.updated_at = new Date().toISOString();

    const { data, error } = await supabase
      .from(CANONICAL_TABLE)
      .update(filteredUpdates)
      .eq('id', orderId)
      .select()
      .single();

    if (error) {
      console.error('❌ [OrderRepository.updateOrderStatus] Error:', error);
      throw error;
    }

    return data;
  },
};
