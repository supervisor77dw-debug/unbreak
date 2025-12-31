require('dotenv').config({path:'.env.local', quiet:true});
const prisma = require('./lib/prisma.js').default;
const { createClient } = require('@supabase/supabase-js');
const Stripe = require('stripe');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

async function migrateShopOrders() {
  try {
    console.log('=== MIGRATING SHOP ORDERS TO ADMIN SYSTEM ===\n');
    
    // Get all paid orders from simple_orders
    const { data: orders, error } = await supabase
      .from('simple_orders')
      .select('*')
      .eq('status', 'paid')
      .not('stripe_session_id', 'is', null)
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('Error fetching orders:', error);
      return;
    }
    
    console.log(`Found ${orders.length} paid shop orders\n`);
    
    if (orders.length === 0) {
      console.log('No paid shop orders to migrate.');
      return;
    }
    
    let migrated = 0;
    let skipped = 0;
    let errors = 0;
    
    for (const order of orders) {
      try {
        console.log(`\n--- Processing order ${order.id.substring(0, 8)}... ---`);
        
        // Check if already migrated
        const existing = await prisma.order.findUnique({
          where: { stripeCheckoutSessionId: order.stripe_session_id }
        });
        
        if (existing) {
          console.log('⏭️  Already migrated, skipping');
          skipped++;
          continue;
        }
        
        // Get Stripe session for customer details
        let session = null;
        try {
          session = await stripe.checkout.sessions.retrieve(order.stripe_session_id);
        } catch (err) {
          console.log('⚠️  Could not fetch Stripe session:', err.message);
        }
        
        const customerEmail = session?.customer_details?.email || 
                            session?.customer_email || 
                            order.customer_email || 
                            'unknown@example.com';
        
        const customerName = session?.customer_details?.name || 
                           session?.shipping?.name || 
                           null;
        
        console.log('Customer:', customerEmail);
        
        // Parse items
        let items = [];
        try {
          items = typeof order.items === 'string' 
            ? JSON.parse(order.items) 
            : order.items || [];
        } catch (e) {
          console.log('⚠️  Could not parse items');
        }
        
        console.log('Items:', items.length);
        
        // Upsert customer in admin system
        const customer = await prisma.customer.upsert({
          where: { email: customerEmail },
          update: {
            name: customerName,
            lastOrderAt: new Date(order.created_at),
          },
          create: {
            email: customerEmail,
            name: customerName,
            locale: session?.locale || 'de',
          },
        });
        
        // Calculate amounts
        const amountTotal = order.total_amount_cents || session?.amount_total || 0;
        const amountShipping = session?.total_details?.amount_shipping || 0;
        const amountTax = session?.total_details?.amount_tax || 0;
        
        // Create order in admin system
        const adminOrder = await prisma.order.create({
          data: {
            stripeCheckoutSessionId: order.stripe_session_id,
            stripePaymentIntentId: order.stripe_payment_intent_id,
            statusPayment: 'PAID',
            statusFulfillment: 'NEW',
            currency: (order.currency || 'EUR').toUpperCase(),
            amountTotal: amountTotal,
            amountShipping: amountShipping,
            amountTax: amountTax,
            email: customerEmail,
            shippingName: customerName,
            shippingAddress: session?.shipping_details?.address || null,
            customerId: customer.id,
            paidAt: new Date(order.updated_at || order.created_at),
            createdAt: new Date(order.created_at),
          },
        });
        
        console.log('✅ Admin order:', adminOrder.id.substring(0, 8));
        
        // Create order items
        if (items.length > 0) {
          for (const item of items) {
            await prisma.orderItem.create({
              data: {
                orderId: adminOrder.id,
                sku: item.sku || item.product_id,
                name: item.name || 'Product',
                variant: item.variant || null,
                qty: item.quantity || 1,
                unitPrice: item.unit_price_cents || 0,
                totalPrice: (item.quantity || 1) * (item.unit_price_cents || 0),
              },
            });
          }
          console.log(`✅ Created ${items.length} items`);
        }
        
        // Log migration event
        await prisma.orderEvent.create({
          data: {
            orderId: adminOrder.id,
            type: 'NOTE_ADDED',
            source: 'migration_script',
            payload: {
              note: 'Order migrated from simple_orders (shop)',
              original_order_id: order.id,
              migrated_at: new Date().toISOString(),
            },
          },
        });
        
        migrated++;
        console.log('✅ Migration complete');
        
      } catch (err) {
        console.error('❌ Error migrating order:', err.message);
        errors++;
      }
    }
    
    console.log('\n\n=== MIGRATION SUMMARY ===');
    console.log(`Total orders processed: ${orders.length}`);
    console.log(`Migrated: ${migrated}`);
    console.log(`Skipped (already migrated): ${skipped}`);
    console.log(`Errors: ${errors}`);
    
    const totalAdminOrders = await prisma.order.count();
    const totalAdminCustomers = await prisma.customer.count();
    
    console.log(`\nTotal orders in admin system: ${totalAdminOrders}`);
    console.log(`Total customers in admin system: ${totalAdminCustomers}`);
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error(error.stack);
  } finally {
    await prisma.$disconnect();
    process.exit(0);
  }
}

migrateShopOrders();
