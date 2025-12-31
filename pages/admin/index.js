import { useSession } from 'next-auth/react';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import AdminLayout from '../../components/AdminLayout';

export async function getServerSideProps() {
  return { props: {} };
}

export default function AdminDashboard() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/admin/login');
    }
  }, [status, router]);

  useEffect(() => {
    if (session) {
      fetchStats();
    }
  }, [session]);

  const fetchStats = async () => {
    try {
      const res = await fetch('/api/admin/stats');
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch (err) {
      console.error('Failed to fetch stats:', err);
    } finally {
      setLoading(false);
    }
  };

  if (status === 'loading' || !session) {
    return <div className="admin-loading">Loading...</div>;
  }

  return (
    <>
      <Head>
        <title>Dashboard - Admin - UNBREAK ONE</title>
      </Head>
      <AdminLayout>
        <div className="admin-header">
          <h1>Dashboard</h1>
          <p>Willkommen zurück, {session.user.name || session.user.email}</p>
        </div>

        {loading ? (
          <div className="admin-loading">Übersicht wird geladen...</div>
        ) : stats ? (
          <div className="admin-stats-grid">
            <div className="admin-stat-card">
              <div className="stat-label">Bestellungen Heute</div>
              <div className="stat-value">{stats.ordersToday || 0}</div>
              <div className="stat-change positive">+{stats.ordersChange || 0}% gegenüber gestern</div>
            </div>

            <div className="admin-stat-card">
              <div className="stat-label">Offene Tickets</div>
              <div className="stat-value">{stats.openTickets || 0}</div>
              <div className="stat-change">{stats.ticketsChange || 0} heute neu</div>
            </div>

            <div className="admin-stat-card">
              <div className="stat-label">Umsatz (Heute)</div>
              <div className="stat-value">€{((stats.revenueToday || 0) / 100).toFixed(2)}</div>
              <div className="stat-change positive">+{stats.revenueChange || 0}%</div>
            </div>

            <div className="admin-stat-card">
              <div className="stat-label">Offene Bestellungen</div>
              <div className="stat-value">{stats.pendingOrders || 0}</div>
              <div className="stat-change neutral">Bearbeitung erforderlich</div>
            </div>
          </div>
        ) : (
          <div className="admin-empty">
            <p>Statistiken konnten nicht geladen werden</p>
          </div>
        )}

        <div className="admin-quick-actions">
          <h2>Schnellaktionen</h2>
          <div className="action-buttons">
            <Link href="/admin/orders?fulfillment=NEW" className="action-button">
              <span className="icon">⚡</span>
              <span>Neue Bestellungen bearbeiten</span>
            </Link>
            <Link href="/admin/tickets?status=OPEN" className="action-button">
              <span className="icon">💬</span>
              <span>Offene Tickets anzeigen</span>
            </Link>
            <Link href="/admin/orders?fulfillment=PROCESSING" className="action-button">
              <span className="icon">📮</span>
              <span>Versandbereit</span>
            </Link>
          </div>
        </div>

        <style jsx>{`
          .admin-header {
            margin-bottom: 40px;
          }

          .admin-header h1 {
            color: #fff;
            font-size: 32px;
            font-weight: 700;
            margin: 0 0 8px 0;
          }

          .admin-header p {
            color: #666;
            font-size: 16px;
            margin: 0;
          }

          .admin-stats-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 20px;
            margin-bottom: 40px;
          }

          .admin-stat-card {
            background: #1a1a1a;
            border: 1px solid #2a2a2a;
            border-radius: 12px;
            padding: 24px;
          }

          .stat-label {
            color: #999;
            font-size: 14px;
            margin-bottom: 8px;
          }

          .stat-value {
            color: #fff;
            font-size: 36px;
            font-weight: 700;
            margin-bottom: 8px;
          }

          .stat-change {
            color: #666;
            font-size: 13px;
          }

          .stat-change.positive {
            color: #4ade80;
          }

          .stat-change.neutral {
            color: #fbbf24;
          }

          .admin-quick-actions h2 {
            color: #fff;
            font-size: 20px;
            font-weight: 600;
            margin-bottom: 20px;
          }

          .action-buttons {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 16px;
          }

          .action-button {
            display: flex;
            align-items: center;
            gap: 12px;
            padding: 16px 20px;
            background: #1a1a1a;
            border: 1px solid #2a2a2a;
            border-radius: 8px;
            color: #fff;
            text-decoration: none;
            transition: all 0.2s;
            font-size: 14px;
            font-weight: 500;
          }

          .action-button:hover {
            background: #222;
            border-color: #0a4d4d;
            transform: translateY(-2px);
          }

          .admin-loading {
            display: flex;
            align-items: center;
            justify-content: center;
            min-height: 400px;
            color: #666;
            font-size: 16px;
          }

          .admin-empty {
            text-align: center;
            padding: 60px 20px;
            color: #666;
          }
        `}</style>
      </AdminLayout>
    </>
  );
}
