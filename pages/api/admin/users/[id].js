/**
 * ADMIN API: User Detail & Update
 * 
 * PATCH /api/admin/users/[id]
 * - Update user role (synced to Supabase Auth metadata)
 * - Activate/deactivate user
 * - Update display name (synced to Supabase Auth metadata)
 * 
 * ARCHITECTURE DECISION (2026-01-19):
 * - Credentials (email/password) → Supabase Auth ONLY
 * - Metadata (name, role, isActive) → Prisma admin_users + Supabase Auth user_metadata
 * 
 * Requires: ADMIN role
 */

import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../auth/[...nextauth]';
import prisma from '../../../../lib/prisma';
import { createClient } from '@supabase/supabase-js';
import { logDataSourceFingerprint } from '../../../../lib/dataSourceFingerprint';

// Supabase Admin Client for auth operations
const supabaseAdmin = createClient(
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const VALID_ROLES = ['ADMIN', 'STAFF', 'SUPPORT'];

export default async function handler(req, res) {
  // Log data source fingerprint
  const supabaseHost = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace('https://', '').split('.')[0];
  logDataSourceFingerprint('admin_users_detail', {
    readTables: ['admin_users (Prisma - metadata)'],
    writeTables: req.method === 'PATCH' ? ['admin_users (Prisma)', 'auth.users (Supabase - metadata sync)'] : [],
    supabaseProject: supabaseHost,
    note: 'Role/Name synced to Supabase Auth user_metadata',
  });

  // Check authentication
  const session = await getServerSession(req, res, authOptions);
  
  if (!session || session.user.role !== 'ADMIN') {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { id } = req.query; // This is now the Supabase Auth ID

  if (req.method === 'PATCH') {
    try {
      const { role, is_active, display_name } = req.body;

      const updates = {};
      const authMetadataUpdates = {};

      if (role) {
        const roleUpper = role.toUpperCase();
        if (!VALID_ROLES.includes(roleUpper)) {
          return res.status(400).json({ error: `Invalid role. Must be one of: ${VALID_ROLES.join(', ')}` });
        }
        updates.role = roleUpper;
        authMetadataUpdates.role = roleUpper;
      }

      if (is_active !== undefined) {
        updates.isActive = is_active;
      }

      if (display_name !== undefined) {
        updates.name = display_name || null;
        authMetadataUpdates.name = display_name || null;
      }

      // Update Prisma (metadata)
      const user = await prisma.user.update({
        where: { id },
        data: updates,
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          isActive: true,
          updatedAt: true,
        },
      });

      // Sync metadata to Supabase Auth (for session consistency)
      if (Object.keys(authMetadataUpdates).length > 0) {
        const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(id, {
          user_metadata: authMetadataUpdates,
        });
        
        if (authError) {
          console.warn(`⚠️ [UPDATE USER] Supabase Auth metadata sync failed: ${authError.message}`);
          // Non-fatal: Prisma is primary for metadata
        } else {
          console.log(`✅ [UPDATE USER] Supabase Auth metadata synced for ${user.email}`);
        }
      }

      return res.status(200).json({
        success: true,
        user: {
          id: user.id,
          email: user.email,
          role: user.role.toLowerCase(),
          display_name: user.name,
          is_active: user.isActive,
        },
      });

    } catch (error) {
      console.error('❌ [UPDATE USER API] Error:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
