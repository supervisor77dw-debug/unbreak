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
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/admin/login');
    }
  }, [status, router]);

  useEffect(() => {
    if (session) {
      fetchCustomers();
    }
  }, [session, search]);

  const fetchCustomers = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.append('search', search);

      const res = await fetch(`/api/admin/customers?${params}`);
      if (res.ok) {
        const data = await res.json();
        setCustomers(data.customers || []);
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

  const formatDate = (date) => new Date(date).toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });

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
          placeholder="Nach E-Mail oder Name suchen..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="admin-search-input"
        />
      </div>

      {loading ? (
        <div className="admin-loading">Kunden werden geladen...</div>
      ) : customers.length === 0 ? (
        <div className="admin-empty">
          <p>Keine Kunden gefunden</p>
        </div>
      ) : (
        <div className="admin-table-container">
          <table className="admin-table">
            <thead>
              <tr>
                <th>E-Mail</th>
                <th>Name</th>
                <th>Telefon</th>
                <th>Letzte Bestellung</th>
                <th>Bestellungen</th>
                <th>Erstellt</th>
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
                  <td className="date-cell">
                    {customer.lastOrderAt ? formatDate(customer.lastOrderAt) : '—'}
                  </td>
                  <td>{customer._count?.orders || 0}</td>
                  <td className="date-cell">{formatDate(customer.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
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
        }

        .admin-search-input {
          flex: 1;
          min-width: 250px;
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

        .date-cell {
          color: #999;
          font-size: 13px;
          font-family: monospace;
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
        }
      `}</style>
    </AdminLayout>
  );
}

