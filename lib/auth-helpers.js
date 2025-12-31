import { getServerSession } from 'next-auth/next';
import { authOptions } from '../pages/api/auth/[...nextauth]';
import prisma from './prisma';

export async function requireAuth(req, res) {
  const session = await getServerSession(req, res, authOptions);
  
  if (!session || !session.user) {
    return null;
  }
  
  // Get user role from database
  try {
    const adminUser = await prisma.adminUser.findUnique({
      where: { email: session.user.email },
    });
    
    if (adminUser) {
      return {
        ...session.user,
        role: adminUser.role,
      };
    }
  } catch (err) {
    console.error('Failed to get user role:', err);
  }
  
  return session.user;
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

// Permission checks
export const canAccessUsers = (role) => role === ROLES.ADMIN;
export const canAccessProducts = (role) => role === ROLES.ADMIN;
export const canAccessOrders = (role) => [ROLES.ADMIN, ROLES.STAFF, ROLES.SUPPORT].includes(role);
export const canEditOrders = (role) => [ROLES.ADMIN, ROLES.STAFF].includes(role);
export const canAccessTickets = (role) => [ROLES.ADMIN, ROLES.STAFF, ROLES.SUPPORT].includes(role);
export const canProcessRefunds = (role) => [ROLES.ADMIN, ROLES.STAFF].includes(role);
