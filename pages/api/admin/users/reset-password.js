/**
 * ADMIN API: Reset User Password
 * 
 * POST /api/admin/users/reset-password
 * - Reset password for any user
 * - Uses Prisma User table (SSOT)
 * 
 * CRITICAL FIX: This was previously using Supabase admin_users table (BUG!)
 * Now unified to use Prisma User table like all other user endpoints.
 * 
 * Requires: ADMIN role
 */

import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../auth/[...nextauth]';
import prisma from '../../../../lib/prisma';
import bcrypt from 'bcryptjs';
import { logDataSourceFingerprint } from '../../../../lib/dataSourceFingerprint';

export default async function handler(req, res) {
  // Log data source fingerprint (SSOT: Prisma User table)
  logDataSourceFingerprint('admin_users_reset_password', {
    readTables: ['User (Prisma)'],
    writeTables: ['User (Prisma)'],
  });

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const session = await getServerSession(req, res, authOptions);

  if (!session?.user || session.user.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Forbidden - Admin access required' });
  }

  const { userId, newPassword } = req.body;

  if (!userId || !newPassword) {
    return res.status(400).json({ error: 'userId and newPassword are required' });
  }

  if (newPassword.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters' });
  }

  try {
    // First verify user exists
    const existingUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true },
    });

    if (!existingUser) {
      console.error(`[RESET PASSWORD] User not found: ${userId}`);
      return res.status(404).json({ error: 'User not found' });
    }

    // Hash the new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update password in Prisma User table (SSOT)
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { 
        passwordHash: hashedPassword,
        updatedAt: new Date(),
      },
      select: {
        id: true,
        email: true,
        updatedAt: true,
      },
    });

    console.log(`✅ [ADMIN] Password reset for user ${updatedUser.email} by ${session.user.email}`);

    return res.status(200).json({ 
      success: true,
      message: 'Password updated successfully' 
    });

  } catch (error) {
    console.error('[RESET PASSWORD] Error:', error);
    
    // Handle Prisma-specific errors
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'User not found' });
    }
    
    return res.status(500).json({ error: 'Internal server error' });
  }
}
