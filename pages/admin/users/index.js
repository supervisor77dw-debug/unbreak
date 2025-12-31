import { useSession } from 'next-auth/react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import AdminLayout from '../../../components/AdminLayout';

export async function getServerSideProps() {
  return { props: {} };
}

export default function UsersPage() {
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

  // Only ADMIN can access user management
  if (session.user.role !== 'ADMIN') {
    return (
      <AdminLayout>
        <Head>
          <title>Access Denied - UNBREAK ONE Admin</title>
        </Head>
        <div style={{ padding: '40px' }}>
          <div style={{ 
            background: '#1a1a1a', 
            padding: '60px', 
            borderRadius: '12px', 
            textAlign: 'center',
            border: '1px solid #ff4444'
          }}>
            <div style={{ fontSize: '48px', marginBottom: '20px' }}>🔒</div>
            <h2 style={{ color: '#ff4444', fontSize: '24px', marginBottom: '10px' }}>Access Denied</h2>
            <p style={{ color: '#888' }}>You need ADMIN role to access user management</p>
          </div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <Head>
        <title>Users - UNBREAK ONE Admin</title>
      </Head>

      <div style={{ padding: '40px' }}>
        <h1 style={{ color: '#fff', marginBottom: '20px' }}>User Management</h1>
        <div style={{ 
          background: '#1a1a1a', 
          padding: '60px', 
          borderRadius: '12px', 
          textAlign: 'center',
          border: '1px solid #333'
        }}>
          <div style={{ fontSize: '48px', marginBottom: '20px' }}>👤</div>
          <h2 style={{ color: '#888', fontSize: '20px', marginBottom: '10px' }}>Admin User Management</h2>
          <p style={{ color: '#666' }}>Coming soon - Manage admin staff accounts and roles</p>
        </div>
      </div>
    </AdminLayout>
  );
}
