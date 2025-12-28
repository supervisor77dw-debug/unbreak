/**
 * Admin Middleware
 * Checks if user has admin role
 */

import { getSupabaseAdmin } from './supabase';

export async function isAdmin(userId: string): Promise<boolean> {
  try {
    const supabase = getSupabaseAdmin();
    
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', userId)
      .single();

    if (error || !profile) {
      return false;
    }

    return profile.role === 'admin';
  } catch (err) {
    console.error('isAdmin check failed:', err);
    return false;
  }
}

export async function requireAdmin(userId: string | undefined): Promise<{ isAdmin: boolean; error?: string }> {
  if (!userId) {
    return { isAdmin: false, error: 'Not authenticated' };
  }

  const admin = await isAdmin(userId);

  if (!admin) {
    return { isAdmin: false, error: 'Insufficient permissions' };
  }

  return { isAdmin: true };
}
