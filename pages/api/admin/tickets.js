/**
 * ADMIN API: Tickets Management
 * 
 * GET /api/admin/tickets
 * - List all tickets with filtering
 * - Search by ticket number, customer email
 * - Filter by status, priority, category
 * 
 * POST /api/admin/tickets
 * - Create new ticket
 * 
 * Requires: admin, ops, or support role
 */

import { createClient } from '@supabase/supabase-js';
import { requireAdminAuth } from '../../../lib/auth-helpers';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  // Require admin/ops/support authentication
  const authResult = await requireAdminAuth(req, res, ['admin', 'ops', 'support']);
  if (!authResult) return;

  if (req.method === 'GET') {
    return handleGetTickets(req, res);
  }

  if (req.method === 'POST') {
    return handleCreateTicket(req, res, authResult);
  }

  return res.status(405).json({ error: 'Method not allowed' });
}

/**
 * GET /api/admin/tickets
 * List tickets with filters and pagination
 */
async function handleGetTickets(req, res) {
  try {
    const {
      search = '',
      status = '',
      priority = '',
      category = '',
      assigned_to = '',
      page = '1',
      limit = '50',
      sort_by = 'created_at',
      sort_order = 'desc',
    } = req.query;

    const offset = (parseInt(page) - 1) * parseInt(limit);

    // Build query
    let query = supabase
      .from('tickets')
      .select(`
        *,
        customer:customers(id, email, name),
        assigned_user:profiles!tickets_assigned_to_fkey(id, email, display_name),
        created_by_user:profiles!tickets_created_by_fkey(id, email, display_name)
      `, { count: 'exact' });

    // Search filter (ticket_number or customer email)
    if (search) {
      query = query.or(`ticket_number.ilike.%${search}%,customer_email.ilike.%${search}%,subject.ilike.%${search}%`);
    }

    // Status filter
    if (status) {
      query = query.eq('status', status);
    }

    // Priority filter
    if (priority) {
      query = query.eq('priority', priority);
    }

    // Category filter
    if (category) {
      query = query.eq('category', category);
    }

    // Assigned to filter
    if (assigned_to) {
      query = query.eq('assigned_to', assigned_to);
    }

    // Sorting
    query = query.order(sort_by, { ascending: sort_order === 'asc' });

    // Pagination
    query = query.range(offset, offset + parseInt(limit) - 1);

    const { data: tickets, error, count } = await query;

    if (error) {
      console.error('❌ [TICKETS API] Query failed:', error);
      return res.status(500).json({ error: 'Failed to fetch tickets' });
    }

    // Calculate pagination metadata
    const totalPages = Math.ceil(count / parseInt(limit));
    const hasMore = parseInt(page) < totalPages;

    return res.status(200).json({
      success: true,
      tickets: tickets || [],
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: count,
        totalPages,
        hasMore,
      },
    });

  } catch (error) {
    console.error('❌ [TICKETS API] Error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * POST /api/admin/tickets
 * Create new ticket
 */
async function handleCreateTicket(req, res, authResult) {
  try {
    const {
      customer_id,
      customer_email,
      subject,
      description,
      priority = 'medium',
      category = 'general',
      order_id,
    } = req.body;

    // Validation
    if (!subject || !description) {
      return res.status(400).json({ error: 'Subject and description are required' });
    }

    if (!customer_email && !customer_id) {
      return res.status(400).json({ error: 'Customer email or ID is required' });
    }

    // Create ticket
    const { data: ticket, error } = await supabase
      .from('tickets')
      .insert({
        customer_id,
        customer_email: customer_email?.toLowerCase(),
        subject,
        description,
        priority,
        category,
        status: 'open',
        order_id,
        created_by: authResult.user.id,
      })
      .select()
      .single();

    if (error) {
      console.error('❌ [TICKETS API] Create failed:', error);
      return res.status(500).json({ error: 'Failed to create ticket' });
    }

    console.log('✅ [TICKETS API] Ticket created:', ticket.ticket_number);

    return res.status(201).json({
      success: true,
      ticket,
    });

  } catch (error) {
    console.error('❌ [TICKETS API] Error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
