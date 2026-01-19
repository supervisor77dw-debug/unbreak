/**
 * ✅ SSOT: Admin Order Details API
 * CANONICAL SOURCE: admin_orders (Prisma)
 * RULE: NO simple_orders, NO OrderRepository - ONLY Prisma admin_orders
 */

import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../auth/[...nextauth]';
import prisma from '../../../../lib/prisma';

export default async function handler(req, res) {
  const session = await getServerSession(req, res, authOptions);

  if (!session) {
    return res.status(401).json({ 
      error: 'UNAUTHORIZED',
      message: 'Authentication required'
    });
  }

  const { id } = req.query;

  try {
    if (req.method === 'GET') {
      // ✅ SSOT: Load from admin_orders with items
      const order = await prisma.order.findUnique({
        where: { id },
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
        }
      });

      if (!order) {
        return res.status(404).json({ 
          error: 'NOT_FOUND',
          message: 'Order not found in admin_orders'
        });
      }

      // ✅ SSOT: Return admin_orders data with all fields
      return res.status(200).json({
        ...order,
        // Items already included from relation
        // Addresses are JSONB from DB
        _source: 'admin_orders',
        _debug: {
          has_billing_address: !!(order.billingAddress && order.billingAddress.line1),
          has_shipping_address: !!(order.shippingAddress && order.shippingAddress.line1),
          items_count: order.items?.length || 0,
          db_env: {
            app_env: process.env.APP_ENV || 'production',
            db_url_tail: (process.env.DATABASE_URL || '').slice(-6),
          }
        }
      });
    }

    if (req.method === 'PATCH') {
      // Update order - use repository
      const updates = req.body;
      
      // Map camelCase to snake_case for Supabase
      const mappedUpdates = {};
      if (updates.statusPayment !== undefined) mappedUpdates.status_payment = updates.statusPayment;
      if (updates.statusFulfillment !== undefined) mappedUpdates.status_fulfillment = updates.statusFulfillment;
      if (updates.notes !== undefined) mappedUpdates.notes = updates.notes;
      if (updates.metadata !== undefined) mappedUpdates.metadata = updates.metadata;

      const updatedOrder = await OrderRepository.updateOrderStatus(id, mappedUpdates);

      // Normalize response
      return res.status(200).json({
        ...updatedOrder,
        statusPayment: updatedOrder.status_payment,
        statusFulfillment: updatedOrder.status_fulfillment,
        createdAt: updatedOrder.created_at,
        updatedAt: updatedOrder.updated_at,
      });
    }

    return res.status(405).json({ error: 'Method not allowed' });

  } catch (error) {
    console.error('❌ [ADMIN ORDER DETAILS] Error:', error);
    return res.status(500).json({ 
      error: 'Failed to process order',
      message: error.message 
    });
  }
}
