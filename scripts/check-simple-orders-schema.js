/**
 * Check simple_orders table schema
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials');
  console.log('NEXT_PUBLIC_SUPABASE_URL:', supabaseUrl ? '✅ Set' : '❌ Missing');
  console.log('SUPABASE_SERVICE_ROLE_KEY:', supabaseKey ? '✅ Set' : '❌ Missing');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkSchema() {
  console.log('🔍 Checking simple_orders table schema...\n');

  // 1. Try to select one row to see columns
  const { data, error } = await supabase
    .from('simple_orders')
    .select('*')
    .limit(1);

  if (error) {
    console.error('❌ Error querying simple_orders:', error);
    return;
  }

  if (data && data.length > 0) {
    console.log('✅ simple_orders columns:', Object.keys(data[0]));
    console.log('\n📊 Sample row:');
    console.log(JSON.stringify(data[0], null, 2));
  } else {
    console.log('⚠️ simple_orders table is empty');
    
    // Try to describe table structure via information_schema
    const { data: columns, error: colError } = await supabase.rpc('exec_sql', {
      query: `
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_name = 'simple_orders'
        AND table_schema = 'public'
        ORDER BY ordinal_position;
      `
    });

    if (!colError && columns) {
      console.log('📋 Table structure:', columns);
    }
  }

  // 2. Check if config-related columns exist
  console.log('\n🔍 Checking for config-related columns...');
  
  const configColumns = ['config_json', 'preview_image_url', 'items', 'metadata'];
  for (const col of configColumns) {
    const { error } = await supabase
      .from('simple_orders')
      .select(col)
      .limit(1);
    
    if (error) {
      console.log(`❌ ${col}: NOT FOUND (${error.message})`);
    } else {
      console.log(`✅ ${col}: EXISTS`);
    }
  }

  // 3. Check for customer-related columns
  console.log('\n🔍 Checking for customer-related columns...');
  
  const customerColumns = ['customer_id', 'customer_email', 'customer_name', 'customer_phone', 'stripe_customer_id'];
  for (const col of customerColumns) {
    const { error } = await supabase
      .from('simple_orders')
      .select(col)
      .limit(1);
    
    if (error) {
      console.log(`❌ ${col}: NOT FOUND (${error.message})`);
    } else {
      console.log(`✅ ${col}: EXISTS`);
    }
  }
}

checkSchema()
  .then(() => {
    console.log('\n✅ Schema check complete');
    process.exit(0);
  })
  .catch(err => {
    console.error('❌ Fatal error:', err);
    process.exit(1);
  });
