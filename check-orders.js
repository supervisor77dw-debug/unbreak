require('dotenv').config({path:'.env.local', quiet:true});
const prisma = require('./lib/prisma.js').default;

async function checkOrders() {
  try {
    const orders = await prisma.order.findMany({
      include: {
        customer: true,
        items: true
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: 10
    });
    
    console.log('=== ADMIN_ORDERS TABLE ===');
    console.log('Total orders:', orders.length);
    
    if (orders.length === 0) {
      console.log('\n⚠️  No orders found in admin_orders table');
      console.log('This means the Stripe webhook sync did not work.');
    } else {
      console.log('\nOrders:');
      orders.forEach(o => {
        console.log(`\n- Order ID: ${o.id.slice(0, 12)}...`);
        console.log(`  Customer: ${o.customer.email}`);
        console.log(`  Total: €${(o.amountTotal / 100).toFixed(2)}`);
        console.log(`  Payment: ${o.statusPayment}`);
        console.log(`  Fulfillment: ${o.statusFulfillment}`);
        console.log(`  Items: ${o.items.length}`);
        console.log(`  Created: ${o.createdAt.toISOString()}`);
      });
    }
    
    // Check simple_orders for comparison
    const supabase = require('@supabase/supabase-js').createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
    
    const { data: simpleOrders } = await supabase
      .from('simple_orders')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(5);
    
    console.log('\n=== SIMPLE_ORDERS TABLE (for comparison) ===');
    console.log('Total orders:', simpleOrders?.length || 0);
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

checkOrders();
