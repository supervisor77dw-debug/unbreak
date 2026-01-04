/**
 * GET /api/admin/customers
 * List all customers from Supabase public.customers table
 */

import { getSupabaseAdmin } from '../../../../lib/supabase';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]';

export default async function handler(req, res) {
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

    // Build query
    let query = supabase
      .from('customers')
      .select('*', { count: 'exact' });

    // Search filter
    if (search) {
      query = query.or(`email.ilike.%${search}%,name.ilike.%${search}%`);
    }

    // Sorting
    query = query.order(sort_by, { ascending: sort_order === 'asc' });

    // Pagination
    const limitNum = parseInt(limit, 10);
    const offsetNum = parseInt(offset, 10);
    query = query.range(offsetNum, offsetNum + limitNum - 1);

    // Execute query
    const { data: customers, error, count } = await query;

    if (error) {
      console.error('❌ [Customers API] Supabase error:', error);
      return res.status(500).json({
        error: 'Failed to fetch customers',
        details: error.message,
      });
    }

    console.log(`✅ [Customers API] Fetched ${customers?.length || 0} customers (total: ${count})`);

    // Return response
    return res.status(200).json({
      customers: customers || [],
      pagination: {
        total: count || 0,
        limit: limitNum,
        offset: offsetNum,
        has_more: (offsetNum + limitNum) < (count || 0),
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
