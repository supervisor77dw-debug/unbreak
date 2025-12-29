import { useState, useEffect } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { getSupabasePublic } from '../lib/supabase';
import Layout from '../components/Layout';

export default function MyProducts() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);

  useEffect(() => {
    checkAuth();
  }, []);

  async function checkAuth() {
    try {
      const supabase = getSupabasePublic();
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        router.push('/login.html?redirect=/my-products');
        return;
      }

      setUser(session.user);
      loadProducts(session.user.id);
    } catch (error) {
      console.error('Auth check error:', error);
      router.push('/login.html');
    } finally {
      setLoading(false);
    }
  }

  async function loadProducts(userId) {
    try {
      const supabase = getSupabasePublic();
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('created_by', userId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setProducts(data || []);
    } catch (error) {
      console.error('Error loading products:', error);
      alert('Failed to load products');
    }
  }

  async function submitForReview(productId) {
    if (!confirm('Submit this product for admin review?')) {
      return;
    }

    try {
      const supabase = getSupabasePublic();
      const { error } = await supabase.rpc('submit_product_for_review', {
        product_id: productId
      });

      if (error) throw error;

      alert('Product submitted for review!');
      loadProducts(user.id);
    } catch (error) {
      console.error('Error submitting product:', error);
      alert('Failed to submit product: ' + error.message);
    }
  }

  async function deleteProduct(productId) {
    if (!confirm('Delete this product? This cannot be undone.')) {
      return;
    }

    try {
      const supabase = getSupabasePublic();
      const { error } = await supabase
        .from('products')
        .delete()
        .eq('id', productId);

      if (error) throw error;

      alert('Product deleted.');
      loadProducts(user.id);
    } catch (error) {
      console.error('Error deleting product:', error);
      alert('Failed to delete product: ' + error.message);
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
      day: 'numeric'
    });
  }

  function getStatusInfo(status) {
    const statusMap = {
      draft: { color: '#999', text: 'Draft', icon: '📝' },
      pending_review: { color: '#ff9800', text: 'Pending Review', icon: '⏳' },
      approved: { color: '#4caf50', text: 'Approved & Live', icon: '✓' },
      rejected: { color: '#f44336', text: 'Rejected', icon: '✗' }
    };
    return statusMap[status] || statusMap.draft;
  }

  if (loading) {
    return (
      <Layout>
        <div style={{ padding: '100px 20px', textAlign: 'center' }}>
          <div className="spinner"></div>
          <p>Loading...</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <Head>
        <title>My Products | UNBREAK ONE</title>
      </Head>

      <main className="page-content" style={{ padding: '120px 20px 60px' }}>
        <div className="container" style={{ maxWidth: '1000px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '40px' }}>
            <div>
              <h1 style={{ marginBottom: '10px' }}>My Products</h1>
              <p style={{ color: '#999' }}>Manage your product submissions</p>
            </div>
            <button
              onClick={() => {
                setEditingProduct(null);
                setShowForm(true);
              }}
              style={{
                padding: '12px 24px',
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                fontWeight: 'bold',
                fontSize: '16px'
              }}
            >
              + Create Product
            </button>
          </div>

          {/* Product Form Modal */}
          {showForm && (
            <ProductForm
              product={editingProduct}
              user={user}
              onClose={() => {
                setShowForm(false);
                setEditingProduct(null);
              }}
              onSave={() => {
                setShowForm(false);
                setEditingProduct(null);
                loadProducts(user.id);
              }}
            />
          )}

          {/* Products Grid */}
          {products.length === 0 ? (
            <div style={{
              textAlign: 'center',
              padding: '80px 20px',
              background: '#1a1a1a',
              borderRadius: '12px'
            }}>
              <h2 style={{ fontSize: '24px', marginBottom: '12px' }}>No products yet</h2>
              <p style={{ color: '#999', marginBottom: '24px' }}>
                Create your first product to get started
              </p>
              <button
                onClick={() => setShowForm(true)}
                style={{
                  padding: '12px 32px',
                  background: '#667eea',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontWeight: 'bold'
                }}
              >
                Create Product
              </button>
            </div>
          ) : (
            <div style={{ display: 'grid', gap: '20px' }}>
              {products.map(product => {
                const statusInfo = getStatusInfo(product.status);
                const canEdit = product.status === 'draft' || product.status === 'rejected';
                const canSubmit = product.status === 'draft';
                const canDelete = product.status === 'draft';

                return (
                  <div
                    key={product.id}
                    style={{
                      background: '#1a1a1a',
                      borderRadius: '12px',
                      padding: '24px',
                      border: `2px solid ${statusInfo.color}20`
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '16px' }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                          <h3 style={{ margin: 0 }}>{product.name}</h3>
                          <span style={{
                            backgroundColor: statusInfo.color,
                            color: 'white',
                            padding: '4px 12px',
                            borderRadius: '12px',
                            fontSize: '12px',
                            fontWeight: 'bold'
                          }}>
                            {statusInfo.icon} {statusInfo.text}
                          </span>
                        </div>
                        <p style={{ color: '#ccc', fontSize: '14px' }}>
                          {product.description || 'No description'}
                        </p>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#667eea' }}>
                          {formatPrice(product.base_price_cents)}
                        </div>
                        <div style={{ fontSize: '12px', color: '#999' }}>
                          SKU: {product.sku}
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '8px', fontSize: '14px', color: '#999', marginBottom: '16px' }}>
                      <span>Created: {formatDate(product.created_at)}</span>
                      {product.approved_at && (
                        <span>• Reviewed: {formatDate(product.approved_at)}</span>
                      )}
                    </div>

                    <div style={{ display: 'flex', gap: '12px' }}>
                      {canEdit && (
                        <button
                          onClick={() => {
                            setEditingProduct(product);
                            setShowForm(true);
                          }}
                          style={{
                            padding: '8px 16px',
                            background: '#333',
                            color: 'white',
                            border: 'none',
                            borderRadius: '6px',
                            cursor: 'pointer'
                          }}
                        >
                          Edit
                        </button>
                      )}
                      {canSubmit && (
                        <button
                          onClick={() => submitForReview(product.id)}
                          style={{
                            padding: '8px 16px',
                            background: '#667eea',
                            color: 'white',
                            border: 'none',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            fontWeight: 'bold'
                          }}
                        >
                          Submit for Review
                        </button>
                      )}
                      {canDelete && (
                        <button
                          onClick={() => deleteProduct(product.id)}
                          style={{
                            padding: '8px 16px',
                            background: '#f44336',
                            color: 'white',
                            border: 'none',
                            borderRadius: '6px',
                            cursor: 'pointer'
                          }}
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
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

// Product Form Component
function ProductForm({ product, user, onClose, onSave }) {
  const [formData, setFormData] = useState({
    name: product?.name || '',
    sku: product?.sku || '',
    description: product?.description || '',
    base_price_cents: product ? product.base_price_cents / 100 : '',
    status: 'draft'
  });
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);

    try {
      const supabase = getSupabasePublic();
      
      const productData = {
        name: formData.name,
        sku: formData.sku,
        description: formData.description,
        base_price_cents: Math.round(parseFloat(formData.base_price_cents) * 100),
        created_by: user.id,
        status: 'draft',
        active: false
      };

      if (product) {
        // Update existing
        const { error } = await supabase
          .from('products')
          .update(productData)
          .eq('id', product.id);

        if (error) throw error;
      } else {
        // Create new
        const { error } = await supabase
          .from('products')
          .insert([productData]);

        if (error) throw error;
      }

      alert(product ? 'Product updated!' : 'Product created!');
      onSave();
    } catch (error) {
      console.error('Error saving product:', error);
      alert('Failed to save product: ' + error.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0,0,0,0.8)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      padding: '20px'
    }}>
      <div style={{
        background: '#1a1a1a',
        borderRadius: '12px',
        padding: '32px',
        maxWidth: '600px',
        width: '100%',
        maxHeight: '90vh',
        overflow: 'auto'
      }}>
        <h2 style={{ marginBottom: '24px' }}>
          {product ? 'Edit Product' : 'Create New Product'}
        </h2>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
              Product Name *
            </label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              style={{
                width: '100%',
                padding: '12px',
                background: '#0a0a0a',
                border: '1px solid #333',
                borderRadius: '8px',
                color: 'white',
                fontSize: '16px'
              }}
              placeholder="e.g., UNBREAK Weinglashalter Premium"
            />
          </div>

          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
              SKU *
            </label>
            <input
              type="text"
              required
              value={formData.sku}
              onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
              style={{
                width: '100%',
                padding: '12px',
                background: '#0a0a0a',
                border: '1px solid #333',
                borderRadius: '8px',
                color: 'white',
                fontSize: '16px'
              }}
              placeholder="e.g., UBO-WGH-001"
            />
          </div>

          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
              Price (EUR) *
            </label>
            <input
              type="number"
              step="0.01"
              required
              value={formData.base_price_cents}
              onChange={(e) => setFormData({ ...formData, base_price_cents: e.target.value })}
              style={{
                width: '100%',
                padding: '12px',
                background: '#0a0a0a',
                border: '1px solid #333',
                borderRadius: '8px',
                color: 'white',
                fontSize: '16px'
              }}
              placeholder="59.90"
            />
          </div>

          <div style={{ marginBottom: '24px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
              Description
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={4}
              style={{
                width: '100%',
                padding: '12px',
                background: '#0a0a0a',
                border: '1px solid #333',
                borderRadius: '8px',
                color: 'white',
                fontSize: '16px',
                fontFamily: 'inherit',
                resize: 'vertical'
              }}
              placeholder="Product description..."
            />
          </div>

          <div style={{ display: 'flex', gap: '12px' }}>
            <button
              type="submit"
              disabled={saving}
              style={{
                flex: 1,
                padding: '12px',
                background: saving ? '#666' : '#667eea',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                cursor: saving ? 'not-allowed' : 'pointer',
                fontWeight: 'bold',
                fontSize: '16px'
              }}
            >
              {saving ? 'Saving...' : (product ? 'Update' : 'Create')}
            </button>
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              style={{
                flex: 1,
                padding: '12px',
                background: '#333',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                cursor: saving ? 'not-allowed' : 'pointer',
                fontSize: '16px'
              }}
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
