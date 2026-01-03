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

export default async function handler(req, res) {
  const authResult = await requireAdminAuth(req, ['admin', 'finance']);
  if (!authResult.authorized) {
    return res.status(401).json({ error: authResult.error });
  }

  if (req.method === 'GET') {
    try {
      const { page = 1, limit = 50 } = req.query;
      const offset = (parseInt(page) - 1) * parseInt(limit);

      const { data: rules, error, count } = await supabase
        .from('pricing_rules')
        .select('*', { count: 'exact' })
        .order('version', { ascending: false })
        .range(offset, offset + parseInt(limit) - 1);

      if (error) throw error;

      return res.status(200).json({
        rules,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: count,
          totalPages: Math.ceil(count / parseInt(limit)),
          hasMore: offset + rules.length < count
        }
      });
    } catch (error) {
      console.error('Error fetching pricing rules:', error);
      return res.status(500).json({ error: error.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
