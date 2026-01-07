import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function findBySession() {
  const sessionId = 'cs_test_a11acYCPqIWVvv0fy2SPb52tWs4A1TKWESzTBQht3TkPESpucXCKL4OC8M';

  console.log('🔍 Searching for session:', sessionId.substring(0, 30) + '...\n');

  // Check admin_orders
  const { data: adminOrders, error: adminError } = await supabase
    .from('admin_orders')
    .select('id, stripe_checkout_session_id, config_json, status_payment, created_at')
    .eq('stripe_checkout_session_id', sessionId);

  if (adminError) {
    console.log('❌ Error:', adminError.message);
  } else if (adminOrders && adminOrders.length > 0) {
    console.log('✅ FOUND in admin_orders:', adminOrders.length, 'order(s)');
    adminOrders.forEach(order => {
      console.log('\n📦 Order:', order.id.substring(0, 8));
      console.log('   Status:', order.status_payment);
      console.log('   Created:', order.created_at);
      console.log('   config_json:', order.config_json ? '✅ EXISTS' : '❌ NULL');
      
      if (order.config_json) {
        console.log('   🌈 Colors:', order.config_json.colors);
      }
    });
  } else {
    console.log('⚠️  NOT found in admin_orders - webhook may not have processed yet');
    console.log('   This is normal if the order was just created.');
    console.log('   Stripe webhooks can take a few seconds to arrive.\n');
  }

  // Check simple_orders
  const { data: simpleOrders, error: simpleError } = await supabase
    .from('simple_orders')
    .select('id, stripe_session_id, stripe_checkout_session_id, config_json, status')
    .or(`stripe_session_id.eq.${sessionId},stripe_checkout_session_id.eq.${sessionId}`);

  if (simpleError) {
    console.log('❌ simple_orders error:', simpleError.message);
  } else if (simpleOrders && simpleOrders.length > 0) {
    console.log('---\n✅ FOUND in simple_orders:', simpleOrders.length, 'order(s)');
    simpleOrders.forEach(order => {
      console.log('\n📦 Order:', order.id.substring(0, 8));
      console.log('   Status:', order.status);
      console.log('   config_json:', order.config_json ? '✅ EXISTS' : '❌ NULL');
      
      if (order.config_json) {
        console.log('\n   🌈 Colors:');
        console.log('      Base:', order.config_json.colors?.base);
        console.log('      Arm:', order.config_json.colors?.arm);
        console.log('      Module:', order.config_json.colors?.module);
        console.log('      Pattern:', order.config_json.colors?.pattern);
      }
    });
  }
}

findBySession().catch(console.error);
