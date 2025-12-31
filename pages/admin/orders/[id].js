import { useRouter } from 'next/router';
import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import AdminLayout from '../../../components/AdminLayout';

export default function OrderDetail() {
  const router = useRouter();
  const { id } = router.query;
  const { data: session, status } = useSession();
  
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/admin/login');
    }
  }, [status, router]);

  useEffect(() => {
    if (!id) return;
    
    async function fetchOrder() {
      try {
        const res = await fetch(`/api/admin/orders/${id}`);
        if (!res.ok) {
          throw new Error(`Failed to fetch order: ${res.status}`);
        }
        const data = await res.json();
        setOrder(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    
    fetchOrder();
  }, [id]);

  async function updateStatus(field, value) {
    setUpdating(true);
    try {
      const res = await fetch(`/api/admin/orders/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: value }),
      });
      
      if (!res.ok) throw new Error('Update failed');
      
      const updated = await res.json();
      setOrder(updated);
    } catch (err) {
      alert('Failed to update: ' + err.message);
    } finally {
      setUpdating(false);
    }
  }

  if (status === 'loading' || loading) {
    return (
      <AdminLayout>
        <div className="loading">Loading order...</div>
      </AdminLayout>
    );
  }

  if (error) {
    return (
      <AdminLayout>
        <div className="error-state">
          <h2>Error</h2>
          <p>{error}</p>
          <button onClick={() => router.push('/admin/orders')}>← Back to Orders</button>
        </div>
      </AdminLayout>
    );
  }

  if (!order) {
    return (
      <AdminLayout>
        <div className="error-state">
          <h2>Order not found</h2>
          <button onClick={() => router.push('/admin/orders')}>← Back to Orders</button>
        </div>
      </AdminLayout>
    );
  }

  const formatCurrency = (cents) => {
    return new Intl.NumberFormat('de-DE', {
      style: 'currency',
      currency: order.currency || 'EUR',
    }).format(cents / 100);
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString('de-DE', {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  };

  const getPaymentBadge = (status) => {
    const styles = {
      PAID: { bg: '#065f46', text: '#d1fae5' },
      PENDING: { bg: '#854d0e', text: '#fef3c7' },
      FAILED: { bg: '#991b1b', text: '#fee2e2' },
      REFUNDED: { bg: '#7c2d12', text: '#fed7aa' },
    };
    const style = styles[status] || styles.PENDING;
    return (
      <span style={{
        padding: '4px 12px',
        borderRadius: '6px',
        fontSize: '13px',
        fontWeight: '600',
        backgroundColor: style.bg,
        color: style.text,
      }}>
        {status}
      </span>
    );
  };

  const getFulfillmentBadge = (status) => {
    const styles = {
      NEW: { bg: '#1e3a8a', text: '#dbeafe' },
      PROCESSING: { bg: '#854d0e', text: '#fef3c7' },
      SHIPPED: { bg: '#065f46', text: '#d1fae5' },
      DONE: { bg: '#374151', text: '#e5e7eb' },
      CANCELED: { bg: '#991b1b', text: '#fee2e2' },
    };
    const style = styles[status] || styles.NEW;
    return (
      <span style={{
        padding: '4px 12px',
        borderRadius: '6px',
        fontSize: '13px',
        fontWeight: '600',
        backgroundColor: style.bg,
        color: style.text,
      }}>
        {status}
      </span>
    );
  };

  return (
    <AdminLayout>
      <div className="order-detail">
        <div className="header">
          <button className="back-btn" onClick={() => router.push('/admin/orders')}>
            ← Back
          </button>
          <div className="title-section">
            <h1>Order Details</h1>
            <div className="order-id">ID: {order.id.substring(0, 8)}...</div>
          </div>
        </div>

        <div className="content">
          {/* Status Cards */}
          <div className="status-section">
            <div className="status-card">
              <label>Payment Status</label>
              <select
                value={order.statusPayment}
                onChange={(e) => updateStatus('statusPayment', e.target.value)}
                disabled={updating}
              >
                <option value="PENDING">PENDING</option>
                <option value="PAID">PAID</option>
                <option value="FAILED">FAILED</option>
                <option value="REFUNDED">REFUNDED</option>
              </select>
            </div>

            <div className="status-card">
              <label>Fulfillment Status</label>
              <select
                value={order.statusFulfillment}
                onChange={(e) => updateStatus('statusFulfillment', e.target.value)}
                disabled={updating}
              >
                <option value="NEW">NEW</option>
                <option value="PROCESSING">PROCESSING</option>
                <option value="SHIPPED">SHIPPED</option>
                <option value="DONE">DONE</option>
                <option value="CANCELED">CANCELED</option>
              </select>
            </div>
          </div>

          {/* Customer Info */}
          <div className="info-card">
            <h2>Customer</h2>
            <div className="info-grid">
              <div>
                <strong>Email:</strong>
                <span>{order.email}</span>
              </div>
              {order.shippingName && (
                <div>
                  <strong>Name:</strong>
                  <span>{order.shippingName}</span>
                </div>
              )}
              {order.customer && (
                <div>
                  <strong>Customer ID:</strong>
                  <span>{order.customer.id.substring(0, 8)}...</span>
                </div>
              )}
            </div>
          </div>

          {/* Shipping Address */}
          {order.shippingAddress && (
            <div className="info-card">
              <h2>Shipping Address</h2>
              <div className="address">
                {order.shippingAddress.line1}<br />
                {order.shippingAddress.line2 && <>{order.shippingAddress.line2}<br /></>}
                {order.shippingAddress.postal_code} {order.shippingAddress.city}<br />
                {order.shippingAddress.state && <>{order.shippingAddress.state}<br /></>}
                {order.shippingAddress.country}
              </div>
            </div>
          )}

          {/* Order Items */}
          <div className="info-card">
            <h2>Items</h2>
            <table className="items-table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>SKU</th>
                  <th>Qty</th>
                  <th>Unit Price</th>
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                {order.items?.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <div className="item-name">{item.name}</div>
                      {item.variant && <div className="item-variant">{item.variant}</div>}
                    </td>
                    <td>{item.sku || '—'}</td>
                    <td>{item.qty}</td>
                    <td>{formatCurrency(item.unitPrice)}</td>
                    <td>{formatCurrency(item.totalPrice)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Totals */}
          <div className="info-card">
            <h2>Totals</h2>
            <div className="totals">
              <div className="total-row">
                <span>Subtotal:</span>
                <span>{formatCurrency(order.amountTotal - order.amountShipping - order.amountTax)}</span>
              </div>
              <div className="total-row">
                <span>Shipping:</span>
                <span>{formatCurrency(order.amountShipping)}</span>
              </div>
              <div className="total-row">
                <span>Tax:</span>
                <span>{formatCurrency(order.amountTax)}</span>
              </div>
              <div className="total-row total">
                <span>Total:</span>
                <span>{formatCurrency(order.amountTotal)}</span>
              </div>
            </div>
          </div>

          {/* Payment Info */}
          <div className="info-card">
            <h2>Payment Details</h2>
            <div className="info-grid">
              <div>
                <strong>Stripe Session:</strong>
                <span className="mono">{order.stripeCheckoutSessionId}</span>
              </div>
              {order.stripePaymentIntentId && (
                <div>
                  <strong>Payment Intent:</strong>
                  <span className="mono">{order.stripePaymentIntentId}</span>
                </div>
              )}
              {order.paidAt && (
                <div>
                  <strong>Paid At:</strong>
                  <span>{formatDate(order.paidAt)}</span>
                </div>
              )}
              <div>
                <strong>Created:</strong>
                <span>{formatDate(order.createdAt)}</span>
              </div>
            </div>
          </div>

          {/* Order Events */}
          {order.events && order.events.length > 0 && (
            <div className="info-card">
              <h2>Activity Log</h2>
              <div className="events">
                {order.events.map((event) => (
                  <div key={event.id} className="event">
                    <div className="event-header">
                      <span className="event-type">{event.type}</span>
                      <span className="event-time">{formatDate(event.createdAt)}</span>
                    </div>
                    <div className="event-source">Source: {event.source}</div>
                    {event.payload && (
                      <details className="event-payload">
                        <summary>View details</summary>
                        <pre>{JSON.stringify(event.payload, null, 2)}</pre>
                      </details>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Notes */}
          <div className="info-card">
            <h2>Internal Notes</h2>
            <textarea
              placeholder="Add notes about this order..."
              value={order.notes || ''}
              onChange={(e) => updateStatus('notes', e.target.value)}
              disabled={updating}
              rows={4}
            />
          </div>
        </div>
      </div>

      <style jsx>{`
        .order-detail {
          max-width: 1200px;
          margin: 0 auto;
        }

        .header {
          margin-bottom: 32px;
        }

        .back-btn {
          background: #0a4d4d;
          color: #d4f1f1;
          border: none;
          padding: 8px 16px;
          border-radius: 6px;
          cursor: pointer;
          font-size: 14px;
          margin-bottom: 16px;
          transition: background 0.2s;
        }

        .back-btn:hover {
          background: #0d6666;
        }

        .title-section h1 {
          color: #d4f1f1;
          margin: 0 0 8px 0;
        }

        .order-id {
          color: #94a3b8;
          font-family: monospace;
          font-size: 14px;
        }

        .content {
          display: flex;
          flex-direction: column;
          gap: 24px;
        }

        .status-section {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
          gap: 16px;
        }

        .status-card {
          background: #262626;
          border: 1px solid #404040;
          border-radius: 8px;
          padding: 20px;
        }

        .status-card label {
          display: block;
          color: #94a3b8;
          font-size: 13px;
          font-weight: 600;
          margin-bottom: 8px;
          text-transform: uppercase;
        }

        .status-card select {
          width: 100%;
          background: #1a1a1a;
          border: 1px solid #404040;
          color: #d4f1f1;
          padding: 10px;
          border-radius: 6px;
          font-size: 14px;
          cursor: pointer;
        }

        .status-card select:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .info-card {
          background: #262626;
          border: 1px solid #404040;
          border-radius: 8px;
          padding: 24px;
        }

        .info-card h2 {
          color: #d4f1f1;
          font-size: 18px;
          margin: 0 0 16px 0;
          padding-bottom: 12px;
          border-bottom: 1px solid #404040;
        }

        .info-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
          gap: 16px;
        }

        .info-grid > div {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .info-grid strong {
          color: #94a3b8;
          font-size: 13px;
          font-weight: 600;
        }

        .info-grid span {
          color: #d4f1f1;
          font-size: 14px;
        }

        .mono {
          font-family: monospace;
          font-size: 12px;
          word-break: break-all;
        }

        .address {
          color: #d4f1f1;
          line-height: 1.6;
        }

        .items-table {
          width: 100%;
          border-collapse: collapse;
        }

        .items-table th {
          text-align: left;
          padding: 12px;
          background: #1a1a1a;
          color: #94a3b8;
          font-size: 13px;
          font-weight: 600;
          text-transform: uppercase;
          border-bottom: 1px solid #404040;
        }

        .items-table td {
          padding: 12px;
          color: #d4f1f1;
          border-bottom: 1px solid #333;
        }

        .item-name {
          font-weight: 500;
        }

        .item-variant {
          color: #94a3b8;
          font-size: 13px;
          margin-top: 4px;
        }

        .totals {
          display: flex;
          flex-direction: column;
          gap: 8px;
          max-width: 400px;
          margin-left: auto;
        }

        .total-row {
          display: flex;
          justify-content: space-between;
          color: #d4f1f1;
          padding: 8px 0;
        }

        .total-row.total {
          border-top: 2px solid #0a4d4d;
          margin-top: 8px;
          padding-top: 16px;
          font-size: 18px;
          font-weight: 600;
          color: #d4f1f1;
        }

        .events {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .event {
          background: #1a1a1a;
          border: 1px solid #333;
          border-radius: 6px;
          padding: 12px;
        }

        .event-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 8px;
        }

        .event-type {
          background: #0a4d4d;
          color: #d4f1f1;
          padding: 4px 8px;
          border-radius: 4px;
          font-size: 12px;
          font-weight: 600;
        }

        .event-time {
          color: #94a3b8;
          font-size: 13px;
        }

        .event-source {
          color: #94a3b8;
          font-size: 13px;
          margin-bottom: 8px;
        }

        .event-payload summary {
          color: #0a4d4d;
          cursor: pointer;
          font-size: 13px;
          margin-bottom: 8px;
        }

        .event-payload pre {
          background: #000;
          color: #22c55e;
          padding: 12px;
          border-radius: 4px;
          font-size: 12px;
          overflow-x: auto;
          margin: 0;
        }

        textarea {
          width: 100%;
          background: #1a1a1a;
          border: 1px solid #404040;
          color: #d4f1f1;
          padding: 12px;
          border-radius: 6px;
          font-family: inherit;
          font-size: 14px;
          resize: vertical;
        }

        textarea:disabled {
          opacity: 0.5;
        }

        .loading, .error-state {
          text-align: center;
          padding: 48px;
          color: #94a3b8;
        }

        .error-state h2 {
          color: #ef4444;
          margin-bottom: 16px;
        }

        .error-state button {
          background: #0a4d4d;
          color: #d4f1f1;
          border: none;
          padding: 10px 20px;
          border-radius: 6px;
          cursor: pointer;
          font-size: 14px;
          margin-top: 16px;
        }
      `}</style>
    </AdminLayout>
  );
}

export async function getServerSideProps(context) {
  return { props: {} };
}
