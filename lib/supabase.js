/**
 * Supabase Client Configuration
 * Server-side only (uses service_role key for write operations)
 */

import { createClient } from '@supabase/supabase-js';

// Environment variables (set in .env.local)
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error(
    'Missing Supabase environment variables. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local'
  );
}

/**
 * Server-side Supabase client with service_role privileges
 * WARNING: NEVER expose this client to frontend - bypasses RLS
 */
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

/**
 * Public Supabase client (anon key) - for read-only operations
 * Safe to use in frontend for product catalog reads
 */
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const supabasePublic = supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;
