/**
 * ADMIN API: Invite User
 * 
 * POST /api/admin/users/invite
 * - Send invitation email to new user
 * - Create profile with role
 * 
 * Requires: admin role
 */

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function requireAdminAuth(req, allowedRoles = ['admin']) {
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

const VALID_ROLES = ['admin', 'ops', 'support', 'designer', 'finance', 'user'];

export default async function handler(req, res) {
  const authResult = await requireAdminAuth(req, ['admin']);
  if (!authResult.authorized) {
    return res.status(401).json({ error: authResult.error });
  }

  if (req.method === 'POST') {
    try {
      const { email, role = 'user', display_name } = req.body;

      // Validation
      if (!email || !email.includes('@')) {
        return res.status(400).json({ error: 'Valid email is required' });
      }

      if (!VALID_ROLES.includes(role)) {
        return res.status(400).json({ error: `Invalid role. Must be one of: ${VALID_ROLES.join(', ')}` });
      }

      // Invite user via Supabase Admin API
      const { data: inviteData, error: inviteError } = await supabase.auth.admin.inviteUserByEmail(email, {
        data: {
          role,
          display_name: display_name || null,
        },
        redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || 'https://unbreak-one.vercel.app'}/auth/callback`,
      });

      if (inviteError) {
        console.error('❌ [INVITE API] Failed to invite user:', inviteError);
        return res.status(500).json({ error: inviteError.message || 'Failed to send invitation' });
      }

      // Ensure profile exists (should be created by trigger, but upsert to be safe)
      const { error: profileError } = await supabase
        .from('profiles')
        .upsert({
          id: inviteData.user.id,
          email: email,
          role: role,
          display_name: display_name || null,
          is_active: true,
        }, {
          onConflict: 'id',
        });

      if (profileError) {
        console.error('❌ [INVITE API] Failed to create profile:', profileError);
        // Don't fail the whole operation, profile might be created by trigger
      }

      return res.status(200).json({
        success: true,
        message: 'Invitation sent successfully',
        user: {
          id: inviteData.user.id,
          email: inviteData.user.email,
          role,
          display_name,
        },
      });

    } catch (error) {
      console.error('❌ [INVITE API] Error:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
