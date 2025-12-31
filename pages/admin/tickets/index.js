import { useSession } from 'next-auth/react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import AdminLayout from '../../../components/AdminLayout';

export async function getServerSideProps() {
  return { props: {} };
}

export default function TicketsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  if (status === 'loading') {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: '#0f0f0f', color: '#fff' }}>
        Loading...
      </div>
    );
  }

  if (!session) {
    router.push('/admin/login');
    return null;
  }

  return (
    <AdminLayout>
      <Head>
        <title>Tickets - UNBREAK ONE Admin</title>
      </Head>

      <div style={{ padding: '40px' }}>
        <h1 style={{ color: '#fff', marginBottom: '20px' }}>Support Tickets</h1>
        <div style={{ 
          background: '#1a1a1a', 
          padding: '60px', 
          borderRadius: '12px', 
          textAlign: 'center',
          border: '1px solid #333'
        }}>
          <div style={{ fontSize: '48px', marginBottom: '20px' }}>🎫</div>
          <h2 style={{ color: '#888', fontSize: '20px', marginBottom: '10px' }}>Ticket System</h2>
          <p style={{ color: '#666' }}>Coming soon - Customer support ticket management</p>
        </div>
      </div>
    </AdminLayout>
  );
}
