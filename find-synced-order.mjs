import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { createClient } from '@supabase/supabase-js';

const prisma = new PrismaClient();
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function findSyncedOrders() {
  console.log('🔍 Searching for orders that exist in BOTH systems with config_json...\n');
  
  // Get all Prisma orders
  const prismaOrders = await prisma.order.findMany({
    select: { id: true, email: true, statusPayment: true },
    orderBy: { createdAt: 'desc' },
    take: 50
  });
  
  console.log(`📊 Found ${prismaOrders.length} orders in Prisma\n`);
  
  let found = 0;
  
  for (const pOrder of prismaOrders) {
    const { data: sOrder } = await supabase
      .from('simple_orders')
      .select('id, config_json')
      .eq('id', pOrder.id)
      .maybeSingle();
    
    if (sOrder?.config_json?.colors) {
      found++;
      console.log(`✅ MATCH #${found}: ${pOrder.id.substring(0, 8)}...`);
      console.log(`   Email: ${pOrder.email}`);
      console.log(`   Status: ${pOrder.statusPayment}`);
      console.log(`   Colors: ${Object.keys(sOrder.config_json.colors).join(', ')}`);
      console.log(`   🔗 https://unbreak-one.vercel.app/admin/orders/${pOrder.id}\n`);
      
      if (found >= 3) break; // Show first 3 matches
    }
  }
  
  if (found === 0) {
    console.log('❌ NO ORDERS FOUND IN BOTH SYSTEMS WITH config_json');
    console.log('\n📋 SOLUTION OPTIONS:');
    console.log('   A) Migrate Supabase orders to Prisma');
    console.log('   B) Create new test order via Checkout flow');
    console.log('   C) Manually insert test order in both DBs');
  }
  
  await prisma.$disconnect();
}

findSyncedOrders().catch(console.error);
