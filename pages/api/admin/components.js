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
  const authResult = await requireAdminAuth(req, ['admin', 'ops', 'designer']);
  if (!authResult.authorized) {
    return res.status(401).json({ error: authResult.error });
  }

  if (req.method === 'GET') {
    try {
      const { category, page = 1, limit = 100 } = req.query;
      const offset = (parseInt(page) - 1) * parseInt(limit);

      let query = supabase
        .from('component_inventory')
        .select('*', { count: 'exact' })
        .order('component_name', { ascending: true })
        .range(offset, offset + parseInt(limit) - 1);

      if (category) {
        query = query.eq('component_category', category);
      }

      const { data: components, error, count } = await query;

      if (error) throw error;

      return res.status(200).json({
        components,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: count,
          totalPages: Math.ceil(count / parseInt(limit)),
          hasMore: offset + components.length < count
        }
      });
    } catch (error) {
      console.error('Error fetching components:', error);
      return res.status(500).json({ error: error.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
