/**
 * Check last order and customer sync status
 */
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Try to load from .env.local first, then .env
let envPath = path.join(__dirname, '..', '.env.local');
if (!fs.existsSync(envPath)) {
  envPath = path.join(__dirname, '..', '.env');
}

if (fs.existsSync(envPath)) {
  require('dotenv').config({ path: envPath });
}

// Fallback to Vercel environment variables if not in .env
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ Missing Supabase credentials!');
  console.error('   Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env or .env.local');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function checkLastOrder() {
  console.log('🔍 Checking last order and customer sync...\n');

  // Get last order
  const { data: order, error: orderError } = await supabase
    .from('simple_orders')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (orderError) {
    console.error('❌ Error fetching order:', orderError);
    return;
  }

  console.log('📦 LAST ORDER:');
  console.log('  ID:', order.id);
  console.log('  Email:', order.customer_email);
  console.log('  Customer ID:', order.customer_id || '⚠️ NULL');
  console.log('  Stripe Session ID:', order.stripe_session_id || order.stripe_checkout_session_id);
  console.log('  Config:', JSON.stringify(order.config_json, null, 2));
  console.log('  Created:', order.created_at);
  console.log('');

  // Check if customer exists
  if (order.customer_email) {
    const { data: customer, error: custError } = await supabase
      .from('customers')
      .select('*')
      .eq('email', order.customer_email)
      .maybeSingle();

    if (custError) {
      console.error('❌ Error checking customer:', custError);
    } else if (customer) {
      console.log('✅ CUSTOMER FOUND:');
      console.log('  ID:', customer.id);
      console.log('  Email:', customer.email);
      console.log('  Stripe Customer ID:', customer.stripe_customer_id || 'NULL');
      console.log('  Created:', customer.created_at);
      console.log('');
      
      if (!order.customer_id) {
        console.log('⚠️ WARNING: Customer exists but order.customer_id is NULL!');
        console.log('   → Webhook did not link them');
      } else if (order.customer_id === customer.id) {
        console.log('✅ Order correctly linked to customer');
      } else {
        console.log('❌ Order.customer_id does not match customer.id!');
      }
    } else {
      console.log('❌ NO CUSTOMER FOUND for email:', order.customer_email);
      console.log('   → Webhook did not create customer');
    }
  }

  console.log('\n📊 DIAGNOSTIC INFO:');
  console.log('  stripe_session_id:', order.stripe_session_id || 'NULL');
  console.log('  stripe_checkout_session_id:', order.stripe_checkout_session_id || 'NULL');
  
  if (!order.stripe_session_id && !order.stripe_checkout_session_id) {
    console.log('  ❌ BOTH session ID fields are NULL - webhook cannot find this order!');
  }
}

checkLastOrder().catch(console.error);
