require('dotenv').config({path:'.env.local', quiet:true});
const prisma = require('./lib/prisma.js').default;
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testSync() {
  try {
    console.log('Fetching latest order from simple_orders...');
    
    const { data: orders } = await supabase
      .from('simple_orders')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1);
    
    if (!orders || orders.length === 0) {
      console.log('No orders found in simple_orders');
      process.exit(0);
    }
    
    const order = orders[0];
    console.log('Found order:', order.id);
    console.log('Email:', order.email);
    
    // Create fake Stripe session from Supabase order
    const fakeSession = {
      id: order.stripe_checkout_session_id || `test_session_${order.id}`,
      customer_details: {
        email: order.email,
        name: order.shipping_name
      },
      customer_email: order.email,
      locale: 'de',
      amount_total: order.amount_total,
      currency: order.currency || 'eur',
      payment_intent: order.stripe_payment_intent_id,
      shipping_details: order.shipping_address ? {
        address: order.shipping_address,
        name: order.shipping_name
      } : null
    };
    
    console.log('\nTesting syncOrderToPrisma...');
    
    // Call the sync function (copied from webhook)
    await syncOrderToPrisma(fakeSession, order);
    
    console.log('\n✅ Sync completed! Checking database...');
    
    const adminOrders = await prisma.order.findMany({
      include: { customer: true, items: true }
    });
    
    console.log(`\nFound ${adminOrders.length} orders in admin_orders`);
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

async function syncOrderToPrisma(session, supabaseOrder) {
  try {
    console.log('💾 [PRISMA SYNC] Starting order sync...');
    console.log('💾 [PRISMA SYNC] Session ID:', session.id);

    // 1. Get or create customer
    const customerEmail = session.customer_details?.email || session.customer_email;
    if (!customerEmail) {
      console.warn('⚠️ [PRISMA SYNC] No customer email - skipping');
      return;
    }

    const customer = await prisma.customer.upsert({
      where: { email: customerEmail },
      update: {
        name: session.customer_details?.name,
        lastOrderAt: new Date(),
      },
      create: {
        email: customerEmail,
        name: session.customer_details?.name,
        locale: session.locale || 'de',
      },
    });

    console.log('✅ [PRISMA SYNC] Customer:', customer.id);

    // 2. Parse items from Supabase order
    const items = [];
    try {
      if (supabaseOrder.items && typeof supabaseOrder.items === 'string') {
        const parsed = JSON.parse(supabaseOrder.items);
        if (Array.isArray(parsed)) {
          items.push(...parsed);
        }
      } else if (Array.isArray(supabaseOrder.items)) {
        items.push(...supabaseOrder.items);
      }
    } catch (e) {
      console.warn('⚠️ [PRISMA SYNC] Could not parse items:', e.message);
    }

    console.log('💾 [PRISMA SYNC] Items:', items.length);

    // 3. Create or update order
    const order = await prisma.order.upsert({
      where: {
        stripeCheckoutSessionId: session.id,
      },
      update: {
        statusPayment: 'PAID',
        paidAt: new Date(),
      },
      create: {
        stripeCheckoutSessionId: session.id,
        stripePaymentIntentId: session.payment_intent,
        statusPayment: 'PAID',
        statusFulfillment: 'NEW',
        currency: (session.currency || 'EUR').toUpperCase(),
        amountTotal: session.amount_total || supabaseOrder.amount_total || 0,
        amountShipping: 0,
        amountTax: 0,
        email: customerEmail,
        customerId: customer.id,
        shippingName: session.shipping_details?.name || session.customer_details?.name,
        shippingAddress: session.shipping_details?.address || null,
        paidAt: new Date(),
      },
    });

    console.log('✅ [PRISMA SYNC] Order:', order.id);

    // 4. Create order items
    const existingItems = await prisma.orderItem.count({
      where: { orderId: order.id },
    });

    if (items.length > 0 && existingItems === 0) {
      for (const item of items) {
        await prisma.orderItem.create({
          data: {
            orderId: order.id,
            sku: item.sku || item.id,
            name: item.name || item.description || 'Unknown Product',
            variant: item.variant,
            qty: item.quantity || item.qty || 1,
            unitPrice: item.unit_amount || item.price || 0,
            totalPrice: (item.unit_amount || item.price || 0) * (item.quantity || item.qty || 1),
          },
        });
      }
      console.log(`✅ [PRISMA SYNC] Created ${items.length} order items`);
    } else {
      console.log('⏭️ [PRISMA SYNC] Order items already exist, skipping');
    }

    // 5. Log event
    await prisma.orderEvent.create({
      data: {
        orderId: order.id,
        type: 'STRIPE_WEBHOOK',
        source: 'stripe_checkout_completed',
        payload: {
          sessionId: session.id,
          syncedAt: new Date().toISOString(),
        },
      },
    });

    console.log('✅ [PRISMA SYNC] Complete!');
  } catch (error) {
    console.error('❌ [PRISMA SYNC] Failed:', error.message);
    console.error(error.stack);
    // Don't throw - log but continue webhook processing
  }
}

testSync();
