/**
 * UNBREAK ONE - Client-Side Auth Utilities
 * ==========================================
 * Purpose: Supabase authentication helpers for browser/client-side
 * Security: Uses ANON_KEY (safe for client-side)
 * Dependencies: @supabase/supabase-js
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables (NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY)');
}

// Create Supabase client (client-side, uses anon key)
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

/**
 * Sign in with email and password
 * @param {string} email - User email
 * @param {string} password - User password
 * @returns {Promise<{user, session, error}>}
 */
export async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    console.error('Sign in error:', error.message);
    return { user: null, session: null, error };
  }

  return { user: data.user, session: data.session, error: null };
}

/**
 * Sign up new user with email and password
 * @param {string} email - User email
 * @param {string} password - User password
 * @param {object} metadata - Optional user metadata
 * @returns {Promise<{user, session, error}>}
 */
export async function signUp(email, password, metadata = {}) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: metadata,
    },
  });

  if (error) {
    console.error('Sign up error:', error.message);
    return { user: null, session: null, error };
  }

  return { user: data.user, session: data.session, error: null };
}

/**
 * Sign out current user
 * @returns {Promise<{error}>}
 */
export async function signOut() {
  const { error } = await supabase.auth.signOut();

  if (error) {
    console.error('Sign out error:', error.message);
    return { error };
  }

  return { error: null };
}

/**
 * Get current user session
 * @returns {Promise<{session, error}>}
 */
export async function getSession() {
  const { data, error } = await supabase.auth.getSession();

  if (error) {
    console.error('Get session error:', error.message);
    return { session: null, error };
  }

  return { session: data.session, error: null };
}

/**
 * Get current user
 * @returns {Promise<{user, error}>}
 */
export async function getCurrentUser() {
  const { data, error } = await supabase.auth.getUser();

  if (error) {
    console.error('Get user error:', error.message);
    return { user: null, error };
  }

  return { user: data.user, error: null };
}

/**
 * Get current user profile (with role)
 * @returns {Promise<{profile, error}>}
 */
export async function getUserProfile() {
  const { user, error: userError } = await getCurrentUser();

  if (userError || !user) {
    return { profile: null, error: userError };
  }

  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  if (error) {
    console.error('Get profile error:', error.message);
    return { profile: null, error };
  }

  return { profile: data, error: null };
}

/**
 * Check if user has required role
 * @param {string[]} allowedRoles - Array of allowed roles
 * @returns {Promise<{hasAccess, role, error}>}
 */
export async function checkRole(allowedRoles) {
  const { profile, error } = await getUserProfile();

  if (error || !profile) {
    return { hasAccess: false, role: null, error: error || new Error('No profile found') };
  }

  const hasAccess = allowedRoles.includes(profile.role);

  return { hasAccess, role: profile.role, error: null };
}

/**
 * Redirect to login if not authenticated
 * @param {string} redirectTo - URL to redirect to after login (optional)
 */
export async function requireAuth(redirectTo) {
  const { session } = await getSession();

  if (!session) {
    const params = redirectTo ? `?redirect=${encodeURIComponent(redirectTo)}` : '';
    window.location.href = `/login.html${params}`;
    return false;
  }

  return true;
}

/**
 * Redirect to appropriate portal based on role
 * @param {string[]} allowedRoles - Array of allowed roles for current page
 * @param {string} currentPage - Current page name (for redirect loop prevention)
 */
export async function requireRole(allowedRoles, currentPage) {
  const { hasAccess, role, error } = await checkRole(allowedRoles);

  if (error || !hasAccess) {
    // Redirect to appropriate portal based on role
    if (role === 'admin' && currentPage !== 'admin') {
      window.location.href = '/admin.html';
    } else if (role === 'staff' && currentPage !== 'ops') {
      window.location.href = '/ops.html';
    } else if (role === 'customer' && currentPage !== 'account') {
      window.location.href = '/account.html';
    } else if (!role) {
      window.location.href = '/login.html';
    }
    return false;
  }

  return true;
}

/**
 * Listen to auth state changes
 * @param {function} callback - Callback function (event, session)
 * @returns {object} Subscription object with unsubscribe method
 */
export function onAuthStateChange(callback) {
  const { data: subscription } = supabase.auth.onAuthStateChange(callback);
  return subscription;
}

/**
 * Update user profile
 * @param {object} updates - Profile fields to update
 * @returns {Promise<{profile, error}>}
 */
export async function updateProfile(updates) {
  const { user, error: userError } = await getCurrentUser();

  if (userError || !user) {
    return { profile: null, error: userError };
  }

  // Remove role from updates (can't change own role)
  const { role, ...safeUpdates } = updates;

  const { data, error } = await supabase
    .from('profiles')
    .update(safeUpdates)
    .eq('id', user.id)
    .select()
    .single();

  if (error) {
    console.error('Update profile error:', error.message);
    return { profile: null, error };
  }

  return { profile: data, error: null };
}

/**
 * Send password reset email
 * @param {string} email - User email
 * @returns {Promise<{error}>}
 */
export async function resetPassword(email) {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/reset-password.html`,
  });

  if (error) {
    console.error('Password reset error:', error.message);
    return { error };
  }

  return { error: null };
}

/**
 * Update user password
 * @param {string} newPassword - New password
 * @returns {Promise<{error}>}
 */
export async function updatePassword(newPassword) {
  const { error } = await supabase.auth.updateUser({
    password: newPassword,
  });

  if (error) {
    console.error('Update password error:', error.message);
    return { error };
  }

  return { error: null };
}
