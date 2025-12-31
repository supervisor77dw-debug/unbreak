require('dotenv').config({path:'.env.local', quiet:true});
const { createClient } = require('@supabase/supabase-js');
const Stripe = require('stripe');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

async function diagnoseWebhook() {
  console.log('=== WEBHOOK DIAGNOSIS ===\n');
  
  // Get latest paid session from Stripe
  const sessions = await stripe.checkout.sessions.list({ limit: 1 });
  const session = sessions.data[0];
  
  if (!session) {
    console.log('No sessions found in Stripe');
    return;
  }
  
  console.log('Latest Stripe session:');
  console.log('- ID:', session.id);
  console.log('- Status:', session.status);
  console.log('- Payment Status:', session.payment_status);
  console.log('- Amount:', session.amount_total / 100, session.currency?.toUpperCase());
  console.log('- Email:', session.customer_details?.email);
  console.log('- Metadata order_id:', session.metadata?.order_id);
  console.log('');
  
  // Check if exists in simple_orders
  const { data: simpleOrder } = await supabase
    .from('simple_orders')
    .select('*')
    .eq('id', session.metadata?.order_id)
    .single();
  
  if (simpleOrder) {
    console.log('✅ Found in simple_orders:');
    console.log('- ID:', simpleOrder.id);
    console.log('- Status:', simpleOrder.status);
    console.log('- stripe_session_id:', simpleOrder.stripe_session_id);
    console.log('- stripe_payment_intent_id:', simpleOrder.stripe_payment_intent_id);
    console.log('');
    
    if (!simpleOrder.stripe_session_id) {
      console.log('❌ PROBLEM: stripe_session_id is NULL in simple_orders!');
      console.log('This means the checkout API did not save the session ID.');
      console.log('The webhook cannot find this order.');
      console.log('');
      
      // Fix it
      console.log('Fixing: Setting stripe_session_id...');
      await supabase
        .from('simple_orders')
        .update({ stripe_session_id: session.id })
        .eq('id', simpleOrder.id);
      console.log('✅ Fixed!');
    } else if (simpleOrder.stripe_session_id !== session.id) {
      console.log('⚠️  WARNING: stripe_session_id mismatch!');
      console.log('- In DB:', simpleOrder.stripe_session_id);
      console.log('- In Stripe:', session.id);
    }
  } else {
    console.log('❌ NOT found in simple_orders');
    console.log('The order was never created in the database.');
  }
  
  // Check if exists in orders (configurator)
  const { data: configuratorOrder } = await supabase
    .from('orders')
    .select('*')
    .eq('stripe_checkout_session_id', session.id)
    .maybeSingle();
  
  if (configuratorOrder) {
    console.log('✅ Found in orders (configurator):');
    console.log('- ID:', configuratorOrder.id);
    console.log('- Order Number:', configuratorOrder.order_number);
    console.log('- Status:', configuratorOrder.status);
  }
  
  // Check if exists in admin_orders
  const adminOrder = await require('./lib/prisma.js').default.order.findUnique({
    where: { stripeCheckoutSessionId: session.id }
  });
  
  if (adminOrder) {
    console.log('\n✅ Found in admin_orders (Prisma):');
    console.log('- ID:', adminOrder.id);
    console.log('- Email:', adminOrder.email);
    console.log('- Status:', adminOrder.statusPayment);
  } else {
    console.log('\n❌ NOT found in admin_orders (Prisma)');
    console.log('The webhook sync did not work or was never called.');
  }
  
  console.log('\n=== RECOMMENDATION ===');
  console.log('Go to Stripe Dashboard → Webhooks');
  console.log('Find the checkout.session.completed event for session:', session.id);
  console.log('Click "Resend" to trigger the webhook manually');
}

diagnoseWebhook()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Error:', err);
    process.exit(1);
  });
