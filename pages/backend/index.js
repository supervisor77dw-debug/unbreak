import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { checkAuth, redirectToLogin } from '../../lib/auth-guard';
import BackendLayout from '../../components/backend/BackendLayout';

export default function Backend() {
  const router = useRouter();
  const [auth, setAuth] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    initAuth();
  }, []);

  async function initAuth() {
    try {
      const authData = await checkAuth();
      setAuth(authData);
    } catch (error) {
      console.error('Auth error:', error);
      redirectToLogin('/backend');
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div style={styles.loading}>
        <div style={styles.spinner}></div>
        <p>Lädt...</p>
      </div>
    );
  }

  if (!auth) return null;

  return (
    <BackendLayout user={auth.user} profile={auth.profile} title="Dashboard">
      <div style={styles.dashboard}>
        <h1 style={styles.title}>Willkommen im Backend</h1>
        <p style={styles.subtitle}>
          {auth.isAdmin ? 'Administrator-Bereich' : 'Team-Bereich'}
        </p>

        <div style={styles.cards}>
          <div style={styles.card} onClick={() => router.push('/backend/products')}>
            <h3>📦 Produkte</h3>
            <p>Produkte verwalten und bearbeiten</p>
          </div>

          {auth.isAdmin && (
            <div style={styles.card} onClick={() => router.push('/backend/products?filter=pending')}>
              <h3>✅ Freigaben</h3>
              <p>Produkte prüfen und freigeben</p>
            </div>
          )}
        </div>
      </div>
    </BackendLayout>
  );
}

const styles = {
  loading: {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'linear-gradient(135deg, #050812 0%, #0A0E27 100%)',
    color: '#fff',
  },
  spinner: {
    border: '4px solid rgba(255, 255, 255, 0.1)',
    borderTop: '4px solid #00FFDC',
    borderRadius: '50%',
    width: '40px',
    height: '40px',
    animation: 'spin 1s linear infinite',
    marginBottom: '20px',
  },
  dashboard: {
    padding: '20px 0',
  },
  title: {
    fontSize: '32px',
    fontWeight: '700',
    marginBottom: '8px',
  },
  subtitle: {
    fontSize: '16px',
    color: 'rgba(255, 255, 255, 0.6)',
    marginBottom: '40px',
  },
  cards: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
    gap: '24px',
  },
  card: {
    background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.08) 0%, rgba(255, 255, 255, 0.04) 100%)',
    backdropFilter: 'blur(20px)',
    borderRadius: '16px',
    border: '1px solid rgba(255, 255, 255, 0.12)',
    padding: '32px',
    cursor: 'pointer',
    transition: 'all 0.3s ease',
  },
};
