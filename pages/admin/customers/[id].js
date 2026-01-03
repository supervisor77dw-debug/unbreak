import { useSession } from 'next-auth/react';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import AdminLayout from '../../../components/AdminLayout';

export async function getServerSideProps() {
  return { props: {} };
}

export default function CustomerDetailPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { id } = router.query;
  
  const [customer, setCustomer] = useState(null);
  const [orders, setOrders] = useState([]);
  const [simpleOrders, setSimpleOrders] = useState([]);
  const [tickets, setTickets] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('orders'); // orders | tickets

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/admin/login');
    }
  }, [status, router]);

  useEffect(() => {
    if (session && id) {
      fetchCustomerDetails();
    }
  }, [session, id]);

  const fetchCustomerDetails = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/customers/${id}`);
      if (res.ok) {
        const data = await res.json();
        setCustomer(data.customer);
        setOrders(data.orders || []);
        setSimpleOrders(data.simple_orders || []);
        setTickets(data.tickets || []);
        setStats(data.stats);
      } else {
        console.error('Failed to fetch customer:', res.status);
        if (res.status === 404) {
          router.push('/admin/customers');
        }
      }
    } catch (err) {
      console.error('Failed to fetch customer:', err);
    } finally {
      setLoading(false);
    }
  };

  if (status === 'loading' || !session || loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: '#0f0f0f', color: '#fff' }}>
        Wird geladen...
      </div>
    );
  }

  if (!customer) {
    return (
      <AdminLayout>
        <div className="admin-empty">
          <p>Kunde nicht gefunden</p>
          <Link href="/admin/customers" style={{ color: '#0a4d4d' }}>← Zurück zur Übersicht</Link>
        </div>
      </AdminLayout>
    );
  }

  const formatDate = (date) => {
    if (!date) return '—';
    return new Date(date).toLocaleDateString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatCurrency = (cents) => {
    return `€${(cents / 100).toFixed(2)}`;
  };

  const getStatusBadgeClass = (status) => {
    const statusMap = {
      paid: 'status-paid',
      completed: 'status-completed',
      pending_payment: 'status-pending',
      shipped: 'status-shipped',
      delivered: 'status-delivered',
      cancelled: 'status-cancelled',
    };
    return statusMap[status] || 'status-default';
  };

  const getTicketStatusBadgeClass = (status) => {
    const statusMap = {
      open: 'ticket-open',
      in_progress: 'ticket-progress',
      waiting: 'ticket-waiting',
      resolved: 'ticket-resolved',
      closed: 'ticket-closed',
    };
    return statusMap[status] || 'ticket-default';
  };

  const getPriorityBadgeClass = (priority) => {
    const priorityMap = {
      urgent: 'priority-urgent',
      high: 'priority-high',
      medium: 'priority-medium',
      low: 'priority-low',
    };
    return priorityMap[priority] || 'priority-default';
  };

  const allOrders = [...orders, ...simpleOrders].sort((a, b) => 
    new Date(b.created_at) - new Date(a.created_at)
  );

  return (
    <AdminLayout>
      <Head>
        <title>{customer.name || customer.email} - Kunden - Admin - UNBREAK ONE</title>
      </Head>

      <div className="admin-header">
        <Link href="/admin/customers" className="back-link">
          ← Zurück zu Kunden
        </Link>
        <h1>{customer.name || customer.email}</h1>
        {customer.name && <p className="email-subtitle">{customer.email}</p>}
      </div>

      {/* Customer Info Cards */}
      <div className="info-grid">
        <div className="info-card">
          <div className="info-label">Kontakt</div>
          <div className="info-value">
            <div>{customer.email}</div>
            {customer.phone && <div>{customer.phone}</div>}
          </div>
        </div>

        <div className="info-card">
          <div className="info-label">Stripe Customer ID</div>
          <div className="info-value">
            {customer.stripe_customer_id ? (
              <code>{customer.stripe_customer_id}</code>
            ) : (
              <span style={{ color: '#666' }}>Nicht verknüpft</span>
            )}
          </div>
        </div>

        <div className="info-card">
          <div className="info-label">Bestellungen</div>
          <div className="info-value stat">{stats?.total_orders || 0}</div>
        </div>

        <div className="info-card">
          <div className="info-label">Gesamtumsatz</div>
          <div className="info-value stat revenue">{formatCurrency(stats?.total_spent_cents || 0)}</div>
        </div>

        <div className="info-card">
          <div className="info-label">Offene Tickets</div>
          <div className="info-value stat">{stats?.open_tickets || 0}</div>
        </div>

        <div className="info-card">
          <div className="info-label">Kunde seit</div>
          <div className="info-value">{formatDate(customer.created_at)}</div>
        </div>
      </div>

      {/* Shipping Address */}
      {customer.default_shipping && (
        <div className="address-section">
          <h3>Standard-Lieferadresse</h3>
          <div className="address-card">
            {customer.default_shipping.name && <div><strong>{customer.default_shipping.name}</strong></div>}
            {customer.default_shipping.line1 && <div>{customer.default_shipping.line1}</div>}
            {customer.default_shipping.line2 && <div>{customer.default_shipping.line2}</div>}
            {(customer.default_shipping.postal_code || customer.default_shipping.city) && (
              <div>
                {customer.default_shipping.postal_code} {customer.default_shipping.city}
              </div>
            )}
            {customer.default_shipping.country && <div>{customer.default_shipping.country}</div>}
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="tabs">
        <button 
          className={`tab ${activeTab === 'orders' ? 'active' : ''}`}
          onClick={() => setActiveTab('orders')}
        >
          Bestellungen ({allOrders.length})
        </button>
        <button 
          className={`tab ${activeTab === 'tickets' ? 'active' : ''}`}
          onClick={() => setActiveTab('tickets')}
        >
          Tickets ({tickets.length})
        </button>
      </div>

      {/* Orders Tab */}
      {activeTab === 'orders' && (
        <div className="tab-content">
          {allOrders.length === 0 ? (
            <div className="empty-state">
              <p>Noch keine Bestellungen</p>
            </div>
          ) : (
            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Bestellnummer</th>
                    <th>Typ</th>
                    <th>Status</th>
                    <th>Betrag</th>
                    <th>Datum</th>
                    <th>Aktionen</th>
                  </tr>
                </thead>
                <tbody>
                  {allOrders.map((order) => (
                    <tr key={order.id}>
                      <td>
                        <code>{order.order_number || order.id.substring(0, 8)}</code>
                      </td>
                      <td>
                        <span className="order-type">
                          {order.order_number ? 'Konfigurator' : 'Shop'}
                        </span>
                      </td>
                      <td>
                        <span className={`status-badge ${getStatusBadgeClass(order.status)}`}>
                          {order.status}
                        </span>
                      </td>
                      <td className="currency">
                        {formatCurrency(order.total_cents || order.total_amount_cents || 0)}
                      </td>
                      <td className="date-cell">
                        {formatDate(order.created_at)}
                      </td>
                      <td>
                        <Link 
                          href={`/admin/orders/${order.id}`} 
                          className="action-link"
                        >
                          Details →
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Tickets Tab */}
      {activeTab === 'tickets' && (
        <div className="tab-content">
          {tickets.length === 0 ? (
            <div className="empty-state">
              <p>Keine Tickets vorhanden</p>
            </div>
          ) : (
            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Ticket-Nr.</th>
                    <th>Betreff</th>
                    <th>Kategorie</th>
                    <th>Status</th>
                    <th>Priorität</th>
                    <th>Erstellt</th>
                    <th>Aktionen</th>
                  </tr>
                </thead>
                <tbody>
                  {tickets.map((ticket) => (
                    <tr key={ticket.id}>
                      <td>
                        <code>{ticket.ticket_number}</code>
                      </td>
                      <td>{ticket.subject}</td>
                      <td>
                        <span className="category-badge">{ticket.category}</span>
                      </td>
                      <td>
                        <span className={`status-badge ${getTicketStatusBadgeClass(ticket.status)}`}>
                          {ticket.status}
                        </span>
                      </td>
                      <td>
                        <span className={`priority-badge ${getPriorityBadgeClass(ticket.priority)}`}>
                          {ticket.priority}
                        </span>
                      </td>
                      <td className="date-cell">
                        {formatDate(ticket.created_at)}
                      </td>
                      <td>
                        <Link 
                          href={`/admin/tickets/${ticket.id}`} 
                          className="action-link"
                        >
                          Öffnen →
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      <style jsx>{`
        .admin-header {
          margin-bottom: 30px;
        }

        .back-link {
          color: #0a4d4d;
          text-decoration: none;
          font-size: 14px;
          display: inline-block;
          margin-bottom: 16px;
        }

        .back-link:hover {
          text-decoration: underline;
        }

        .admin-header h1 {
          color: #fff;
          font-size: 32px;
          font-weight: 700;
          margin: 0;
        }

        .email-subtitle {
          color: #666;
          font-size: 16px;
          margin: 8px 0 0 0;
        }

        .info-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 16px;
          margin-bottom: 30px;
        }

        .info-card {
          background: #1a1a1a;
          border: 1px solid #2a2a2a;
          border-radius: 12px;
          padding: 20px;
        }

        .info-label {
          color: #999;
          font-size: 12px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          margin-bottom: 8px;
        }

        .info-value {
          color: #fff;
          font-size: 16px;
          font-weight: 600;
        }

        .info-value code {
          background: #222;
          padding: 4px 8px;
          border-radius: 4px;
          font-size: 13px;
          color: #0a4d4d;
        }

        .info-value.stat {
          font-size: 28px;
          color: #0a4d4d;
        }

        .info-value.revenue {
          color: #0a9d0a;
        }

        .address-section {
          margin-bottom: 30px;
        }

        .address-section h3 {
          color: #fff;
          font-size: 18px;
          margin-bottom: 12px;
        }

        .address-card {
          background: #1a1a1a;
          border: 1px solid #2a2a2a;
          border-radius: 8px;
          padding: 16px;
          color: #ddd;
          font-size: 14px;
          line-height: 1.6;
        }

        .tabs {
          display: flex;
          gap: 8px;
          margin-bottom: 24px;
          border-bottom: 1px solid #2a2a2a;
        }

        .tab {
          background: transparent;
          border: none;
          border-bottom: 2px solid transparent;
          color: #666;
          padding: 12px 24px;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }

        .tab:hover {
          color: #999;
        }

        .tab.active {
          color: #0a4d4d;
          border-bottom-color: #0a4d4d;
        }

        .tab-content {
          margin-top: 24px;
        }

        .table-container {
          background: #1a1a1a;
          border: 1px solid #2a2a2a;
          border-radius: 12px;
          overflow: hidden;
        }

        .data-table {
          width: 100%;
          border-collapse: collapse;
        }

        .data-table thead {
          background: #222;
        }

        .data-table th {
          color: #999;
          font-size: 13px;
          font-weight: 600;
          text-align: left;
          padding: 14px 16px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .data-table td {
          color: #ddd;
          font-size: 14px;
          padding: 16px;
          border-top: 1px solid #2a2a2a;
        }

        .data-table tbody tr:hover {
          background: #222;
        }

        .status-badge, .priority-badge, .category-badge {
          display: inline-block;
          padding: 4px 10px;
          border-radius: 12px;
          font-size: 12px;
          font-weight: 600;
          text-transform: uppercase;
        }

        .status-paid, .status-completed { background: #0a4d1a; color: #0f0; }
        .status-pending { background: #4d4d0a; color: #ff0; }
        .status-shipped { background: #0a3d4d; color: #0ff; }
        .status-delivered { background: #0a4d0a; color: #0f0; }
        .status-cancelled { background: #4d0a0a; color: #f00; }
        .status-default { background: #2a2a2a; color: #999; }

        .ticket-open { background: #4d4d0a; color: #ff0; }
        .ticket-progress { background: #0a3d4d; color: #0ff; }
        .ticket-waiting { background: #4d4d0a; color: #fa0; }
        .ticket-resolved { background: #0a4d1a; color: #0f0; }
        .ticket-closed { background: #2a2a2a; color: #999; }

        .priority-urgent { background: #4d0a0a; color: #f00; }
        .priority-high { background: #4d2a0a; color: #f90; }
        .priority-medium { background: #4d4d0a; color: #ff0; }
        .priority-low { background: #2a2a2a; color: #999; }

        .category-badge {
          background: #2a2a2a;
          color: #999;
        }

        .order-type {
          background: #222;
          padding: 4px 8px;
          border-radius: 4px;
          font-size: 12px;
          color: #0a4d4d;
        }

        .currency {
          font-family: monospace;
          font-weight: 600;
          color: #0a9d0a;
        }

        .date-cell {
          color: #999;
          font-size: 13px;
          font-family: monospace;
        }

        .action-link {
          color: #0a4d4d;
          text-decoration: none;
          font-weight: 500;
          font-size: 13px;
        }

        .action-link:hover {
          text-decoration: underline;
        }

        .empty-state {
          text-align: center;
          padding: 60px 20px;
          color: #666;
          font-size: 16px;
        }

        @media (max-width: 768px) {
          .info-grid {
            grid-template-columns: 1fr;
          }

          .table-container {
            overflow-x: auto;
          }

          .tabs {
            overflow-x: auto;
          }
        }
      `}</style>
    </AdminLayout>
  );
}
