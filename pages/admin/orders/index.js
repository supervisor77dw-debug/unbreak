import { useSession } from 'next-auth/react';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import AdminLayout from '../../../components/AdminLayout';

export async function getServerSideProps() {
  return { props: {} };
}

export default function AdminOrders() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    statusPayment: '',
    statusFulfillment: '',
    search: '',
  });
  const [pagination, setPagination] = useState({
    page: 1,
    total: 0,
    totalPages: 0,
  });
  const [selectedOrders, setSelectedOrders] = useState([]);
  const [bulkAction, setBulkAction] = useState('');

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/admin/login');
    }
  }, [status, router]);

  useEffect(() => {
    if (session) {
      fetchOrders();
    }
  }, [session, filters, pagination.page]);

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: '20',
        ...(filters.statusPayment && { statusPayment: filters.statusPayment }),
        ...(filters.statusFulfillment && { statusFulfillment: filters.statusFulfillment }),
        ...(filters.search && { search: filters.search }),
      });

      const res = await fetch(`/api/admin/orders?${params}`);
      if (res.ok) {
        const data = await res.json();
        setOrders(data.orders);
        setPagination(data.pagination);
      }
    } catch (err) {
      console.error('Failed to fetch orders:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = () => {
    window.location.href = '/api/admin/orders/export?format=csv';
  };

  const toggleSelectOrder = (orderId) => {
    setSelectedOrders((prev) =>
      prev.includes(orderId)
        ? prev.filter((id) => id !== orderId)
        : [...prev, orderId]
    );
  };

  const toggleSelectAll = () => {
    if (selectedOrders.length === orders.length) {
      setSelectedOrders([]);
    } else {
      setSelectedOrders(orders.map((o) => o.id));
    }
  };

  const handleBulkAction = async () => {
    if (!bulkAction || selectedOrders.length === 0) {
      return;
    }

    const confirmMsg = `${selectedOrders.length} Bestellung(en) auf "${bulkAction}" setzen?`;
    if (!confirm(confirmMsg)) {
      return;
    }

    try {
      const promises = selectedOrders.map((orderId) =>
        fetch(`/api/admin/orders/${orderId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            statusFulfillment: bulkAction,
          }),
        })
      );

      await Promise.all(promises);
      
      // Refresh orders
      fetchOrders();
      setSelectedOrders([]);
      setBulkAction('');
      alert('Bestellungen erfolgreich aktualisiert');
    } catch (err) {
      alert('Fehler beim Aktualisieren: ' + err.message);
    }
  };

  if (status === 'loading' || !session) {
    return <div>Loading...</div>;
  }

  const formatPrice = (cents) => `€${(cents / 100).toFixed(2)}`;
  const formatDate = (date) => new Date(date).toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  const getStatusBadge = (status, type) => {
    const colors = {
      payment: {
        PENDING: '#fbbf24',
        PAID: '#4ade80',
        FAILED: '#ef4444',
        REFUNDED: '#a855f7',
        PARTIALLY_REFUNDED: '#f59e0b',
      },
      fulfillment: {
        NEW: '#60a5fa',
        PROCESSING: '#fbbf24',
        SHIPPED: '#34d399',
        DONE: '#4ade80',
        CANCELED: '#ef4444',
      },
    };

    return colors[type]?.[status] || '#999';
  };

  return (
    <>
      <Head>
        <title>Bestellungen - Admin - UNBREAK ONE</title>
      </Head>
      <AdminLayout>
        <div className="admin-page-header">
          <div>
            <h1>Bestellungen</h1>
            <p>Kundenbestellungen und Versand verwalten</p>
          </div>
          <button onClick={handleExport} className="export-button">
            📥 Als CSV exportieren
          </button>
        </div>

        <div className="admin-filters">
          <input
            type="text"
            placeholder="Suche nach E-Mail, Bestellnummer..."
            value={filters.search}
            onChange={(e) => setFilters({ ...filters, search: e.target.value })}
            className="admin-search-input"
          />

          <select
            value={filters.statusPayment}
            onChange={(e) => setFilters({ ...filters, statusPayment: e.target.value })}
            className="admin-filter-select"
          >
            <option value="">Alle Zahlungsstatus</option>
            <option value="PENDING">Ausstehend</option>
            <option value="PAID">Bezahlt</option>
            <option value="FAILED">Fehlgeschlagen</option>
            <option value="REFUNDED">Erstattet</option>
          </select>

          <select
            value={filters.statusFulfillment}
            onChange={(e) => setFilters({ ...filters, statusFulfillment: e.target.value })}
            className="admin-filter-select"
          >
            <option value="">Alle Versandstatus</option>
            <option value="NEW">Neu</option>
            <option value="PROCESSING">In Bearbeitung</option>
            <option value="SHIPPED">Versandt</option>
            <option value="DONE">Abgeschlossen</option>
            <option value="CANCELED">Storniert</option>
          </select>
        </div>

        {selectedOrders.length > 0 && (
          <div className="bulk-actions">
            <span className="bulk-count">{selectedOrders.length} ausgewählt</span>
            <select
              value={bulkAction}
              onChange={(e) => setBulkAction(e.target.value)}
              className="bulk-select"
            >
              <option value="">Aktion wählen...</option>
              <option value="PROCESSING">→ In Bearbeitung</option>
              <option value="SHIPPED">→ Versandt</option>
              <option value="DONE">→ Abgeschlossen</option>
              <option value="CANCELED">→ Stornieren</option>
            </select>
            <button onClick={handleBulkAction} className="bulk-button" disabled={!bulkAction}>
              Anwenden
            </button>
          </div>
        )}

        {loading ? (
          <div className="admin-loading">Bestellungen werden geladen...</div>
        ) : orders.length === 0 ? (
          <div className="admin-empty">
            <p>Keine Bestellungen gefunden</p>
          </div>
        ) : (
          <>
            <div className="admin-table-container">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>
                      <input
                        type="checkbox"
                        checked={selectedOrders.length === orders.length && orders.length > 0}
                        onChange={toggleSelectAll}
                      />
                    </th>
                    <th>Bestellnr.</th>
                    <th>Kunde</th>
                    <th>Artikel</th>
                    <th>Gesamt</th>
                    <th>Zahlung</th>
                    <th>Versand</th>
                    <th>Datum</th>
                    <th>Aktionen</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((order) => (
                    <tr key={order.id}>
                      <td>
                        <input
                          type="checkbox"
                          checked={selectedOrders.includes(order.id)}
                          onChange={() => toggleSelectOrder(order.id)}
                        />
                      </td>
                      <td>
                        <Link href={`/admin/orders/${order.id}`} className="order-id-link">
                          {order.id.substring(0, 8)}...
                        </Link>
                      </td>
                      <td>
                        <div className="customer-cell">
                          <div className="customer-name">{order.customer.name || 'N/A'}</div>
                          <div className="customer-email">{order.customer.email}</div>
                        </div>
                      </td>
                      <td>{order.items.length} Artikel</td>
                      <td className="amount-cell">{formatPrice(order.amountTotal)}</td>
                      <td>
                        <span
                          className="status-badge"
                          style={{ backgroundColor: getStatusBadge(order.statusPayment, 'payment') }}
                        >
                          {order.statusPayment === 'PENDING' ? 'Ausstehend' : order.statusPayment === 'PAID' ? 'Bezahlt' : order.statusPayment === 'FAILED' ? 'Fehlgeschlagen' : order.statusPayment === 'REFUNDED' ? 'Erstattet' : order.statusPayment}
                        </span>
                      </td>
                      <td>
                        <span
                          className="status-badge"
                          style={{ backgroundColor: getStatusBadge(order.statusFulfillment, 'fulfillment') }}
                        >
                          {order.statusFulfillment === 'NEW' ? 'Neu' : order.statusFulfillment === 'PROCESSING' ? 'In Bearbeitung' : order.statusFulfillment === 'SHIPPED' ? 'Versandt' : order.statusFulfillment === 'DONE' ? 'Abgeschlossen' : order.statusFulfillment === 'CANCELED' ? 'Storniert' : order.statusFulfillment}
                        </span>
                      </td>
                      <td className="date-cell">{formatDate(order.createdAt)}</td>
                      <td>
                        <Link href={`/admin/orders/${order.id}`} className="action-link">
                          Ansehen →
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {pagination.totalPages > 1 && (
              <div className="admin-pagination">
                <button
                  onClick={() => setPagination({ ...pagination, page: pagination.page - 1 })}
                  disabled={pagination.page === 1}
                  className="pagination-button"
                >
                  ← Zurück
                </button>
                <span className="pagination-info">
                  Seite {pagination.page} von {pagination.totalPages} ({pagination.total} gesamt)
                </span>
                <button
                  onClick={() => setPagination({ ...pagination, page: pagination.page + 1 })}
                  disabled={pagination.page >= pagination.totalPages}
                  className="pagination-button"
                >
                  Weiter →
                </button>
              </div>
            )}
          </>
        )}

        <style jsx>{`
          .admin-page-header {
            margin-bottom: 30px;
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            gap: 20px;
          }

          .admin-page-header h1 {
            color: #fff;
            font-size: 32px;
            font-weight: 700;
            margin: 0 0 8px 0;
          }

          .admin-page-header p {
            color: #666;
            margin: 0;
          }

          .export-button {
            background: #0a4d4d;
            color: #d4f1f1;
            border: none;
            border-radius: 6px;
            padding: 10px 20px;
            font-size: 14px;
            font-weight: 500;
            cursor: pointer;
            transition: all 0.2s;
            white-space: nowrap;
          }

          .export-button:hover {
            background: #0d6666;
            transform: translateY(-1px);
          }

          .admin-filters {
            display: flex;
            gap: 12px;
            margin-bottom: 24px;
            flex-wrap: wrap;
          }

          .admin-search-input,
          .admin-filter-select {
            background: #1a1a1a;
            border: 1px solid #2a2a2a;
            border-radius: 6px;
            color: #fff;
            font-size: 14px;
            padding: 10px 14px;
          }

          .admin-search-input {
            flex: 1;
            min-width: 250px;
          }

          .admin-filter-select {
            min-width: 180px;
          }

          .admin-search-input:focus,
          .admin-filter-select:focus {
            outline: none;
            border-color: #0a4d4d;
          }

          .bulk-actions {
            display: flex;
            align-items: center;
            gap: 12px;
            background: #1a1a1a;
            border: 1px solid #2a2a2a;
            border-radius: 6px;
            padding: 12px 16px;
            margin-bottom: 24px;
          }

          .bulk-count {
            color: #0a4d4d;
            font-weight: 600;
            font-size: 14px;
          }

          .bulk-select {
            background: #222;
            border: 1px solid #2a2a2a;
            border-radius: 6px;
            color: #fff;
            font-size: 14px;
            padding: 8px 12px;
            min-width: 200px;
          }

          .bulk-button {
            background: #0a4d4d;
            color: #d4f1f1;
            border: none;
            border-radius: 6px;
            padding: 8px 16px;
            font-size: 14px;
            font-weight: 500;
            cursor: pointer;
            transition: all 0.2s;
          }

          .bulk-button:hover:not(:disabled) {
            background: #0d6666;
          }

          .bulk-button:disabled {
            opacity: 0.5;
            cursor: not-allowed;
          }

          .admin-table-container {
            background: #1a1a1a;
            border: 1px solid #2a2a2a;
            border-radius: 12px;
            overflow: hidden;
            margin-bottom: 24px;
          }

          .admin-table {
            width: 100%;
            border-collapse: collapse;
          }

          .admin-table thead {
            background: #222;
          }

          .admin-table th {
            color: #999;
            font-size: 13px;
            font-weight: 600;
            text-align: left;
            padding: 14px 16px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          }

          .admin-table td {
            color: #ddd;
            font-size: 14px;
            padding: 16px;
            border-top: 1px solid #2a2a2a;
          }

          .admin-table tbody tr:hover {
            background: #222;
          }

          .order-id-link {
            color: #0a4d4d;
            text-decoration: none;
            font-family: monospace;
            font-weight: 600;
          }

          .order-id-link:hover {
            text-decoration: underline;
          }

          .customer-cell {
            display: flex;
            flex-direction: column;
            gap: 4px;
          }

          .customer-name {
            font-weight: 500;
          }

          .customer-email {
            color: #999;
            font-size: 13px;
          }

          .amount-cell {
            font-weight: 600;
            font-family: monospace;
          }

          .status-badge {
            display: inline-block;
            padding: 4px 10px;
            border-radius: 4px;
            font-size: 12px;
            font-weight: 600;
            color: #000;
            text-transform: uppercase;
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

          .admin-pagination {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 20px;
            padding: 20px;
          }

          .pagination-button {
            background: #1a1a1a;
            border: 1px solid #2a2a2a;
            border-radius: 6px;
            color: #fff;
            padding: 10px 20px;
            cursor: pointer;
            font-size: 14px;
            font-weight: 500;
            transition: all 0.2s;
          }

          .pagination-button:hover:not(:disabled) {
            background: #222;
            border-color: #0a4d4d;
          }

          .pagination-button:disabled {
            opacity: 0.4;
            cursor: not-allowed;
          }

          .pagination-info {
            color: #999;
            font-size: 14px;
          }

          .admin-loading,
          .admin-empty {
            text-align: center;
            padding: 60px 20px;
            color: #666;
            font-size: 16px;
          }

          @media (max-width: 768px) {
            .admin-filters {
              flex-direction: column;
            }

            .admin-search-input {
              width: 100%;
            }

            .admin-table-container {
              overflow-x: auto;
            }
          }
        `}</style>
      </AdminLayout>
    </>
  );
}
