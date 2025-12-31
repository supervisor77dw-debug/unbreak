require('dotenv').config({path:'.env.local', quiet:true});
const Stripe = require('stripe');

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

async function checkRecentSessions() {
  try {
    console.log('Checking recent Stripe checkout sessions...\n');
    
    const sessions = await stripe.checkout.sessions.list({
      limit: 10,
    });
    
    console.log(`Found ${sessions.data.length} recent sessions\n`);
    
    for (const session of sessions.data) {
      console.log('--- Session ---');
      console.log('ID:', session.id);
      console.log('Status:', session.status);
      console.log('Payment Status:', session.payment_status);
      console.log('Email:', session.customer_details?.email || session.customer_email);
      console.log('Amount:', session.amount_total / 100, session.currency?.toUpperCase());
      console.log('Created:', new Date(session.created * 1000).toLocaleString('de-DE'));
      console.log('Payment Intent:', session.payment_intent);
      console.log('Metadata:', session.metadata);
      console.log('');
    }
    
    // Check if any completed sessions are missing from orders table
    const { createClient } = require('@supabase/supabase-js');
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
    
    console.log('\n=== Checking which sessions are in database ===\n');
    
    for (const session of sessions.data) {
      if (session.payment_status === 'paid') {
        const { data: order } = await supabase
          .from('orders')
          .select('id, order_number, status')
          .eq('stripe_checkout_session_id', session.id)
          .single();
        
        if (order) {
          console.log(`✅ ${session.id} → Order ${order.order_number} (${order.status})`);
        } else {
          console.log(`❌ ${session.id} → NOT IN DATABASE (webhook may have failed)`);
        }
      }
    }
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

checkRecentSessions().then(() => process.exit(0));
