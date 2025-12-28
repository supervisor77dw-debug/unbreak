/**
 * Supabase Bootstrap Utility
 * Runs migrations and seeds admin user
 */

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
}

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

/**
 * Run all migrations in order
 */
export async function runMigrations() {
  const migrationsDir = path.join(process.cwd(), 'supabase', 'migrations');
  
  if (!fs.existsSync(migrationsDir)) {
    console.warn('⚠️  No migrations directory found');
    return { success: false, error: 'Migrations directory not found' };
  }

  const files = fs.readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql'))
    .sort();

  console.log(`📦 Found ${files.length} migration files`);

  const results = [];

  for (const file of files) {
    const filePath = path.join(migrationsDir, file);
    const sql = fs.readFileSync(filePath, 'utf-8');

    console.log(`   Running: ${file}...`);

    try {
      const { error } = await supabaseAdmin.rpc('exec_sql', { sql_string: sql }).single();
      
      if (error) {
        // Try direct execution as fallback
        const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': supabaseServiceKey,
            'Authorization': `Bearer ${supabaseServiceKey}`,
          },
          body: JSON.stringify({ sql_string: sql }),
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${await response.text()}`);
        }
      }

      results.push({ file, success: true });
      console.log(`   ✅ ${file}`);
    } catch (err: any) {
      console.error(`   ❌ ${file}: ${err.message}`);
      results.push({ file, success: false, error: err.message });
    }
  }

  const allSuccess = results.every(r => r.success);
  return { success: allSuccess, results };
}

/**
 * Check if required tables exist
 */
export async function checkTablesExist() {
  const requiredTables = ['profiles', 'products'];
  const results: Record<string, boolean> = {};

  for (const table of requiredTables) {
    const { data, error } = await supabaseAdmin
      .from(table)
      .select('*')
      .limit(1);

    results[table] = !error;
  }

  return results;
}

/**
 * Seed admin user from SEED_ADMIN_EMAIL env
 */
export async function seedAdminUser() {
  const adminEmail = process.env.SEED_ADMIN_EMAIL;

  if (!adminEmail) {
    return { success: false, message: 'No SEED_ADMIN_EMAIL configured' };
  }

  console.log(`🔑 Seeding admin user: ${adminEmail}`);

  try {
    // Call the promote function
    const { data, error } = await supabaseAdmin
      .rpc('promote_user_to_admin', { user_email: adminEmail });

    if (error) throw error;

    if (data) {
      console.log(`   ✅ User promoted to admin`);
      return { success: true, message: 'Admin user promoted' };
    } else {
      console.log(`   ℹ️  User already admin or not found`);
      return { success: true, message: 'User already admin or not found' };
    }
  } catch (err: any) {
    console.error(`   ❌ Error: ${err.message}`);
    return { success: false, error: err.message };
  }
}

/**
 * Check if admin user exists
 */
export async function hasAdminUser() {
  try {
    const { data, error } = await supabaseAdmin.rpc('has_admin_user');
    if (error) throw error;
    return !!data;
  } catch (err) {
    return false;
  }
}

/**
 * Bootstrap entire database
 */
export async function bootstrapDatabase() {
  console.log('🚀 Starting database bootstrap...\n');

  // 1. Check existing tables
  console.log('1️⃣  Checking existing tables...');
  const tableStatus = await checkTablesExist();
  console.log('   Tables:', tableStatus);

  // 2. Run migrations
  console.log('\n2️⃣  Running migrations...');
  const migrationResult = await runMigrations();

  // 3. Seed admin
  console.log('\n3️⃣  Seeding admin user...');
  const seedResult = await seedAdminUser();

  // 4. Final check
  console.log('\n4️⃣  Final verification...');
  const hasAdmin = await hasAdminUser();
  console.log(`   Admin exists: ${hasAdmin ? '✅' : '❌'}`);

  console.log('\n✨ Bootstrap complete!\n');

  return {
    success: migrationResult.success && (seedResult.success || !process.env.SEED_ADMIN_EMAIL),
    migrations: migrationResult,
    admin: seedResult,
    hasAdmin,
  };
}
