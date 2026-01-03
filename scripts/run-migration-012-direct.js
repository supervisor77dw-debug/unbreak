/**
 * DIRECT MIGRATION EXECUTION
 * Executes SQL directly without RPC dependencies
 */

import pg from 'pg';
import dotenv from 'dotenv';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '..', '.env.local') });

// Use DIRECT_URL for migrations (bypasses PgBouncer which blocks DDL)
const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL;

if (!connectionString) {
  console.error('❌ Missing DIRECT_URL or DATABASE_URL in .env.local');
  console.error('');
  console.error('⚠️  Cannot connect to database');
  console.error('Or run migration manually via Dashboard → SQL Editor\n');
  
  // Print migration SQL for manual execution
  const migrationPath = join(__dirname, '..', 'supabase', 'migrations', '012_extend_orders_customer_fields.sql');
  const sql = readFileSync(migrationPath, 'utf-8');
  
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📋 MIGRATION SQL (copy to Supabase Dashboard):');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log(sql);
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  process.exit(1);
}

// Use DATABASE_URL directly (already includes pgbouncer)

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('🔧 DIRECT DATABASE MIGRATION');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

async function runMigration() {
  const { Client } = pg;
  const client = new Client({ connectionString });
  
  try {
    console.log('📡 Connecting to database...');
    await client.connect();
    console.log('✅ Connected\n');
    
    // Read migration
    const migrationPath = join(__dirname, '..', 'supabase', 'migrations', '012_extend_orders_customer_fields.sql');
    console.log('📄 Reading migration file...');
    const sql = readFileSync(migrationPath, 'utf-8');
    console.log(`✅ Loaded (${sql.length} bytes)\n`);
    
    console.log('🚀 Executing migration...\n');
    await client.query(sql);
    console.log('✅ Migration executed\n');
    
    // Verify
    console.log('🔍 Verifying columns...\n');
    const result = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'orders' 
      AND table_schema = 'public'
      AND column_name IN (
        'customer_email',
        'customer_name',
        'customer_phone',
        'stripe_customer_id',
        'billing_address'
      )
      ORDER BY column_name;
    `);
    
    const foundColumns = result.rows.map(r => r.column_name);
    const requiredColumns = [
      'billing_address',
      'customer_email',
      'customer_name',
      'customer_phone',
      'stripe_customer_id'
    ];
    
    console.log('Column verification:');
    let allPresent = true;
    requiredColumns.forEach(col => {
      const exists = foundColumns.includes(col);
      console.log(`   ${exists ? '✅' : '❌'} ${col}`);
      if (!exists) allPresent = false;
    });
    console.log('');
    
    if (allPresent) {
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('✅ MIGRATION 012 SUCCESSFUL');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('');
      console.log('Next steps:');
      console.log('1. ✅ Database schema updated');
      console.log('2. 🔄 Run backfill: node scripts/run-backfill.js');
      console.log('3. 🧪 Create test order to verify webhook');
      console.log('');
    } else {
      console.log('⚠️  Some columns missing - migration may need manual review\n');
    }
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error('');
    console.error('⚠️  MANUAL ACTION REQUIRED:');
    console.error('Please run the SQL in Supabase Dashboard → SQL Editor\n');
    console.error('See: MIGRATION-012-MANUAL.md for instructions\n');
    throw error;
  } finally {
    await client.end();
  }
}

runMigration()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));
