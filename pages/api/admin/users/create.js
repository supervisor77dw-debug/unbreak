/**
 * ADMIN API: Create User
 * 
 * POST /api/admin/users/create
 * - Create admin user with email and password
 * - Hash password with bcrypt
 * 
 * Requires: ADMIN role
 */

import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../auth/[...nextauth]';
import prisma from '../../../../lib/prisma';
import bcrypt from 'bcryptjs';

const VALID_ROLES = ['ADMIN', 'STAFF', 'SUPPORT'];

export default async function handler(req, res) {
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

      // Check if user already exists
      const existingUser = await prisma.user.findUnique({
        where: { email }
      });

      if (existingUser) {
        return res.status(400).json({ error: 'User with this email already exists' });
      }

      // Hash password
      const passwordHash = await bcrypt.hash(password, 10);

      // Create user
      const user = await prisma.user.create({
        data: {
          email,
          passwordHash,
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

      return res.status(200).json({
        success: true,
        message: 'User created successfully',
        user: {
          id: user.id,
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
