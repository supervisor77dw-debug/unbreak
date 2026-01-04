/**
 * Test customer upsert to find why it fails
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

async function testUpsert() {
  console.log('🧪 Testing customer upsert...\n');

  const testData = {
    stripe_customer_id: 'cus_TjLUJI4xJMBfn6', // From webhook log
    email: 'dirk@ricks-kiel.de',
    name: 'Test Customer',
    phone: null,
    shipping_address: null,
    billing_address: null,
    metadata: {
      stripe_customer_id: 'cus_TjLUJI4xJMBfn6',
      last_session_id: 'cs_test_a1cgJTqNpbXOz37OVsnpXxhNWaZwr0M2zT23kAdkpZWINq7e1zJ5waeGCf',
      synced_at: new Date().toISOString(),
    },
    updated_at: new Date().toISOString(),
  };

  console.log('📝 Upserting customer:', testData.email);
  console.log('   Stripe ID:', testData.stripe_customer_id);
  console.log('');

  const { data: customer, error: upsertError } = await supabase
    .from('customers')
    .upsert(testData, {
      onConflict: 'stripe_customer_id',
      ignoreDuplicates: false,
    })
    .select()
    .single();

  if (upsertError) {
    console.error('❌ UPSERT FAILED!');
    console.error('   Error:', upsertError.message);
    console.error('   Code:', upsertError.code);
    console.error('   Details:', upsertError.details);
    console.error('   Hint:', upsertError.hint);
    console.error('');
    console.error('Full error object:', JSON.stringify(upsertError, null, 2));
    return;
  }

  console.log('✅ UPSERT SUCCESS!');
  console.log('   Customer ID:', customer.id);
  console.log('   Email:', customer.email);
  console.log('   Stripe ID:', customer.stripe_customer_id);
  console.log('');

  // Now try to link to order
  console.log('🔗 Linking to order f85d5dca-e43e-4c17-9239-bffbf473edfd...');
  
  const { error: linkError } = await supabase
    .from('simple_orders')
    .update({
      customer_id: customer.id,
      stripe_customer_id: testData.stripe_customer_id,
      customer_email: testData.email,
      updated_at: new Date().toISOString(),
    })
    .eq('id', 'f85d5dca-e43e-4c17-9239-bffbf473edfd');

  if (linkError) {
    console.error('❌ LINK FAILED:', linkError.message);
  } else {
    console.log('✅ Order linked successfully!');
  }
}

testUpsert().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
