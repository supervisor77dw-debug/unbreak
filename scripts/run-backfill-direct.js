/**
 * SIMPLE BACKFILL: Direct API call (requires manual login)
 * 
 * Instructions:
 * 1. Login to admin panel: https://unbreak-one.vercel.app/admin/login
 * 2. Open browser console (F12)
 * 3. Run this code:
 * 
 * fetch('/api/admin/customers/backfill', {
 *   method: 'POST',
 *   credentials: 'include'
 * })
 * .then(r => r.json())
 * .then(result => {
 *   console.log('=== BACKFILL RESULTS ===');
 *   console.log('Total Orders:', result.stats.totalOrders);
 *   console.log('Customers Created:', result.stats.customersCreated);
 *   console.log('Customers Updated:', result.stats.customersUpdated);
 *   console.log('Orders Updated:', result.stats.ordersUpdated);
 *   console.log('Errors:', result.stats.errors.length);
 *   if (result.stats.errors.length > 0) {
 *     console.log('Error details:', result.stats.errors);
 *   }
 * });
 * 
 * OR use curl (get session cookie first):
 * curl -X POST https://unbreak-one.vercel.app/api/admin/customers/backfill \
 *   -H "Cookie: next-auth.session-token=YOUR_SESSION_TOKEN"
 */

console.log('⚠️  This script requires manual execution via browser console');
console.log('');
console.log('Steps:');
console.log('1. Login: https://unbreak-one.vercel.app/admin/login');
console.log('2. Open Console (F12)');
console.log('3. Paste and run:');
console.log('');
console.log(`fetch('/api/admin/customers/backfill', {
  method: 'POST',
  credentials: 'include'
}).then(r => r.json()).then(console.log);`);
console.log('');
console.log('Alternative: Use the direct backfill tool below');
console.log('');

// Direct Supabase backfill (no auth needed - uses service role)
import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '..', '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const stripeSecretKey = process.env.STRIPE_SECRET_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

