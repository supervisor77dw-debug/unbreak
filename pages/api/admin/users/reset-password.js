/**
 * ADMIN API: Reset User Password
 * 
 * POST /api/admin/users/reset-password
 * - Reset password for any user
 * - SSOT: Supabase Auth (auth.users table)
 * 
 * ARCHITECTURE DECISION (2026-01-19):
 * - Credentials (email/password) → Supabase Auth ONLY
 * - Metadata (name, role, isActive) → Prisma admin_users table
 * - This ensures single source of truth for authentication
 * 
 * Requires: ADMIN role
 */

import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../auth/[...nextauth]';
import { createClient } from '@supabase/supabase-js';
import { logDataSourceFingerprint } from '../../../../lib/dataSourceFingerprint';

// Supabase Admin Client for auth operations
const supabaseAdmin = createClient(
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

export default async function handler(req, res) {
  // Log data source fingerprint - SSOT is Supabase Auth
  const supabaseHost = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace('https://', '').split('.')[0];
  logDataSourceFingerprint('admin_users_reset_password', {
    readTables: ['auth.users (Supabase Auth)'],
    writeTables: ['auth.users (Supabase Auth)'],
    supabaseProject: supabaseHost,
    note: 'Credentials SSOT = Supabase Auth, NOT Prisma',
  });

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const session = await getServerSession(req, res, authOptions);

  if (!session?.user || session.user.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Forbidden - Admin access required' });
  }

  // Accept either userId (Supabase Auth ID) or email
  const { userId, email, newPassword } = req.body;

  if ((!userId && !email) || !newPassword) {
    return res.status(400).json({ error: 'userId or email, and newPassword are required' });
  }

  if (newPassword.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters' });
  }

  try {
    let authUserId = userId;

    // If only email provided, find Supabase Auth user by email
    if (!authUserId && email) {
      const { data: users, error: listError } = await supabaseAdmin.auth.admin.listUsers();
      if (listError) {
        console.error('[RESET PASSWORD] Error listing users:', listError);
        return res.status(500).json({ error: 'Failed to find user' });
      }
      
      const authUser = users.users.find(u => u.email?.toLowerCase() === email.toLowerCase());
      if (!authUser) {
        console.error(`[RESET PASSWORD] No Supabase Auth user found for email: ${email}`);
        return res.status(404).json({ error: 'User not found in authentication system' });
      }
      authUserId = authUser.id;
    }

    // Update password in Supabase Auth (SSOT for credentials)
    const { data: updatedUser, error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      authUserId,
      { password: newPassword }
    );

    if (updateError) {
      console.error('[RESET PASSWORD] Supabase Auth error:', updateError);
      return res.status(500).json({ error: `Failed to update password: ${updateError.message}` });
    }

    console.log(`✅ [ADMIN] Password reset for user ${updatedUser.user.email} (auth_id: ${authUserId}) by ${session.user.email}`);
    console.log(`   [FINGERPRINT] Supabase Project: ${supabaseHost}`);

    return res.status(200).json({ 
      success: true,
      message: 'Password updated successfully in Supabase Auth',
      authUserId: authUserId,
    });

  } catch (error) {
    console.error('[RESET PASSWORD] Error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
