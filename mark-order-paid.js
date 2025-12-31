require('dotenv').config({path:'.env.local', quiet:true});
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function markOrderPaid() {
  // Get the latest pending order
  const { data: orders } = await supabase
    .from('orders')
    .select('*')
    .eq('status', 'pending_payment')
    .order('created_at', { ascending: false })
    .limit(1);
  
  if (!orders || orders.length === 0) {
    console.log('No pending orders found');
    return;
  }
  
  const order = orders[0];
  console.log('Found order:', order.order_number);
  console.log('Session ID:', order.stripe_checkout_session_id);
  
  if (!order.stripe_checkout_session_id) {
    console.log('⚠️  Order has no stripe_checkout_session_id - cannot trigger webhook');
    console.log('This order was probably created but checkout was never completed');
    return;
  }
  
  // Update to paid
  const { data, error } = await supabase
    .from('orders')
    .update({
      status: 'paid',
      stripe_payment_intent_id: 'pi_test_manual_' + order.id.substring(0, 8),
      updated_at: new Date().toISOString(),
    })
    .eq('id', order.id)
    .select();
  
  if (error) {
    console.error('Error:', error);
    return;
  }
  
  console.log('✅ Order marked as paid');
  console.log('\nNow you can run the migration script to sync to admin system:');
  console.log('node migrate-orders.js');
}

markOrderPaid().then(() => process.exit(0));
