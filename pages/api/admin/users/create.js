/**
 * ADMIN API: Create User
 * 
 * POST /api/admin/users/create
 * - Create admin user in Supabase Auth (SSOT for credentials)
 * - Then create/update metadata in admin_users table via Prisma
 * 
 * ARCHITECTURE DECISION (2026-01-19):
 * - Credentials (email/password) → Supabase Auth ONLY
 * - Metadata (name, role, isActive) → Prisma admin_users table
 * - auth.users.id is stored in admin_users for linking
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
  logDataSourceFingerprint('admin_users_create', {
    readTables: ['auth.users (Supabase Auth)'],
    writeTables: ['auth.users (Supabase Auth)', 'admin_users (Prisma - metadata only)'],
    supabaseProject: supabaseHost,
    note: 'Credentials in Supabase Auth, metadata in Prisma',
  });

  // Check authentication
  const session = await getServerSession(req, res, authOptions);
  
  if (!session || session.user.role !== 'ADMIN') {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (req.method === 'POST') {
    try {
      const { email, password, role = 'SUPPORT', display_name } = req.body;

      // Validation
      if (!email || !email.includes('@')) {
        return res.status(400).json({ error: 'Valid email is required' });
      }

      if (!password || password.length < 8) {
        return res.status(400).json({ error: 'Password must be at least 8 characters' });
      }

      const roleUpper = role.toUpperCase();
      if (!VALID_ROLES.includes(roleUpper)) {
        return res.status(400).json({ error: `Invalid role. Must be one of: ${VALID_ROLES.join(', ')}` });
      }

      // Step 1: Create user in Supabase Auth (SSOT for credentials)
      const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true, // Auto-confirm email for admin-created users
        user_metadata: {
          name: display_name || null,
          role: roleUpper,
        },
      });

      if (authError) {
        console.error('[CREATE USER] Supabase Auth error:', authError);
        
        // Handle duplicate email
        if (authError.message?.includes('already been registered') || authError.message?.includes('already exists')) {
          return res.status(400).json({ error: 'User with this email already exists' });
        }
        
        return res.status(500).json({ error: `Failed to create auth user: ${authError.message}` });
      }

      const authUserId = authData.user.id;
      console.log(`✅ [CREATE USER] Supabase Auth user created: ${email} (auth_id: ${authUserId})`);

      // Step 2: Create/Update metadata in admin_users table (Prisma)
      // Use the Supabase Auth ID as the primary key for consistency
      const user = await prisma.user.upsert({
        where: { id: authUserId },
        create: {
          id: authUserId, // Use Supabase Auth ID
          email,
          role: roleUpper,
          name: display_name || null,
          isActive: true,
          passwordHash: 'SUPABASE_AUTH', // Placeholder - not used for auth
        },
        update: {
          email,
          role: roleUpper,
          name: display_name || null,
          isActive: true,
        },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          isActive: true,
          createdAt: true,
        },
      });

      console.log(`✅ [CREATE USER] Prisma metadata saved for: ${email}`);
      console.log(`   [FINGERPRINT] Supabase Project: ${supabaseHost}`);

      return res.status(200).json({
        success: true,
        message: 'User created successfully',
        user: {
          id: user.id, // This is now the Supabase Auth ID
          email: user.email,
          role: user.role.toLowerCase(),
          display_name: user.name,
        },
      });

    } catch (error) {
      console.error('❌ [CREATE USER API] Error:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
