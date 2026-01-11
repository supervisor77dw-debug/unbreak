// CHECK-MISSING-COLUMNS.js
// Run the SQL diagnostic to find missing columns in admin_orders

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing environment variables:');
  console.error('   SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL)');
  console.error('   SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkMissingColumns() {
  console.log('\n🔍 CHECKING admin_orders SCHEMA...\n');

  // Try to fetch one row to see available columns
  console.log('📋 Fetching sample row to detect columns...');
  console.log('─'.repeat(80));
  
  const { data: sampleRows, error: fetchError } = await supabase
    .from('admin_orders')
    .select('*')
    .limit(1);

  if (fetchError) {
    console.error('❌ Error fetching admin_orders:', fetchError.message);
    console.log('\n💡 Please run CHECK-MISSING-COLUMNS.sql in Supabase SQL Editor\n');
    return;
  }

  if (!sampleRows || sampleRows.length === 0) {
    console.log('⚠️  No orders in admin_orders table yet');
    console.log('💡 Cannot detect columns from empty table');
    console.log('\n📝 Please run CHECK-MISSING-COLUMNS.sql in Supabase SQL Editor\n');
    return;
  }

  const existingColumns = Object.keys(sampleRows[0]);
  console.log(`✅ Found ${existingColumns.length} columns:\n`);
  
  existingColumns.sort().forEach((col, idx) => {
    console.log(`  ${(idx + 1).toString().padStart(2)}. ${col}`);
  });

  // Check specific columns
  console.log('\n\n🎯 CRITICAL COLUMNS CHECK:');
  console.log('─'.repeat(80));

  const requiredColumns = [
    'shipping_region',
    'subtotal_net',
    'tax_rate',
    'tax_amount',
    'total_gross',
    'config_json'
  ];

  requiredColumns.forEach(colName => {
    const exists = existingColumns.includes(colName);
    const status = exists ? '✅' : '❌ MISSING';
    console.log(`  ${status} ${colName}`);
  });

  console.log('\n' + '─'.repeat(80));

  // Summary
  const missingCount = requiredColumns.filter(c => !existingColumns.includes(c)).length;
  if (missingCount === 0) {
    console.log('✅ All required columns exist!\n');
  } else {
    console.log(`⚠️  ${missingCount} column(s) missing from admin_orders`);
    console.log('💡 You may need to run a migration to add them\n');
  }
}

checkMissingColumns().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
