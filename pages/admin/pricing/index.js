import { useState, useEffect } from 'react';
import { useSession, getSession } from 'next-auth/react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import AdminLayout from '../../../components/AdminLayout';

export default function PricingRulesPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchRules = async () => {
    setLoading(true);
    try {
      const session = await getSession();
      const res = await fetch('/api/admin/pricing', {
        headers: { 'Authorization': `Bearer ${session?.accessToken}` }
      });
      const data = await res.json();
      setRules(data.rules || []);
    } catch (err) {
      console.error('Error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (status === 'authenticated') fetchRules();
  }, [status]);

  if (status === 'loading') return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: '#0f0f0f', color: '#fff' }}>Loading...</div>;
  if (!session) { router.push('/admin/login'); return null; }

  return (
    <AdminLayout>
      <Head><title>Pricing Rules - UNBREAK ONE</title></Head>
      <div style={{ padding: '40px', maxWidth: '1600px', margin: '0 auto' }}>
        <h1 style={{ color: '#fff', marginBottom: '30px' }}>Pricing Rules</h1>

        {loading ? <p style={{ color: '#888' }}>Loading...</p> : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', background: '#1a1a1a', borderRadius: '8px' }}>
              <thead>
                <tr style={{ background: '#0f0f0f', borderBottom: '2px solid #333' }}>
                  <th style={{ padding: '15px', textAlign: 'left', color: '#888' }}>Rule Name</th>
                  <th style={{ padding: '15px', textAlign: 'left', color: '#888' }}>Version</th>
                  <th style={{ padding: '15px', textAlign: 'left', color: '#888' }}>Type</th>
                  <th style={{ padding: '15px', textAlign: 'right', color: '#888' }}>Base Price</th>
                  <th style={{ padding: '15px', textAlign: 'left', color: '#888' }}>Valid From</th>
                  <th style={{ padding: '15px', textAlign: 'left', color: '#888' }}>Valid Until</th>
                  <th style={{ padding: '15px', textAlign: 'center', color: '#888' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {rules.map((rule) => (
                  <tr key={rule.id} style={{ borderBottom: '1px solid #333' }}>
                    <td style={{ padding: '15px', color: '#fff', fontWeight: '500' }}>{rule.rule_name}</td>
                    <td style={{ padding: '15px', fontFamily: 'monospace', color: '#3b82f6' }}>v{rule.version}</td>
                    <td style={{ padding: '15px', color: '#888', textTransform: 'capitalize' }}>{rule.rule_type}</td>
                    <td style={{ padding: '15px', color: '#fff', textAlign: 'right' }}>€{(rule.base_price_cents / 100).toFixed(2)}</td>
                    <td style={{ padding: '15px', color: '#666', fontSize: '13px' }}>{new Date(rule.valid_from).toLocaleDateString('de-DE')}</td>
                    <td style={{ padding: '15px', color: '#666', fontSize: '13px' }}>{rule.valid_until ? new Date(rule.valid_until).toLocaleDateString('de-DE') : 'Unbegrenzt'}</td>
                    <td style={{ padding: '15px', textAlign: 'center' }}>
                      <span style={{ padding: '4px 12px', borderRadius: '12px', fontSize: '12px', background: rule.is_active ? '#16a34a20' : '#6b728020', color: rule.is_active ? '#16a34a' : '#6b7280' }}>
                        {rule.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {rules.length === 0 && <div style={{ textAlign: 'center', padding: '60px', color: '#666' }}><div style={{ fontSize: '48px' }}>💰</div><p>No pricing rules defined</p></div>}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
