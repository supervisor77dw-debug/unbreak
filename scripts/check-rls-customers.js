/**
 * Check RLS policies on customers table
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

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ Missing credentials!');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function checkCustomers() {
  console.log('🔍 Checking customers table with SERVICE ROLE KEY...\n');

  try {
    // Count all customers
    const { count, error: countError } = await supabase
      .from('customers')
      .select('*', { count: 'exact', head: true });

    if (countError) {
      console.error('❌ Error counting customers:', countError);
      return;
    }

    console.log(`📊 Total customers: ${count}\n`);

  // Get all customers
  const { data: customers, error } = await supabase
    .from('customers')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(10);

  if (error) {
    console.error('❌ Error fetching customers:', error);
    return;
  }

  if (customers.length === 0) {
    console.log('❌ NO CUSTOMERS FOUND\n');
    console.log('Checking RLS policies...');
    
    // Try to query RLS policies
    const { data: policies, error: rlsError } = await supabase
      .rpc('exec', { 
        query: `SELECT * FROM pg_policies WHERE tablename = 'customers'` 
      });
    
    if (rlsError) {
      console.log('Cannot check RLS policies via RPC');
    }
    
    return;
  }

  console.log('✅ CUSTOMERS FOUND:\n');
  customers.forEach((cust, i) => {
    console.log(`${i + 1}. ${cust.email}`);
    console.log(`   ID: ${cust.id}`);
    console.log(`   Stripe: ${cust.stripe_customer_id || 'NULL'}`);
    console.log(`   Created: ${cust.created_at}`);
    console.log('');
  });

  // Check for our specific customer
  const targetEmail = 'dirk@ricks-kiel.de';
  const { data: targetCustomer } = await supabase
    .from('customers')
    .select('*')
    .eq('email', targetEmail)
    .maybeSingle();

  if (targetCustomer) {
    console.log(`✅ Found customer for ${targetEmail}:`);
    console.log('   ID:', targetCustomer.id);
    console.log('   Stripe Customer ID:', targetCustomer.stripe_customer_id);
  } else {
    console.log(`❌ Customer ${targetEmail} not found even with SERVICE ROLE!`);
    console.log('   This means webhook did NOT create the customer.');
  }
  } catch (err) {
    console.error('❌ Unexpected error:', err);
  }
}

checkCustomers().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
