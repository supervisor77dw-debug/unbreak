/**
 * ADMIN API: Ticket Messages
 * 
 * POST /api/admin/tickets/[id]/messages
 * - Add message to ticket thread
 * - Support internal notes and customer replies
 * 
 * Requires: admin, ops, or support role
 */

import { createClient } from '@supabase/supabase-js';
import { requireAdminAuth } from '../../../../../lib/auth-helpers';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  // Require admin/ops/support authentication
  const authResult = await requireAdminAuth(req, res, ['admin', 'ops', 'support']);
  if (!authResult) return;

  const { id: ticketId } = req.query;

  if (req.method === 'POST') {
    return handleCreateMessage(req, res, ticketId, authResult);
  }

  return res.status(405).json({ error: 'Method not allowed' });
}

/**
 * POST /api/admin/tickets/[id]/messages
 * Add message to ticket
 */
async function handleCreateMessage(req, res, ticketId, authResult) {
  try {
    const { message, is_internal = false, attachments = [] } = req.body;

    // Validation
    if (!message || message.trim().length === 0) {
      return res.status(400).json({ error: 'Message is required' });
    }

    // Check if ticket exists
    const { data: ticket, error: ticketError } = await supabase
      .from('tickets')
      .select('id, status')
      .eq('id', ticketId)
      .single();

    if (ticketError || !ticket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    // Create message
    const { data: ticketMessage, error } = await supabase
      .from('ticket_messages')
      .insert({
        ticket_id: ticketId,
        user_id: authResult.user.id,
        message: message.trim(),
        is_internal,
        sender_type: 'staff',
        attachments: attachments.length > 0 ? attachments : null,
      })
      .select(`
        *,
        user:profiles(id, email, display_name)
      `)
      .single();

    if (error) {
      console.error('❌ [TICKET MESSAGE API] Create failed:', error);
      return res.status(500).json({ error: 'Failed to create message' });
    }

    // Update ticket's last_activity_at
    await supabase
      .from('tickets')
      .update({ 
        last_activity_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', ticketId);

    console.log('✅ [TICKET MESSAGE API] Message created for ticket:', ticketId);

    return res.status(201).json({
      success: true,
      message: ticketMessage,
    });

  } catch (error) {
    console.error('❌ [TICKET MESSAGE API] Error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
