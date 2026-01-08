import Stripe from 'stripe';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

async function checkWebhooks() {
  console.log('🔍 Checking Stripe Webhook Endpoints...\n');
  
  const endpoints = await stripe.webhookEndpoints.list({ limit: 10 });
  
  if (endpoints.data.length === 0) {
    console.log('❌ NO WEBHOOK ENDPOINTS CONFIGURED!');
    console.log('\n💡 You need to add a webhook endpoint in Stripe Dashboard:');
    console.log('   1. Go to: https://dashboard.stripe.com/test/webhooks');
    console.log('   2. Click "Add endpoint"');
    console.log('   3. URL: https://unbreak-one.vercel.app/api/webhooks/stripe');
    console.log('   4. Select events:');
    console.log('      - checkout.session.completed');
    console.log('      - customer.created');
    console.log('      - customer.updated');
    console.log('      - payment_intent.succeeded');
    console.log('      - payment_intent.payment_failed');
    console.log('   5. Copy the "Signing secret" (whsec_...)');
    console.log('   6. Add to Vercel Environment Variables:');
    console.log('      STRIPE_WEBHOOK_SECRET=whsec_...');
    return;
  }
  
  console.log(`✅ Found ${endpoints.data.length} webhook endpoint(s):\n`);
  
  endpoints.data.forEach((ep, idx) => {
    console.log(`${idx + 1}. ${ep.url}`);
    console.log(`   Status: ${ep.status}`);
    console.log(`   Enabled Events: ${ep.enabled_events.join(', ')}`);
    console.log(`   Secret: ${ep.secret ? ep.secret.substring(0, 15) + '...' : '❌ NO SECRET'}`);
    console.log(`   API Version: ${ep.api_version}`);
    console.log(`   Created: ${new Date(ep.created * 1000).toLocaleString()}`);
    console.log();
  });
  
  // Check if our production URL is configured
  const hasProductionWebhook = endpoints.data.some(
    ep => ep.url.includes('unbreak-one.vercel.app')
  );
  
  if (!hasProductionWebhook) {
    console.log('⚠️  WARNING: No webhook endpoint configured for production URL!');
    console.log('   Expected: https://unbreak-one.vercel.app/api/webhooks/stripe');
    console.log('   Please add this endpoint in Stripe Dashboard.');
  }
}

checkWebhooks().catch(console.error);
