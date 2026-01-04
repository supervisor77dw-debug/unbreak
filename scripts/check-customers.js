/**
 * Quick check: Do we have customers in the database?
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials');
  console.log('Required: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (sb_secret_...)');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkCustomers() {
  console.log('🔍 Checking customers table...\n');

  // Count total customers
  const { count, error: countError } = await supabase
    .from('customers')
    .select('*', { count: 'exact', head: true });

  if (countError) {
    console.error('❌ Error counting customers:', countError.message);
    process.exit(1);
  }

  console.log(`📊 Total customers in DB: ${count}`);

  if (count === 0) {
    console.log('\n⚠️  No customers found!');
    console.log('\n🔧 Possible reasons:');
    console.log('   1. No orders placed yet');
    console.log('   2. Webhook not processing checkout.session.completed');
    console.log('   3. Customer sync failing in webhook');
    console.log('\n💡 Solutions:');
    console.log('   - Place a test order: https://unbreak-one.vercel.app/configurator');
    console.log('   - Run backfill: node scripts/backfill-customers.js');
    console.log('   - Check webhook logs in Stripe Dashboard');
    return;
  }

  // Get sample customers
  const { data: customers, error } = await supabase
    .from('customers')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(5);

  if (error) {
    console.error('❌ Error fetching customers:', error.message);
    process.exit(1);
  }

  console.log(`\n✅ Sample customers (latest 5):\n`);
  customers.forEach((c, i) => {
    console.log(`${i + 1}. ${c.email}`);
    console.log(`   ID: ${c.id}`);
    console.log(`   Name: ${c.name || 'N/A'}`);
    console.log(`   Stripe ID: ${c.stripe_customer_id || 'N/A'}`);
    console.log(`   Total Orders: ${c.total_orders || 0}`);
    console.log(`   Total Spent: €${((c.total_spent_cents || 0) / 100).toFixed(2)}`);
    console.log(`   Created: ${new Date(c.created_at).toLocaleString()}`);
    console.log('');
  });

  // Check if any orders exist
  const { count: ordersCount } = await supabase
    .from('simple_orders')
    .select('*', { count: 'exact', head: true });

  console.log(`📦 Total orders: ${ordersCount}`);

  if (ordersCount > 0 && count === 0) {
    console.log('\n⚠️  WARNING: Orders exist but no customers!');
    console.log('   This means customer sync is broken.');
    console.log('   Run: node scripts/backfill-customers.js');
  }

  // Check recent orders without customer_id
  const { data: orphanOrders, count: orphanCount } = await supabase
    .from('simple_orders')
    .select('*', { count: 'exact' })
    .is('customer_id', null)
    .limit(5);

  if (orphanCount > 0) {
    console.log(`\n⚠️  ${orphanCount} orders without customer_id:`);
    orphanOrders.forEach((o, i) => {
      console.log(`   ${i + 1}. Order ${o.id.substring(0, 8)}... - ${o.customer_email || 'no email'} - ${o.status}`);
    });
    console.log('\n   Run backfill to fix: node scripts/backfill-customers.js');
  }
}

checkCustomers()
  .then(() => {
    console.log('\n✅ Check complete');
    process.exit(0);
  })
  .catch(err => {
    console.error('❌ Fatal error:', err);
    process.exit(1);
  });
