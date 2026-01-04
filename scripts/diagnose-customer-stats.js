/**
 * DIAGNOSE: Customer Stats - Why are they all zeros?
 * Checks:
 * 1. How customers table links to orders (customer_id, stripe_customer_id, email)
 * 2. What fields are actually populated in orders
 * 3. Sample stats calculation with different join methods
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function diagnoseCustomerStats() {
  console.log('\n🔍 CUSTOMER STATS DIAGNOSIS\n');
  console.log('='.repeat(80));

  // 1. Get a sample customer with orders
  console.log('\n1️⃣ Finding customers with Stripe customer IDs...\n');
  
  const { data: customers, error: custError } = await supabase
    .from('customers')
    .select('id, email, stripe_customer_id, total_orders, total_spent_cents, last_order_at')
    .not('stripe_customer_id', 'is', null)
    .limit(3);

  if (custError) {
    console.error('❌ Error fetching customers:', custError);
    return;
  }

  console.log(`Found ${customers.length} customers with Stripe IDs:\n`);
  customers.forEach((c, i) => {
    console.log(`${i + 1}. ${c.email}`);
    console.log(`   ID: ${c.id}`);
    console.log(`   Stripe ID: ${c.stripe_customer_id}`);
    console.log(`   Stats: ${c.total_orders} orders, €${(c.total_spent_cents || 0) / 100}, last: ${c.last_order_at || 'NULL'}`);
    console.log('');
  });

  // 2. For first customer, check orders with different join methods
  if (customers.length === 0) {
    console.log('❌ No customers found!');
    return;
  }

  const customer = customers[0];
  console.log(`\n2️⃣ Checking orders for: ${customer.email}\n`);

  // Check simple_orders table
  console.log('📊 SIMPLE_ORDERS TABLE:');
  const { data: simpleOrders, error: simpleError } = await supabase
    .from('simple_orders')
    .select('id, customer_id, customer_email, stripe_customer_id, total_amount_cents, status, created_at')
    .or(`customer_id.eq.${customer.id},stripe_customer_id.eq.${customer.stripe_customer_id},customer_email.ilike.${customer.email}`)
    .order('created_at', { ascending: false });

  if (simpleError) {
    console.error('❌ Error:', simpleError);
  } else {
    console.log(`Found ${simpleOrders.length} orders:\n`);
    simpleOrders.forEach((o, i) => {
      console.log(`${i + 1}. Order ${o.id.substring(0, 8)}...`);
      console.log(`   customer_id: ${o.customer_id || 'NULL'}`);
      console.log(`   customer_email: ${o.customer_email || 'NULL'}`);
      console.log(`   stripe_customer_id: ${o.stripe_customer_id || 'NULL'}`);
      console.log(`   total_amount_cents: ${o.total_amount_cents || 'NULL'}`);
      console.log(`   status: ${o.status}`);
      console.log(`   created: ${o.created_at}`);
      console.log('');
    });
  }

  // Check configurator orders table
  console.log('\n📊 ORDERS TABLE (configurator):');
  const { data: configOrders, error: configError } = await supabase
    .from('orders')
    .select('id, customer_id, customer_email, stripe_customer_id, total_amount_cents, status, created_at')
    .or(`customer_id.eq.${customer.id},stripe_customer_id.eq.${customer.stripe_customer_id},customer_email.ilike.${customer.email}`)
    .order('created_at', { ascending: false });

  if (configError) {
    console.error('❌ Error:', configError);
  } else {
    console.log(`Found ${configOrders.length} orders:\n`);
    configOrders.forEach((o, i) => {
      console.log(`${i + 1}. Order ${o.id.substring(0, 8)}...`);
      console.log(`   customer_id: ${o.customer_id || 'NULL'}`);
      console.log(`   customer_email: ${o.customer_email || 'NULL'}`);
      console.log(`   stripe_customer_id: ${o.stripe_customer_id || 'NULL'}`);
      console.log(`   total_amount_cents: ${o.total_amount_cents || 'NULL'}`);
      console.log(`   status: ${o.status}`);
      console.log(`   created: ${o.created_at}`);
      console.log('');
    });
  }

  // 3. Calculate stats manually with different join strategies
  console.log('\n3️⃣ MANUAL STATS CALCULATION\n');
  
  const allOrders = [...(simpleOrders || []), ...(configOrders || [])];
  
  console.log('Strategy A: Match by customer_id');
  const byCustomerId = allOrders.filter(o => o.customer_id === customer.id);
  console.log(`  Orders: ${byCustomerId.length}`);
  console.log(`  Total: €${byCustomerId.reduce((sum, o) => sum + (o.total_amount_cents || 0), 0) / 100}`);
  
  console.log('\nStrategy B: Match by stripe_customer_id');
  const byStripeId = allOrders.filter(o => o.stripe_customer_id === customer.stripe_customer_id);
  console.log(`  Orders: ${byStripeId.length}`);
  console.log(`  Total: €${byStripeId.reduce((sum, o) => sum + (o.total_amount_cents || 0), 0) / 100}`);
  
  console.log('\nStrategy C: Match by email (case-insensitive)');
  const byEmail = allOrders.filter(o => o.customer_email?.toLowerCase() === customer.email.toLowerCase());
  console.log(`  Orders: ${byEmail.length}`);
  console.log(`  Total: €${byEmail.reduce((sum, o) => sum + (o.total_amount_cents || 0), 0) / 100}`);
  
  console.log('\nStrategy D: Combined (stripe_id OR email)');
  const combined = allOrders.filter(o => 
    o.stripe_customer_id === customer.stripe_customer_id || 
    o.customer_email?.toLowerCase() === customer.email.toLowerCase()
  );
  console.log(`  Orders: ${combined.length}`);
  console.log(`  Total: €${combined.reduce((sum, o) => sum + (o.total_amount_cents || 0), 0) / 100}`);
  
  // 4. Check what fields are NULL in orders
  console.log('\n4️⃣ FIELD POPULATION CHECK\n');
  
  console.log('Orders with NULL fields:');
  console.log(`  customer_id NULL: ${allOrders.filter(o => !o.customer_id).length}/${allOrders.length}`);
  console.log(`  stripe_customer_id NULL: ${allOrders.filter(o => !o.stripe_customer_id).length}/${allOrders.length}`);
  console.log(`  customer_email NULL: ${allOrders.filter(o => !o.customer_email).length}/${allOrders.length}`);
  console.log(`  total_amount_cents NULL: ${allOrders.filter(o => !o.total_amount_cents).length}/${allOrders.length}`);

  console.log('\n' + '='.repeat(80));
  console.log('\n✅ Diagnosis complete!\n');
}

diagnoseCustomerStats().catch(console.error);
