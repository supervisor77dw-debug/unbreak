require('dotenv').config({path:'.env.local', quiet:true});
const { PrismaClient } = require('@prisma/client');
const { createClient } = require('@supabase/supabase-js');

const prisma = new PrismaClient();
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function findCommonOrders() {
  // Get all orders from Prisma
  const prismaOrders = await prisma.order.findMany({
    select: { id: true, email: true, createdAt: true },
    orderBy: { createdAt: 'desc' },
    take: 20
  });
  
  console.log(`Found ${prismaOrders.length} orders in Prisma (admin_orders)\n`);
  
  // Check which ones exist in Supabase with config_json
  for (const order of prismaOrders) {
    const { data: simpleOrder } = await supabase
      .from('simple_orders')
      .select('id, config_json')
      .eq('id', order.id)
      .maybeSingle();
    
    const hasConfig = !!simpleOrder?.config_json;
    const hasColors = !!simpleOrder?.config_json?.colors;
    
    if (hasConfig) {
      console.log(`✅ ${order.id.substring(0, 8)}... - ${order.email}`);
      console.log(`   In Supabase: YES | Has config_json: YES | Has colors: ${hasColors ? 'YES ✓✓✓' : 'NO'}`);
      if (hasColors) {
        console.log(`   🎨 Colors: ${Object.keys(simpleOrder.config_json.colors).join(', ')}`);
        console.log(`   👉 URL: https://unbreak-one.vercel.app/admin/orders/${order.id}\n`);
      }
    } else if (simpleOrder) {
      console.log(`⚠️  ${order.id.substring(0, 8)}... - ${order.email}`);
      console.log(`   In Supabase: YES | Has config_json: NO\n`);
    } else {
      console.log(`❌ ${order.id.substring(0, 8)}... - ${order.email}`);
      console.log(`   In Supabase: NO\n`);
    }
  }
}

findCommonOrders()
  .then(() => {
    prisma.$disconnect();
    process.exit(0);
  })
  .catch(err => {
    console.error(err);
    prisma.$disconnect();
    process.exit(1);
  });
