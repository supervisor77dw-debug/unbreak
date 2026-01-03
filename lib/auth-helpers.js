import { getServerSession } from 'next-auth/next';
import { authOptions } from '../pages/api/auth/[...nextauth]';
import prisma from './prisma';
import { getSupabaseAdmin } from './supabase';

export async function requireAuth(req, res) {
  const session = await getServerSession(req, res, authOptions);
  
  if (!session || !session.user) {
    return null;
  }
  
  // Get user role from database
  try {
    const adminUser = await prisma.user.findUnique({
      where: { email: session.user.email },
    });
    
    if (!adminUser) {
      // User exists in session but not in database - invalid state
      console.error('[requireAuth] User not found in database:', session.user.email);
      return null;
    }
    
    return {
      ...session.user,
      role: adminUser.role,
    };
  } catch (err) {
    console.error('Failed to get user role:', err);
    // Database connection failed - treat as authentication failure
    // This prevents crashes when accessing .role property
    return null;
  }
}

/**
 * Enhanced auth helper using Supabase profiles table
 * Checks against new role system: admin, ops, support, designer, finance
 */
export async function requireAdminAuth(req, res, allowedRoles = ['admin']) {
  const session = await getServerSession(req, res, authOptions);
  
  if (!session || !session.user) {
    console.error('[requireAdminAuth] No session found');
    return null;
  }
  
  try {
    const supabaseAdmin = getSupabaseAdmin();
    
    // Get user profile from Supabase
    const { data: profile, error } = await supabaseAdmin
      .from('profiles')
      .select('id, email, role, is_active, display_name')
      .eq('email', session.user.email)
      .single();
    
    if (error || !profile) {
      console.error('[requireAdminAuth] Profile not found:', session.user.email, error);
      return null;
    }
    
    // Check if user is active
    if (!profile.is_active) {
      console.error('[requireAdminAuth] User is deactivated:', session.user.email);
      return null;
    }
    
    // Check if user has required role
    if (!allowedRoles.includes(profile.role)) {
      console.error('[requireAdminAuth] Insufficient permissions:', profile.role, 'required:', allowedRoles);
      return null;
    }
    
    // Update last login
    await supabaseAdmin
      .from('profiles')
      .update({ last_login_at: new Date().toISOString() })
      .eq('id', profile.id);
    
    return {
      ...session.user,
      id: profile.id,
      role: profile.role,
      display_name: profile.display_name,
      is_active: profile.is_active,
    };
    
  } catch (err) {
    console.error('[requireAdminAuth] Error:', err);
    return null;
  }
}

export async function requireRole(req, res, allowedRoles) {
  const user = await requireAuth(req, res);
  
  if (!user) {
    res.status(401).json({ error: 'Unauthorized - Please login' });
    return null;
  }
  
  if (!allowedRoles.includes(user.role)) {
    res.status(403).json({ error: 'Forbidden - Insufficient permissions' });
    return null;
  }
  
  return user;
}

export const ROLES = {
  ADMIN: 'ADMIN',
  STAFF: 'STAFF',
  SUPPORT: 'SUPPORT',
};

// New role constants (Supabase)
export const SUPABASE_ROLES = {
  USER: 'user',
  ADMIN: 'admin',
  OPS: 'ops',
  SUPPORT: 'support',
  DESIGNER: 'designer',
  FINANCE: 'finance',
};

// Permission checks
export const canAccessUsers = (role) => role === ROLES.ADMIN;
export const canAccessProducts = (role) => role === ROLES.ADMIN;
export const canAccessOrders = (role) => [ROLES.ADMIN, ROLES.STAFF, ROLES.SUPPORT].includes(role);
export const canEditOrders = (role) => [ROLES.ADMIN, ROLES.STAFF].includes(role);
export const canAccessTickets = (role) => [ROLES.ADMIN, ROLES.STAFF, ROLES.SUPPORT].includes(role);
export const canProcessRefunds = (role) => [ROLES.ADMIN, ROLES.STAFF].includes(role);

// Supabase permission checks
export const canManageCustomers = (role) => ['admin', 'ops', 'support'].includes(role);
export const canManageUsers = (role) => role === 'admin';
export const canManageTickets = (role) => ['admin', 'ops', 'support'].includes(role);
export const canManageProduction = (role) => ['admin', 'ops', 'designer'].includes(role);
export const canManagePricing = (role) => ['admin', 'finance'].includes(role);
