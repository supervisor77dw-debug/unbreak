/**
 * UNBREAK ONE - Server-Side Auth Utilities
 * ==========================================
 * Purpose: Supabase authentication helpers for server-side (API routes)
 * Security: Uses SERVICE_ROLE_KEY (server-side only, never expose to client)
 * Dependencies: @supabase/supabase-js
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  throw new Error('Missing Supabase environment variables (SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY)');
}

// Create Supabase client with service_role key (bypasses RLS)
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

/**
 * Get user from request (validates JWT token)
 * @param {object} req - Next.js request object
 * @returns {Promise<{user, error}>}
 */
export async function getUserFromRequest(req) {
  const authHeader = req.headers.authorization || req.headers.Authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { user: null, error: new Error('Missing or invalid authorization header') };
  }

  const token = authHeader.replace('Bearer ', '');

  const { data, error } = await supabaseAdmin.auth.getUser(token);

  if (error) {
    console.error('Get user from token error:', error.message);
    return { user: null, error };
  }

  return { user: data.user, error: null };
}

/**
 * Get user profile by user ID
 * @param {string} userId - User ID (UUID)
 * @returns {Promise<{profile, error}>}
 */
export async function getUserProfile(userId) {
  const { data, error } = await supabaseAdmin
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();

  if (error) {
    console.error('Get profile error:', error.message);
    return { profile: null, error };
  }

  return { profile: data, error: null };
}

/**
 * Check if user has required role
 * @param {string} userId - User ID
 * @param {string[]} allowedRoles - Array of allowed roles
 * @returns {Promise<{hasAccess, role, error}>}
 */
export async function checkUserRole(userId, allowedRoles) {
  const { profile, error } = await getUserProfile(userId);

  if (error || !profile) {
    return { hasAccess: false, role: null, error: error || new Error('No profile found') };
  }

  const hasAccess = allowedRoles.includes(profile.role);

  return { hasAccess, role: profile.role, error: null };
}

/**
 * Update user role (admin only operation)
 * @param {string} email - User email
 * @param {string} newRole - New role (customer, staff, admin)
 * @returns {Promise<{profile, error}>}
 */
export async function setUserRole(email, newRole) {
  const validRoles = ['customer', 'staff', 'admin'];

  if (!validRoles.includes(newRole)) {
    return { profile: null, error: new Error(`Invalid role. Must be one of: ${validRoles.join(', ')}`) };
  }

  const { data, error } = await supabaseAdmin
    .from('profiles')
    .update({ role: newRole, updated_at: new Date().toISOString() })
    .eq('email', email)
    .select()
    .single();

  if (error) {
    console.error('Set user role error:', error.message);
    return { profile: null, error };
  }

  return { profile: data, error: null };
}

/**
 * Get all users with profiles (admin only)
 * @param {number} limit - Optional limit
 * @param {number} offset - Optional offset
 * @returns {Promise<{users, error}>}
 */
export async function getAllUsers(limit = 100, offset = 0) {
  const { data, error } = await supabaseAdmin
    .from('profiles')
    .select('*')
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    console.error('Get all users error:', error.message);
    return { users: [], error };
  }

  return { users: data, error: null };
}

/**
 * Middleware: Require authentication
 * @param {object} req - Next.js request
 * @param {object} res - Next.js response
 * @returns {Promise<{user, error}>}
 */
export async function requireAuth(req, res) {
  const { user, error } = await getUserFromRequest(req);

  if (error || !user) {
    res.status(401).json({ error: 'Unauthorized - Please log in' });
    return { user: null, error: error || new Error('Unauthorized') };
  }

  return { user, error: null };
}

/**
 * Middleware: Require specific role
 * @param {object} req - Next.js request
 * @param {object} res - Next.js response
 * @param {string[]} allowedRoles - Array of allowed roles
 * @returns {Promise<{user, profile, error}>}
 */
export async function requireRole(req, res, allowedRoles) {
  const { user, error: authError } = await requireAuth(req, res);

  if (authError) {
    return { user: null, profile: null, error: authError };
  }

  const { hasAccess, role, error: roleError } = await checkUserRole(user.id, allowedRoles);

  if (roleError || !hasAccess) {
    res.status(403).json({ 
      error: 'Forbidden - Insufficient permissions',
      requiredRoles: allowedRoles,
      userRole: role,
    });
    return { user: null, profile: null, error: roleError || new Error('Forbidden') };
  }

  const { profile } = await getUserProfile(user.id);

  return { user, profile, error: null };
}

/**
 * Create new user (admin only)
 * @param {string} email - User email
 * @param {string} password - User password
 * @param {string} role - User role (default: customer)
 * @returns {Promise<{user, error}>}
 */
export async function createUser(email, password, role = 'customer') {
  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (error) {
    console.error('Create user error:', error.message);
    return { user: null, error };
  }

  // Update role if not customer
  if (role !== 'customer') {
    await setUserRole(email, role);
  }

  return { user: data.user, error: null };
}

/**
 * Delete user (admin only)
 * @param {string} userId - User ID
 * @returns {Promise<{error}>}
 */
export async function deleteUser(userId) {
  const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);

  if (error) {
    console.error('Delete user error:', error.message);
    return { error };
  }

  return { error: null };
}

/**
 * Verify request has valid admin role
 * @param {object} req - Next.js request
 * @param {object} res - Next.js response
 * @returns {Promise<{isAdmin, user, profile}>}
 */
export async function verifyAdmin(req, res) {
  const { user, profile, error } = await requireRole(req, res, ['admin']);

  if (error) {
    return { isAdmin: false, user: null, profile: null };
  }

  return { isAdmin: true, user, profile };
}
