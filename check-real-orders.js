require('dotenv').config({path:'.env.local', quiet:true});
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkOrders() {
  console.log('=== ORDERS TABLE (new system) ===\n');
  
  const { data: orders, error } = await supabase
    .from('orders')
    .select('*')
    .order('created_at', { ascending: false });
  
  if (error) {
    console.error('Error:', error);
    return;
  }
  
  console.log(`Total orders: ${orders.length}\n`);
  
  orders.slice(0, 5).forEach((order, i) => {
    console.log(`\n--- Order ${i + 1} ---`);
    console.log('ID:', order.id);
    console.log('Order Number:', order.order_number);
    console.log('Customer ID:', order.customer_id);
    console.log('Status:', order.status);
    console.log('Total:', order.total_cents, order.currency);
    console.log('Stripe Session ID:', order.stripe_checkout_session_id);
    console.log('Stripe Payment Intent:', order.stripe_payment_intent_id);
    console.log('Paid At:', order.paid_at);
    console.log('Created:', order.created_at);
  });
  
  // Get a paid order to sync
  const paidOrders = orders.filter(o => o.status === 'paid' || o.status === 'completed');
  console.log(`\n\n✅ Found ${paidOrders.length} paid orders`);
  
  if (paidOrders.length > 0) {
    console.log('\nLatest paid order:');
    const latest = paidOrders[0];
    console.log('- ID:', latest.id);
    console.log('- Order Number:', latest.order_number);
    console.log('- Session ID:', latest.stripe_checkout_session_id);
    console.log('- Payment Intent:', latest.stripe_payment_intent_id);
    console.log('- Total:', latest.total_cents / 100, latest.currency);
    
    // Get customer email
    if (latest.customer_id) {
      const { data: customer } = await supabase
        .from('customers')
        .select('email, name')
        .eq('id', latest.customer_id)
        .single();
      
      if (customer) {
        console.log('- Customer:', customer.email, customer.name);
      }
    }
  }
}

checkOrders().then(() => process.exit(0));
