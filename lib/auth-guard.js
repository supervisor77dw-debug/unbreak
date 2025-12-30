/**
 * Auth Guard - Reusable authentication and role checking
 */

import { getSupabasePublic } from './supabase';

/**
 * Check authentication and get user with role
 * @returns {Promise<{user: object, profile: object, isAdmin: boolean}>}
 */
export async function checkAuth() {
  const supabase = getSupabasePublic();
  
  if (!supabase) {
    throw new Error('Supabase client not initialized');
  }
  
  const { data: { session }, error: sessionError } = await supabase.auth.getSession();
  
  if (sessionError || !session) {
    throw new Error('Not authenticated');
  }
  
  // Get user profile with role
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', session.user.id)
    .single();
  
  if (profileError) {
    // Profile doesn't exist yet - treat as regular user
    return {
      user: session.user,
      profile: { role: 'user' },
      isAdmin: false,
      isStaff: false
    };
  }
  
  return {
    user: session.user,
    profile,
    isAdmin: profile.role === 'admin',
    isStaff: profile.role === 'staff' || profile.role === 'admin'
  };
}

/**
 * Redirect to login if not authenticated
 */
export function redirectToLogin(redirectPath) {
  if (typeof window !== 'undefined') {
    const params = redirectPath ? `?redirect=${encodeURIComponent(redirectPath)}` : '';
    window.location.href = `/login.html${params}`;
  }
}

/**
 * Check if user has admin role
 */
export async function requireAdmin() {
  const auth = await checkAuth();
  if (!auth.isAdmin) {
    throw new Error('Admin access required');
  }
  return auth;
}

/**
 * Check if user has staff or admin role
 */
export async function requireStaff() {
  const auth = await checkAuth();
  if (!auth.isStaff && !auth.isAdmin) {
    throw new Error('Staff access required');
  }
  return auth;
}
