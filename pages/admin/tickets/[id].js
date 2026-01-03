import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import AdminLayout from '../../../components/AdminLayout';

const STATUS_COLORS = { open: '#dc2626', in_progress: '#2563eb', waiting_customer: '#ea580c', resolved: '#16a34a', closed: '#6b7280' };
const PRIORITY_COLORS = { low: '#6b7280', medium: '#2563eb', high: '#ea580c', urgent: '#dc2626' };

export default function TicketDetailPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { id } = router.query;
  const [ticket, setTicket] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newMessage, setNewMessage] = useState('');
  const [isInternal, setIsInternal] = useState(false);
  const [sending, setSending] = useState(false);

  const fetchTicket = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const response = await fetch(`/api/admin/tickets/${id}`);
      const data = await response.json();
      setTicket(data.ticket);
      setMessages(data.messages || []);
    } catch (err) {
      console.error('Error:', err);
    } finally {
      setLoading(false);
    }
  };

  const updateTicket = async (updates) => {
    try {
      const response = await fetch(`/api/admin/tickets/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      if (response.ok) {
        await fetchTicket();
        alert('Ticket updated');
      }
    } catch (err) {
      console.error('Error:', err);
      alert('Failed to update ticket');
    }
  };

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim()) return;
    setSending(true);
    try {
      const response = await fetch(`/api/admin/tickets/${id}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: newMessage, is_internal: isInternal }),
      });
      if (response.ok) {
        setNewMessage('');
        setIsInternal(false);
        await fetchTicket();
      }
    } catch (err) {
      console.error('Error:', err);
      alert('Failed to send message');
    } finally {
      setSending(false);
    }
  };

  useEffect(() => {
    if (status === 'authenticated' && id) fetchTicket();
  }, [status, id]);

  if (status === 'loading' || loading) return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: '#0f0f0f', color: '#fff' }}>Loading...</div>;
  if (!session) { router.push('/admin/login'); return null; }
  if (!ticket) return <AdminLayout><p style={{ color: '#888', padding: '40px' }}>Ticket not found</p></AdminLayout>;

  return (
    <AdminLayout>
      <Head><title>{ticket.ticket_number} - UNBREAK ONE</title></Head>
      <div style={{ padding: '40px', maxWidth: '1200px', margin: '0 auto' }}>
        <div style={{ marginBottom: '30px' }}>
          <button onClick={() => router.push('/admin/tickets')} style={{ padding: '8px 16px', background: '#333', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', marginBottom: '20px' }}>← Back to Tickets</button>
          <h1 style={{ color: '#fff', fontSize: '24px', marginBottom: '10px' }}>{ticket.ticket_number}</h1>
          <h2 style={{ color: '#888', fontSize: '20px', fontWeight: 'normal' }}>{ticket.subject}</h2>
        </div>

        {/* Ticket Info */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px', marginBottom: '30px' }}>
          <div style={{ background: '#1a1a1a', padding: '20px', borderRadius: '8px' }}>
            <div style={{ color: '#666', fontSize: '12px', marginBottom: '8px' }}>Customer</div>
            <div style={{ color: '#fff', fontSize: '16px' }}>{ticket.customer?.name || ticket.customer_email}</div>
            <div style={{ color: '#666', fontSize: '13px' }}>{ticket.customer_email}</div>
          </div>
          <div style={{ background: '#1a1a1a', padding: '20px', borderRadius: '8px' }}>
            <div style={{ color: '#666', fontSize: '12px', marginBottom: '8px' }}>Status</div>
            <select value={ticket.status} onChange={(e) => updateTicket({ status: e.target.value })} style={{ width: '100%', padding: '8px', background: '#0f0f0f', color: '#fff', border: '1px solid #333', borderRadius: '4px' }}>
              <option value="open">Open</option>
              <option value="in_progress">In Progress</option>
              <option value="waiting_customer">Waiting Customer</option>
              <option value="resolved">Resolved</option>
              <option value="closed">Closed</option>
            </select>
          </div>
          <div style={{ background: '#1a1a1a', padding: '20px', borderRadius: '8px' }}>
            <div style={{ color: '#666', fontSize: '12px', marginBottom: '8px' }}>Priority</div>
            <select value={ticket.priority} onChange={(e) => updateTicket({ priority: e.target.value })} style={{ width: '100%', padding: '8px', background: '#0f0f0f', color: '#fff', border: '1px solid #333', borderRadius: '4px' }}>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </select>
          </div>
          <div style={{ background: '#1a1a1a', padding: '20px', borderRadius: '8px' }}>
            <div style={{ color: '#666', fontSize: '12px', marginBottom: '8px' }}>Category</div>
            <div style={{ color: '#fff', fontSize: '16px', textTransform: 'capitalize' }}>{ticket.category}</div>
          </div>
        </div>

        {/* Initial Description */}
        <div style={{ background: '#1a1a1a', padding: '20px', borderRadius: '8px', marginBottom: '30px' }}>
          <div style={{ color: '#888', fontSize: '13px', marginBottom: '10px' }}>Initial Request</div>
          <div style={{ color: '#fff', whiteSpace: 'pre-wrap' }}>{ticket.description}</div>
        </div>

        {/* Messages Thread */}
        <div style={{ marginBottom: '30px' }}>
          <h3 style={{ color: '#fff', fontSize: '18px', marginBottom: '20px' }}>Messages ({messages.length})</h3>
          {messages.map((msg) => (
            <div key={msg.id} style={{ background: msg.is_internal ? '#1a1a1a' : '#0f0f0f', padding: '20px', borderRadius: '8px', marginBottom: '15px', borderLeft: msg.is_internal ? '3px solid #ea580c' : 'none' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <div>
                  <span style={{ color: '#fff', fontWeight: '500' }}>{msg.user?.display_name || msg.user?.email}</span>
                  {msg.is_internal && <span style={{ marginLeft: '10px', padding: '2px 8px', background: '#ea580c20', color: '#ea580c', fontSize: '11px', borderRadius: '4px' }}>Internal</span>}
                </div>
                <div style={{ color: '#666', fontSize: '12px' }}>{new Date(msg.created_at).toLocaleString('de-DE')}</div>
              </div>
              <div style={{ color: '#ddd', whiteSpace: 'pre-wrap' }}>{msg.message}</div>
            </div>
          ))}
        </div>

        {/* Reply Form */}
        <form onSubmit={sendMessage} style={{ background: '#1a1a1a', padding: '20px', borderRadius: '8px' }}>
          <h3 style={{ color: '#fff', fontSize: '16px', marginBottom: '15px' }}>Add Message</h3>
          <textarea value={newMessage} onChange={(e) => setNewMessage(e.target.value)} placeholder="Type your message..." rows={5} style={{ width: '100%', padding: '12px', background: '#0f0f0f', color: '#fff', border: '1px solid #333', borderRadius: '4px', marginBottom: '15px', fontFamily: 'inherit', resize: 'vertical' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <label style={{ color: '#888', fontSize: '14px' }}>
              <input type="checkbox" checked={isInternal} onChange={(e) => setIsInternal(e.target.checked)} style={{ marginRight: '8px' }} />
              Internal note (not visible to customer)
            </label>
            <button type="submit" disabled={sending} style={{ padding: '10px 24px', background: sending ? '#333' : '#3b82f6', color: '#fff', border: 'none', borderRadius: '4px', cursor: sending ? 'not-allowed' : 'pointer', fontWeight: '500' }}>
              {sending ? 'Sending...' : 'Send Message'}
            </button>
          </div>
        </form>
      </div>
    </AdminLayout>
  );
}
