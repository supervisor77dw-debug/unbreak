/**
 * ADMIN API: Users Management
 * 
 * GET /api/admin/users
 * - List all admin users from admin_users table (via Supabase)
 * - Search by email, name
 * - Filter by role, isActive
 * 
 * ARCHITECTURE DECISION (2026-01-19):
 * - Credentials (email/password) → Supabase Auth ONLY
 * - Metadata (name, role, isActive) → admin_users table (Supabase)
 * - User IDs in admin_users = Supabase Auth IDs
 * 
 * Requires: ADMIN role
 */

import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]';
import { createClient } from '@supabase/supabase-js';
import { logDataSourceFingerprint } from '../../../lib/dataSourceFingerprint';

// Supabase Admin Client
const supabaseAdmin = createClient(
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

export default async function handler(req, res) {
  // Log data source fingerprint
  const supabaseHost = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace('https://', '').split('.')[0];
  logDataSourceFingerprint('admin_users_list', {
    readTables: ['admin_users (Supabase - metadata)'],
    writeTables: [],
    supabaseProject: supabaseHost,
    note: 'User list from Supabase, IDs match auth.users IDs',
  });

  // Check authentication
  const session = await getServerSession(req, res, authOptions);
  
  if (!session || session.user.role !== 'ADMIN') {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (req.method === 'GET') {
    try {
      const { search = '', role = '', is_active = '' } = req.query;

      // Build query
      let query = supabaseAdmin
        .from('admin_users')
        .select('id, email, name, role, "isActive", "createdAt", "updatedAt"')
        .order('createdAt', { ascending: false });

      // Apply filters
      if (search) {
        query = query.or(`email.ilike.%${search}%,name.ilike.%${search}%`);
      }

      if (role) {
        query = query.eq('role', role.toUpperCase());
      }

      if (is_active !== '') {
        query = query.eq('isActive', is_active === 'true');
      }

      const { data: users, error } = await query;

      if (error) {
        console.error('❌ [USERS API] Supabase error:', error);
        return res.status(500).json({ error: 'Database error' });
      }

      // Transform to match frontend expectations
      const transformedUsers = (users || []).map(user => ({
        id: user.id,
        email: user.email,
        display_name: user.name,
        role: user.role.toLowerCase(),
        is_active: user.isActive,
        created_at: user.createdAt,
        last_sign_in_at: null, // Not tracked in current schema
      }));

      console.log(`✅ [USERS API] Returned ${transformedUsers.length} users`);

      return res.status(200).json({
        success: true,
        users: transformedUsers,
      });

    } catch (error) {
      console.error('❌ [USERS API] Error:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
