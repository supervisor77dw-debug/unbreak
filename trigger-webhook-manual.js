import Stripe from 'stripe';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

async function triggerWebhook() {
  const sessionId = 'cs_test_a1lERkIVDMah9oHoSh5gNiAdpuaG3LVAgiU0VlZvIfObs3nUMZxj62X6i5';
  
  console.log('🔍 Retrieving session:', sessionId);
  
  const session = await stripe.checkout.sessions.retrieve(sessionId, {
    expand: ['line_items', 'payment_intent']
  });
  
  console.log('\n✅ Session found:');
  console.log('   Email:', session.customer_email);
  console.log('   Status:', session.status);
  console.log('   Payment Status:', session.payment_status);
  console.log('   Amount:', session.amount_total / 100, session.currency.toUpperCase());
  console.log('   Metadata:');
  console.log('      order_id:', session.metadata.order_id);
  console.log('      order_type:', session.metadata.order_type);
  console.log('      config_json:', session.metadata.config_json?.substring(0, 100) + '...');
  
  console.log('\n📦 Line Items:');
  session.line_items?.data.forEach(item => {
    console.log('   -', item.description);
    console.log('     Quantity:', item.quantity);
    console.log('     Price:', item.amount_total / 100, session.currency.toUpperCase());
  });
  
  console.log('\n💡 To manually trigger webhook, you need to:');
  console.log('   1. Go to Stripe Dashboard > Developers > Webhooks');
  console.log('   2. Click on your webhook endpoint');
  console.log('   3. Click "Send test webhook"');
  console.log('   4. Select "checkout.session.completed"');
  console.log('   5. Use this session ID:', sessionId);
  
  console.log('\n🔧 Or use Stripe CLI:');
  console.log('   stripe trigger checkout.session.completed');
  
  console.log('\n⚠️  Real solution: Check Vercel logs to see why webhook failed');
  console.log('   https://vercel.com/your-team/unbreak-one/logs');
}

triggerWebhook().catch(console.error);
