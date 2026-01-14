/**
 * 🔥 MESSE-MVP: Customer Repository - Single Source of Truth
 * CANONICAL TABLE: customers (Supabase)
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

export const CustomerRepository = {
  async getCustomerById(customerId) {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('customers')
      .select('*')
      .eq('id', customerId)
      .maybeSingle();
    
    if (error) {
      console.error('❌ [CustomerRepository.getCustomerById] Error:', error);
      throw error;
    }
    return data;
  },

  async getCustomerByEmail(email) {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('customers')
      .select('*')
      .eq('email', email)
      .maybeSingle();
    
    if (error) {
      console.error('❌ [CustomerRepository.getCustomerByEmail] Error:', error);
      throw error;
    }
    return data;
  },

  async getCustomerByStripeId(stripeCustomerId) {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('customers')
      .select('*')
      .eq('stripe_customer_id', stripeCustomerId)
      .maybeSingle();
    
    if (error) {
      console.error('❌ [CustomerRepository.getCustomerByStripeId] Error:', error);
      throw error;
    }
    return data;
  },

  async listCustomers({ page = 1, limit = 20, search }) {
    const supabase = getSupabase();
    const offset = (page - 1) * limit;

    let query = supabase
      .from('customers')
      .select('*', { count: 'exact' });

    if (search) {
      query = query.or(`email.ilike.%${search}%,name.ilike.%${search}%,stripe_customer_id.ilike.%${search}%`);
    }

    query = query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) {
      console.error('❌ [CustomerRepository.listCustomers] Error:', error);
      throw error;
    }

    return {
      customers: data || [],
      total: count || 0,
      page,
      limit,
      totalPages: Math.ceil((count || 0) / limit),
    };
  },
};
