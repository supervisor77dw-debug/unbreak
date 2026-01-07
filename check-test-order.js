import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkOrder() {
  const orderId = '082b457d-b256-408a-8bdd-fafa48299be0';
  const sessionId = 'cs_test_a11acYCPqIWVvv0fy2SPb52tWs4A1TKWESzTBQht3TkPESpucXCKL4OC8M';

  console.log('🔍 Checking test order:', orderId.substring(0, 8));
  console.log('📋 Session ID:', sessionId.substring(0, 30) + '...\n');

  // Check in admin_orders (Prisma)
  const { data: adminOrder, error: adminError } = await supabase
    .from('admin_orders')
    .select('id, stripe_checkout_session_id, config_json, status_payment, amount_total, email')
    .eq('id', orderId)
    .maybeSingle();

  if (adminError) {
    console.log('❌ Error querying admin_orders:', adminError.message);
  } else if (adminOrder) {
    console.log('✅ FOUND in admin_orders:');
    console.log('   ID:', adminOrder.id.substring(0, 8));
    console.log('   Status:', adminOrder.status_payment);
    console.log('   Amount:', adminOrder.amount_total);
    console.log('   Email:', adminOrder.email);
    console.log('   Session ID:', adminOrder.stripe_checkout_session_id?.substring(0, 30));
    console.log('\n🎨 config_json:', adminOrder.config_json ? 'EXISTS ✅' : 'NULL ❌');
    
    if (adminOrder.config_json) {
      console.log('\n📦 CONFIG DATA:');
      console.log(JSON.stringify(adminOrder.config_json, null, 2));
      
      if (adminOrder.config_json.colors) {
        console.log('\n🌈 COLORS:');
        console.log('   Base:', adminOrder.config_json.colors.base);
        console.log('   Arm:', adminOrder.config_json.colors.arm);
        console.log('   Module:', adminOrder.config_json.colors.module);
        console.log('   Pattern:', adminOrder.config_json.colors.pattern);
      }
    } else {
      console.log('\n⚠️  config_json is NULL - webhook may not have fired yet or config was not saved');
    }
  } else {
    console.log('❌ Order NOT found in admin_orders');
  }

  // Also check simple_orders
  console.log('\n---\n');
  const { data: simpleOrder, error: simpleError } = await supabase
    .from('simple_orders')
    .select('id, config_json')
    .eq('id', orderId)
    .maybeSingle();

  if (simpleError) {
    console.log('ℹ️  simple_orders check:', simpleError.message);
  } else if (simpleOrder) {
    console.log('ℹ️  Also in simple_orders with config:', !!simpleOrder.config_json);
  } else {
    console.log('ℹ️  NOT in simple_orders (expected - we use Prisma now)');
  }
}

checkOrder().catch(console.error);
