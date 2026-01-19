/**
 * ADMIN API: User Detail & Update
 * 
 * PATCH /api/admin/users/[id]
 * - Update user role
 * - Activate/deactivate user
 * - Update display name
 * 
 * Requires: ADMIN role
 */

import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../auth/[...nextauth]';
import prisma from '../../../../lib/prisma';
import { logDataSourceFingerprint } from '../../../../lib/dataSourceFingerprint';

const VALID_ROLES = ['ADMIN', 'STAFF', 'SUPPORT'];

export default async function handler(req, res) {
  // Log data source fingerprint (SSOT: Prisma User table)
  logDataSourceFingerprint('admin_users_detail', {
    readTables: ['User (Prisma)'],
    writeTables: req.method === 'PATCH' ? ['User (Prisma)'] : [],
  });

  // Check authentication
  const session = await getServerSession(req, res, authOptions);
  
  if (!session || session.user.role !== 'ADMIN') {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { id } = req.query;

  if (req.method === 'PATCH') {
    try {
      const { role, is_active, display_name } = req.body;

      const updates = {};

      if (role) {
        const roleUpper = role.toUpperCase();
        if (!VALID_ROLES.includes(roleUpper)) {
          return res.status(400).json({ error: `Invalid role. Must be one of: ${VALID_ROLES.join(', ')}` });
        }
        updates.role = roleUpper;
      }

      if (is_active !== undefined) {
        updates.isActive = is_active;
      }

      if (display_name !== undefined) {
        updates.name = display_name || null;
      }

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
