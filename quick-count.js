require('dotenv').config({path:'.env.local', quiet:true});
const prisma = require('./lib/prisma.js').default;

async function quickCheck() {
  const total = await prisma.order.count();
  console.log('Total admin_orders:', total);
  
  const orders = await prisma.order.findMany({
    select: {
      id: true,
      email: true,
      amountTotal: true,
      currency: true,
      statusPayment: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'desc' }
  });
  
  console.log('\nAll orders:');
  orders.forEach((o, i) => {
    console.log(`${i+1}. ${o.id.substring(0, 8)} - ${o.email} - €${o.amountTotal/100} - ${o.statusPayment}`);
  });
  
  await prisma.$disconnect();
}

quickCheck().then(() => process.exit(0));
