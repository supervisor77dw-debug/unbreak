import Stripe from 'stripe';
import dotenv from 'dotenv';
import fetch from 'node-fetch';

dotenv.config({ path: '.env.local' });

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

async function manualWebhookTrigger() {
  const sessionId = 'cs_test_a1kYAtqz8qttRA4t8kv0LC80AbZZ72mPVg6An9NriNxEn57fAdlzPhB2bH';
  
  console.log('🔍 Retrieving session...\n');
  
  const session = await stripe.checkout.sessions.retrieve(sessionId, {
    expand: ['line_items', 'payment_intent']
  });
  
  console.log('Session:', session.id);
  console.log('Status:', session.status);
  console.log('Payment Status:', session.payment_status);
  console.log('Order ID:', session.metadata?.order_id);
  console.log('Config:', session.metadata?.config_json?.substring(0, 100));
  
  // Create event manually
  const event = {
    id: 'evt_manual_' + Date.now(),
    object: 'event',
    type: 'checkout.session.completed',
    data: {
      object: session
    }
  };
  
  console.log('\n🚀 Calling webhook endpoint...\n');
  
  try {
    const response = await fetch('https://unbreak-one.vercel.app/api/webhooks/stripe', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'stripe-signature': 'MANUAL_TRIGGER' // This will fail signature check, but we can see the error
      },
      body: JSON.stringify(event)
    });
    
    const text = await response.text();
    console.log('Response Status:', response.status);
    console.log('Response:', text);
  } catch (error) {
    console.error('Error:', error.message);
  }
}

manualWebhookTrigger().catch(console.error);
