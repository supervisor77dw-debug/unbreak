import { useSession, signOut } from 'next-auth/react';
import Link from 'next/link';
import { useRouter } from 'next/router';

export default function AdminLayout({ children }) {
  const { data: session } = useSession();
  const router = useRouter();

  if (!session) {
    return null;
  }

  const user = session.user;
  const canViewUsers = user.role === 'ADMIN';
  const canViewProducts = user.role === 'ADMIN';

  const isActive = (path) => router.pathname.startsWith(path);

  return (
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
            <Link href="/admin" className={isActive('/admin') && router.pathname === '/admin' ? 'active' : ''}>
              <span className="icon">📊</span> Übersicht
            </Link>
          </li>
          <li>
            <Link href="/admin/orders" className={isActive('/admin/orders') ? 'active' : ''}>
              <span className="icon">📦</span> Bestellungen
            </Link>
          </li>
          <li>
            <Link href="/admin/customers" className={isActive('/admin/customers') ? 'active' : ''}>
              <span className="icon">👥</span> Kunden
            </Link>
          </li>
          <li>
            <Link href="/admin/tickets" className={isActive('/admin/tickets') ? 'active' : ''}>
              <span className="icon">🎫</span> Anfragen
            </Link>
          </li>
          {canViewUsers && (
            <li>
              <Link href="/admin/users" className={isActive('/admin/users') ? 'active' : ''}>
                <span className="icon">🔒</span> Benutzer
              </Link>
            </li>
          )}
          {canViewProducts && (
            <li>
              <Link href="/admin/products" className={isActive('/admin/products') ? 'active' : ''}>
                <span className="icon">🏷️</span> Produkte
              </Link>
            </li>
          )}
        </ul>

        <button onClick={() => signOut({ callbackUrl: '/admin/login' })} className="admin-logout">
          <span className="icon">🚺</span> Abmelden
        </button>
      </nav>

      <main className="admin-content">
        {children}
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
  );
}
