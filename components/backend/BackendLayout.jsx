import { useState } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { getSupabasePublic } from '../../lib/supabase';

export default function BackendLayout({ children, user, profile, title = 'Backend' }) {
  const router = useRouter();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const isAdmin = profile?.role === 'admin';

  async function handleLogout() {
    try {
      const supabase = getSupabasePublic();
      await supabase.auth.signOut();
      router.push('/login.html');
    } catch (error) {
      console.error('Logout error:', error);
    }
  }

  return (
    <>
      <Head>
        <title>{title} | UNBREAK ONE</title>
      </Head>

      <div style={styles.container}>
        {/* Header */}
        <header style={styles.header}>
          <div style={styles.headerContent}>
            <div style={styles.logo}>
              <h1>UNBREAK ONE</h1>
              <span style={styles.badge}>{isAdmin ? 'Admin' : 'Team'}</span>
            </div>
            
            <div style={styles.userInfo}>
              <span style={styles.userEmail}>{user?.email}</span>
              <button onClick={handleLogout} style={styles.btnLogout}>
                Abmelden
              </button>
            </div>
          </div>
        </header>

        {/* Navigation */}
        <nav style={styles.nav}>
          <div style={styles.navContent}>
            <button
              onClick={() => router.push('/backend')}
              style={{
                ...styles.navLink,
                ...(router.pathname === '/backend' ? styles.navLinkActive : {})
              }}
            >
              Dashboard
            </button>
            
            <button
              onClick={() => router.push('/backend/products')}
              style={{
                ...styles.navLink,
                ...(router.pathname.startsWith('/backend/products') ? styles.navLinkActive : {})
              }}
            >
              Produkte
            </button>

            {isAdmin && (
              <button
                onClick={() => router.push('/backend/products?filter=pending')}
                style={{
                  ...styles.navLink,
                  ...(router.query.filter === 'pending' ? styles.navLinkActive : {})
                }}
              >
                Freigaben
                {/* Could add pending count badge here */}
              </button>
            )}
          </div>
        </nav>

        {/* Main Content */}
        <main style={styles.main}>
          {children}
        </main>
      </div>
    </>
  );
}

const styles = {
  container: {
    minHeight: '100vh',
    background: 'linear-gradient(135deg, #050812 0%, #0A0E27 100%)',
    color: '#fff',
  },
  header: {
    background: 'rgba(255, 255, 255, 0.05)',
    backdropFilter: 'blur(20px)',
    borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
    padding: '20px 40px',
  },
  headerContent: {
    maxWidth: '1400px',
    margin: '0 auto',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  logo: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  badge: {
    padding: '4px 12px',
    background: 'rgba(0, 255, 220, 0.1)',
    border: '1px solid rgba(0, 255, 220, 0.3)',
    borderRadius: '12px',
    fontSize: '12px',
    fontWeight: '600',
    color: '#00FFDC',
  },
  userInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
  },
  userEmail: {
    fontSize: '14px',
    color: 'rgba(255, 255, 255, 0.7)',
  },
  btnLogout: {
    padding: '10px 20px',
    background: 'rgba(255, 77, 77, 0.1)',
    border: '1px solid rgba(255, 77, 77, 0.3)',
    borderRadius: '8px',
    color: '#ff9999',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '500',
    transition: 'all 0.3s ease',
  },
  nav: {
    background: 'rgba(255, 255, 255, 0.03)',
    borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
    padding: '0 40px',
  },
  navContent: {
    maxWidth: '1400px',
    margin: '0 auto',
    display: 'flex',
    gap: '8px',
  },
  navLink: {
    padding: '16px 24px',
    background: 'transparent',
    border: 'none',
    borderBottom: '2px solid transparent',
    color: 'rgba(255, 255, 255, 0.6)',
    cursor: 'pointer',
    fontSize: '15px',
    fontWeight: '500',
    transition: 'all 0.3s ease',
  },
  navLinkActive: {
    color: '#00FFDC',
    borderBottomColor: '#00FFDC',
  },
  main: {
    maxWidth: '1400px',
    margin: '0 auto',
    padding: '40px',
  },
};
