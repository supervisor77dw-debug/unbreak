import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';

// Prevent static generation - admin pages must be dynamic
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

  const user = session.user;
  const canViewUsers = user.role === 'ADMIN';
  const canViewProducts = user.role === 'ADMIN';

  return (
    <>
      <Head>
        <title>Admin Dashboard - UNBREAK ONE</title>
      </Head>
      <div className="admin-layout">
        <nav className="admin-sidebar">
          <div className="admin-brand">
            <h2>UNBREAK ONE</h2>
            <span>Admin Panel</span>
          </div>

          <div className="admin-user-info">
            <div className="admin-user-avatar">{user.email[0].toUpperCase()}</div>
            <div>
              <div className="admin-user-name">{user.name || user.email}</div>
              <div className="admin-user-role">{user.role}</div>
            </div>
          </div>

          <ul className="admin-nav">
            <li>
              <Link href="/admin" className="active">
                <span className="icon">📊</span> Dashboard
              </Link>
            </li>
            <li>
              <Link href="/admin/orders">
                <span className="icon">📦</span> Orders
              </Link>
            </li>
            <li>
              <Link href="/admin/customers">
                <span className="icon">👥</span> Customers
              </Link>
            </li>
            <li>
              <Link href="/admin/tickets">
                <span className="icon">🎫</span> Tickets
              </Link>
            </li>
            {canViewUsers && (
              <li>
                <Link href="/admin/users">
                  <span className="icon">🔒</span> Users
                </Link>
              </li>
            )}
            {canViewProducts && (
              <li>
                <Link href="/admin/products">
                  <span className="icon">🏷️</span> Products
                </Link>
              </li>
            )}
          </ul>

          <button onClick={() => signOut({ callbackUrl: '/admin/login' })} className="admin-logout">
            <span className="icon">🚪</span> Sign Out
          </button>
        </nav>

        <main className="admin-content">
          <div className="admin-header">
            <h1>Dashboard</h1>
            <p>Welcome back, {user.name || user.email}</p>
          </div>

          {loading ? (
            <div className="admin-loading">Loading stats...</div>
          ) : stats ? (
            <div className="admin-stats-grid">
              <div className="admin-stat-card">
                <div className="stat-label">Today's Orders</div>
                <div className="stat-value">{stats.ordersToday || 0}</div>
                <div className="stat-change positive">+{stats.ordersChange || 0}% from yesterday</div>
              </div>

              <div className="admin-stat-card">
                <div className="stat-label">Open Tickets</div>
                <div className="stat-value">{stats.openTickets || 0}</div>
                <div className="stat-change">{stats.ticketsChange || 0} new today</div>
              </div>

              <div className="admin-stat-card">
                <div className="stat-label">Revenue (Today)</div>
                <div className="stat-value">€{((stats.revenueToday || 0) / 100).toFixed(2)}</div>
                <div className="stat-change positive">+{stats.revenueChange || 0}%</div>
              </div>

              <div className="admin-stat-card">
                <div className="stat-label">Pending Orders</div>
                <div className="stat-value">{stats.pendingOrders || 0}</div>
                <div className="stat-change neutral">Needs processing</div>
              </div>
            </div>
          ) : (
            <div className="admin-empty">
              <p>Unable to load statistics</p>
            </div>
          )}

          <div className="admin-quick-actions">
            <h2>Quick Actions</h2>
            <div className="action-buttons">
              <Link href="/admin/orders?status=NEW" className="action-button">
                <span className="icon">⚡</span>
                <span>Process New Orders</span>
              </Link>
              <Link href="/admin/tickets?status=OPEN" className="action-button">
                <span className="icon">💬</span>
                <span>View Open Tickets</span>
              </Link>
              <Link href="/admin/orders?fulfillment=PROCESSING" className="action-button">
                <span className="icon">📮</span>
                <span>Ready to Ship</span>
              </Link>
            </div>
          </div>
        </main>

        <style jsx>{`
          .admin-layout {
            display: flex;
            min-height: 100vh;
            background: #0f0f0f;
          }

          .admin-sidebar {
            width: 280px;
            background: #1a1a1a;
            border-right: 1px solid #2a2a2a;
            padding: 30px 20px;
            display: flex;
            flex-direction: column;
            position: fixed;
            height: 100vh;
            overflow-y: auto;
          }

          .admin-brand {
            margin-bottom: 30px;
          }

          .admin-brand h2 {
            color: #0a4d4d;
            font-size: 24px;
            font-weight: 700;
            margin: 0 0 4px 0;
          }

          .admin-brand span {
            color: #666;
            font-size: 12px;
            text-transform: uppercase;
            letter-spacing: 1px;
          }

          .admin-user-info {
            display: flex;
            align-items: center;
            gap: 12px;
            padding: 16px;
            background: #222;
            border-radius: 8px;
            margin-bottom: 30px;
          }

          .admin-user-avatar {
            width: 40px;
            height: 40px;
            border-radius: 50%;
            background: #0a4d4d;
            color: white;
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: 600;
            font-size: 18px;
          }

          .admin-user-name {
            color: #fff;
            font-size: 14px;
            font-weight: 500;
          }

          .admin-user-role {
            color: #0a4d4d;
            font-size: 12px;
            font-weight: 600;
            text-transform: uppercase;
          }

          .admin-nav {
            list-style: none;
            padding: 0;
            margin: 0;
            flex: 1;
          }

          .admin-nav li {
            margin-bottom: 4px;
          }

          .admin-nav :global(a) {
            display: flex;
            align-items: center;
            gap: 12px;
            padding: 12px 16px;
            color: #aaa;
            text-decoration: none;
            border-radius: 6px;
            transition: all 0.2s;
            font-size: 14px;
            font-weight: 500;
          }

          .admin-nav :global(a):hover {
            background: #222;
            color: #fff;
          }

          .admin-nav :global(a.active) {
            background: #0a4d4d;
            color: #fff;
          }

          .admin-nav .icon {
            font-size: 18px;
          }

          .admin-logout {
            display: flex;
            align-items: center;
            gap: 12px;
            width: 100%;
            padding: 12px 16px;
            background: #2a2a2a;
            border: none;
            border-radius: 6px;
            color: #999;
            cursor: pointer;
            font-size: 14px;
            font-weight: 500;
            transition: all 0.2s;
          }

          .admin-logout:hover {
            background: #333;
            color: #fff;
          }

          .admin-content {
            flex: 1;
            margin-left: 280px;
            padding: 40px;
          }

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

          @media (max-width: 1024px) {
            .admin-sidebar {
              width: 240px;
            }
            .admin-content {
              margin-left: 240px;
              padding: 30px 20px;
            }
          }

          @media (max-width: 768px) {
            .admin-sidebar {
              display: none;
            }
            .admin-content {
              margin-left: 0;
            }
          }
        `}</style>
      </div>
    </>
  );
}
