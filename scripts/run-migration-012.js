/**
 * RUN MIGRATION 012: Add Customer Fields to Orders
 * 
 * This script applies migration 012 directly to the production database.
 * It's safe to run multiple times (idempotent).
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env.local
dotenv.config({ path: join(__dirname, '..', '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('🔧 RUNNING MIGRATION 012');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

async function runMigration() {
  
  // Read migration file
  const migrationPath = join(__dirname, '..', 'supabase', 'migrations', '012_extend_orders_customer_fields.sql');
  
  console.log('📄 Reading migration file...');
  const sql = readFileSync(migrationPath, 'utf-8');
  console.log(`✅ Loaded ${sql.length} bytes\n`);
  
  console.log('🚀 Executing migration...\n');
  
  // Execute via Supabase SQL
  const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql });
  
  if (error) {
    console.error('❌ Migration failed:', error);
    
    // Try alternative: direct execution via REST API
    console.log('\n⚠️  Trying alternative method...\n');
    
    const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': supabaseServiceKey,
        'Authorization': `Bearer ${supabaseServiceKey}`
      },
      body: JSON.stringify({ sql_query: sql })
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Alternative method also failed:', errorText);
      console.log('\n⚠️  MANUAL ACTION REQUIRED:');
      console.log('Please run this SQL in Supabase Dashboard → SQL Editor:\n');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log(sql);
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
      process.exit(1);
    }
    
    console.log('✅ Migration executed via REST API\n');
  } else {
    console.log('✅ Migration executed successfully\n');
  }
  
  // Verify columns exist
  console.log('🔍 Verifying columns...\n');
  
  const { data: testOrder, error: verifyError } = await supabase
    .from('orders')
    .select('id, customer_email, customer_name, stripe_customer_id, billing_address')
    .limit(1)
    .maybeSingle();
  
  if (verifyError) {
    console.error('❌ Verification failed:', verifyError.message);
    console.log('\n⚠️  Migration may not have applied correctly.\n');
    process.exit(1);
  }
  
  // Check which fields exist in response
  const requiredFields = [
    'customer_email',
    'customer_name',
    'customer_phone',
    'stripe_customer_id',
    'billing_address'
  ];
  
  console.log('Column verification:');
  let allPresent = true;
  
  if (testOrder) {
    requiredFields.forEach(field => {
      const exists = field in testOrder || testOrder === null; // null means no rows, which is ok
      console.log(`   ${exists ? '✅' : '❌'} ${field}`);
      if (!exists) allPresent = false;
    });
  } else {
    console.log('   ℹ️  No orders in table yet (empty table is OK)');
    
    // Alternative verification: try to insert and rollback
    console.log('\n🔍 Testing insertability...');
    
    const testData = {
      order_number: 'TEST-VERIFY',
      total_price: 0,
      customer_email: 'test@verify.com',
      customer_name: 'Test User',
      stripe_customer_id: 'cus_test',
      billing_address: { test: true }
    };
    
    const { error: insertError } = await supabase
      .from('orders')
      .insert(testData)
      .select()
      .single();
    
    if (insertError) {
      console.error('❌ Insert test failed:', insertError.message);
      allPresent = false;
    } else {
      console.log('✅ All fields insertable');
      
      // Clean up test row
      await supabase
        .from('orders')
        .delete()
        .eq('order_number', 'TEST-VERIFY');
      
      console.log('✅ Test row cleaned up');
    }
  }
  
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
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('⚠️  MIGRATION INCOMPLETE');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('');
    console.log('Please run the SQL manually in Supabase Dashboard.');
    console.log('');
  }
}

runMigration()
  .then(() => {
    process.exit(0);
  })
  .catch((err) => {
    console.error('❌ Migration script failed:', err);
    process.exit(1);
  });
