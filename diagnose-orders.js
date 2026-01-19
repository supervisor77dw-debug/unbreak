// DIAGNOSE: Check all order tables and email config
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL, 
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function diagnose() {
  console.log('\n═══════════════════════════════════════════════════════');
  console.log('                    ORDER DIAGNOSIS');
  console.log('═══════════════════════════════════════════════════════\n');

  // 1. Check simple_orders
  console.log('1️⃣  simple_orders TABLE');
  console.log('─────────────────────────────────────────');
  const simpleOrders = await supabase
    .from('simple_orders')
    .select('id, order_number, stripe_session_id, status, customer_email, created_at')
    .order('created_at', { ascending: false })
    .limit(5);
  
  if (simpleOrders.error) {
    console.log('   ❌ Error:', simpleOrders.error.message);
  } else {
    console.log('   Recent orders:');
    simpleOrders.data.forEach(o => {
      const sessionType = o.stripe_session_id?.startsWith('cs_test') ? '🧪TEST' : '💰LIVE';
      console.log(`   ${o.order_number} | ${o.status} | ${sessionType} | ${o.customer_email || 'NO EMAIL'}`);
    });
  }

  // 2. Check admin_orders
  console.log('\n2️⃣  admin_orders TABLE');
  console.log('─────────────────────────────────────────');
  const adminOrders = await supabase
    .from('admin_orders')
    .select('*')
    .limit(3);
  
  if (adminOrders.error) {
    console.log('   ❌ Error:', adminOrders.error.message);
  } else {
    console.log('   Count:', adminOrders.data.length, 'rows');
    if (adminOrders.data.length > 0) {
      console.log('   Columns:', Object.keys(adminOrders.data[0]).join(', '));
      const first = adminOrders.data[0];
      console.log('\n   First order:');
      console.log('   - id:', first.id?.substring(0, 8));
      console.log('   - email:', first.email);
      console.log('   - status_payment:', first.status_payment || first.statusPayment);
      console.log('   - email_status:', first.email_status || first.emailStatus);
    }
  }

  // 3. Search for UO-2026-000123 specifically
  console.log('\n3️⃣  ORDER UO-2026-000123 DETAILS');
  console.log('─────────────────────────────────────────');
  
  // In simple_orders
  const testOrder = await supabase
    .from('simple_orders')
    .select('*')
    .eq('order_number', 'UO-2026-000123')
    .single();
  
  if (testOrder.data) {
    console.log('   ✅ Found in simple_orders');
    console.log('   - status:', testOrder.data.status);
    console.log('   - customer_email:', testOrder.data.customer_email);
    console.log('   - stripe_session_id:', testOrder.data.stripe_session_id?.substring(0, 20) + '...');
    console.log('   - paid_at:', testOrder.data.paid_at);
    
    // Check for email-related columns
    const emailCols = ['email_status', 'email_sent_at', 'customer_email_sent_at', 'admin_email_sent_at', 'email_last_error'];
    console.log('\n   Email columns:');
    emailCols.forEach(col => {
      const val = testOrder.data[col];
      console.log(`   - ${col}: ${val === undefined ? '❌ COLUMN NOT EXISTS' : (val || 'null')}`);
    });
  } else {
    console.log('   ❌ Not found in simple_orders');
  }

  // In admin_orders  
  const adminOrder = await supabase
    .from('admin_orders')
    .select('*')
    .or(`id.eq.14b82ec2-d8db-4b3c-bb33-91368e7f70d1,stripe_session_id.eq.cs_test_b1UwvaTlVJD5i6wWrdKaafazegS5MFif2Yz4wjtnQEN3juGC8XEH4ZzVKg`);
  
  if (adminOrder.error) {
    console.log('   ❌ admin_orders search error:', adminOrder.error.message);
  } else if (adminOrder.data.length > 0) {
    console.log('   ✅ Found in admin_orders');
    console.log('   - id:', adminOrder.data[0].id?.substring(0, 8));
  } else {
    console.log('   ❌ NOT FOUND in admin_orders');
    console.log('   → This is why Admin Panel is empty!');
  }

  // 4. Email ENV check
  console.log('\n4️⃣  EMAIL CONFIGURATION');
  console.log('─────────────────────────────────────────');
  console.log('   DISABLE_EMAILS:', process.env.DISABLE_EMAILS || 'NOT SET');
  console.log('   RESEND_API_KEY:', process.env.RESEND_API_KEY ? '✅ SET' : '❌ NOT SET');
  console.log('   ADMIN_ORDER_EMAIL:', process.env.ADMIN_ORDER_EMAIL || 'NOT SET');
  console.log('   EMAIL_FROM:', process.env.EMAIL_FROM || 'NOT SET');

  // 5. Check if Orders table exists (Prisma model)
  console.log('\n5️⃣  DATABASE SCHEMA CHECK');
  console.log('─────────────────────────────────────────');
  
  const tables = ['simple_orders', 'admin_orders', 'orders', 'Order'];
  for (const table of tables) {
    const result = await supabase.from(table).select('id').limit(1);
    const status = result.error ? `❌ ${result.error.message.substring(0, 40)}` : `✅ EXISTS (${result.data.length} sample)`;
    console.log(`   ${table}: ${status}`);
  }

  console.log('\n═══════════════════════════════════════════════════════');
  console.log('                    DIAGNOSIS COMPLETE');
  console.log('═══════════════════════════════════════════════════════\n');
}

diagnose().catch(console.error);
