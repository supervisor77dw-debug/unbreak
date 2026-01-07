import { useSession } from 'next-auth/react';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import AdminLayout from '../../../components/AdminLayout';

export async function getServerSideProps() {
  return { props: {} };
}

export default function CustomersPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [pagination, setPagination] = useState({
    total: 0,
    limit: 50,
    offset: 0,
    has_more: false,
  });

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/admin/login');
    }
  }, [status, router]);

  useEffect(() => {
    if (session) {
      fetchCustomers();
    }
  }, [session, search, pagination.offset]);

  const fetchCustomers = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.append('search', search);
      params.append('limit', pagination.limit);
      params.append('offset', pagination.offset);

      const res = await fetch(`/api/admin/customers?${params}`, {
        headers: {
          'x-admin-key': process.env.NEXT_PUBLIC_ADMIN_API_KEY || '',
        },
      });
      
      if (res.ok) {
        const data = await res.json();
        setCustomers(data.customers || []);
        setPagination(data.pagination || pagination);
      } else if (res.status === 401) {
        console.error('❌ Admin API unauthorized - check NEXT_PUBLIC_ADMIN_API_KEY');
        setError('Admin API unauthorized. Check environment configuration.');
      } else {
        console.error('Failed to fetch customers:', res.status);
      }
    } catch (err) {
      console.error('Failed to fetch customers:', err);
    } finally {
      setLoading(false);
    }
  };

  if (status === 'loading' || !session) {
    return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: '#0f0f0f', color: '#fff' }}>
      Wird geladen...
    </div>;
  }

  const formatDate = (date) => {
    if (!date) return '—';
    return new Date(date).toLocaleDateString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  const formatCurrency = (cents) => {
    return `€${(cents / 100).toFixed(2)}`;
  };

  const handleNextPage = () => {
    if (pagination.has_more) {
      setPagination({ ...pagination, offset: pagination.offset + pagination.limit });
    }
  };

  const handlePrevPage = () => {
    if (pagination.offset > 0) {
      setPagination({ ...pagination, offset: Math.max(0, pagination.offset - pagination.limit) });
    }
  };

  return (
    <AdminLayout>
      <Head>
        <title>Kunden - Admin - UNBREAK ONE</title>
      </Head>

      <div className="admin-page-header">
        <h1>Kunden</h1>
        <p>Kundenverwaltung und -übersicht</p>
      </div>

      <div className="admin-filters">
        <input
          type="text"
          placeholder="Nach E-Mail, Name oder Stripe ID suchen..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPagination({ ...pagination, offset: 0 }); // Reset to first page on search
          }}
          className="admin-search-input"
        />
        <div className="filter-info">
          {pagination.total > 0 && (
            <span>
              Zeige {pagination.offset + 1}-{Math.min(pagination.offset + pagination.limit, pagination.total)} von {pagination.total}
            </span>
          )}
        </div>
      </div>

      {loading ? (
        <div className="admin-loading">Kunden werden geladen...</div>
      ) : customers.length === 0 ? (
        <div className="admin-empty">
          <p>Keine Kunden gefunden</p>
          {search && <p style={{ fontSize: '14px', color: '#666' }}>Suchbegriff: "{search}"</p>}
        </div>
      ) : (
        <>
          <div className="admin-table-container">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>E-Mail</th>
                  <th>Name</th>
                  <th>Telefon</th>
                  <th>Stripe ID</th>
                  <th>Bestellungen</th>
                  <th>Umsatz</th>
                  <th>Letzte Bestellung</th>
                  <th>Erstellt</th>
                  <th>Aktionen</th>
                </tr>
              </thead>
              <tbody>
                {customers.map((customer) => (
                  <tr key={customer.id}>
                    <td>
                      <div className="customer-email">{customer.email}</div>
                    </td>
                    <td>{customer.name || '—'}</td>
                    <td>{customer.phone || '—'}</td>
                    <td className="stripe-id">
                      {customer.stripe_customer_id ? (
                        <code>{customer.stripe_customer_id.substring(0, 20)}...</code>
                      ) : '—'}
                    </td>
                    <td>
                      <span className="badge">{customer.total_orders}</span>
                    </td>
                    <td className="currency">
                      {customer.total_spent_cents > 0 ? formatCurrency(customer.total_spent_cents) : '€0.00'}
                    </td>
                    <td className="date-cell">
                      {formatDate(customer.last_order_at)}
                    </td>
                    <td className="date-cell">{formatDate(customer.created_at)}</td>
                    <td>
                      <Link href={`/admin/customers/${customer.id}`} className="action-link">
                        Details →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {pagination.total > pagination.limit && (
            <div className="pagination">
              <button 
                onClick={handlePrevPage} 
                disabled={pagination.offset === 0}
                className="pagination-btn"
              >
                ← Vorherige
              </button>
              <span className="pagination-info">
                Seite {Math.floor(pagination.offset / pagination.limit) + 1} von {Math.ceil(pagination.total / pagination.limit)}
              </span>
              <button 
                onClick={handleNextPage} 
                disabled={!pagination.has_more}
                className="pagination-btn"
              >
                Nächste →
              </button>
            </div>
          )}
        </>
      )}

      <style jsx>{`
        .admin-page-header {
          margin-bottom: 30px;
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

        .admin-filters {
          display: flex;
          gap: 12px;
          margin-bottom: 24px;
          flex-wrap: wrap;
          align-items: center;
        }

        .admin-search-input {
          flex: 1;
          min-width: 300px;
          background: #1a1a1a;
          border: 1px solid #2a2a2a;
          border-radius: 6px;
          color: #fff;
          font-size: 14px;
          padding: 10px 14px;
        }

        .admin-search-input:focus {
          outline: none;
          border-color: #0a4d4d;
        }

        .filter-info {
          color: #666;
          font-size: 13px;
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

        .customer-email {
          color: #0a4d4d;
          font-weight: 500;
        }

        .stripe-id code {
          background: #222;
          padding: 4px 8px;
          border-radius: 4px;
          font-size: 12px;
          color: #999;
        }

        .badge {
          background: #2a2a2a;
          padding: 4px 10px;
          border-radius: 12px;
          font-size: 13px;
          font-weight: 600;
          color: #0a4d4d;
        }

        .currency {
          color: #0a9d0a;
          font-weight: 600;
          font-family: monospace;
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

        .pagination {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 20px 0;
        }

        .pagination-btn {
          background: #1a1a1a;
          border: 1px solid #2a2a2a;
          border-radius: 6px;
          color: #fff;
          padding: 10px 20px;
          font-size: 14px;
          cursor: pointer;
          transition: all 0.2s;
        }

        .pagination-btn:hover:not(:disabled) {
          background: #222;
          border-color: #0a4d4d;
        }

        .pagination-btn:disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }

        .pagination-info {
          color: #666;
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
          .admin-table-container {
            overflow-x: auto;
          }

          .admin-filters {
            flex-direction: column;
            align-items: stretch;
          }

          .admin-search-input {
            min-width: 100%;
          }
        }
      `}</style>
    </AdminLayout>
  );
}

