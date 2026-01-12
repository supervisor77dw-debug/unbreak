import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../auth/[...nextauth]';
import prisma from '../../../../lib/prisma';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

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
      // Try Prisma first (configurator orders - admin_orders table)
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

      if (order) {
        // ✅ PRISMA IS NOW SINGLE SOURCE - config_json comes from Prisma
        // Return order directly - config_json is already included from Prisma
        return res.status(200).json(order);
      }

      // If not found in orders table, try simple_orders (shop orders)
      const { data: simpleOrder, error: simpleOrderError } = await supabase
        .from('simple_orders')
        .select('*')
        .eq('id', id)
        .single();

      if (simpleOrderError && simpleOrderError.code !== 'PGRST116') {
        // PGRST116 = not found (acceptable), other errors are problems
        console.error('[Admin Orders API] Supabase error:', simpleOrderError);
      }

      if (simpleOrder) {
        // Transform simple_order to match order structure for frontend compatibility
        return res.status(200).json({
          ...simpleOrder,
          // Ensure pricing snapshot fields are accessible
          price_breakdown_json: simpleOrder.price_breakdown_json,
          priceBreakdownJson: simpleOrder.price_breakdown_json, // Alias
          trace_id: simpleOrder.trace_id || simpleOrder.metadata?.trace_id,
          snapshot_id: simpleOrder.snapshot_id || simpleOrder.metadata?.snapshot_id,
          has_snapshot: simpleOrder.has_snapshot || !!simpleOrder.price_breakdown_json,
          // Source indicator
          _source: 'simple_orders',
        });
      }

      // Not found in either table
      return res.status(404).json({ 
        error: 'NOT_FOUND',
        message: 'Order not found in orders or simple_orders tables'
      });
    }

    if (req.method === 'PATCH') {
      // Update order - try both tables
      const updates = req.body;
      
      // Only allow specific fields to be updated
      const allowedFields = ['statusPayment', 'statusFulfillment', 'notes', 'status'];
      const filteredUpdates = {};
      
      for (const field of allowedFields) {
        if (updates[field] !== undefined) {
          filteredUpdates[field] = updates[field];
        }
      }

      // Try Prisma first (admin_orders)
      try {
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
      } catch (prismaError) {
        // Not in Prisma orders table, try simple_orders
        if (prismaError.code === 'P2025') {
          // Record not found in Prisma, try Supabase
          const { data: simpleOrder, error: updateError } = await supabase
            .from('simple_orders')
            .update({
              ...filteredUpdates,
              updated_at: new Date().toISOString(),
            })
            .eq('id', id)
            .select()
            .single();

          if (updateError) {
            console.error('[Admin Orders API] Failed to update simple_order:', updateError);
            return res.status(404).json({ 
              error: 'NOT_FOUND',
              message: 'Order not found in either table for update'
            });
          }

          return res.status(200).json({
            ...simpleOrder,
            price_breakdown_json: simpleOrder.price_breakdown_json,
            priceBreakdownJson: simpleOrder.price_breakdown_json,
            trace_id: simpleOrder.trace_id || simpleOrder.metadata?.trace_id,
            snapshot_id: simpleOrder.snapshot_id || simpleOrder.metadata?.snapshot_id,
            _source: 'simple_orders',
          });
        }
        
        // Other Prisma error
        throw prismaError;
      }
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('Order API error:', error);
    return res.status(500).json({ error: 'Internal server error', details: error.message });
  }
}
