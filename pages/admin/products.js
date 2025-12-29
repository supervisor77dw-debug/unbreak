import { useState, useEffect } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { getSupabasePublic } from '../../lib/supabase';
import Layout from '../../components/Layout';

export default function AdminProducts() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState([]);
  const [filter, setFilter] = useState('pending_review'); // Show pending by default

  useEffect(() => {
    checkAuth();
  }, []);

  useEffect(() => {
    if (isAdmin) {
      loadProducts();
    }
  }, [isAdmin, filter]);

  async function checkAuth() {
    try {
      const supabase = getSupabasePublic();
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        router.push('/login.html?redirect=/admin/products');
        return;
      }

      setUser(session.user);

      // Check if user is admin
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', session.user.id)
        .single();

      if (profile?.role !== 'admin') {
        alert('Access denied. Admin rights required.');
        router.push('/');
        return;
      }

      setIsAdmin(true);
    } catch (error) {
      console.error('Auth check error:', error);
      router.push('/login.html');
    } finally {
      setLoading(false);
    }
  }

  async function loadProducts() {
    try {
      const supabase = getSupabasePublic();
      let query = supabase
        .from('products')
        .select('*')
        .order('created_at', { ascending: false });

      if (filter !== 'all') {
        query = query.eq('status', filter);
      }

      const { data, error } = await query;

      if (error) throw error;
      setProducts(data || []);
    } catch (error) {
      console.error('Error loading products:', error);
      alert('Failed to load products');
    }
  }

  async function approveProduct(productId) {
    if (!confirm('Approve this product? It will become publicly visible.')) {
      return;
    }

    try {
      const supabase = getSupabasePublic();
      const { error } = await supabase.rpc('approve_product', {
        product_id: productId
      });

      if (error) throw error;

      alert('Product approved!');
      loadProducts();
    } catch (error) {
      console.error('Error approving product:', error);
      alert('Failed to approve product: ' + error.message);
    }
  }

  async function rejectProduct(productId) {
    const reason = prompt('Rejection reason (optional):');
    if (reason === null) return; // User cancelled

    try {
      const supabase = getSupabasePublic();
      const { error } = await supabase.rpc('reject_product', {
        product_id: productId,
        rejection_reason: reason || null
      });

      if (error) throw error;

      alert('Product rejected.');
      loadProducts();
    } catch (error) {
      console.error('Error rejecting product:', error);
      alert('Failed to reject product: ' + error.message);
    }
  }

  function formatPrice(cents) {
    return new Intl.NumberFormat('de-DE', {
      style: 'currency',
      currency: 'EUR'
    }).format(cents / 100);
  }

  function formatDate(dateString) {
    return new Date(dateString).toLocaleDateString('de-DE', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  function getStatusBadge(status) {
    const badges = {
      draft: { color: '#999', text: 'Draft' },
      pending_review: { color: '#ff9800', text: 'Pending Review' },
      approved: { color: '#4caf50', text: 'Approved' },
      rejected: { color: '#f44336', text: 'Rejected' }
    };

    const badge = badges[status] || badges.draft;

    return (
      <span style={{
        backgroundColor: badge.color,
        color: 'white',
        padding: '4px 12px',
        borderRadius: '12px',
        fontSize: '12px',
        fontWeight: 'bold'
      }}>
        {badge.text}
      </span>
    );
  }

  if (loading) {
    return (
      <Layout>
        <div style={{ padding: '100px 20px', textAlign: 'center' }}>
          <div className="spinner"></div>
          <p>Checking permissions...</p>
        </div>
      </Layout>
    );
  }

  if (!isAdmin) {
    return null; // Will redirect
  }

  return (
    <Layout>
      <Head>
        <title>Admin: Product Review | UNBREAK ONE</title>
      </Head>

      <main className="page-content" style={{ padding: '120px 20px 60px' }}>
        <div className="container" style={{ maxWidth: '1200px' }}>
          <div style={{ marginBottom: '40px' }}>
            <h1 style={{ marginBottom: '10px' }}>Product Review Dashboard</h1>
            <p style={{ color: '#999' }}>Review and approve user-submitted products</p>
          </div>

          {/* Filter Tabs */}
          <div style={{ marginBottom: '30px', borderBottom: '2px solid #333' }}>
            {['pending_review', 'approved', 'rejected', 'draft', 'all'].map(status => (
              <button
                key={status}
                onClick={() => setFilter(status)}
                style={{
                  padding: '12px 24px',
                  marginRight: '5px',
                  border: 'none',
                  background: filter === status ? '#333' : 'transparent',
                  color: filter === status ? 'white' : '#999',
                  cursor: 'pointer',
                  borderRadius: '8px 8px 0 0',
                  fontWeight: filter === status ? 'bold' : 'normal',
                  textTransform: 'capitalize'
                }}
              >
                {status.replace('_', ' ')}
              </button>
            ))}
          </div>

          {/* Products List */}
          {products.length === 0 ? (
            <div style={{
              textAlign: 'center',
              padding: '60px 20px',
              background: '#1a1a1a',
              borderRadius: '12px'
            }}>
              <p style={{ fontSize: '18px', color: '#999' }}>
                No products in "{filter.replace('_', ' ')}" status
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {products.map(product => (
                <div
                  key={product.id}
                  style={{
                    background: '#1a1a1a',
                    borderRadius: '12px',
                    padding: '24px',
                    border: product.status === 'pending_review' ? '2px solid #ff9800' : '1px solid #333'
                  }}
                >
                  <div style={{ display: 'flex', gap: '24px', alignItems: 'start' }}>
                    {/* Product Info */}
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                        <h3 style={{ margin: 0 }}>{product.name}</h3>
                        {getStatusBadge(product.status)}
                      </div>

                      <p style={{ color: '#ccc', marginBottom: '12px' }}>
                        {product.description || 'No description'}
                      </p>

                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', fontSize: '14px', color: '#999' }}>
                        <div>
                          <strong>SKU:</strong> {product.sku}
                        </div>
                        <div>
                          <strong>Price:</strong> {formatPrice(product.base_price_cents)}
                        </div>
                        <div>
                          <strong>Created:</strong> {formatDate(product.created_at)}
                        </div>
                        {product.approved_at && (
                          <div>
                            <strong>Reviewed:</strong> {formatDate(product.approved_at)}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    {product.status === 'pending_review' && (
                      <div style={{ display: 'flex', gap: '12px' }}>
                        <button
                          onClick={() => approveProduct(product.id)}
                          style={{
                            padding: '12px 24px',
                            background: '#4caf50',
                            color: 'white',
                            border: 'none',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            fontWeight: 'bold'
                          }}
                        >
                          ✓ Approve
                        </button>
                        <button
                          onClick={() => rejectProduct(product.id)}
                          style={{
                            padding: '12px 24px',
                            background: '#f44336',
                            color: 'white',
                            border: 'none',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            fontWeight: 'bold'
                          }}
                        >
                          ✗ Reject
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      <style jsx>{`
        .spinner {
          border: 4px solid #333;
          border-top: 4px solid #fff;
          border-radius: 50%;
          width: 40px;
          height: 40px;
          animation: spin 1s linear infinite;
          margin: 0 auto 20px;
        }

        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </Layout>
  );
}
