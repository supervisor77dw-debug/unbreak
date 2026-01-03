/**
 * ADMIN BACKFILL: Sync existing orders to customers
 * POST /api/admin/customers/backfill
 * 
 * Purpose: Retroactively create customers from existing orders
 * - Fetches Stripe Customer data from checkout sessions/payment intents
 * - Creates/updates customers table
 * - Links orders to customers
 * 
 * CRITICAL: Admin only, idempotent, logged
 */

import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../auth/[...nextauth]';
import { getSupabaseAdmin } from '../../../../lib/supabase';
import { stripe } from '../../../../lib/stripe';

export default async function handler(req, res) {
  // ========================================
  // 1. AUTHENTICATION
  // ========================================
  const session = await getServerSession(req, res, authOptions);
  
  if (!session || session.user.role !== 'ADMIN') {
    return res.status(401).json({ error: 'Unauthorized - Admin only' });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const supabaseAdmin = getSupabaseAdmin();

  try {
    console.log('🔄 [BACKFILL] Starting customer backfill process...');

    const stats = {
      totalOrders: 0,
      ordersProcessed: 0,
      customersCreated: 0,
      customersUpdated: 0,
      ordersUpdated: 0,
      errors: [],
    };

    // ========================================
    // 2. FETCH ORDERS WITHOUT CUSTOMER DATA
    // ========================================
    
    // Fetch from configurator orders
    const { data: configuratorOrders, error: configOrdersError } = await supabaseAdmin
      .from('orders')
      .select('id, stripe_checkout_session_id, stripe_payment_intent_id, customer_email, stripe_customer_id, status')
      .or('stripe_customer_id.is.null,customer_email.is.null')
      .not('stripe_checkout_session_id', 'is', null)
      .order('created_at', { ascending: false })
      .limit(100);

    if (configOrdersError) {
      console.error('❌ [BACKFILL] Failed to fetch configurator orders:', configOrdersError);
    }

    // Fetch from simple_orders (shop)
    const { data: simpleOrders, error: simpleOrdersError } = await supabaseAdmin
      .from('simple_orders')
      .select('id, stripe_session_id, stripe_payment_intent_id, customer_email, stripe_customer_id, status')
      .or('stripe_customer_id.is.null,customer_email.is.null')
      .not('stripe_session_id', 'is', null)
      .order('created_at', { ascending: false })
      .limit(100);

    if (simpleOrdersError) {
      console.error('❌ [BACKFILL] Failed to fetch simple orders:', simpleOrdersError);
    }

    const orders = [
      ...(configuratorOrders || []).map(o => ({ ...o, source: 'orders' })),
      ...(simpleOrders || []).map(o => ({ ...o, source: 'simple_orders', stripe_checkout_session_id: o.stripe_session_id }))
    ];

    stats.totalOrders = orders.length;
    console.log(`📊 [BACKFILL] Found ${stats.totalOrders} orders to process`);

    if (stats.totalOrders === 0) {
      return res.status(200).json({
        success: true,
        message: 'No orders need backfill',
        stats,
      });
    }

    // ========================================
    // 3. PROCESS EACH ORDER
    // ========================================
    for (const order of orders) {
      try {
        console.log(`\n🔍 [BACKFILL] Processing order ${order.id.substring(0, 8)}...`);

        let stripeSession = null;
        let stripeCustomerId = null;
        let customerEmail = null;
        let customerName = null;
        let customerPhone = null;
        let shippingAddress = null;
        let billingAddress = null;

        // Try to retrieve Stripe checkout session
        if (order.stripe_checkout_session_id) {
          try {
            console.log(`  📥 Fetching Stripe session: ${order.stripe_checkout_session_id}`);
            stripeSession = await stripe.checkout.sessions.retrieve(
              order.stripe_checkout_session_id,
              { expand: ['customer', 'payment_intent'] }
            );

            stripeCustomerId = stripeSession.customer;
            customerEmail = stripeSession.customer_details?.email || stripeSession.customer_email;
            customerName = stripeSession.customer_details?.name;
            customerPhone = stripeSession.customer_details?.phone;
            shippingAddress = stripeSession.shipping_details?.address;
            billingAddress = stripeSession.customer_details?.address;

            console.log(`  ✅ Session retrieved - Customer: ${stripeCustomerId || 'none'}, Email: ${customerEmail}`);
          } catch (stripeError) {
            console.warn(`  ⚠️ Failed to retrieve session: ${stripeError.message}`);
            stats.errors.push({
              orderId: order.id,
              error: `Stripe session fetch failed: ${stripeError.message}`,
            });
          }
        }

        // Fallback: Try payment intent if no session data
        if (!stripeCustomerId && order.stripe_payment_intent_id) {
          try {
            console.log(`  📥 Fetching Stripe PaymentIntent: ${order.stripe_payment_intent_id}`);
            const paymentIntent = await stripe.paymentIntents.retrieve(
              order.stripe_payment_intent_id,
              { expand: ['customer'] }
            );

            if (typeof paymentIntent.customer === 'string') {
              stripeCustomerId = paymentIntent.customer;
            } else if (paymentIntent.customer && typeof paymentIntent.customer === 'object') {
              stripeCustomerId = paymentIntent.customer.id;
            }

            console.log(`  ✅ PaymentIntent retrieved - Customer: ${stripeCustomerId || 'none'}`);
          } catch (piError) {
            console.warn(`  ⚠️ Failed to retrieve payment intent: ${piError.message}`);
          }
        }

        // Fallback: Use existing customer_email from order
        if (!customerEmail && order.customer_email) {
          customerEmail = order.customer_email;
          console.log(`  ℹ️ Using email from order: ${customerEmail}`);
        }

        // Skip if no customer data available
        if (!stripeCustomerId && !customerEmail) {
          console.warn(`  ⚠️ No customer data found for order ${order.id} - skipping`);
          stats.errors.push({
            orderId: order.id,
            error: 'No customer data available (no Stripe customer ID or email)',
          });
          continue;
        }

        // ========================================
        // 4. UPSERT CUSTOMER
        // ========================================
        let customerUuid = null;

        if (stripeCustomerId || customerEmail) {
          console.log(`  💾 Upserting customer...`);

          // Check if customer already exists
          const { data: existingCustomer } = await supabaseAdmin
            .from('customers')
            .select('id, stripe_customer_id')
            .or(`stripe_customer_id.eq.${stripeCustomerId},email.eq.${customerEmail}`)
            .maybeSingle();

          if (existingCustomer) {
            // Update existing customer
            const { data: updatedCustomer, error: updateError } = await supabaseAdmin
              .from('customers')
              .update({
                stripe_customer_id: stripeCustomerId || existingCustomer.stripe_customer_id,
                name: customerName,
                phone: customerPhone,
                shipping_address: shippingAddress,
                billing_address: billingAddress,
                updated_at: new Date().toISOString(),
              })
              .eq('id', existingCustomer.id)
              .select()
              .single();

            if (updateError) {
              console.error(`  ❌ Failed to update customer:`, updateError.message);
              stats.errors.push({
                orderId: order.id,
                error: `Customer update failed: ${updateError.message}`,
              });
              continue;
            }

            customerUuid = updatedCustomer.id;
            stats.customersUpdated++;
            console.log(`  ✅ Customer updated: ${customerUuid.substring(0, 8)}`);
          } else {
            // Create new customer
            const { data: newCustomer, error: insertError } = await supabaseAdmin
              .from('customers')
              .insert({
                stripe_customer_id: stripeCustomerId,
                email: customerEmail,
                name: customerName,
                phone: customerPhone,
                shipping_address: shippingAddress,
                billing_address: billingAddress,
              })
              .select()
              .single();

            if (insertError) {
              console.error(`  ❌ Failed to create customer:`, insertError.message);
              stats.errors.push({
                orderId: order.id,
                error: `Customer creation failed: ${insertError.message}`,
              });
              continue;
            }

            customerUuid = newCustomer.id;
            stats.customersCreated++;
            console.log(`  ✅ Customer created: ${customerUuid.substring(0, 8)}`);
          }
        }

        // ========================================
        // 5. UPDATE ORDER WITH CUSTOMER DATA
        // ========================================
        const orderUpdateData = {
          customer_id: customerUuid,
          stripe_customer_id: stripeCustomerId,
          customer_email: customerEmail,
          customer_name: customerName,
          customer_phone: customerPhone,
          shipping_address: shippingAddress,
          billing_address: billingAddress,
          updated_at: new Date().toISOString(),
        };

        console.log(`  💾 Updating order with customer data...`);

        const { error: orderUpdateError } = await supabaseAdmin
          .from(order.source)
          .update(orderUpdateData)
          .eq('id', order.id);

        if (orderUpdateError) {
          console.error(`  ❌ Failed to update order:`, orderUpdateError.message);
          stats.errors.push({
            orderId: order.id,
            error: `Order update failed: ${orderUpdateError.message}`,
          });
          continue;
        }

        stats.ordersUpdated++;
        stats.ordersProcessed++;
        console.log(`  ✅ Order updated successfully`);

      } catch (orderError) {
        console.error(`  ❌ Error processing order ${order.id}:`, orderError.message);
        stats.errors.push({
          orderId: order.id,
          error: orderError.message,
        });
      }
    }

    // ========================================
    // 6. RETURN RESULTS
    // ========================================
    console.log('\n📊 [BACKFILL] Complete!');
    console.log(`  Total orders: ${stats.totalOrders}`);
    console.log(`  Processed: ${stats.ordersProcessed}`);
    console.log(`  Customers created: ${stats.customersCreated}`);
    console.log(`  Customers updated: ${stats.customersUpdated}`);
    console.log(`  Orders updated: ${stats.ordersUpdated}`);
    console.log(`  Errors: ${stats.errors.length}`);

    return res.status(200).json({
      success: true,
      message: 'Backfill completed',
      stats,
      errors: stats.errors.length > 0 ? stats.errors : undefined,
    });

  } catch (error) {
    console.error('❌ [BACKFILL] Fatal error:', error);
    return res.status(500).json({
      error: 'Backfill failed',
      message: error.message,
    });
  }
}
