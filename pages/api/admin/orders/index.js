/**
 * ✅ SSOT: Admin Orders List API
 * CANONICAL SOURCE: admin_orders (Prisma)
 * RULE: NO simple_orders, NO OrderRepository - ONLY Prisma admin_orders
 */

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

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const offset = (pageNum - 1) * limitNum;

    // Build where filter
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
        { shippingName: { contains: search, mode: 'insensitive' } },
      ];
    }

    // ✅ SSOT: Fetch from admin_orders (Prisma)
    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        include: {
          items: {
            select: {
              id: true,
              sku: true,
              name: true,
              variant: true,
              qty: true,
              unitPrice: true,
              totalPrice: true,
            }
          }
        },
        orderBy: {
          [sortBy]: sortOrder,
        },
        skip: offset,
        take: limitNum,
      }),
      prisma.order.count({ where }),
    ]);

    res.status(200).json({
      orders,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum),
      },
    });

  } catch (error) {
    console.error('❌ [ADMIN ORDERS] Error:', error);
    res.status(500).json({ error: 'Failed to fetch orders', details: error.message });
  }
}
