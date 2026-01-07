const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function listOrders() {
  const orders = await prisma.order.findMany({
    select: { 
      id: true, 
      email: true, 
      amountTotal: true,
      statusPayment: true,
      createdAt: true 
    },
    orderBy: { createdAt: 'desc' },
    take: 10
  });
  
  console.log('Latest 10 orders in Prisma:\n');
  orders.forEach((o, i) => {
    console.log(`${i+1}. ${o.id}`);
    console.log(`   ${o.email} - ${o.statusPayment} - €${(o.amountTotal/100).toFixed(2)}`);
    console.log(`   Created: ${o.createdAt.toISOString().split('T')[0]}\n`);
  });
  
  await prisma.$disconnect();
}

listOrders();
