require('dotenv').config({path:'.env.local', quiet:true});
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function inspect() {
  const { data: orders, error } = await supabase
    .from('simple_orders')
    .select('*')
    .order('created_at', { ascending: false });
  
  if (error) {
    console.error('Error:', error);
    return;
  }
  
  console.log(`Found ${orders.length} orders\n`);
  
  orders.forEach((order, i) => {
    console.log(`\n=== ORDER ${i + 1} ===`);
    console.log('ID:', order.id);
    console.log('Email:', order.email);
    console.log('Stripe Session ID:', order.stripe_checkout_session_id);
    console.log('Stripe Payment Intent:', order.stripe_payment_intent_id);
    console.log('Amount:', order.amount_total, order.currency);
    console.log('Shipping Name:', order.shipping_name);
    console.log('Shipping Address:', JSON.stringify(order.shipping_address, null, 2));
    console.log('Items:', JSON.stringify(order.items, null, 2));
    console.log('Created:', order.created_at);
    console.log('All keys:', Object.keys(order));
  });
}

inspect().then(() => process.exit(0));
