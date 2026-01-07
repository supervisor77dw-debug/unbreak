require('dotenv').config({path:'.env.local', quiet:true});
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkOrder() {
  // Get all orders with config_json to see which ones have color data
  const { data: orders, error } = await supabase
    .from('simple_orders')
    .select('id, customer_email, config_json, items')
    .not('config_json', 'is', null)
    .order('created_at', { ascending: false })
    .limit(10);
  
  if (error) {
    console.error('Error:', error.message);
    return;
  }
  
  console.log(`Found ${orders.length} orders with config_json:\n`);
  
  orders.forEach((order, i) => {
    console.log(`${i + 1}. ${order.id.substring(0, 8)}... - ${order.customer_email}`);
    console.log('   Has colors:', !!order.config_json?.colors);
    if (order.config_json?.colors) {
      console.log('   Colors:', Object.keys(order.config_json.colors).join(', '));
    }
  });
  
  // Also check the specific order from browser log
  console.log('\n=== Checking order 70e852c2... ===');
  const { data: specificOrder } = await supabase
    .from('simple_orders')
    .select('id, customer_email, config_json')
    .ilike('id', '70e852c2%')
    .single();
  
  if (specificOrder) {
    console.log('Found:', specificOrder.id);
    console.log('Has config_json:', !!specificOrder.config_json);
    console.log('config_json:', specificOrder.config_json);
  } else {
    console.log('Order not found');
  }
}

checkOrder().then(() => process.exit(0));
