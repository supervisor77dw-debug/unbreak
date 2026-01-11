import { useState } from 'react';
import Head from 'next/head';

/**
 * Debug page for testing config-session API
 * Internal use only - not for production users
 */
export default function ConfigSessionDebug() {
  const [sessionId, setSessionId] = useState('');
  const [response, setResponse] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  async function createSession() {
    setLoading(true);
    setError(null);
    setResponse(null);

    try {
      const testConfig = {
        lang: 'de',
        config: {
          product_type: 'glass_holder',
          variant: 'glass_holder',
          product_sku: 'UNBREAK-GLAS-01',
          parts: {
            base: 'black',
            holder: 'gold',
          },
          colors: {
            primary: '#000000',
            accent: '#FFD700',
          },
          finish: 'matte',
          quantity: 1,
          price: 4900,
        },
      };

      console.log('[DEBUG] Creating session...', testConfig);

      const res = await fetch('/api/config-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(testConfig),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || `HTTP ${res.status}`);
      }

      console.log('[DEBUG] Session created:', data);
      setResponse(data);
      
      if (data.sessionId) {
        setSessionId(data.sessionId);
      }

    } catch (err) {
      console.error('[DEBUG] Create failed:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function readSession() {
    if (!sessionId) {
      setError('No session ID - create a session first');
      return;
    }

    setLoading(true);
    setError(null);
    setResponse(null);

    try {
      console.log('[DEBUG] Reading session:', sessionId);

      const res = await fetch(`/api/config-session/${sessionId}`);
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || `HTTP ${res.status}`);
      }

      console.log('[DEBUG] Session data:', data);
      setResponse(data);

    } catch (err) {
      console.error('[DEBUG] Read failed:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function deleteSession() {
    if (!sessionId) {
      setError('No session ID - create a session first');
      return;
    }

    setLoading(true);
    setError(null);
    setResponse(null);

    try {
      console.log('[DEBUG] Deleting session:', sessionId);

      const res = await fetch(`/api/config-session/${sessionId}`, {
        method: 'DELETE',
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || `HTTP ${res.status}`);
      }

      console.log('[DEBUG] Session deleted:', data);
      setResponse(data);
      setSessionId('');

    } catch (err) {
      console.error('[DEBUG] Delete failed:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function checkHealth() {
    setLoading(true);
    setError(null);
    setResponse(null);

    try {
      const res = await fetch('/api/health');
      const data = await res.json();

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      console.log('[DEBUG] Health check:', data);
      setResponse(data);

    } catch (err) {
      console.error('[DEBUG] Health check failed:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Head>
        <title>Config Session Debug - UNBREAK ONE</title>
      </Head>

      <div style={styles.container}>
        <div style={styles.card}>
          <h1 style={styles.title}>Config Session API Debug</h1>
          <p style={styles.subtitle}>Internal testing only</p>

          <div style={styles.section}>
            <h2>Health Check</h2>
            <button onClick={checkHealth} disabled={loading} style={styles.button}>
              Check /api/health
            </button>
          </div>

          <div style={styles.section}>
            <h2>Session Management</h2>
            
            <div style={styles.buttonGroup}>
              <button onClick={createSession} disabled={loading} style={styles.button}>
                1. Create Session
              </button>
              
              <button onClick={readSession} disabled={loading || !sessionId} style={styles.button}>
                2. Read Session
              </button>
              
              <button onClick={deleteSession} disabled={loading || !sessionId} style={styles.button}>
                3. Delete Session
              </button>
            </div>

            {sessionId && (
              <div style={styles.sessionId}>
                <strong>Session ID:</strong> {sessionId}
              </div>
            )}
          </div>

          {error && (
            <div style={styles.error}>
              <strong>Error:</strong> {error}
            </div>
          )}

          {response && (
            <div style={styles.response}>
              <h3>Response:</h3>
              <pre>{JSON.stringify(response, null, 2)}</pre>
            </div>
          )}

          {loading && (
            <div style={styles.loading}>Loading...</div>
          )}

          <div style={styles.section}>
            <h2>Manual Test</h2>
            <p>Open browser console and run:</p>
            <pre style={styles.code}>{`
// Test POST
fetch('/api/config-session', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    lang: 'de',
    config: { product_type: 'glass_holder', quantity: 1 }
  })
}).then(r => r.json()).then(console.log)

// Test GET (replace SESSION_ID)
fetch('/api/config-session/SESSION_ID')
  .then(r => r.json()).then(console.log)
            `}</pre>
          </div>

          <div style={styles.footer}>
            <a href="/shop" style={styles.link}>← Back to Shop</a>
            <a href="/" style={styles.link}>← Back to Home</a>
          </div>
        </div>
      </div>
    </>
  );
}

const styles = {
  container: {
    minHeight: '100vh',
    background: '#f3f4f6',
    padding: '40px 20px',
  },
  card: {
    maxWidth: '800px',
    margin: '0 auto',
    background: 'white',
    borderRadius: '8px',
    padding: '40px',
    boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
  },
  title: {
    fontSize: '32px',
    fontWeight: 'bold',
    marginBottom: '8px',
  },
  subtitle: {
    fontSize: '14px',
    color: '#666',
    marginBottom: '32px',
  },
  section: {
    marginBottom: '32px',
    paddingBottom: '32px',
    borderBottom: '1px solid #e5e7eb',
  },
  buttonGroup: {
    display: 'flex',
    gap: '12px',
    flexWrap: 'wrap',
    marginBottom: '16px',
  },
  button: {
    padding: '12px 24px',
    background: '#2563eb',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'background 0.2s',
  },
  sessionId: {
    padding: '12px',
    background: '#f3f4f6',
    borderRadius: '6px',
    fontSize: '14px',
    fontFamily: 'monospace',
  },
  error: {
    padding: '16px',
    background: '#fee2e2',
    color: '#dc2626',
    borderRadius: '6px',
    marginBottom: '16px',
  },
  response: {
    padding: '16px',
    background: '#f3f4f6',
    borderRadius: '6px',
    marginBottom: '16px',
  },
  code: {
    padding: '16px',
    background: '#1f2937',
    color: '#f3f4f6',
    borderRadius: '6px',
    fontSize: '12px',
    overflow: 'auto',
  },
  loading: {
    padding: '16px',
    textAlign: 'center',
    color: '#666',
  },
  footer: {
    display: 'flex',
    gap: '16px',
    marginTop: '32px',
  },
  link: {
    color: '#2563eb',
    textDecoration: 'none',
  },
};
