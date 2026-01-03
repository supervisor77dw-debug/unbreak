import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import AdminLayout from '../../../components/AdminLayout';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

const STATUS_COLORS = {
  pending: '#ea580c', in_production: '#2563eb', quality_check: '#ca8a04',
  completed: '#16a34a', on_hold: '#dc2626', cancelled: '#6b7280'
};

export default function ProductionQueuePage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');

  const fetchQueue = async () => {
    setLoading(true);
    try {
      let query = supabase.from('production_queue').select('*').order('priority_level', { ascending: false }).order('created_at', { ascending: true }).limit(100);
      if (statusFilter) query = query.eq('production_status', statusFilter);
      const { data } = await query;
      setItems(data || []);
    } catch (err) {
      console.error('Error:', err);
    } finally {
      setLoading(false);
    }
  };

  const updateStatus = async (id, newStatus) => {
    try {
      await supabase.from('production_queue').update({ production_status: newStatus, updated_at: new Date().toISOString() }).eq('id', id);
      await fetchQueue();
    } catch (err) {
      console.error('Error:', err);
    }
  };

  useEffect(() => {
    if (status === 'authenticated') fetchQueue();
  }, [status, statusFilter]);

  if (status === 'loading') return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: '#0f0f0f', color: '#fff' }}>Loading...</div>;
  if (!session) { router.push('/admin/login'); return null; }

  return (
    <AdminLayout>
      <Head><title>Production Queue - UNBREAK ONE</title></Head>
      <div style={{ padding: '40px', maxWidth: '1600px', margin: '0 auto' }}>
        <h1 style={{ color: '#fff', marginBottom: '30px' }}>Production Queue</h1>
        
        <div style={{ marginBottom: '20px' }}>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={{ padding: '10px', border: '1px solid #333', borderRadius: '4px', background: '#0f0f0f', color: '#fff' }}>
            <option value="">All Statuses</option>
            <option value="pending">Pending</option>
            <option value="in_production">In Production</option>
            <option value="quality_check">Quality Check</option>
            <option value="completed">Completed</option>
            <option value="on_hold">On Hold</option>
          </select>
        </div>

        {loading ? <p style={{ color: '#888' }}>Loading...</p> : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', background: '#1a1a1a', borderRadius: '8px' }}>
              <thead>
                <tr style={{ background: '#0f0f0f', borderBottom: '2px solid #333' }}>
                  <th style={{ padding: '15px', textAlign: 'left', color: '#888' }}>Production #</th>
                  <th style={{ padding: '15px', textAlign: 'left', color: '#888' }}>Order</th>
                  <th style={{ padding: '15px', textAlign: 'left', color: '#888' }}>Design</th>
                  <th style={{ padding: '15px', textAlign: 'center', color: '#888' }}>Priority</th>
                  <th style={{ padding: '15px', textAlign: 'left', color: '#888' }}>Status</th>
                  <th style={{ padding: '15px', textAlign: 'left', color: '#888' }}>Scheduled</th>
                  <th style={{ padding: '15px', textAlign: 'center', color: '#888' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id} style={{ borderBottom: '1px solid #333' }}>
                    <td style={{ padding: '15px', fontWeight: '600', color: '#3b82f6', fontFamily: 'monospace' }}>{item.production_code}</td>
                    <td style={{ padding: '15px', color: '#fff' }}>{item.order_number || '-'}</td>
                    <td style={{ padding: '15px', color: '#fff' }}>{item.design_code || '-'}</td>
                    <td style={{ padding: '15px', textAlign: 'center' }}>
                      <span style={{ padding: '4px 12px', borderRadius: '12px', fontSize: '12px', fontWeight: '500', background: item.priority_level >= 8 ? '#dc262620' : item.priority_level >= 5 ? '#ea580c20' : '#6b728020', color: item.priority_level >= 8 ? '#dc2626' : item.priority_level >= 5 ? '#ea580c' : '#6b7280' }}>
                        {item.priority_level}/10
                      </span>
                    </td>
                    <td style={{ padding: '15px' }}>
                      <span style={{ padding: '4px 12px', borderRadius: '12px', fontSize: '12px', background: STATUS_COLORS[item.production_status] + '20', color: STATUS_COLORS[item.production_status] }}>
                        {item.production_status}
                      </span>
                    </td>
                    <td style={{ padding: '15px', color: '#666', fontSize: '13px' }}>{item.scheduled_start_date ? new Date(item.scheduled_start_date).toLocaleDateString('de-DE') : '-'}</td>
                    <td style={{ padding: '15px', textAlign: 'center' }}>
                      <select value={item.production_status} onChange={(e) => updateStatus(item.id, e.target.value)} style={{ padding: '6px 10px', background: '#0f0f0f', color: '#fff', border: '1px solid #333', borderRadius: '4px', fontSize: '12px' }}>
                        <option value="pending">Pending</option>
                        <option value="in_production">In Production</option>
                        <option value="quality_check">Quality Check</option>
                        <option value="completed">Completed</option>
                        <option value="on_hold">On Hold</option>
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {items.length === 0 && <div style={{ textAlign: 'center', padding: '60px', color: '#666' }}><div style={{ fontSize: '48px' }}>🏭</div><p>No production items</p></div>}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
