/**
 * DIAGNOSE: Warum sind Customers leer?
 * 
 * Prüft:
 * 1. customers Tabelle (count + samples)
 * 2. orders mit customer_email/stripe_customer_id
 * 3. simple_orders mit customer_email
 * 4. RLS Policies
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
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
  console.error('NEXT_PUBLIC_SUPABASE_URL:', !!supabaseUrl);
  console.error('SUPABASE_SERVICE_ROLE_KEY:', !!supabaseServiceKey);
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('📊 CUSTOMER DIAGNOSIS - UNBREAK-ONE');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

async function runDiagnosis() {
  
  // ========================================
  // A1) Count customers
  // ========================================
  console.log('🔍 A1) Customers Table Count:');
  const { data: customersCount, error: e1 } = await supabase
    .from('customers')
    .select('*', { count: 'exact', head: true });
  
  if (e1) {
    console.error('❌ Error:', e1.message);
  } else {
    console.log(`✅ Total customers: ${customersCount?.length || 0}`);
  }
  
  // Sample customers
  const { data: customersSample, error: e1b } = await supabase
    .from('customers')
    .select('id, email, name, stripe_customer_id, created_at')
    .order('created_at', { ascending: false })
    .limit(5);
  
  if (customersSample && customersSample.length > 0) {
    console.log('\n📋 Sample Customers:');
    customersSample.forEach((c, i) => {
      console.log(`${i + 1}. ${c.email} | ${c.name || 'N/A'} | Stripe: ${c.stripe_customer_id || 'N/A'}`);
    });
  }
  console.log('');
  
  // ========================================
  // A2) Orders with customer fields
  // ========================================
  console.log('🔍 A2) Orders Table Customer Fields:');
  const { data: ordersStats, error: e2 } = await supabase.rpc('get_orders_stats');
  
  if (e2) {
    // Fallback: direct query
    const { data: allOrders, error: e2b } = await supabase
      .from('orders')
      .select('customer_email, stripe_customer_id, customer_name');
    
    if (e2b) {
      console.error('❌ Error:', e2b.message);
    } else {
      const total = allOrders.length;
      const withStripeId = allOrders.filter(o => o.stripe_customer_id).length;
      const withEmail = allOrders.filter(o => o.customer_email).length;
      const withName = allOrders.filter(o => o.customer_name).length;
      
      console.log(`✅ Total orders: ${total}`);
      console.log(`   - With stripe_customer_id: ${withStripeId}`);
      console.log(`   - With customer_email: ${withEmail}`);
      console.log(`   - With customer_name: ${withName}`);
    }
  } else {
    console.log('✅ Orders stats:', ordersStats);
  }
  console.log('');
  
  // ========================================
  // A3) Group by customer_email
  // ========================================
  console.log('🔍 A3) Orders Grouped by Customer Email (Top 20):');
  const { data: ordersByEmail, error: e3 } = await supabase
    .from('orders')
    .select('customer_email')
    .not('customer_email', 'is', null);
  
  if (e3) {
    console.error('❌ Error:', e3.message);
  } else {
    // Group manually
    const emailCounts = {};
    ordersByEmail.forEach(o => {
      const email = o.customer_email;
      emailCounts[email] = (emailCounts[email] || 0) + 1;
    });
    
    const sorted = Object.entries(emailCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20);
    
    if (sorted.length > 0) {
      sorted.forEach(([email, count]) => {
        console.log(`   ${email}: ${count} order(s)`);
      });
    } else {
      console.log('   ⚠️  No orders with customer_email found!');
    }
  }
  console.log('');
  
  // ========================================
  // B) Check recent orders structure
  // ========================================
  console.log('🔍 B) Recent Orders Structure:');
  const { data: recentOrders, error: e4 } = await supabase
    .from('orders')
    .select('id, order_number, customer_email, stripe_customer_id, customer_name, customer_phone, shipping_address, billing_address, created_at')
    .order('created_at', { ascending: false })
    .limit(3);
  
  if (e4) {
    console.error('❌ Error:', e4.message);
  } else if (recentOrders && recentOrders.length > 0) {
    console.log('✅ Sample Orders:');
    recentOrders.forEach((o, i) => {
      console.log(`\n${i + 1}. Order #${o.order_number} (${o.created_at})`);
      console.log(`   - customer_email: ${o.customer_email || '❌ NULL'}`);
      console.log(`   - stripe_customer_id: ${o.stripe_customer_id || '❌ NULL'}`);
      console.log(`   - customer_name: ${o.customer_name || '❌ NULL'}`);
      console.log(`   - customer_phone: ${o.customer_phone || '❌ NULL'}`);
      console.log(`   - shipping_address: ${o.shipping_address ? '✅ Present' : '❌ NULL'}`);
      console.log(`   - billing_address: ${o.billing_address ? '✅ Present' : '❌ NULL'}`);
    });
  } else {
    console.log('⚠️  No orders found!');
  }
  console.log('');
  
  // ========================================
  // C) Check simple_orders
  // ========================================
  console.log('🔍 C) Simple Orders Customer Fields:');
  const { data: simpleOrders, error: e5 } = await supabase
    .from('simple_orders')
    .select('customer_email')
    .not('customer_email', 'is', null)
    .limit(5);
  
  if (e5) {
    console.error('❌ Error:', e5.message);
  } else {
    console.log(`✅ simple_orders with customer_email: ${simpleOrders?.length || 0}`);
    if (simpleOrders && simpleOrders.length > 0) {
      simpleOrders.forEach((o, i) => {
        console.log(`   ${i + 1}. ${o.customer_email}`);
      });
    }
  }
  console.log('');
  
  // ========================================
  // D) Check database schema
  // ========================================
  console.log('🔍 D) Database Schema Check:');
  console.log('Checking if customer fields exist in orders table...\n');
  
  const { data: ordersColumns, error: e6 } = await supabase.rpc('get_table_columns', { 
    table_name: 'orders' 
  });
  
  if (e6) {
    console.log('⚠️  Could not fetch schema (RPC might not exist)');
    // Try direct query to see what fields exist
    const { data: testOrder, error: e6b } = await supabase
      .from('orders')
      .select('*')
      .limit(1)
      .single();
    
    if (testOrder) {
      console.log('✅ Orders table fields (from sample):');
      const customerFields = [
        'customer_email',
        'customer_name', 
        'customer_phone',
        'stripe_customer_id',
        'shipping_address',
        'billing_address'
      ];
      
      customerFields.forEach(field => {
        const exists = field in testOrder;
        console.log(`   ${exists ? '✅' : '❌'} ${field}`);
      });
    }
  } else {
    console.log('✅ Schema info:', ordersColumns);
  }
  console.log('');
  
  // ========================================
  // E) Summary
  // ========================================
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📊 DIAGNOSIS SUMMARY');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');
  console.log('Next steps based on results:');
  console.log('');
  console.log('1. If customers = 0 AND orders have customer_email:');
  console.log('   → Run backfill tool');
  console.log('');
  console.log('2. If orders have NO customer_email:');
  console.log('   → Check webhook is running');
  console.log('   → Check checkout creates customer fields');
  console.log('');
  console.log('3. If both are empty:');
  console.log('   → Need to create test order first');
  console.log('');
}

runDiagnosis()
  .then(() => {
    console.log('✅ Diagnosis complete\n');
    process.exit(0);
  })
  .catch((err) => {
    console.error('❌ Diagnosis failed:', err);
    process.exit(1);
  });
