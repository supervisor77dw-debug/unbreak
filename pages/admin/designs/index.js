import { useState, useEffect } from 'react';
import { useSession, getSession } from 'next-auth/react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import AdminLayout from '../../../components/AdminLayout';

export default function SavedDesignsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [designs, setDesigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const fetchDesigns = async () => {
    setLoading(true);
    try {
      const session = await getSession();
      const res = await fetch(`/api/admin/designs?search=${encodeURIComponent(search)}`, {
        headers: { 'Authorization': `Bearer ${session?.accessToken}` }
      });
      const data = await res.json();
      setDesigns(data.designs || []);
    } catch (err) {
      console.error('Error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (status === 'authenticated') fetchDesigns();
  }, [status, search]);

  if (status === 'loading') return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: '#0f0f0f', color: '#fff' }}>Loading...</div>;
  if (!session) { router.push('/admin/login'); return null; }

  return (
    <AdminLayout>
      <Head><title>Saved Designs - UNBREAK ONE</title></Head>
      <div style={{ padding: '40px', maxWidth: '1600px', margin: '0 auto' }}>
        <h1 style={{ color: '#fff', marginBottom: '30px' }}>Saved Designs</h1>
        
        <div style={{ marginBottom: '20px' }}>
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by design code or email..." style={{ width: '100%', maxWidth: '400px', padding: '10px', border: '1px solid #333', borderRadius: '4px', background: '#0f0f0f', color: '#fff' }} />
        </div>

        {loading ? <p style={{ color: '#888' }}>Loading...</p> : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', background: '#1a1a1a', borderRadius: '8px' }}>
              <thead>
                <tr style={{ background: '#0f0f0f', borderBottom: '2px solid #333' }}>
                  <th style={{ padding: '15px', textAlign: 'left', color: '#888' }}>Design Code</th>
                  <th style={{ padding: '15px', textAlign: 'left', color: '#888' }}>Customer</th>
                  <th style={{ padding: '15px', textAlign: 'left', color: '#888' }}>Product</th>
                  <th style={{ padding: '15px', textAlign: 'right', color: '#888' }}>Price</th>
                  <th style={{ padding: '15px', textAlign: 'left', color: '#888' }}>Created</th>
                  <th style={{ padding: '15px', textAlign: 'left', color: '#888' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {designs.map((design) => (
                  <tr key={design.id} style={{ borderBottom: '1px solid #333' }}>
                    <td style={{ padding: '15px', fontWeight: '600', color: '#3b82f6', fontFamily: 'monospace' }}>{design.design_code}</td>
                    <td style={{ padding: '15px' }}>
                      <div style={{ color: '#fff', fontSize: '14px' }}>{design.customer_name || '-'}</div>
                      <div style={{ color: '#666', fontSize: '12px' }}>{design.customer_email}</div>
                    </td>
                    <td style={{ padding: '15px', color: '#fff' }}>{design.product_name}</td>
                    <td style={{ padding: '15px', color: '#fff', textAlign: 'right' }}>€{(design.final_price_cents / 100).toFixed(2)}</td>
                    <td style={{ padding: '15px', color: '#666', fontSize: '13px' }}>{new Date(design.created_at).toLocaleDateString('de-DE')}</td>
                    <td style={{ padding: '15px' }}>
                      <span style={{ padding: '4px 12px', borderRadius: '12px', fontSize: '12px', background: design.is_ordered ? '#16a34a20' : '#ea580c20', color: design.is_ordered ? '#16a34a' : '#ea580c' }}>
                        {design.is_ordered ? 'Ordered' : 'Saved'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {designs.length === 0 && <div style={{ textAlign: 'center', padding: '60px', color: '#666' }}><div style={{ fontSize: '48px' }}>🎨</div><p>No saved designs</p></div>}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
