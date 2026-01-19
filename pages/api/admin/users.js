/**
 * ADMIN API: Users Management
 * 
 * GET /api/admin/users
 * - List all admin users from Prisma (metadata)
 * - Search by email, name
 * - Filter by role, isActive
 * 
 * ARCHITECTURE DECISION (2026-01-19):
 * - Credentials (email/password) → Supabase Auth ONLY
 * - Metadata (name, role, isActive) → Prisma admin_users table
 * - User IDs in admin_users = Supabase Auth IDs
 * 
 * Requires: ADMIN role
 */

import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]';
import prisma from '../../../lib/prisma';
import { logDataSourceFingerprint } from '../../../lib/dataSourceFingerprint';

export default async function handler(req, res) {
  // Log data source fingerprint
  const supabaseHost = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace('https://', '').split('.')[0];
  logDataSourceFingerprint('admin_users_list', {
    readTables: ['admin_users (Prisma - metadata)'],
    writeTables: [],
    supabaseProject: supabaseHost,
    note: 'User list from Prisma, IDs match Supabase Auth IDs',
  });

  // Check authentication
  const session = await getServerSession(req, res, authOptions);
  
  if (!session || session.user.role !== 'ADMIN') {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (req.method === 'GET') {
    try {
      const { search = '', role = '', is_active = '' } = req.query;

      // Build where clause
      const where = {};
      
      if (search) {
        where.OR = [
          { email: { contains: search, mode: 'insensitive' } },
          { name: { contains: search, mode: 'insensitive' } },
        ];
      }

      if (role) {
        where.role = role.toUpperCase();
      }

      if (is_active !== '') {
        where.isActive = is_active === 'true';
      }

      const users = await prisma.user.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      // Transform to match frontend expectations
      const transformedUsers = users.map(user => ({
        id: user.id,
        email: user.email,
        display_name: user.name,
        role: user.role.toLowerCase(),
        is_active: user.isActive,
        created_at: user.createdAt,
        last_sign_in_at: null, // Not tracked in current schema
      }));

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