if (!stripeSecretKey) {
  console.error('❌ Missing STRIPE_SECRET_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);
const stripe = new Stripe(stripeSecretKey, { apiVersion: '2024-12-18.acacia' });

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('🔄 DIRECT CUSTOMER BACKFILL');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

async function runDirectBackfill() {
  const stats = {
    totalOrders: 0,
    customersCreated: 0,
    customersUpdated: 0,
    ordersUpdated: 0,
    errors: [],
  };

  try {
    // Fetch orders without customer data
    console.log('📥 Fetching orders...');
    const { data: orders, error: ordersError } = await supabase
      .from('orders')
      .select('id, order_number, stripe_checkout_session_id, customer_email, stripe_customer_id')
      .or('stripe_customer_id.is.null,customer_email.is.null')
      .not('stripe_checkout_session_id', 'is', null)
      .order('created_at', { ascending: false })
      .limit(100);

    if (ordersError) {
      console.error('❌ Failed to fetch orders:', ordersError);
      process.exit(1);
    }

    stats.totalOrders = orders?.length || 0;
    console.log(`✅ Found ${stats.totalOrders} orders to process\n`);

    if (stats.totalOrders === 0) {
      console.log('✅ No orders need backfill\n');
      return stats;
    }

    // Process each order
    for (const order of orders) {
      try {
        console.log(`🔍 Processing order ${order.order_number}...`);

        // Fetch Stripe session
        const session = await stripe.checkout.sessions.retrieve(
          order.stripe_checkout_session_id,
          { expand: ['customer'] }
        );

        const stripeCustomerId = session.customer;
        const customerEmail = session.customer_details?.email || session.customer_email;
        const customerName = session.customer_details?.name;
        const customerPhone = session.customer_details?.phone;
        const shippingAddress = session.shipping_details?.address;
        const billingAddress = session.customer_details?.address;

        console.log(`   Email: ${customerEmail}, Stripe ID: ${stripeCustomerId}`);

        if (!customerEmail && !stripeCustomerId) {
          console.warn(`   ⚠️  No customer data - skipping`);
          stats.errors.push({ orderId: order.id, error: 'No customer data' });
          continue;
        }

        // Upsert customer
        const { data: customer, error: customerError } = await supabase
          .from('customers')
          .upsert({
            stripe_customer_id: stripeCustomerId,
            email: customerEmail?.toLowerCase() || `stripe-${stripeCustomerId}@unknown.com`,
            name: customerName,
            phone: customerPhone,
            shipping_address: shippingAddress ? {
              line1: shippingAddress.line1,
              line2: shippingAddress.line2,
              city: shippingAddress.city,
              state: shippingAddress.state,
              postal_code: shippingAddress.postal_code,
              country: shippingAddress.country,
            } : null,
            billing_address: billingAddress ? {
              line1: billingAddress.line1,
              line2: billingAddress.line2,
              city: billingAddress.city,
              state: billingAddress.state,
              postal_code: billingAddress.postal_code,
              country: billingAddress.country,
            } : null,
          }, {
            onConflict: 'stripe_customer_id',
          })
          .select()
          .single();

        if (customerError) {
          console.error(`   ❌ Customer upsert failed:`, customerError.message);
          stats.errors.push({ orderId: order.id, error: customerError.message });
          continue;
        }

        const isNew = !order.stripe_customer_id; // If order didn't have stripe_customer_id, customer was created
        if (isNew) {
          stats.customersCreated++;
          console.log(`   ✅ Customer created: ${customer.id}`);
        } else {
          stats.customersUpdated++;
          console.log(`   ✅ Customer updated: ${customer.id}`);
        }

        // Update order
        const { error: orderError } = await supabase
          .from('orders')
          .update({
            customer_id: customer.id,
            stripe_customer_id: stripeCustomerId,
            customer_email: customerEmail,
            customer_name: customerName,
            customer_phone: customerPhone,
            shipping_address: shippingAddress ? {
              line1: shippingAddress.line1,
              line2: shippingAddress.line2,
              city: shippingAddress.city,
              state: shippingAddress.state,
              postal_code: shippingAddress.postal_code,
              country: shippingAddress.country,
              name: session.shipping_details?.name,
            } : null,
            billing_address: billingAddress ? {
              line1: billingAddress.line1,
              line2: billingAddress.line2,
              city: billingAddress.city,
              state: billingAddress.state,
              postal_code: billingAddress.postal_code,
              country: billingAddress.country,
            } : null,
          })
          .eq('id', order.id);

        if (orderError) {
          console.error(`   ❌ Order update failed:`, orderError.message);
          stats.errors.push({ orderId: order.id, error: orderError.message });
        } else {
          stats.ordersUpdated++;
          console.log(`   ✅ Order updated`);
        }

      } catch (err) {
        console.error(`   ❌ Error:`, err.message);
        stats.errors.push({ orderId: order.id, error: err.message });
      }
      console.log('');
    }

    return stats;

  } catch (error) {
    console.error('❌ Backfill failed:', error);
    throw error;
  }
}

runDirectBackfill()
  .then((stats) => {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 BACKFILL RESULTS');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log(`Total Orders:         ${stats.totalOrders}`);
    console.log(`Customers Created:    ${stats.customersCreated}`);
    console.log(`Customers Updated:    ${stats.customersUpdated}`);
    console.log(`Orders Updated:       ${stats.ordersUpdated}`);
    console.log(`Errors:               ${stats.errors.length}`);
    console.log('');
    
    if (stats.errors.length > 0) {
      console.log('⚠️  Errors encountered:');
      stats.errors.forEach((err, i) => {
        console.log(`   ${i + 1}. Order ${err.orderId}: ${err.error}`);
      });
      console.log('');
    }

    if (stats.customersCreated > 0 || stats.customersUpdated > 0) {
      console.log('✅ SUCCESS - Customers populated!');
      console.log('');
      console.log('Next steps:');
      console.log('1. Verify: node scripts/diagnose-customers.js');
      console.log('2. Check admin panel: /admin/customers');
      console.log('3. Create test order to verify webhook');
      console.log('');
    }

    process.exit(0);
  })
  .catch((err) => {
    console.error('❌ Backfill script failed:', err);
    process.exit(1);
  });
