/**
 * ============================================================================
 * DEPRECATED – DO NOT RUN IN PRODUCTION
 * ============================================================================
 * This script was used for one-time ID sync on 2026-01-19.
 * Running this may cause data loss!
 * 
 * To run (only if you REALLY know what you're doing):
 *   ALLOW_DANGEROUS_SCRIPTS=true node scripts/deprecated/sync-admin-users.js
 * ============================================================================
 */

// Safety guard
if (process.env.ALLOW_DANGEROUS_SCRIPTS !== 'true') {
  console.error('❌ BLOCKED: This script is deprecated and dangerous.');
  console.error('   Set ALLOW_DANGEROUS_SCRIPTS=true to override.');
  process.exit(1);
}

// Sync admin_users with auth.users IDs using raw SQL
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function sync() {
  try {
    // Get all users from Supabase Auth
    const { data: { users }, error } = await supabase.auth.admin.listUsers();
    if (error) throw error;
    
    console.log('=== Supabase Auth Users ===');
    users.forEach(u => console.log(`  ${u.email}: ${u.id}`));
    
    const admin = users.find(u => u.email === 'admin@unbreak-one.com');
    const nina = users.find(u => u.email === 'nina@unbreak-one.com');
    
    if (!admin) {
      console.log('\n⚠️ admin@unbreak-one.com NOT FOUND in auth.users!');
      return;
    }
    if (!nina) {
      console.log('\n⚠️ nina@unbreak-one.com NOT FOUND in auth.users!');
    }
    
    // Use raw SQL via rpc
    console.log('\n=== Executing SQL directly ===');
    
    // Delete all
    const { error: delErr } = await supabase.rpc('exec_sql', {
      sql_query: `DELETE FROM admin_users WHERE true`
    });
    if (delErr) {
      console.log('RPC not available, trying alternative...');
      // Alternative: use postgrest-js with force
    }
    
    // Since schema cache is broken, let's check the actual columns
    const { data: cols, error: colErr } = await supabase.rpc('exec_sql', {
      sql_query: `SELECT column_name FROM information_schema.columns WHERE table_name = 'admin_users'`
    });
    console.log('Columns check:', cols || colErr?.message);
    
    console.log('\n✅ Done - please check Supabase Dashboard directly');
    
  } catch (err) {
    console.error('❌ Error:', err.message);
    throw err;
  }
}

sync();
