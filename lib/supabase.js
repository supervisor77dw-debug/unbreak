/**
 * Supabase Client Configuration - BUILD SAFE
 * Lazy initialization to avoid crashes during build time
 */

import { createClient } from '@supabase/supabase-js';

// Cached clients
let adminClient = null;
let publicClient = null;

/**
 * Get Server-side Supabase client with service_role privileges
 * WARNING: NEVER expose this client to frontend - bypasses RLS
 * @returns {import('@supabase/supabase-js').SupabaseClient}
 */
export function getSupabaseAdmin() {
  if (adminClient) return adminClient;

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    console.warn('⚠️ Missing Supabase admin credentials');
    return null;
  }

  adminClient = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  return adminClient;
}

/**
 * Get Public Supabase client (anon key) - for read-only operations
 * Safe to use in frontend for product catalog reads
 * @returns {import('@supabase/supabase-js').SupabaseClient | null}
 */
export function getSupabasePublic() {
  if (publicClient) return publicClient;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    console.warn('⚠️ Missing Supabase public credentials');
    return null;
  }

  publicClient = createClient(supabaseUrl, supabaseAnonKey);
  return publicClient;
}

// Legacy exports for backward compatibility
export const supabaseAdmin = getSupabaseAdmin();
export const supabasePublic = getSupabasePublic();
