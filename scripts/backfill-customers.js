/**
 * Backfill Customer Data for Existing Orders
 * 
 * Syncs customer data from Stripe to Supabase for orders
 * that were created before customer sync was implemented
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const Stripe = require('stripe');

// Standardized env variable names
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const stripeKey = process.env.STRIPE_SECRET_KEY;

if (!supabaseUrl || !supabaseKey || !stripeKey) {
  console.error('❌ Missing environment variables');
  console.log('Required:');
  console.log('  - NEXT_PUBLIC_SUPABASE_URL (or SUPABASE_URL)');
  console.log('  - SUPABASE_SERVICE_ROLE_KEY (sb_secret_...)');
  console.log('  - STRIPE_SECRET_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);
const stripe = new Stripe(stripeKey);

async function backfillCustomers() {
  console.log('🚀 Starting customer data backfill...\n');

  // Get orders without customer data
  const { data: orders, error } = await supabase
    .from('simple_orders')
    .select('*')
    .or('customer_id.is.null,stripe_customer_id.is.null')
    .not('stripe_session_id', 'is', null)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('❌ Failed to fetch orders:', error);
    process.exit(1);
  }

  console.log(`📊 Found ${orders.length} orders needing customer data\n`);

  let synced = 0;
  let failed = 0;
  let skipped = 0;

  for (const order of orders) {
    console.log(`\n📦 Processing order ${order.id.substring(0, 8)}...`);
    console.log(`   Created: ${new Date(order.created_at).toLocaleString()}`);
    console.log(`   Status: ${order.status}`);
    console.log(`   Stripe Session: ${order.stripe_session_id || order.stripe_checkout_session_id}`);

    try {
      // Fetch Stripe Checkout Session
      const sessionId = order.stripe_session_id || order.stripe_checkout_session_id;
      
      if (!sessionId) {
        console.log('   ⏭️  No Stripe session ID - skipping');
        skipped++;
        continue;
      }

      const session = await stripe.checkout.sessions.retrieve(sessionId, {
        expand: ['customer', 'payment_intent']
      });

      console.log(`   ✅ Retrieved Stripe session`);
      console.log(`   Customer Email: ${session.customer_details?.email || 'N/A'}`);
      console.log(`   Customer Name: ${session.customer_details?.name || 'N/A'}`);

      // Extract customer data
      const stripeCustomerId = session.customer;
      const customerEmail = session.customer_details?.email || session.customer_email;
      const customerName = session.customer_details?.name || null;
      const customerPhone = session.customer_details?.phone || null;

      if (!customerEmail) {
        console.log('   ⚠️  No customer email found - skipping');
        skipped++;
        continue;
      }

      // Upsert customer in customers table (simplified - only core fields)
      const { data: customer, error: customerError } = await supabase
        .from('customers')
        .upsert({
          stripe_customer_id: stripeCustomerId,
          email: customerEmail.toLowerCase(),
          name: customerName,
          phone: customerPhone,
          metadata: {
            backfilled: true,
            backfilled_at: new Date().toISOString(),
            source_order_id: order.id
          },
          updated_at: new Date().toISOString()
        }, {
          onConflict: stripeCustomerId ? 'stripe_customer_id' : 'email',
          ignoreDuplicates: false
        })
        .select()
        .single();

      if (customerError) {
        console.error(`   ❌ Failed to upsert customer:`, customerError.message);
        failed++;
        continue;
      }

      console.log(`   ✅ Customer upserted: ${customer.id.substring(0, 8)}...`);

      // Update order with customer data
      const { error: orderUpdateError } = await supabase
        .from('simple_orders')
        .update({
          customer_id: customer.id,
          stripe_customer_id: stripeCustomerId,
          customer_email: customerEmail,
          customer_name: customerName,
          customer_phone: customerPhone,
          shipping_address: session.shipping_details?.address || null,
          billing_address: session.customer_details?.address || null,
          updated_at: new Date().toISOString()
        })
        .eq('id', order.id);

      if (orderUpdateError) {
        console.error(`   ❌ Failed to update order:`, orderUpdateError.message);
        failed++;
        continue;
      }

      console.log(`   ✅ Order updated with customer data`);
      synced++;

      // Rate limiting - don't hammer Stripe API
      await new Promise(resolve => setTimeout(resolve, 200));

    } catch (error) {
      console.error(`   ❌ Error processing order:`, error.message);
      failed++;
    }
  }

  console.log('\n' + '='.repeat(50));
  console.log('✅ Backfill complete!');
  console.log(`   Total orders processed: ${orders.length}`);
  console.log(`   ✅ Synced: ${synced}`);
  console.log(`   ❌ Failed: ${failed}`);
  console.log(`   ⏭️  Skipped: ${skipped}`);
  console.log('='.repeat(50));
}

backfillCustomers()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('❌ Fatal error:', err);
    process.exit(1);
  });
