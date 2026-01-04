/**
 * Check if default_shipping and default_billing columns exist
 */
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

let envPath = path.join(__dirname, '..', '.env.local');
if (!fs.existsSync(envPath)) {
  envPath = path.join(__dirname, '..', '.env');
}
if (fs.existsSync(envPath)) {
  require('dotenv').config({ path: envPath });
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function checkSchema() {
  console.log('🔍 Checking customers table schema...\n');

  // Try to query with default_shipping to see if column exists
  const { data, error } = await supabase
    .from('customers')
    .select('id, email, default_shipping, default_billing')
    .limit(1);

  if (error) {
    if (error.code === 'PGRST204') {
      console.error('❌ COLUMNS DO NOT EXIST!');
      console.error('   Error:', error.message);
      console.error('\n📝 SOLUTION: Run migration 008 in Supabase SQL Editor:');
      console.error('   File: supabase/migrations/008_create_customers_extended.sql\n');
      
      console.log('🔧 Trying to add columns now...\n');
      
      // Try to add columns via SQL
      const addColumns = `
        ALTER TABLE public.customers 
        ADD COLUMN IF NOT EXISTS default_shipping JSONB,
        ADD COLUMN IF NOT EXISTS default_billing JSONB;
      `;
      
      console.log('SQL:', addColumns);
      console.log('\n⚠️ Cannot execute SQL via Supabase JS - must use SQL Editor or CLI\n');
      return;
    }
    
    console.error('❌ Other error:', error);
    return;
  }

  console.log('✅ COLUMNS EXIST!');
  console.log('   Schema cache might be stale.');
  console.log('\n📝 SOLUTION: Reload PostgREST schema cache:');
  console.log('   1. Go to Supabase Dashboard → SQL Editor');
  console.log('   2. Run: NOTIFY pgrst, \'reload schema\';');
  console.log('   3. Wait 30 seconds');
  console.log('   4. Try checkout again\n');
}

checkSchema().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
