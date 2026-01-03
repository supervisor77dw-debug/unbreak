import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import AdminLayout from '../../../components/AdminLayout';

const STATUS_COLORS = {
  open: '#dc2626', in_progress: '#2563eb', waiting_customer: '#ea580c',
  resolved: '#16a34a', closed: '#6b7280', cancelled: '#9ca3af'
};

const PRIORITY_COLORS = { low: '#6b7280', medium: '#2563eb', high: '#ea580c', urgent: '#dc2626' };

export default function TicketsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [pagination, setPagination] = useState({ page: 1, limit: 50, total: 0, totalPages: 0 });

  const fetchTickets = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: pagination.page, limit: pagination.limit, search, status: statusFilter, priority: priorityFilter });
      const response = await fetch(`/api/admin/tickets?${params}`);
      const data = await response.json();
      setTickets(data.tickets || []);
      setPagination(data.pagination);
    } catch (err) {
      console.error('Error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (status === 'authenticated') fetchTickets();
  }, [status, pagination.page, search, statusFilter, priorityFilter]);

  if (status === 'loading') return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: '#0f0f0f', color: '#fff' }}>Loading...</div>;
  if (!session) { router.push('/admin/login'); return null; }

  return (
    <AdminLayout>
      <Head><title>Tickets - UNBREAK ONE</title></Head>
      <div style={{ padding: '40px', maxWidth: '1600px', margin: '0 auto' }}>
        <h1 style={{ color: '#fff', marginBottom: '30px' }}>Support Tickets</h1>
        
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px', marginBottom: '30px', padding: '20px', background: '#1a1a1a', borderRadius: '8px' }}>
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search..." style={{ width: '100%', padding: '10px', border: '1px solid #333', borderRadius: '4px', background: '#0f0f0f', color: '#fff' }} />
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={{ width: '100%', padding: '10px', border: '1px solid #333', borderRadius: '4px', background: '#0f0f0f', color: '#fff' }}>
            <option value="">All Statuses</option>
            <option value="open">Open</option>
            <option value="in_progress">In Progress</option>
            <option value="resolved">Resolved</option>
          </select>
          <select value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value)} style={{ width: '100%', padding: '10px', border: '1px solid #333', borderRadius: '4px', background: '#0f0f0f', color: '#fff' }}>
            <option value="">All Priorities</option>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="urgent">Urgent</option>
          </select>
        </div>

        {loading ? <p style={{ color: '#888' }}>Loading...</p> : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', background: '#1a1a1a', borderRadius: '8px' }}>
              <thead>
                <tr style={{ background: '#0f0f0f', borderBottom: '2px solid #333' }}>
                  <th style={{ padding: '15px', textAlign: 'left', color: '#888' }}>Ticket #</th>
                  <th style={{ padding: '15px', textAlign: 'left', color: '#888' }}>Customer</th>
                  <th style={{ padding: '15px', textAlign: 'left', color: '#888' }}>Subject</th>
                  <th style={{ padding: '15px', textAlign: 'left', color: '#888' }}>Status</th>
                  <th style={{ padding: '15px', textAlign: 'center', color: '#888' }}>Priority</th>
                  <th style={{ padding: '15px', textAlign: 'left', color: '#888' }}>Created</th>
                </tr>
              </thead>
              <tbody>
                {tickets.map((ticket) => (
                  <tr key={ticket.id} style={{ borderBottom: '1px solid #333', cursor: 'pointer' }} onClick={() => router.push(`/admin/tickets/${ticket.id}`)} onMouseEnter={(e) => e.currentTarget.style.background = '#222'} onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
                    <td style={{ padding: '15px', fontWeight: '600', color: '#3b82f6', fontFamily: 'monospace' }}>{ticket.ticket_number}</td>
                    <td style={{ padding: '15px' }}>
                      <div style={{ color: '#fff', fontSize: '14px' }}>{ticket.customer?.name || ticket.customer_email}</div>
                      <div style={{ color: '#666', fontSize: '12px' }}>{ticket.customer_email}</div>
                    </td>
                    <td style={{ padding: '15px', color: '#fff', maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ticket.subject}</td>
                    <td style={{ padding: '15px' }}>
                      <span style={{ display: 'inline-block', padding: '4px 12px', borderRadius: '12px', fontSize: '12px', fontWeight: '500', background: STATUS_COLORS[ticket.status] + '20', color: STATUS_COLORS[ticket.status] }}>{ticket.status}</span>
                    </td>
                    <td style={{ padding: '15px', textAlign: 'center' }}>
                      <span style={{ display: 'inline-block', padding: '4px 12px', borderRadius: '12px', fontSize: '12px', fontWeight: '500', background: PRIORITY_COLORS[ticket.priority] + '20', color: PRIORITY_COLORS[ticket.priority], textTransform: 'uppercase' }}>{ticket.priority}</span>
                    </td>
                    <td style={{ padding: '15px', fontSize: '13px', color: '#666' }}>{new Date(ticket.created_at).toLocaleDateString('de-DE')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {tickets.length === 0 && <div style={{ textAlign: 'center', padding: '60px', color: '#666' }}><div style={{ fontSize: '48px' }}>📋</div><p>No tickets found</p></div>}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}