require('dotenv').config({path:'.env.local', quiet:true});
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkOrder() {
  const orderId = '8131c67c-87b3-4b02-a51e-644560a78a45'; // Just created
  
  const { data: order, error } = await supabase
    .from('simple_orders')
    .select('id, customer_email, config_json, items')
    .eq('id', orderId)
    .single();
  
  if (error) {
    console.error('❌ Error:', error.message);
    console.log('\n⚠️  Order NOT in simple_orders table!');
    console.log('Only in Prisma (admin_orders)');
    console.log('\n🔍 PROBLEM: Checkout does not write to simple_orders');
    return;
  }
  
  console.log('✅ Order found in simple_orders');
  console.log('ID:', order.id);
  console.log('Email:', order.customer_email);
  console.log('Has config_json:', !!order.config_json);
  console.log('config_json:', JSON.stringify(order.config_json, null, 2));
  
  if (order.items?.[0]?.config) {
    console.log('\nitems[0].config:', JSON.stringify(order.items[0].config, null, 2));
  }
}

checkOrder().then(() => process.exit(0));
