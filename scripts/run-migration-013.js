/**
 * Execute migration 013
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function runMigration() {
  console.log('🚀 Running migration 013...\n');

  // Read migration file
  const migrationPath = path.join(__dirname, '..', 'supabase', 'migrations', '013_add_config_to_simple_orders.sql');
  const sql = fs.readFileSync(migrationPath, 'utf8');

  console.log('📄 Migration SQL:');
  console.log(sql.substring(0, 500) + '...\n');

  try {
    // Execute migration via Supabase client
    // Note: This may require direct postgres access
    console.log('⚠️  IMPORTANT: This script shows the migration SQL.');
    console.log('⚠️  Please execute it in Supabase SQL Editor or via psql:\n');
    console.log('   1. Go to Supabase Dashboard > SQL Editor');
    console.log('   2. Paste the migration SQL');
    console.log('   3. Click "Run"\n');
    console.log('   OR use: psql <connection-string> < supabase/migrations/013_add_config_to_simple_orders.sql\n');

    // Verify columns after manual execution
    console.log('📊 After executing, verify with:');
    console.log(`
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'simple_orders' 
AND table_schema = 'public'
ORDER BY ordinal_position;
    `);

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

runMigration()
  .then(() => {
    console.log('\n✅ Migration prepared');
    console.log('⚠️  Manual execution required in Supabase Dashboard\n');
  })
  .catch(err => {
    console.error('❌ Fatal error:', err);
    process.exit(1);
  });
