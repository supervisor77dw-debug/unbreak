import { requireAuth } from '../../../lib/auth-helpers';
import prisma from '../../../lib/prisma';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const user = await requireAuth(req, res);
  if (!user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // Debug: Check if prisma is loaded
  if (!prisma) {
    console.error('❌ [ADMIN STATS] Prisma client is undefined!');
    return res.status(500).json({ error: 'Database client not initialized' });
  }

  try {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterdayStart = new Date(todayStart);
    yesterdayStart.setDate(yesterdayStart.getDate() - 1);

    // Orders today
    const ordersToday = await prisma.order.count({
      where: {
        createdAt: {
          gte: todayStart
        }
      }
    });

    // Orders yesterday
    const ordersYesterday = await prisma.order.count({
      where: {
        createdAt: {
          gte: yesterdayStart,
          lt: todayStart
        }
      }
    });

    // Open tickets
    let openTickets = 0;
    let newTicketsToday = 0;
    try {
      openTickets = await prisma.ticket.count({
        where: {
          status: {
            in: ['OPEN', 'IN_PROGRESS']
          }
        }
      });

      // New tickets today
      newTicketsToday = await prisma.ticket.count({
        where: {
          createdAt: {
            gte: todayStart
          }
        }
      });
    } catch (err) {
      // Tickets table might not exist yet
      console.log('Tickets table not available');
    }

    // Revenue today
    const revenueOrders = await prisma.order.findMany({
      where: {
        createdAt: {
          gte: todayStart
        },
        statusPayment: 'PAID'
      },
      select: {
        amountTotal: true
      }
    });
    const revenueToday = revenueOrders.reduce((sum, order) => sum + order.amountTotal, 0);

    // Revenue yesterday
    const revenueOrdersYesterday = await prisma.order.findMany({
      where: {
        createdAt: {
          gte: yesterdayStart,
          lt: todayStart
        },
        statusPayment: 'PAID'
      },
      select: {
        amountTotal: true
      }
    });
    const revenueYesterday = revenueOrdersYesterday.reduce((sum, order) => sum + order.amountTotal, 0);

    // Pending orders
    const pendingOrders = await prisma.order.count({
      where: {
        statusFulfillment: {
          in: ['NEW', 'PROCESSING']
        }
      }
    });

    // Calculate changes
    const ordersChange = ordersYesterday > 0 
      ? Math.round(((ordersToday - ordersYesterday) / ordersYesterday) * 100)
      : 0;

    const revenueChange = revenueYesterday > 0
      ? Math.round(((revenueToday - revenueYesterday) / revenueYesterday) * 100)
      : 0;

    res.status(200).json({
      ordersToday,
      ordersChange,
      openTickets,
      ticketsChange: newTicketsToday,
      revenueToday,
      revenueChange,
      pendingOrders
    });

  } catch (error) {
    console.error('❌ [ADMIN STATS] Error:', error);
    res.status(500).json({ error: 'Failed to fetch statistics' });
  }
}
