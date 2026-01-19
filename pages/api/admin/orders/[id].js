/**
 * ✅ SSOT: Admin Order Details API
 * CANONICAL SOURCE: simple_orders (Supabase)
 * UPDATED: 2026-01-19 - Switched from admin_orders to simple_orders
 */

import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../auth/[...nextauth]';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

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
      // ✅ SSOT: Load from simple_orders
      const { data: order, error } = await supabase
        .from('simple_orders')
        .select('*')
        .eq('id', id)
        .single();

      if (error || !order) {
        return res.status(404).json({ 
          error: 'NOT_FOUND',
          message: 'Order not found in simple_orders'
        });
      }

      // Transform to match Admin UI expectations
      return res.status(200).json({
        id: order.id,
        order_number: order.order_number,
        email: order.customer_email,
        shippingName: order.customer_name,
        customer: {
          name: order.customer_name,
          email: order.customer_email,
          phone: order.customer_phone
        },
        statusPayment: (order.status || 'pending').toUpperCase(),
        statusFulfillment: (order.fulfillment_status || 'NEW').toUpperCase(),
        amountTotal: order.total_amount_cents,
        totalGross: order.total_amount_cents,
        subtotalNet: order.subtotal_cents || order.total_amount_cents,
        amountShipping: order.shipping_cents || 0,
        taxAmount: order.tax_cents || 0,
        currency: order.currency || 'EUR',
        items: order.items || [],
        shippingAddress: order.shipping_address,
        billingAddress: order.billing_address,
        createdAt: order.created_at,
        updatedAt: order.updated_at,
        paidAt: order.paid_at,
        stripeSessionId: order.stripe_session_id,
        stripePaymentIntentId: order.stripe_payment_intent_id,
        customerEmailSentAt: order.customer_email_sent_at,
        adminEmailSentAt: order.admin_email_sent_at,
        emailStatus: order.email_status,
        notes: order.notes,
        _source: 'simple_orders',
        _debug: {
          has_billing_address: !!(order.billing_address && order.billing_address.line1),
          has_shipping_address: !!(order.shipping_address && order.shipping_address.line1),
          items_count: order.items?.length || 0,
        }
      });
    }

    if (req.method === 'PATCH') {
      // Update order
      const updates = req.body;
      
      // Map camelCase to snake_case for Supabase
      const mappedUpdates = {
        updated_at: new Date().toISOString()
      };
      if (updates.statusPayment !== undefined) mappedUpdates.status = updates.statusPayment.toLowerCase();
      if (updates.statusFulfillment !== undefined) mappedUpdates.fulfillment_status = updates.statusFulfillment.toLowerCase();
      if (updates.notes !== undefined) mappedUpdates.notes = updates.notes;

      const { data: updatedOrder, error } = await supabase
        .from('simple_orders')
        .update(mappedUpdates)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        throw error;
      }

      return res.status(200).json({
        ...updatedOrder,
        statusPayment: (updatedOrder.status || 'pending').toUpperCase(),
        statusFulfillment: (updatedOrder.fulfillment_status || 'NEW').toUpperCase(),
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
