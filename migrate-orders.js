require('dotenv').config({path:'.env.local', quiet:true});
const prisma = require('./lib/prisma.js').default;
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function migrateExistingOrders() {
  try {
    console.log('=== MIGRATING EXISTING ORDERS TO ADMIN SYSTEM ===\n');
    
    // Get all paid orders from orders table
    const { data: orders, error } = await supabase
      .from('orders')
      .select('*')
      .or('status.eq.paid,status.eq.completed')
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('Error fetching orders:', error);
      return;
    }
    
    console.log(`Found ${orders.length} paid/completed orders\n`);
    
    if (orders.length === 0) {
      console.log('No paid orders to migrate. Try making a test checkout first.');
      return;
    }
    
    for (const order of orders) {
      console.log(`\n--- Migrating order ${order.order_number} ---`);
      
      // Get customer
      const { data: customer } = await supabase
        .from('customers')
        .select('email, name')
        .eq('id', order.customer_id)
        .single();
      
      if (!customer) {
        console.log('⚠️  No customer found, skipping');
        continue;
      }
      
      console.log('Customer:', customer.email);
      
      // Upsert customer in admin system
      const adminCustomer = await prisma.customer.upsert({
        where: { email: customer.email },
        update: {
          name: customer.name,
          lastOrderAt: new Date(order.created_at),
        },
        create: {
          email: customer.email,
          name: customer.name,
          locale: 'de',
        },
      });
      
      console.log('✅ Admin customer:', adminCustomer.id);
      
      // Get product info
      let productName = 'Configured Product';
      let productSku = null;
      
      if (order.configuration_id) {
        const { data: config } = await supabase
          .from('configurations')
          .select('product_id, config_json, price_cents')
          .eq('id', order.configuration_id)
          .single();
        
        if (config?.product_id) {
          const { data: product } = await supabase
            .from('products')
            .select('name, sku')
            .eq('id', config.product_id)
            .single();
          
          if (product) {
            productName = product.name;
            productSku = product.sku;
            console.log('Product:', productName, `(${productSku})`);
          }
        }
      }
      
      // Create order in admin system
      const sessionId = order.stripe_checkout_session_id || `manual_${order.id}`;
      
      const adminOrder = await prisma.order.upsert({
        where: { stripeCheckoutSessionId: sessionId },
        update: {
          statusPayment: order.status === 'completed' || order.status === 'paid' ? 'PAID' : 'PENDING',
          stripePaymentIntentId: order.stripe_payment_intent_id,
          paidAt: new Date(order.updated_at),
          updatedAt: new Date(),
        },
        create: {
          stripeCheckoutSessionId: sessionId,
          stripePaymentIntentId: order.stripe_payment_intent_id,
          statusPayment: order.status === 'completed' || order.status === 'paid' ? 'PAID' : 'PENDING',
          statusFulfillment: 'NEW',
          currency: order.currency.toUpperCase(),
          amountTotal: order.total_cents,
          amountShipping: order.shipping_cents || 0,
          amountTax: order.tax_cents || 0,
          email: customer.email,
          shippingName: customer.name,
          shippingAddress: order.shipping_address,
          customerId: adminCustomer.id,
          paidAt: new Date(order.updated_at),
          createdAt: new Date(order.created_at),
        },
      });
      
      console.log('✅ Admin order:', adminOrder.id);
      
      // Create order item
      const existingItems = await prisma.orderItem.count({
        where: { orderId: adminOrder.id }
      });
      
      if (existingItems === 0) {
        await prisma.orderItem.create({
          data: {
            orderId: adminOrder.id,
            sku: productSku || order.order_number,
            name: productName,
            variant: `Configured (${order.order_number})`,
            qty: 1,
            unitPrice: order.subtotal_cents,
            totalPrice: order.subtotal_cents,
          },
        });
        console.log('✅ Created order item');
      } else {
        console.log('ℹ️  Order items already exist');
      }
      
      // Log migration event
      await prisma.orderEvent.create({
        data: {
          orderId: adminOrder.id,
          type: 'NOTE_ADDED',
          source: 'manual_script',
          payload: {
            note: 'Order migrated from legacy orders table',
            migrated_from: 'orders_table',
            original_order_id: order.id,
            order_number: order.order_number,
            migrated_at: new Date().toISOString(),
          },
        },
      });
      
      console.log('✅ Migration complete for', order.order_number);
    }
    
    // Show summary
    console.log('\n\n=== MIGRATION SUMMARY ===');
    const totalAdminOrders = await prisma.order.count();
    const totalAdminCustomers = await prisma.customer.count();
    
    console.log(`Total orders in admin system: ${totalAdminOrders}`);
    console.log(`Total customers in admin system: ${totalAdminCustomers}`);
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error(error.stack);
  } finally {
    await prisma.$disconnect();
    process.exit(0);
  }
}

migrateExistingOrders();
