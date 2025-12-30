import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { checkAuth, redirectToLogin } from '../../../lib/auth-guard';
import { getSupabasePublic } from '../../../lib/supabase';
import BackendLayout from '../../../components/backend/BackendLayout';
import ProductForm from '../../../components/backend/ProductForm';
import ProductList from '../../../components/backend/ProductList';

export default function Products() {
  const router = useRouter();
  const [auth, setAuth] = useState(null);
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [filter, setFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    initAuth();
  }, []);

  useEffect(() => {
    if (auth) {
      loadProducts();
    }
  }, [auth, filter]);

  useEffect(() => {
    // Set filter from URL query
    if (router.query.filter) {
      setFilter(router.query.filter);
    }
  }, [router.query.filter]);

  async function initAuth() {
    try {
      const authData = await checkAuth();
      setAuth(authData);
    } catch (error) {
      console.error('Auth error:', error);
      redirectToLogin('/backend/products');
    } finally {
      setLoading(false);
    }
  }

  async function loadProducts() {
    try {
      const supabase = getSupabasePublic();
      if (!supabase) return;

      let query = supabase
        .from('products')
        .select('*')
        .order('created_at', { ascending: false });

      // Filter by status
      if (filter === 'pending') {
        query = query.eq('status', 'pending_review');
      } else if (filter !== 'all') {
        query = query.eq('status', filter);
      }

      // Non-admin users only see their own products
      if (!auth.isAdmin) {
        query = query.eq('created_by', auth.user.id);
      }

      const { data, error } = await query;

      if (error) throw error;
      setProducts(data || []);
    } catch (error) {
      console.error('Error loading products:', error);
      alert('Fehler beim Laden der Produkte');
    }
  }

  async function handleSave(productData) {
    try {
      const supabase = getSupabasePublic();
      if (!supabase) return;

      if (editingProduct) {
        // Update existing product
        const { error } = await supabase
          .from('products')
          .update(productData)
          .eq('id', editingProduct.id);

        if (error) throw error;
      } else {
        // Create new product with status 'pending_review'
        const dataToInsert = {
          ...productData,
          status: 'pending_review',
          created_by: auth.user.id,
        };
        console.log('💾 Saving product to DB:', dataToInsert);
        console.log('   image_url being saved:', dataToInsert.image_url);
        
        const { error } = await supabase
          .from('products')
          .insert([dataToInsert]);

        if (error) throw error;
      }

      setShowForm(false);
      setEditingProduct(null);
      await loadProducts();
    } catch (error) {
      console.error('Save error:', error);
      throw error; // Re-throw to let ProductForm handle it
    }
  }

  function handleEdit(product) {
    setEditingProduct(product);
    setShowForm(true);
  }

  function handleCancel() {
    setShowForm(false);
    setEditingProduct(null);
  }

  async function handleDelete(productId, productName) {
    if (!confirm(`"${productName}" wirklich löschen?`)) {
      return;
    }

    try {
      const supabase = getSupabasePublic();
      const { error } = await supabase
        .from('products')
        .delete()
        .eq('id', productId);

      if (error) throw error;

      await loadProducts();
    } catch (error) {
      console.error('Delete error:', error);
      alert('Fehler beim Löschen');
    }
  }

  async function handleApprove(productId) {
    if (!confirm('Produkt freigeben? Es wird öffentlich sichtbar.')) {
      return;
    }

    try {
      const supabase = getSupabasePublic();
      const { error } = await supabase.rpc('approve_product', {
        product_id: productId
      });

      if (error) throw error;

      alert('Produkt freigegeben!');
      await loadProducts();
    } catch (error) {
      console.error('Approve error:', error);
      alert('Fehler beim Freigeben: ' + error.message);
    }
  }

  async function handleReject(productId) {
    const reason = prompt('Ablehnungsgrund (optional):');
    if (reason === null) return; // User cancelled

    try {
      const supabase = getSupabasePublic();
      const { error } = await supabase.rpc('reject_product', {
        product_id: productId,
        rejection_reason: reason || null
      });

      if (error) throw error;

      alert('Produkt abgelehnt.');
      await loadProducts();
    } catch (error) {
      console.error('Reject error:', error);
      alert('Fehler beim Ablehnen: ' + error.message);
    }
  }

  const filteredProducts = products.filter(p =>
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.sku.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div style={styles.loading}>
        <div style={styles.spinner}></div>
        <p>Lädt...</p>
      </div>
    );
  }

  if (!auth) return null;

  return (
    <BackendLayout user={auth.user} profile={auth.profile} title="Produkte">
      <div style={styles.container}>
        {/* Header */}
        <div style={styles.header}>
          <div>
            <h1 style={styles.title}>Produkte</h1>
            <p style={styles.subtitle}>
              {auth.isAdmin ? 'Alle Produkte verwalten und freigeben' : 'Eigene Produkte verwalten'}
            </p>
          </div>
          <button onClick={() => setShowForm(true)} style={styles.btnPrimary}>
            + Neues Produkt
          </button>
        </div>

        {/* Filters */}
        <div style={styles.filters}>
          <div style={styles.filterTabs}>
            <button
              onClick={() => setFilter('all')}
              style={{
                ...styles.filterTab,
                ...(filter === 'all' ? styles.filterTabActive : {})
              }}
            >
              Alle
            </button>
            <button
              onClick={() => setFilter('pending')}
              style={{
                ...styles.filterTab,
                ...(filter === 'pending' ? styles.filterTabActive : {})
              }}
            >
              Ausstehend
            </button>
            <button
              onClick={() => setFilter('approved')}
              style={{
                ...styles.filterTab,
                ...(filter === 'approved' ? styles.filterTabActive : {})
              }}
            >
              Freigegeben
            </button>
            {auth.isAdmin && (
              <button
                onClick={() => setFilter('rejected')}
                style={{
                  ...styles.filterTab,
                  ...(filter === 'rejected' ? styles.filterTabActive : {})
                }}
              >
                Abgelehnt
              </button>
            )}
          </div>

          <input
            type="text"
            placeholder="Suchen..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={styles.searchInput}
          />
        </div>

        {/* Form Modal */}
        {showForm && (
          <div style={styles.modal}>
            <div style={styles.modalContent}>
              <h2 style={styles.modalTitle}>
                {editingProduct ? 'Produkt bearbeiten' : 'Neues Produkt'}
              </h2>
              <ProductForm
                product={editingProduct}
                onSave={handleSave}
                onCancel={handleCancel}
              />
            </div>
          </div>
        )}

        {/* Product List */}
        <ProductList
          products={filteredProducts}
          onEdit={handleEdit}
          onDelete={handleDelete}
          onApprove={handleApprove}
          onReject={handleReject}
          isAdmin={auth.isAdmin}
          currentUserId={auth.user.id}
        />
      </div>
    </BackendLayout>
  );
}

