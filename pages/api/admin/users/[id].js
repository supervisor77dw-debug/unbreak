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

const VALID_ROLES = ['ADMIN', 'STAFF', 'SUPPORT'];

export default async function handler(req, res) {
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

export default async function handler(req, res) {
  // Require admin authentication
  const authResult = await requireAdminAuth(req, res, ['admin']);
  if (!authResult) return;

  const { id } = req.query;

  if (req.method === 'GET') {
    return handleGetUser(req, res, id);
  }

  if (req.method === 'PATCH') {
    return handleUpdateUser(req, res, id);
  }

  return res.status(405).json({ error: 'Method not allowed' });
}

/**
 * GET /api/admin/users/[id]
 * Get user profile details
 */
async function handleGetUser(req, res, userId) {
  try {
    const { data: user, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (error || !user) {
      console.error('❌ [USER API] User not found:', error);
      return res.status(404).json({ error: 'User not found' });
    }

    return res.status(200).json({
      success: true,
      user,
    });

  } catch (error) {
    console.error('❌ [USER API] Error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * PATCH /api/admin/users/[id]
 * Update user profile
 */
async function handleUpdateUser(req, res, userId) {
  try {
    const { role, is_active, display_name } = req.body;

    // Validate role if provided
    if (role && !VALID_ROLES.includes(role)) {
      return res.status(400).json({ 
        error: `Invalid role. Must be one of: ${VALID_ROLES.join(', ')}` 
      });
    }

    // Build update object
    const updates = {};
    if (role !== undefined) updates.role = role;
    if (is_active !== undefined) updates.is_active = is_active;
    if (display_name !== undefined) updates.display_name = display_name;
    updates.updated_at = new Date().toISOString();

    if (Object.keys(updates).length === 1) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }

    // Update user
    const { data: user, error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', userId)
      .select()
      .single();

    if (error) {
      console.error('❌ [USER API] Update failed:', error);
      return res.status(500).json({ error: 'Failed to update user' });
    }

    console.log('✅ [USER API] User updated:', userId);

    return res.status(200).json({
      success: true,
      user,
    });

  } catch (error) {
    console.error('❌ [USER API] Error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
