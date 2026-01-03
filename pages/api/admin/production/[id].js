import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function requireAdminAuth(req, allowedRoles = ['admin', 'ops']) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return { authorized: false, error: 'Missing authorization header' };
  }

  const token = authHeader.substring(7);
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);

  if (authError || !user) {
    return { authorized: false, error: 'Invalid token' };
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, is_active')
    .eq('id', user.id)
    .single();

  if (!profile?.is_active) {
    return { authorized: false, error: 'User is not active' };
  }

  const userRole = profile.role?.toLowerCase();
  if (!allowedRoles.includes(userRole)) {
    return { authorized: false, error: 'Insufficient permissions' };
  }

  return { authorized: true, user, profile };
}

const VALID_STATUSES = ['pending', 'in_production', 'quality_check', 'completed', 'on_hold', 'cancelled'];

export default async function handler(req, res) {
  const authResult = await requireAdminAuth(req, ['admin', 'ops']);
  if (!authResult.authorized) {
    return res.status(401).json({ error: authResult.error });
  }

  const { id } = req.query;

  if (req.method === 'PATCH') {
    try {
      const { production_status } = req.body;

      if (production_status && !VALID_STATUSES.includes(production_status)) {
        return res.status(400).json({ error: 'Invalid production status' });
      }

      const updates = { updated_at: new Date().toISOString() };
      if (production_status) updates.production_status = production_status;

      const { data, error } = await supabase
        .from('production_queue')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      return res.status(200).json({ item: data });
    } catch (error) {
      console.error('Error updating production item:', error);
      return res.status(500).json({ error: error.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
