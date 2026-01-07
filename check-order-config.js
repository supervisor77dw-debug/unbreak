require('dotenv').config({path:'.env.local', quiet:true});
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkOrder() {
  const orderId = 'd928a2ef-9922-4baf-830f-bdaca81b30bf';
  
  const { data: order, error } = await supabase
    .from('simple_orders')
    .select('id, customer_email, config_json, items')
    .eq('id', orderId)
    .single();
  
  if (error) {
    console.error('Error:', error);
    return;
  }
  
  console.log('Order ID:', order.id);
  console.log('Email:', order.customer_email);
  console.log('Has config_json:', !!order.config_json);
  console.log('config_json:', JSON.stringify(order.config_json, null, 2));
  console.log('\nItems:', JSON.stringify(order.items, null, 2));
  
  if (order.items?.[0]?.config) {
    console.log('\nitems[0].config:', JSON.stringify(order.items[0].config, null, 2));
  }
}

checkOrder().then(() => process.exit(0));
