/**
 * ADMIN UI: Users Management List
 * 
 * Display all users from auth.users + profiles
 * - Invite and Create new users
 * - Edit role and activate/deactivate
 */

import { useState, useEffect } from 'react';
import { useSession, getSession } from 'next-auth/react';
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

export default function UsersPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [activeFilter, setActiveFilter] = useState('');
  
  // Modals
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [inviteData, setInviteData] = useState({ email: '', role: 'user', display_name: '' });
  const [createData, setCreateData] = useState({ email: '', password: '', role: 'user', display_name: '' });
  const [submitting, setSubmitting] = useState(false);

  // Fetch users
  const fetchUsers = async () => {
    setLoading(true);
    setError(null);

    try {
      const session = await getSession();
      const params = new URLSearchParams({
        search,
        role: roleFilter,
        is_active: activeFilter,
      });

      const response = await fetch(`/api/admin/users?${params}`, {
        headers: { 'Authorization': `Bearer ${session?.accessToken}` }
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch users');
      }

      const data = await response.json();
      setUsers(data.users || []);
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
  }, [status, search, roleFilter, activeFilter]);

  // Invite user
  const handleInvite = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const session = await getSession();
      const response = await fetch('/api/admin/users/invite', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.accessToken}`
        },
        body: JSON.stringify(inviteData),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to invite user');

      alert('✅ Invitation sent successfully!');
      setShowInviteModal(false);
      setInviteData({ email: '', role: 'user', display_name: '' });
      await fetchUsers();
    } catch (err) {
      alert('❌ ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  // Create user
  const handleCreate = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const session = await getSession();
      const response = await fetch('/api/admin/users/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.accessToken}`
        },
        body: JSON.stringify(createData),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to create user');

      alert('✅ User created successfully!');
      setShowCreateModal(false);
      setCreateData({ email: '', password: '', role: 'user', display_name: '' });
      await fetchUsers();
    } catch (err) {
      alert('❌ ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  // Update user
  const handleUpdateUser = async (userId, updates) => {
    try {
      const session = await getSession();
      const response = await fetch(`/api/admin/users/${userId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.accessToken}`
        },
        body: JSON.stringify(updates),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to update user');

      alert('✅ User updated successfully!');
      await fetchUsers();
    } catch (err) {
      alert('❌ ' + err.message);
    }
  };

  // Change role
  const changeUserRole = (user) => {
    const newRole = prompt(`Change role for ${user.email}\n\nOptions: admin, ops, support, designer, finance, user\n\nCurrent: ${user.role}`, user.role);
    if (newRole && ['admin', 'ops', 'support', 'designer', 'finance', 'user'].includes(newRole)) {
      handleUpdateUser(user.id, { role: newRole });
    } else if (newRole) {
      alert('Invalid role');
    }
  };

  // Toggle active status
  const toggleUserStatus = (user) => {
    if (confirm(`Are you sure you want to ${user.is_active ? 'deactivate' : 'activate'} ${user.email}?`)) {
      handleUpdateUser(user.id, { is_active: !user.is_active });
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

  return (
    <AdminLayout>
      <Head>
        <title>Users - UNBREAK ONE Admin</title>
      </Head>

      <div style={{ padding: '40px', maxWidth: '1400px', margin: '0 auto' }}>
        {/* Header with action buttons */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
          <h1 style={{ color: '#fff', fontSize: '28px', margin: 0 }}>Users Management</h1>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              onClick={() => setShowInviteModal(true)}
              style={{
                padding: '10px 20px',
                background: '#3b82f6',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: '500'
              }}
            >
              📧 Invite User
            </button>
            <button
              onClick={() => setShowCreateModal(true)}
              style={{
                padding: '10px 20px',
                background: '#10b981',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: '500'
              }}
            >
              ➕ Create User
            </button>
          </div>
        </div>

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
          <div style={{ overflowX: 'auto' }}>
            <table style={{ 
              width: '100%', 
              borderCollapse: 'collapse',
              background: '#1a1a1a',
              borderRadius: '8px'
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
                    <td style={{ padding: '15px', fontWeight: '500', color: '#fff' }}>{user.email}</td>
                    <td style={{ padding: '15px', color: '#888' }}>{user.display_name || '-'}</td>
                    <td style={{ padding: '15px' }}>
                      <span style={{
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
                      {user.last_sign_in_at 
                        ? new Date(user.last_sign_in_at).toLocaleDateString('de-DE')
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
            {users.length === 0 && (
              <div style={{ textAlign: 'center', padding: '60px', color: '#666' }}>
                <div style={{ fontSize: '48px' }}>👥</div>
                <p>No users found</p>
              </div>
            )}
          </div>
        )}

        {/* Invite Modal */}
        {showInviteModal && (
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
            <div style={{ background: '#1a1a1a', padding: '30px', borderRadius: '12px', maxWidth: '500px', width: '90%', border: '1px solid #333' }}>
              <h2 style={{ color: '#fff', marginBottom: '20px' }}>📧 Invite User</h2>
              <form onSubmit={handleInvite}>
                <div style={{ marginBottom: '15px' }}>
                  <label style={{ display: 'block', marginBottom: '8px', color: '#888' }}>Email *</label>
                  <input
                    type="email"
                    required
                    value={inviteData.email}
                    onChange={(e) => setInviteData({...inviteData, email: e.target.value})}
                    style={{ width: '100%', padding: '10px', background: '#0f0f0f', border: '1px solid #333', borderRadius: '4px', color: '#fff' }}
                  />
                </div>
                <div style={{ marginBottom: '15px' }}>
                  <label style={{ display: 'block', marginBottom: '8px', color: '#888' }}>Role *</label>
                  <select
                    value={inviteData.role}
                    onChange={(e) => setInviteData({...inviteData, role: e.target.value})}
                    style={{ width: '100%', padding: '10px', background: '#0f0f0f', border: '1px solid #333', borderRadius: '4px', color: '#fff' }}
                  >
                    <option value="user">User</option>
                    <option value="support">Support</option>
                    <option value="designer">Designer</option>
                    <option value="ops">Operations</option>
                    <option value="finance">Finance</option>
                    <option value="admin">Administrator</option>
                  </select>
                </div>
                <div style={{ marginBottom: '20px' }}>
                  <label style={{ display: 'block', marginBottom: '8px', color: '#888' }}>Display Name</label>
                  <input
                    type="text"
                    value={inviteData.display_name}
                    onChange={(e) => setInviteData({...inviteData, display_name: e.target.value})}
                    style={{ width: '100%', padding: '10px', background: '#0f0f0f', border: '1px solid #333', borderRadius: '4px', color: '#fff' }}
                  />
                </div>
                <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                  <button
                    type="button"
                    onClick={() => setShowInviteModal(false)}
                    style={{ padding: '10px 20px', background: '#333', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer' }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    style={{ padding: '10px 20px', background: '#3b82f6', color: '#fff', border: 'none', borderRadius: '6px', cursor: submitting ? 'not-allowed' : 'pointer', opacity: submitting ? 0.5 : 1 }}
                  >
                    {submitting ? 'Sending...' : 'Send Invitation'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Create Modal */}
        {showCreateModal && (
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
            <div style={{ background: '#1a1a1a', padding: '30px', borderRadius: '12px', maxWidth: '500px', width: '90%', border: '1px solid #333' }}>
              <h2 style={{ color: '#fff', marginBottom: '20px' }}>➕ Create User</h2>
              <form onSubmit={handleCreate}>
                <div style={{ marginBottom: '15px' }}>
                  <label style={{ display: 'block', marginBottom: '8px', color: '#888' }}>Email *</label>
                  <input
                    type="email"
                    required
                    value={createData.email}
                    onChange={(e) => setCreateData({...createData, email: e.target.value})}
                    style={{ width: '100%', padding: '10px', background: '#0f0f0f', border: '1px solid #333', borderRadius: '4px', color: '#fff' }}
                  />
                </div>
                <div style={{ marginBottom: '15px' }}>
                  <label style={{ display: 'block', marginBottom: '8px', color: '#888' }}>Password * (min. 8 characters)</label>
                  <input
                    type="password"
                    required
                    minLength={8}
                    value={createData.password}
                    onChange={(e) => setCreateData({...createData, password: e.target.value})}
                    style={{ width: '100%', padding: '10px', background: '#0f0f0f', border: '1px solid #333', borderRadius: '4px', color: '#fff' }}
                  />
                </div>
                <div style={{ marginBottom: '15px' }}>
                  <label style={{ display: 'block', marginBottom: '8px', color: '#888' }}>Role *</label>
                  <select
                    value={createData.role}
                    onChange={(e) => setCreateData({...createData, role: e.target.value})}
                    style={{ width: '100%', padding: '10px', background: '#0f0f0f', border: '1px solid #333', borderRadius: '4px', color: '#fff' }}
                  >
                    <option value="user">User</option>
                    <option value="support">Support</option>
                    <option value="designer">Designer</option>
                    <option value="ops">Operations</option>
                    <option value="finance">Finance</option>
                    <option value="admin">Administrator</option>
                  </select>
                </div>
                <div style={{ marginBottom: '20px' }}>
                  <label style={{ display: 'block', marginBottom: '8px', color: '#888' }}>Display Name</label>
                  <input
                    type="text"
                    value={createData.display_name}
                    onChange={(e) => setCreateData({...createData, display_name: e.target.value})}
                    style={{ width: '100%', padding: '10px', background: '#0f0f0f', border: '1px solid #333', borderRadius: '4px', color: '#fff' }}
                  />
                </div>
                <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    style={{ padding: '10px 20px', background: '#333', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer' }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    style={{ padding: '10px 20px', background: '#10b981', color: '#fff', border: 'none', borderRadius: '6px', cursor: submitting ? 'not-allowed' : 'pointer', opacity: submitting ? 0.5 : 1 }}
                  >
                    {submitting ? 'Creating...' : 'Create User'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
