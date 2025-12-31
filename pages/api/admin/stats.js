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

  // Check database connection
  try {
    await prisma.$queryRaw`SELECT 1`;
    console.log('[ADMIN STATS] Database connection OK');
  } catch (dbError) {
    console.error('❌ [ADMIN STATS] Database connection failed:', {
      message: dbError.message,
      code: dbError.code,
    });
    return res.status(500).json({ 
      error: 'Database connection failed',
      message: dbError.message 
    });
  }

  try {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterdayStart = new Date(todayStart);
    yesterdayStart.setDate(yesterdayStart.getDate() - 1);

    console.log('[ADMIN STATS] Fetching statistics...');

    // Orders today
    const ordersToday = await prisma.order.count({
      where: {
        createdAt: {
          gte: todayStart
        }
      }
    });
    console.log('[ADMIN STATS] Orders today:', ordersToday);

    // Orders yesterday
    const ordersYesterday = await prisma.order.count({
      where: {
        createdAt: {
          gte: yesterdayStart,
          lt: todayStart
        }
      }
    });
    console.log('[ADMIN STATS] Orders yesterday:', ordersYesterday);

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
      console.log('[ADMIN STATS] Tickets - open:', openTickets, 'new today:', newTicketsToday);
    } catch (err) {
      // Tickets table might not exist yet
      console.log('[ADMIN STATS] Tickets table not available:', err.message);
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
    console.log('[ADMIN STATS] Revenue today:', revenueToday);

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
    console.log('[ADMIN STATS] Revenue yesterday:', revenueYesterday);

    // Pending orders
    const pendingOrders = await prisma.order.count({
      where: {
        statusFulfillment: {
          in: ['NEW', 'PROCESSING']
        }
      }
    });
    console.log('[ADMIN STATS] Pending orders:', pendingOrders);

    // Calculate changes
    const ordersChange = ordersYesterday > 0 
      ? Math.round(((ordersToday - ordersYesterday) / ordersYesterday) * 100)
      : 0;

    const revenueChange = revenueYesterday > 0
      ? Math.round(((revenueToday - revenueYesterday) / revenueYesterday) * 100)
      : 0;

    console.log('[ADMIN STATS] Success - returning stats');

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
    console.error('❌ [ADMIN STATS] Error:', {
      message: error.message,
      stack: error.stack,
      code: error.code,
      meta: error.meta,
    });
    res.status(500).json({ 
      error: 'Failed to fetch statistics',
      message: error.message,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
}
