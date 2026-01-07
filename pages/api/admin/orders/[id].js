import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../auth/[...nextauth]';
import prisma from '../../../../lib/prisma';

export default async function handler(req, res) {
  const session = await getServerSession(req, res, authOptions);

  // DEBUG: Log auth status (without exposing secrets)
  console.log('[API /admin/orders/:id] Auth check:', {
    hasSession: !!session,
    method: req.method,
    orderId: req.query.id?.substring(0, 8)
  });

  if (!session) {
    console.log('[API /admin/orders/:id] UNAUTHORIZED - No session');
    return res.status(401).json({ 
      error: 'UNAUTHORIZED',
      message: 'Authentication required'
    });
  }

  const { id } = req.query;

  try {
    if (req.method === 'GET') {
      // Fetch order with all relations from Prisma (SINGLE SOURCE)
      const order = await prisma.order.findUnique({
        where: { id },
        include: {
          customer: true,
          items: true,
          events: {
            orderBy: { createdAt: 'desc' }
          }
        }
      });

      if (!order) {
        console.log('[API /admin/orders/:id] NOT FOUND - Order does not exist');
        return res.status(404).json({ 
          error: 'NOT_FOUND',
          message: 'Order not found'
        });
      }

      // ✅ PRISMA IS NOW SINGLE SOURCE - config_json comes from Prisma
      // Return order directly - config_json is already included from Prisma
      return res.status(200).json(order);
    }

    if (req.method === 'PATCH') {
      // Update order
      const updates = req.body;
      
      // Only allow specific fields to be updated
      const allowedFields = ['statusPayment', 'statusFulfillment', 'notes'];
      const filteredUpdates = {};
      
      for (const field of allowedFields) {
        if (updates[field] !== undefined) {
          filteredUpdates[field] = updates[field];
        }
      }

      const order = await prisma.order.update({
        where: { id },
        data: {
          ...filteredUpdates,
          updatedAt: new Date(),
        },
        include: {
          customer: true,
          items: true,
          events: {
            orderBy: { createdAt: 'desc' }
          }
        }
      });

      // Log status change event
      if (updates.statusPayment || updates.statusFulfillment) {
        await prisma.orderEvent.create({
          data: {
            orderId: order.id,
            type: 'STATUS_CHANGE',
            source: 'admin_ui',
            payload: {
              changed_by: session.user.email,
              changes: filteredUpdates,
              timestamp: new Date().toISOString(),
            },
          },
        });
      }

      return res.status(200).json(order);
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('Order API error:', error);
    return res.status(500).json({ error: 'Internal server error', details: error.message });
  }
}
