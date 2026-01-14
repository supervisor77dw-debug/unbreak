/**
 * 🔥 MESSE-MVP: Admin Order Details API
 * CANONICAL SOURCE: simple_orders (Supabase) via OrderRepository
 * RULE: NO PRISMA, NO FALLBACK, only Supabase
 */

import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../auth/[...nextauth]';
import { OrderRepository } from '../../../../lib/repositories';
import { mapPaymentStatus } from '../../../../lib/utils/paymentStatusMapper';

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
      // 🔥 USE REPOSITORY - SINGLE SOURCE (simple_orders only)
      const order = await OrderRepository.getOrderById(id);

      if (!order) {
        return res.status(404).json({ 
          error: 'NOT_FOUND',
          message: 'Order not found in canonical orders table'
        });
      }

      // Normalize field names for frontend compatibility
      return res.status(200).json({
        ...order,
        
        // ORDER IDENTIFICATION - All IDs normalized
        id: order.id,
        order_number: order.order_number,
        public_id: order.public_id,
        
        // Pricing snapshot fields (ensure proper parsing)
        price_breakdown_json: order.price_breakdown_json,
        priceBreakdownJson: order.price_breakdown_json,
        trace_id: order.trace_id || order.metadata?.trace_id,
        snapshot_id: order.snapshot_id || order.metadata?.snapshot_id,
        has_snapshot: !!order.price_breakdown_json && !!order.price_breakdown_json.items,
        
        // Field name normalization
        stripeCheckoutSessionId: order.stripe_checkout_session_id || order.stripe_session_id,
        stripe_checkout_session_id: order.stripe_checkout_session_id || order.stripe_session_id,
        
        // Timestamps (normalize to camelCase)
        createdAt: order.created_at,
        updatedAt: order.updated_at,
        created_at: order.created_at,
        updated_at: order.updated_at,
        
        // Amounts (already in cents)
        amountTotal: order.total_amount_cents,
        totalGross: order.total_amount_cents,
        
        // Customer info
        customerId: order.customer_id,
        email: order.customer_email,
        customer: order.customers,
        
        // 🔥 MESSE-FIX: PAYMENT STATUS - Single source mapper (UPPERCASE)
        statusPayment: mapPaymentStatus(order),
        statusFulfillment: order.status_fulfillment || 'NEW',
        
        // Source indicator
        _source: 'simple_orders',
        
        // DEBUG INFO - All identifiers and tracking IDs
        _debug: {
          uuid: order.id,
          order_number: order.order_number || '(not set)',
          public_id: order.public_id || '(not set)',
          stripe_session_id: order.stripe_session_id || order.stripe_checkout_session_id || '(not set)',
          stripe_payment_intent: order.stripe_payment_intent_id || '(not set)',
          trace_id: order.trace_id || '(not set)',
          snapshot_id: order.snapshot_id || '(not set)',
          has_snapshot: !!order.price_breakdown_json && !!order.price_breakdown_json.items,
          customer_id: order.customer_id || '(not set)',
          created_at: order.created_at,
          // 🔥 MESSE-FIX: Payment status
          status_raw: order.status,
          status_mapped: mapPaymentStatus(order),
          status_fulfillment_raw: order.status_fulfillment,
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
