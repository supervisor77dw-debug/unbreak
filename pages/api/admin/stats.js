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

  try {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterdayStart = new Date(todayStart);
    yesterdayStart.setDate(yesterdayStart.getDate() - 1);

    // Orders today
    const ordersToday = await prisma.adminOrder.count({
      where: {
        created_at: {
          gte: todayStart
        }
      }
    });

    // Orders yesterday
    const ordersYesterday = await prisma.adminOrder.count({
      where: {
        created_at: {
          gte: yesterdayStart,
          lt: todayStart
        }
      }
    });

    // Open tickets
    let openTickets = 0;
    let newTicketsToday = 0;
    try {
      openTickets = await prisma.adminTicket.count({
        where: {
          status: {
            in: ['OPEN', 'IN_PROGRESS']
          }
        }
      });

      // New tickets today
      newTicketsToday = await prisma.adminTicket.count({
        where: {
          created_at: {
            gte: todayStart
          }
        }
      });
    } catch (err) {
      // Tickets table might not exist yet
      console.log('Tickets table not available');
    }

    // Revenue today
    const revenueOrders = await prisma.adminOrder.findMany({
      where: {
        created_at: {
          gte: todayStart
        },
        status_payment: 'PAID'
      },
      select: {
        amount_total: true
      }
    });
    const revenueToday = revenueOrders.reduce((sum, order) => sum + order.amount_total, 0);

    // Revenue yesterday
    const revenueOrdersYesterday = await prisma.adminOrder.findMany({
      where: {
        created_at: {
          gte: yesterdayStart,
          lt: todayStart
        },
        status_payment: 'PAID'
      },
      select: {
        amount_total: true
      }
    });
    const revenueYesterday = revenueOrdersYesterday.reduce((sum, order) => sum + order.amount_total, 0);

    // Pending orders
    const pendingOrders = await prisma.adminOrder.count({
      where: {
        status_fulfillment: {
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
