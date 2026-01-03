/**
 * ADMIN UI: Users Management List
 * 
 * Display all users with:
 * - Email, Name, Role, Status
 * - Filter by role and active status
 * - Search by email/name
 * - Edit role and activate/deactivate
 */

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import AdminLayout from '../../../components/AdminLayout';

const ROLE_LABELS = {
  admin: 'Administrator',
  ops: 'Operations',
  support: 'Support',
  designer: 'Designer',
  finance: 'Finance',
  user: 'User',
};

const ROLE_COLORS = {
  admin: '#dc2626',
  ops: '#ea580c',
  support: '#2563eb',
  designer: '#7c3aed',
  finance: '#059669',
  user: '#6b7280',
};

export async function getServerSideProps() {
  return { props: {} };
}

export default function UsersPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [activeFilter, setActiveFilter] = useState('');
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 50,
    total: 0,
    totalPages: 0,
  });

  // Fetch users
  const fetchUsers = async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        page: pagination.page,
        limit: pagination.limit,
        search,
        role: roleFilter,
        is_active: activeFilter,
      });

      const response = await fetch(`/api/admin/users?${params}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch users');
      }

      const data = await response.json();
      setUsers(data.users || []);
      setPagination(data.pagination);
    } catch (err) {
      console.error('Error fetching users:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (status === 'authenticated') {
      fetchUsers();
    }
  }, [status, pagination.page, search, roleFilter, activeFilter]);

  // Update user role or status
  const handleUpdateUser = async (userId, updates) => {
    try {
      const response = await fetch(`/api/admin/users/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });

      if (!response.ok) {
        throw new Error('Failed to update user');
      }

      // Refresh users list
      await fetchUsers();
      alert('User updated successfully');
    } catch (err) {
      console.error('Error updating user:', err);
      alert('Failed to update user: ' + err.message);
    }
  };

  // Toggle user active status
  const toggleUserStatus = async (user) => {
    if (confirm(`Are you sure you want to ${user.is_active ? 'deactivate' : 'activate'} ${user.email}?`)) {
      await handleUpdateUser(user.id, { is_active: !user.is_active });
    }
  };

  // Change user role
  const changeUserRole = async (user) => {
    const newRole = prompt(`Enter new role for ${user.email}:\n\nAvailable roles:\n- admin\n- ops\n- support\n- designer\n- finance\n- user`, user.role);
    
    if (newRole && newRole !== user.role) {
      await handleUpdateUser(user.id, { role: newRole });
    }
  };

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

      <div style={{ padding: '40px', maxWidth: '1400px', margin: '0 auto' }}>
        <h1 style={{ color: '#fff', marginBottom: '30px', fontSize: '28px' }}>Users Management</h1>

        {/* Filters */}
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', 
          gap: '15px', 
          marginBottom: '30px',
          padding: '20px',
          background: '#1a1a1a',
          borderRadius: '8px'
        }}>
          <div>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500', color: '#888' }}>
              Search
            </label>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Email or name..."
              style={{
                width: '100%',
                padding: '10px',
                border: '1px solid #333',
                borderRadius: '4px',
                fontSize: '14px',
                background: '#0f0f0f',
                color: '#fff'
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500', color: '#888' }}>
              Role
            </label>
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              style={{
                width: '100%',
                padding: '10px',
                border: '1px solid #333',
                borderRadius: '4px',
                fontSize: '14px',
                background: '#0f0f0f',
                color: '#fff'
              }}
            >
              <option value="">All Roles</option>
              <option value="admin">Administrator</option>
              <option value="ops">Operations</option>
              <option value="support">Support</option>
              <option value="designer">Designer</option>
              <option value="finance">Finance</option>
              <option value="user">User</option>
            </select>
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500', color: '#888' }}>
              Status
            </label>
            <select
              value={activeFilter}
              onChange={(e) => setActiveFilter(e.target.value)}
              style={{
                width: '100%',
                padding: '10px',
                border: '1px solid #333',
                borderRadius: '4px',
                fontSize: '14px',
                background: '#0f0f0f',
                color: '#fff'
              }}
            >
              <option value="">All</option>
              <option value="true">Active</option>
              <option value="false">Inactive</option>
            </select>
          </div>
        </div>

        {/* Loading/Error States */}
        {loading && <p style={{ color: '#888' }}>Loading users...</p>}
        {error && <p style={{ color: '#ff4444' }}>Error: {error}</p>}

        {/* Users Table */}
        {!loading && !error && (
          <>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ 
                width: '100%', 
                borderCollapse: 'collapse',
                background: '#1a1a1a',
                borderRadius: '8px',
                overflow: 'hidden'
              }}>
                <thead>
                  <tr style={{ background: '#0f0f0f', borderBottom: '2px solid #333' }}>
                    <th style={{ padding: '15px', textAlign: 'left', fontWeight: '600', color: '#888' }}>Email</th>
                    <th style={{ padding: '15px', textAlign: 'left', fontWeight: '600', color: '#888' }}>Name</th>
                    <th style={{ padding: '15px', textAlign: 'left', fontWeight: '600', color: '#888' }}>Role</th>
                    <th style={{ padding: '15px', textAlign: 'center', fontWeight: '600', color: '#888' }}>Status</th>
                    <th style={{ padding: '15px', textAlign: 'left', fontWeight: '600', color: '#888' }}>Last Login</th>
                    <th style={{ padding: '15px', textAlign: 'center', fontWeight: '600', color: '#888' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => (
                    <tr key={user.id} style={{ borderBottom: '1px solid #333' }}>
                      <td style={{ padding: '15px' }}>
                        <div style={{ fontWeight: '500', color: '#fff' }}>{user.email}</div>
                      </td>
                      <td style={{ padding: '15px', color: '#888' }}>
                        {user.display_name || '-'}
                      </td>
                      <td style={{ padding: '15px' }}>
                        <span style={{
                          display: 'inline-block',
                          padding: '4px 12px',
                          borderRadius: '12px',
                          fontSize: '13px',
                          fontWeight: '500',
                          background: ROLE_COLORS[user.role] + '20',
                          color: ROLE_COLORS[user.role]
                        }}>
                          {ROLE_LABELS[user.role] || user.role}
                        </span>
                      </td>
                      <td style={{ padding: '15px', textAlign: 'center' }}>
                        <span style={{
                          display: 'inline-block',
                          padding: '4px 12px',
                          borderRadius: '12px',
                          fontSize: '13px',
                          fontWeight: '500',
                          background: user.is_active ? '#16a34a20' : '#dc262620',
                          color: user.is_active ? '#16a34a' : '#dc2626'
                        }}>
                          {user.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td style={{ padding: '15px', fontSize: '14px', color: '#666' }}>
                        {user.last_login_at 
                          ? new Date(user.last_login_at).toLocaleDateString('de-DE', {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })
                          : 'Never'}
                      </td>
                      <td style={{ padding: '15px', textAlign: 'center' }}>
                        <button
                          onClick={() => changeUserRole(user)}
                          style={{
                            padding: '6px 12px',
                            marginRight: '8px',
                            background: '#3b82f6',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '13px'
                          }}
                        >
                          Change Role
                        </button>
                        <button
                          onClick={() => toggleUserStatus(user)}
                          style={{
                            padding: '6px 12px',
                            background: user.is_active ? '#ef4444' : '#10b981',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '13px'
                          }}
                        >
                          {user.is_active ? 'Deactivate' : 'Activate'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {pagination.totalPages > 1 && (
              <div style={{ 
                marginTop: '20px', 
                display: 'flex', 
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <div style={{ fontSize: '14px', color: '#666' }}>
                  Page {pagination.page} of {pagination.totalPages} ({pagination.total} users)
                </div>
                <div>
                  <button
                    onClick={() => setPagination({ ...pagination, page: pagination.page - 1 })}
                    disabled={pagination.page === 1}
                    style={{
                      padding: '8px 16px',
                      marginRight: '10px',
                      background: pagination.page === 1 ? '#333' : '#3b82f6',
                      color: pagination.page === 1 ? '#666' : 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: pagination.page === 1 ? 'not-allowed' : 'pointer'
                    }}
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => setPagination({ ...pagination, page: pagination.page + 1 })}
                    disabled={!pagination.hasMore}
                    style={{
                      padding: '8px 16px',
                      background: !pagination.hasMore ? '#333' : '#3b82f6',
                      color: !pagination.hasMore ? '#666' : 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: !pagination.hasMore ? 'not-allowed' : 'pointer'
                    }}
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </AdminLayout>
  );
}
