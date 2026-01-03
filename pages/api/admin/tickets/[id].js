/**
 * ADMIN API: Ticket Detail & Update
 * 
 * GET /api/admin/tickets/[id]
 * - Get ticket details with messages
 * 
 * PATCH /api/admin/tickets/[id]
 * - Update ticket status, priority, assignment
 * 
 * Requires: admin, ops, or support role
 */

import { createClient } from '@supabase/supabase-js';
import { requireAdminAuth } from '../../../../lib/auth-helpers';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const VALID_STATUSES = ['open', 'in_progress', 'waiting_customer', 'waiting_internal', 'resolved', 'closed', 'cancelled'];
const VALID_PRIORITIES = ['low', 'medium', 'high', 'urgent'];

export default async function handler(req, res) {
  // Require admin/ops/support authentication
  const authResult = await requireAdminAuth(req, res, ['admin', 'ops', 'support']);
  if (!authResult) return;

  const { id } = req.query;

  if (req.method === 'GET') {
    return handleGetTicket(req, res, id);
  }

  if (req.method === 'PATCH') {
    return handleUpdateTicket(req, res, id, authResult);
  }

  return res.status(405).json({ error: 'Method not allowed' });
}

/**
 * GET /api/admin/tickets/[id]
 * Get ticket details with messages and related data
 */
async function handleGetTicket(req, res, ticketId) {
  try {
    // Get ticket
    const { data: ticket, error: ticketError } = await supabase
      .from('tickets')
      .select(`
        *,
        customer:customers(id, email, name, phone),
        order:orders(id, order_number, status),
        assigned_user:profiles!tickets_assigned_to_fkey(id, email, display_name),
        created_by_user:profiles!tickets_created_by_fkey(id, email, display_name)
      `)
      .eq('id', ticketId)
      .single();

    if (ticketError || !ticket) {
      console.error('❌ [TICKET API] Ticket not found:', ticketError);
      return res.status(404).json({ error: 'Ticket not found' });
    }

    // Get messages
    const { data: messages, error: messagesError } = await supabase
      .from('ticket_messages')
      .select(`
        *,
        user:profiles(id, email, display_name)
      `)
      .eq('ticket_id', ticketId)
      .order('created_at', { ascending: true });

    if (messagesError) {
      console.error('❌ [TICKET API] Failed to load messages:', messagesError);
    }

    return res.status(200).json({
      success: true,
      ticket,
      messages: messages || [],
    });

  } catch (error) {
    console.error('❌ [TICKET API] Error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * PATCH /api/admin/tickets/[id]
 * Update ticket
 */
async function handleUpdateTicket(req, res, ticketId, authResult) {
  try {
    const { status, priority, assigned_to, resolution_notes } = req.body;

    // Validate status
    if (status && !VALID_STATUSES.includes(status)) {
      return res.status(400).json({ 
        error: `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}` 
      });
    }

    // Validate priority
    if (priority && !VALID_PRIORITIES.includes(priority)) {
      return res.status(400).json({ 
        error: `Invalid priority. Must be one of: ${VALID_PRIORITIES.join(', ')}` 
      });
    }

    // Build update object
    const updates = {};
    if (status !== undefined) {
      updates.status = status;
      if (status === 'resolved' || status === 'closed') {
        updates.resolved_at = new Date().toISOString();
        updates.resolved_by = authResult.user.id;
      }
    }
    if (priority !== undefined) updates.priority = priority;
    if (assigned_to !== undefined) updates.assigned_to = assigned_to;
    if (resolution_notes !== undefined) updates.resolution_notes = resolution_notes;
    updates.updated_at = new Date().toISOString();

    if (Object.keys(updates).length === 1) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }

    // Update ticket
    const { data: ticket, error } = await supabase
      .from('tickets')
      .update(updates)
      .eq('id', ticketId)
      .select()
      .single();

    if (error) {
      console.error('❌ [TICKET API] Update failed:', error);
      return res.status(500).json({ error: 'Failed to update ticket' });
    }

    console.log('✅ [TICKET API] Ticket updated:', ticket.ticket_number);

    return res.status(200).json({
      success: true,
      ticket,
    });

  } catch (error) {
    console.error('❌ [TICKET API] Error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
