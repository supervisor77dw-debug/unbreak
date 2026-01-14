/**
 * =====================================================
 * 🔥 MESSE-FIX: Payment Status Mapper
 * =====================================================
 * Single source of truth for payment status normalization
 * Ensures consistent UPPERCASE values across Liste and Details
 * =====================================================
 */

/**
 * Map order status to normalized payment status
 * @param {Object} order - Order object from simple_orders table
 * @returns {string} PAID | PENDING | FAILED | REFUNDED
 */
export function mapPaymentStatus(order) {
  if (!order || !order.status) {
    return 'PENDING';
  }

  const status = String(order.status).toUpperCase().trim();

  // Direct matches (UPPERCASE)
  if (status === 'PAID') return 'PAID';
  if (status === 'PENDING') return 'PENDING';
  if (status === 'FAILED') return 'FAILED';
  if (status === 'REFUNDED') return 'REFUNDED';

  // Stripe-style statuses
  if (status === 'SUCCEEDED' || status === 'COMPLETE' || status === 'COMPLETED') {
    return 'PAID';
  }
  
  if (status === 'PROCESSING' || status === 'REQUIRES_ACTION' || status === 'REQUIRES_PAYMENT_METHOD') {
    return 'PENDING';
  }

  if (status === 'CANCELED' || status === 'CANCELLED') {
    return 'FAILED';
  }

  // Legacy/fallback
  console.warn(`[paymentStatusMapper] Unknown status value: "${order.status}" for order ${order.id || order.order_number}`);
  return 'PENDING';
}

/**
 * Map order status to German display label
 * @param {Object} order - Order object
 * @returns {string} German label
 */
export function mapPaymentStatusLabel(order) {
  const status = mapPaymentStatus(order);
  
  const labels = {
    PAID: 'Bezahlt',
    PENDING: 'Ausstehend',
    FAILED: 'Fehlgeschlagen',
    REFUNDED: 'Erstattet'
  };

  return labels[status] || 'Ausstehend';
}
