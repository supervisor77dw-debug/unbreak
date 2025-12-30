import Head from 'next/head';
import { useState, useEffect } from 'react';
import Layout from '../../components/Layout';

export default function AdminDebug() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [autoRefresh, setAutoRefresh] = useState(false);

  const fetchData = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/admin/debug-orders');
      const json = await res.json();
      
      if (!json.success) {
        throw new Error(json.error || 'Failed to fetch debug data');
      }
      
      setData(json);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (autoRefresh) {
      const interval = setInterval(fetchData, 5000); // Refresh every 5s
      return () => clearInterval(interval);
    }
  }, [autoRefresh]);

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleString('de-DE');
  };

  const formatPrice = (cents) => {
    if (!cents && cents !== 0) return 'N/A';
    return `${(cents / 100).toFixed(2)} €`;
  };

  const getStatusBadge = (status) => {
    const colors = {
      pending: '#ff9800',
      paid: '#4caf50',
      failed: '#f44336',
      success: '#4caf50',
      error: '#f44336',
      skipped: '#2196f3',
    };
    return (
      <span style={{
        background: colors[status] || '#757575',
        color: 'white',
        padding: '4px 12px',
        borderRadius: '12px',
        fontSize: '12px',
        fontWeight: '600',
      }}>
        {status?.toUpperCase() || 'UNKNOWN'}
      </span>
    );
  };

  return (
    <Layout>
      <Head>
        <title>Admin Debug - UNBREAK ONE</title>
      </Head>

      <div style={{ padding: '40px 20px', maxWidth: '1400px', margin: '0 auto' }}>
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          marginBottom: '30px'
        }}>
          <h1 style={{ margin: 0 }}>🔧 Admin Debug Dashboard</h1>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button onClick={fetchData} style={{
              padding: '10px 20px',
              background: '#2196f3',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontWeight: '600',
            }}>
              🔄 Refresh
            </button>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <input 
                type="checkbox" 
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
              />
              Auto-refresh (5s)
            </label>
          </div>
        </div>

        {loading && !data && (
          <div style={{ textAlign: 'center', padding: '40px' }}>
            <div className="spinner"></div>
            <p>Loading debug data...</p>
          </div>
        )}

        {error && (
          <div style={{
            background: '#fff3cd',
            border: '1px solid #ffc107',
            padding: '20px',
            borderRadius: '8px',
            marginBottom: '20px'
          }}>
            <strong>⚠️ Error:</strong> {error}
          </div>
        )}

        {data && (
          <>
            {/* Timestamp & Environment */}
            <div style={{
              background: '#f5f5f5',
              padding: '15px 20px',
              borderRadius: '8px',
              marginBottom: '20px',
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '15px'
            }}>
              <div>
                <strong>Last Updated:</strong><br/>
                {formatDate(data.timestamp)}
              </div>
              <div>
                <strong>Supabase:</strong><br/>
                {data.env_check.supabase_url ? '✅ Connected' : '❌ Missing'}
              </div>
              <div>
                <strong>Stripe:</strong><br/>
                {data.env_check.stripe_secret ? '✅ Configured' : '❌ Missing'}
              </div>
              <div>
                <strong>Webhook Secret:</strong><br/>
                {data.env_check.stripe_webhook_secret ? '✅ Set' : '❌ Missing'}
              </div>
            </div>

            {/* Webhook Summary */}
            {data.webhook_summary && (
              <div style={{
                background: '#e3f2fd',
                padding: '20px',
                borderRadius: '8px',
                marginBottom: '30px'
              }}>
                <h2 style={{ marginTop: 0 }}>📊 Webhook Statistics (24h)</h2>
                <div style={{ display: 'flex', gap: '30px' }}>
                  <div>
                    <strong>Total:</strong> {data.webhook_summary.total_24h}
                  </div>
                  <div>
                    <strong>Success:</strong> <span style={{ color: '#4caf50' }}>{data.webhook_summary.success}</span>
                  </div>
                  <div>
                    <strong>Errors:</strong> <span style={{ color: '#f44336' }}>{data.webhook_summary.error}</span>
                  </div>
                  <div>
                    <strong>Skipped:</strong> <span style={{ color: '#2196f3' }}>{data.webhook_summary.skipped}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Latest Orders */}
            <section style={{ marginBottom: '40px' }}>
              <h2>📦 Latest Orders (5 most recent)</h2>
              {data.orders.length === 0 ? (
                <p style={{ color: '#757575' }}>No orders yet</p>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{
                    width: '100%',
                    borderCollapse: 'collapse',
                    background: 'white',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                    borderRadius: '8px',
                    overflow: 'hidden'
                  }}>
                    <thead>
                      <tr style={{ background: '#f5f5f5' }}>
                        <th style={thStyle}>ID</th>
                        <th style={thStyle}>Created</th>
                        <th style={thStyle}>Status</th>
                        <th style={thStyle}>Total</th>
                        <th style={thStyle}>Items</th>
                        <th style={thStyle}>Stripe Session ID</th>
                        <th style={thStyle}>Paid At</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.orders.map((order, idx) => (
                        <tr key={order.id} style={{
                          borderBottom: idx < data.orders.length - 1 ? '1px solid #e0e0e0' : 'none'
                        }}>
                          <td style={tdStyle}>
                            <code style={{ fontSize: '11px' }}>
                              {order.id.substring(0, 8)}...
                            </code>
                          </td>
                          <td style={tdStyle}>{formatDate(order.created_at)}</td>
                          <td style={tdStyle}>{getStatusBadge(order.status)}</td>
                          <td style={tdStyle}>
                            <strong>{formatPrice(order.total_amount_cents)}</strong>
                          </td>
                          <td style={tdStyle}>
                            {order.items ? (
                              <details>
                                <summary style={{ cursor: 'pointer' }}>
                                  {Array.isArray(order.items) ? order.items.length : '1'} item(s)
                                </summary>
                                <pre style={{
                                  fontSize: '11px',
                                  background: '#f5f5f5',
                                  padding: '10px',
                                  borderRadius: '4px',
                                  marginTop: '8px',
                                  overflow: 'auto',
                                  maxWidth: '400px'
                                }}>
                                  {JSON.stringify(order.items, null, 2)}
                                </pre>
                              </details>
                            ) : (
                              <span style={{ color: '#757575' }}>Legacy (no items)</span>
                            )}
                          </td>
                          <td style={tdStyle}>
                            {order.stripe_session_id ? (
                              <code style={{ fontSize: '11px' }}>
                                {order.stripe_session_id.substring(0, 20)}...
                              </code>
                            ) : (
                              <span style={{ color: '#757575' }}>N/A</span>
                            )}
                          </td>
                          <td style={tdStyle}>
                            {order.paid_at ? formatDate(order.paid_at) : (
                              <span style={{ color: '#757575' }}>Not paid</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            {/* Webhook Logs */}
            <section>
              <h2>🪝 Webhook Logs (10 most recent)</h2>
              {data.webhook_logs.length === 0 ? (
                <p style={{ color: '#757575' }}>
                  No webhook logs yet. Table might not exist - run database/webhook-logs.sql
                </p>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{
                    width: '100%',
                    borderCollapse: 'collapse',
                    background: 'white',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                    borderRadius: '8px',
                    overflow: 'hidden'
                  }}>
                    <thead>
                      <tr style={{ background: '#f5f5f5' }}>
                        <th style={thStyle}>Timestamp</th>
                        <th style={thStyle}>Event Type</th>
                        <th style={thStyle}>Status</th>
                        <th style={thStyle}>Session ID</th>
                        <th style={thStyle}>Order ID</th>
                        <th style={thStyle}>Rows Affected</th>
                        <th style={thStyle}>Error</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.webhook_logs.map((log, idx) => (
                        <tr key={log.id} style={{
                          borderBottom: idx < data.webhook_logs.length - 1 ? '1px solid #e0e0e0' : 'none'
                        }}>
                          <td style={tdStyle}>{formatDate(log.created_at)}</td>
                          <td style={tdStyle}>
                            <code style={{ fontSize: '11px' }}>{log.event_type}</code>
                          </td>
                          <td style={tdStyle}>{getStatusBadge(log.status)}</td>
                          <td style={tdStyle}>
                            {log.stripe_session_id ? (
                              <code style={{ fontSize: '11px' }}>
                                {log.stripe_session_id.substring(0, 20)}...
                              </code>
                            ) : (
                              <span style={{ color: '#757575' }}>N/A</span>
                            )}
                          </td>
                          <td style={tdStyle}>
                            {log.order_id ? (
                              <code style={{ fontSize: '11px' }}>
                                {log.order_id.substring(0, 8)}...
                              </code>
                            ) : (
                              <span style={{ color: '#757575' }}>N/A</span>
                            )}
                          </td>
                          <td style={tdStyle}>
                            {log.rows_affected !== null ? log.rows_affected : 'N/A'}
                          </td>
                          <td style={tdStyle}>
                            {log.error_message ? (
                              <span style={{ color: '#f44336', fontSize: '12px' }}>
                                {log.error_message}
                              </span>
                            ) : (
                              <span style={{ color: '#4caf50' }}>✓</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </>
        )}
      </div>

      <style jsx>{`
        .spinner {
          border: 4px solid #f3f3f3;
          border-top: 4px solid #2196f3;
          border-radius: 50%;
          width: 40px;
          height: 40px;
          animation: spin 1s linear infinite;
          margin: 0 auto 20px;
        }

        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </Layout>
  );
}

const thStyle = {
  padding: '12px 16px',
  textAlign: 'left',
  fontWeight: '600',
  fontSize: '13px',
  color: '#424242',
};

const tdStyle = {
  padding: '12px 16px',
  fontSize: '13px',
  verticalAlign: 'top',
};
