import { useState, useEffect } from 'react';
import { useSession, getSession } from 'next-auth/react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import AdminLayout from '../../../components/AdminLayout';

export default function ComponentInventoryPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [components, setComponents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [categoryFilter, setCategoryFilter] = useState('');

  const fetchComponents = async () => {
    setLoading(true);
    try {
      const session = await getSession();
      const res = await fetch(`/api/admin/components?category=${categoryFilter}`, {
        headers: { 'Authorization': `Bearer ${session?.accessToken}` }
      });
      const data = await res.json();
      setComponents(data.components || []);
    } catch (err) {
      console.error('Error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (status === 'authenticated') fetchComponents();
  }, [status, categoryFilter]);

  if (status === 'loading') return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: '#0f0f0f', color: '#fff' }}>Loading...</div>;
  if (!session) { router.push('/admin/login'); return null; }

  return (
    <AdminLayout>
      <Head><title>Component Inventory - UNBREAK ONE</title></Head>
      <div style={{ padding: '40px', maxWidth: '1600px', margin: '0 auto' }}>
        <h1 style={{ color: '#fff', marginBottom: '30px' }}>Component Inventory</h1>
        
        <div style={{ marginBottom: '20px' }}>
          <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} style={{ padding: '10px', border: '1px solid #333', borderRadius: '4px', background: '#0f0f0f', color: '#fff' }}>
            <option value="">All Categories</option>
            <option value="material">Material</option>
            <option value="finish">Finish</option>
            <option value="addon">Add-on</option>
            <option value="hardware">Hardware</option>
          </select>
        </div>

        {loading ? <p style={{ color: '#888' }}>Loading...</p> : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', background: '#1a1a1a', borderRadius: '8px' }}>
              <thead>
                <tr style={{ background: '#0f0f0f', borderBottom: '2px solid #333' }}>
                  <th style={{ padding: '15px', textAlign: 'left', color: '#888' }}>SKU</th>
                  <th style={{ padding: '15px', textAlign: 'left', color: '#888' }}>Component</th>
                  <th style={{ padding: '15px', textAlign: 'left', color: '#888' }}>Category</th>
                  <th style={{ padding: '15px', textAlign: 'right', color: '#888' }}>Stock</th>
                  <th style={{ padding: '15px', textAlign: 'right', color: '#888' }}>Unit Price</th>
                  <th style={{ padding: '15px', textAlign: 'left', color: '#888' }}>Supplier</th>
                  <th style={{ padding: '15px', textAlign: 'center', color: '#888' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {components.map((comp) => (
                  <tr key={comp.id} style={{ borderBottom: '1px solid #333' }}>
                    <td style={{ padding: '15px', fontWeight: '600', color: '#3b82f6', fontFamily: 'monospace' }}>{comp.component_sku}</td>
                    <td style={{ padding: '15px', color: '#fff' }}>{comp.component_name}</td>
                    <td style={{ padding: '15px', color: '#888', textTransform: 'capitalize' }}>{comp.component_category}</td>
                    <td style={{ padding: '15px', textAlign: 'right' }}>
                      <span style={{ color: comp.stock_quantity <= comp.reorder_level ? '#dc2626' : comp.stock_quantity <= comp.reorder_level * 2 ? '#ea580c' : '#16a34a' }}>
                        {comp.stock_quantity} {comp.stock_unit}
                      </span>
                    </td>
                    <td style={{ padding: '15px', color: '#fff', textAlign: 'right' }}>€{(comp.unit_price_cents / 100).toFixed(2)}</td>
                    <td style={{ padding: '15px', color: '#888' }}>{comp.supplier_name || '-'}</td>
                    <td style={{ padding: '15px', textAlign: 'center' }}>
                      <span style={{ padding: '4px 12px', borderRadius: '12px', fontSize: '12px', background: comp.is_available ? '#16a34a20' : '#dc262620', color: comp.is_available ? '#16a34a' : '#dc2626' }}>
                        {comp.is_available ? 'Available' : 'Unavailable'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {components.length === 0 && <div style={{ textAlign: 'center', padding: '60px', color: '#666' }}><div style={{ fontSize: '48px' }}>📦</div><p>No components in inventory</p></div>}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
