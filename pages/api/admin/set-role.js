/**
 * UNBREAK ONE - Admin API: Set User Role
 * ========================================
 * Purpose: Allow admins to change user roles
 * Security: Requires admin role, uses service_role key
 * Route: POST /api/admin/set-role
 */

import { requireRole, setUserRole } from '../../../lib/auth-server.js';

export default async function handler(req, res) {
  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Verify admin authentication
    const { user, profile, error: authError } = await requireRole(req, res, ['admin']);

    if (authError) {
      // Response already sent by requireRole middleware
      return;
    }

    // Get request body
    const { email, role } = req.body;

    // Validate input
    if (!email || !role) {
      return res.status(400).json({ 
        error: 'Missing required fields',
        required: ['email', 'role']
      });
    }

    const validRoles = ['customer', 'staff', 'admin'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({ 
        error: 'Invalid role',
        validRoles,
        received: role
      });
    }

    // Prevent admin from demoting themselves
    if (email === profile.email && role !== 'admin') {
      return res.status(403).json({ 
        error: 'Cannot change your own admin role'
      });
    }

    // Set user role
    const { profile: updatedProfile, error: roleError } = await setUserRole(email, role);

    if (roleError) {
      return res.status(400).json({ 
        error: roleError.message 
      });
    }

    // Success
    return res.status(200).json({
      success: true,
      message: `Role updated successfully for ${email}`,
      profile: {
        id: updatedProfile.id,
        email: updatedProfile.email,
        role: updatedProfile.role,
        updated_at: updatedProfile.updated_at
      }
    });

  } catch (error) {
    console.error('Set role API error:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  }
}
