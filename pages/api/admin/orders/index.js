import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../auth/[...nextauth]';
import { requireAuth } from '../../../../lib/auth-helpers';
import prisma from '../../../../lib/prisma';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const user = await requireAuth(req, res);
  if (!user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const {
      page = '1',
      limit = '20',
      statusPayment,
      statusFulfillment,
      search,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const take = parseInt(limit);

    // Build where clause
    const where = {};

    if (statusPayment) {
      where.statusPayment = statusPayment;
    }

    if (statusFulfillment) {
      where.statusFulfillment = statusFulfillment;
    }

    if (search) {
      where.OR = [
        { email: { contains: search, mode: 'insensitive' } },
        { id: { contains: search, mode: 'insensitive' } },
        { stripeCheckoutSessionId: { contains: search, mode: 'insensitive' } },
      ];
    }

    // Get orders with customer
    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        skip,
        take,
        orderBy: { [sortBy]: sortOrder },
        include: {
          customer: {
            select: {
              id: true,
              email: true,
              name: true,
            },
          },
          items: true,
        },
      }),
      prisma.order.count({ where }),
    ]);

    res.status(200).json({
      orders,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / parseInt(limit)),
      },
    });

  } catch (error) {
    console.error('❌ [ADMIN ORDERS] Error:', error);
    res.status(500).json({ error: 'Failed to fetch orders' });
  }
}
