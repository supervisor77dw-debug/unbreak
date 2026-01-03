/**
 * ADMIN API: Users Management
 * 
 * GET /api/admin/users
 * - List all users with role filtering
 * - Search by email, name
 * - Pagination support
 * 
 * Requires: admin role
 */

import { createClient } from '@supabase/supabase-js';
import { requireAdminAuth } from '../../../lib/auth-helpers';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  // Require admin authentication
  const authResult = await requireAdminAuth(req, res, ['admin']);
  if (!authResult) return; // Response already sent by requireAdminAuth

  if (req.method === 'GET') {
    return handleGetUsers(req, res);
  }

  return res.status(405).json({ error: 'Method not allowed' });
}

/**
 * GET /api/admin/users
 * List users with filters and pagination
 */
async function handleGetUsers(req, res) {
  try {
    const {
      search = '',
      role = '',
      is_active = '',
      page = '1',
      limit = '50',
      sort_by = 'created_at',
      sort_order = 'desc',
    } = req.query;

    const offset = (parseInt(page) - 1) * parseInt(limit);

    // Build query
    let query = supabase
      .from('profiles')
      .select('*', { count: 'exact' });

    // Search filter (email or display_name)
    if (search) {
      query = query.or(`email.ilike.%${search}%,display_name.ilike.%${search}%`);
    }

    // Role filter
    if (role) {
      query = query.eq('role', role);
    }

    // Active status filter
    if (is_active !== '') {
      query = query.eq('is_active', is_active === 'true');
    }

    // Sorting
    query = query.order(sort_by, { ascending: sort_order === 'asc' });

    // Pagination
    query = query.range(offset, offset + parseInt(limit) - 1);

    const { data: users, error, count } = await query;

    if (error) {
      console.error('❌ [USERS API] Query failed:', error);
      return res.status(500).json({ error: 'Failed to fetch users' });
    }

    // Calculate pagination metadata
    const totalPages = Math.ceil(count / parseInt(limit));
    const hasMore = parseInt(page) < totalPages;

    return res.status(200).json({
      success: true,
      users: users || [],
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: count,
        totalPages,
        hasMore,
      },
    });

  } catch (error) {
    console.error('❌ [USERS API] Error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