const styles = {
  loading: {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'linear-gradient(135deg, #050812 0%, #0A0E27 100%)',
    color: '#fff',
  },
  spinner: {
    border: '4px solid rgba(255, 255, 255, 0.1)',
    borderTop: '4px solid #00FFDC',
    borderRadius: '50%',
    width: '40px',
    height: '40px',
    animation: 'spin 1s linear infinite',
    marginBottom: '20px',
  },
  container: {
    paddingBottom: '40px',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'start',
    marginBottom: '32px',
  },
  title: {
    fontSize: '32px',
    fontWeight: '700',
    marginBottom: '8px',
  },
  subtitle: {
    fontSize: '16px',
    color: 'rgba(255, 255, 255, 0.6)',
  },
  btnPrimary: {
    padding: '12px 24px',
    background: 'linear-gradient(135deg, #00FFDC 0%, #00C9A7 100%)',
    border: 'none',
    borderRadius: '8px',
    color: '#0A0E27',
    fontWeight: '600',
    cursor: 'pointer',
    fontSize: '15px',
  },
  filters: {
    display: 'flex',
    gap: '16px',
    marginBottom: '24px',
    alignItems: 'center',
  },
  filterTabs: {
    display: 'flex',
    gap: '8px',
    flex: 1,
  },
  filterTab: {
    padding: '10px 20px',
    background: 'transparent',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    borderRadius: '8px',
    color: 'rgba(255, 255, 255, 0.6)',
    cursor: 'pointer',
    fontSize: '14px',
    transition: 'all 0.3s ease',
  },
  filterTabActive: {
    background: 'rgba(0, 255, 220, 0.1)',
    borderColor: '#00FFDC',
    color: '#00FFDC',
  },
  searchInput: {
    padding: '10px 16px',
    background: 'rgba(255, 255, 255, 0.05)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    borderRadius: '8px',
    color: '#fff',
    fontSize: '14px',
    width: '250px',
  },
  modal: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'rgba(0, 0, 0, 0.8)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    padding: '20px',
  },
  modalContent: {
    background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.12) 0%, rgba(255, 255, 255, 0.08) 100%)',
    backdropFilter: 'blur(20px)',
    borderRadius: '16px',
    border: '1px solid rgba(255, 255, 255, 0.15)',
    padding: '32px',
    maxWidth: '600px',
    width: '100%',
    maxHeight: '90vh',
    overflowY: 'auto',
  },
  modalTitle: {
    fontSize: '24px',
    fontWeight: '700',
    marginBottom: '24px',
  },
};
