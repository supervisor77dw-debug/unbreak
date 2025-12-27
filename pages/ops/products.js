import { createClient } from '@supabase/supabase-js';
import { useState, useEffect } from 'react';
import Head from 'next/head';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export default function OpsProducts() {
  const [supabase, setSupabase] = useState(null);
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingProduct, setEditingProduct] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const client = createClient(supabaseUrl, supabaseAnonKey);
    setSupabase(client);
    checkAuth(client);
  }, []);

  async function checkAuth(client) {
    try {
      const { data: { user } } = await client.auth.getUser();
      
      if (!user) {
        window.location.href = '/login.html?redirect=/ops/products';
        return;
      }

      setUser(user);

      // Get user profile with role
      const { data: profile } = await client
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (!profile || !['staff', 'admin'].includes(profile.role)) {
        alert('Zugriff verweigert. Nur Staff und Admin können Produkte verwalten.');
        window.location.href = '/';
        return;
      }

      setProfile(profile);
      loadProducts(client);
    } catch (error) {
      console.error('Auth error:', error);
      window.location.href = '/login.html';
    }
  }

  async function loadProducts(client) {
    try {
      const { data, error } = await client
        .from('products')
        .select('*')
        .order('sort_order', { ascending: true });

      if (error) throw error;
      setProducts(data || []);
    } catch (error) {
      console.error('Error loading products:', error);
      alert('Fehler beim Laden der Produkte');
    } finally {
      setLoading(false);
    }
  }

  async function handleSave(product) {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('products')
        .update({
          name: product.name,
          short_description_de: product.short_description_de,
          short_description_en: product.short_description_en,
          long_description_de: product.long_description_de,
          long_description_en: product.long_description_en,
          base_price_cents: parseInt(product.base_price_cents),
          currency: product.currency,
          image_url: product.image_url,
          active: product.active,
          sort_order: parseInt(product.sort_order),
          stripe_price_id: product.stripe_price_id || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', product.id);

      if (error) throw error;

      alert('Produkt gespeichert!');
      setEditingProduct(null);
      loadProducts(supabase);
    } catch (error) {
      console.error('Save error:', error);
      alert('Fehler beim Speichern: ' + error.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleActive(product) {
    try {
      const { error } = await supabase
        .from('products')
        .update({ active: !product.active })
        .eq('id', product.id);

      if (error) throw error;
      loadProducts(supabase);
    } catch (error) {
      console.error('Toggle error:', error);
      alert('Fehler beim Aktualisieren');
    }
  }

  function formatPrice(cents) {
    return new Intl.NumberFormat('de-DE', {
      style: 'currency',
      currency: 'EUR',
    }).format(cents / 100);
  }

  if (loading) {
    return (
      <div className="loading-container">
        <div className="spinner"></div>
        <p>Lade Produkte...</p>
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>Produktverwaltung – Ops | UNBREAK ONE</title>
      </Head>

      <div className="ops-container">
        <header className="ops-header">
          <h1>🛒 Produktverwaltung</h1>
          <div className="user-info">
            {profile && (
              <span>
                {profile.role === 'admin' ? '👑' : '🔧'} {user.email}
              </span>
            )}
          </div>
        </header>

        <div className="products-table-container">
          <table className="products-table">
            <thead>
              <tr>
                <th>Status</th>
                <th>SKU</th>
                <th>Name</th>
                <th>Preis</th>
                <th>Sortierung</th>
                <th>Bild</th>
                <th>Aktionen</th>
              </tr>
            </thead>
            <tbody>
              {products.map((product) => (
                <tr key={product.id} className={!product.active ? 'inactive' : ''}>
                  <td>
                    <button
                      className={`status-toggle ${product.active ? 'active' : 'inactive'}`}
                      onClick={() => handleToggleActive(product)}
                      title={product.active ? 'Deaktivieren' : 'Aktivieren'}
                    >
                      {product.active ? '✓' : '✗'}
                    </button>
                  </td>
                  <td className="sku">{product.sku}</td>
                  <td>{product.name}</td>
                  <td className="price">{formatPrice(product.base_price_cents)}</td>
                  <td className="sort-order">{product.sort_order}</td>
                  <td>
                    {product.image_url && (
                      <img
                        src={product.image_url}
                        alt={product.name}
                        className="product-thumbnail"
                      />
                    )}
                  </td>
                  <td>
                    <button
                      className="btn-edit"
                      onClick={() => setEditingProduct(product)}
                    >
                      Bearbeiten
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Edit Modal */}
        {editingProduct && (
          <div className="modal-overlay" onClick={() => setEditingProduct(null)}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h2>Produkt bearbeiten</h2>
                <button
                  className="modal-close"
                  onClick={() => setEditingProduct(null)}
                >
                  ✕
                </button>
              </div>

              <div className="modal-body">
                <div className="form-group">
                  <label>SKU (nicht änderbar)</label>
                  <input type="text" value={editingProduct.sku} disabled />
                </div>

                <div className="form-group">
                  <label>Name</label>
                  <input
                    type="text"
                    value={editingProduct.name}
                    onChange={(e) =>
                      setEditingProduct({ ...editingProduct, name: e.target.value })
                    }
                  />
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Preis (Cent)</label>
                    <input
                      type="number"
                      value={editingProduct.base_price_cents}
                      onChange={(e) =>
                        setEditingProduct({
                          ...editingProduct,
                          base_price_cents: e.target.value,
                        })
                      }
                    />
                    <small>{formatPrice(editingProduct.base_price_cents)}</small>
                  </div>

                  <div className="form-group">
                    <label>Sortierung</label>
                    <input
                      type="number"
                      value={editingProduct.sort_order}
                      onChange={(e) =>
                        setEditingProduct({
                          ...editingProduct,
                          sort_order: e.target.value,
                        })
                      }
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label>Kurzbeschreibung (DE)</label>
                  <textarea
                    rows="2"
                    value={editingProduct.short_description_de || ''}
                    onChange={(e) =>
                      setEditingProduct({
                        ...editingProduct,
                        short_description_de: e.target.value,
                      })
                    }
                  />
                </div>

                <div className="form-group">
                  <label>Kurzbeschreibung (EN)</label>
                  <textarea
                    rows="2"
                    value={editingProduct.short_description_en || ''}
                    onChange={(e) =>
                      setEditingProduct({
                        ...editingProduct,
                        short_description_en: e.target.value,
                      })
                    }
                  />
                </div>

                <div className="form-group">
                  <label>Bild URL</label>
                  <input
                    type="text"
                    value={editingProduct.image_url || ''}
                    onChange={(e) =>
                      setEditingProduct({
                        ...editingProduct,
                        image_url: e.target.value,
                      })
                    }
                    placeholder="/images/..."
                  />
                </div>

                <div className="form-group">
                  <label>Stripe Price ID (optional)</label>
                  <input
                    type="text"
                    value={editingProduct.stripe_price_id || ''}
                    onChange={(e) =>
                      setEditingProduct({
                        ...editingProduct,
                        stripe_price_id: e.target.value,
                      })
                    }
                    placeholder="price_..."
                  />
                </div>

                <div className="form-group">
                  <label>
                    <input
                      type="checkbox"
                      checked={editingProduct.active}
                      onChange={(e) =>
                        setEditingProduct({
                          ...editingProduct,
                          active: e.target.checked,
                        })
                      }
                    />
                    <span style={{ marginLeft: '8px' }}>Aktiv (im Shop sichtbar)</span>
                  </label>
                </div>
              </div>

              <div className="modal-footer">
                <button className="btn-cancel" onClick={() => setEditingProduct(null)}>
                  Abbrechen
                </button>
                <button
                  className="btn-save"
                  onClick={() => handleSave(editingProduct)}
                  disabled={saving}
                >
                  {saving ? 'Speichert...' : 'Speichern'}
                </button>
              </div>
            </div>
          </div>
        )}

        <style jsx>{`
          .loading-container {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
            gap: 1rem;
          }

          .spinner {
            border: 3px solid #f3f3f3;
            border-top: 3px solid #0c7c7c;
            border-radius: 50%;
            width: 40px;
            height: 40px;
            animation: spin 1s linear infinite;
          }

          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }

          .ops-container {
            max-width: 1400px;
            margin: 0 auto;
            padding: 2rem;
          }

          .ops-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 2rem;
            padding-bottom: 1rem;
            border-bottom: 2px solid #0c7c7c;
          }

          .ops-header h1 {
            margin: 0;
            color: #0c7c7c;
          }

          .user-info {
            color: #666;
            font-size: 0.9rem;
          }

          .products-table-container {
            background: white;
            border-radius: 8px;
            overflow: hidden;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
          }

          .products-table {
            width: 100%;
            border-collapse: collapse;
          }

          .products-table th {
            background: #0c7c7c;
            color: white;
            padding: 1rem;
            text-align: left;
            font-weight: 600;
          }

          .products-table td {
            padding: 0.75rem 1rem;
            border-bottom: 1px solid #eee;
          }

          .products-table tr.inactive {
            opacity: 0.5;
          }

          .products-table tr:hover {
            background: #f9f9f9;
          }

          .sku {
            font-family: monospace;
            font-size: 0.85rem;
            color: #666;
          }

          .price {
            font-weight: 600;
            color: #0c7c7c;
          }

          .sort-order {
            text-align: center;
          }

          .product-thumbnail {
            width: 60px;
            height: 60px;
            object-fit: cover;
            border-radius: 4px;
          }

          .status-toggle {
            width: 36px;
            height: 36px;
            border-radius: 50%;
            border: 2px solid;
            background: white;
            cursor: pointer;
            font-weight: bold;
            transition: all 0.3s;
          }

          .status-toggle.active {
            border-color: #0c7c7c;
            color: #0c7c7c;
          }

          .status-toggle.inactive {
            border-color: #ccc;
            color: #ccc;
          }

          .status-toggle:hover {
            transform: scale(1.1);
          }

          .btn-edit {
            background: #0c7c7c;
            color: white;
            border: none;
            padding: 0.5rem 1rem;
            border-radius: 4px;
            cursor: pointer;
            font-size: 0.9rem;
            transition: all 0.3s;
          }

          .btn-edit:hover {
            background: #0a6565;
          }

          .modal-overlay {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.6);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 1000;
          }

          .modal-content {
            background: white;
            border-radius: 12px;
            width: 90%;
            max-width: 700px;
            max-height: 90vh;
            overflow-y: auto;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
          }

          .modal-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 1.5rem;
            border-bottom: 1px solid #eee;
          }

          .modal-header h2 {
            margin: 0;
            color: #0c7c7c;
          }

          .modal-close {
            background: none;
            border: none;
            font-size: 1.5rem;
            cursor: pointer;
            color: #666;
          }

          .modal-body {
            padding: 1.5rem;
          }

          .form-group {
            margin-bottom: 1.25rem;
          }

          .form-row {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 1rem;
          }

          .form-group label {
            display: block;
            margin-bottom: 0.5rem;
            font-weight: 600;
            color: #333;
          }

          .form-group input,
          .form-group textarea {
            width: 100%;
            padding: 0.75rem;
            border: 1px solid #ddd;
            border-radius: 4px;
            font-size: 1rem;
            font-family: inherit;
          }

          .form-group input:disabled {
            background: #f5f5f5;
            cursor: not-allowed;
          }

          .form-group small {
            display: block;
            margin-top: 0.25rem;
            color: #0c7c7c;
            font-weight: 600;
          }

          .modal-footer {
            display: flex;
            justify-content: flex-end;
            gap: 1rem;
            padding: 1.5rem;
            border-top: 1px solid #eee;
          }

          .btn-cancel,
          .btn-save {
            padding: 0.75rem 1.5rem;
            border: none;
            border-radius: 4px;
            font-size: 1rem;
            cursor: pointer;
            transition: all 0.3s;
          }

          .btn-cancel {
            background: #eee;
            color: #333;
          }

          .btn-cancel:hover {
            background: #ddd;
          }

          .btn-save {
            background: #0c7c7c;
            color: white;
          }

          .btn-save:hover:not(:disabled) {
            background: #0a6565;
          }

          .btn-save:disabled {
            opacity: 0.6;
            cursor: not-allowed;
          }

          @media (max-width: 768px) {
            .ops-container {
              padding: 1rem;
            }

            .products-table {
              font-size: 0.85rem;
            }

            .products-table th,
            .products-table td {
              padding: 0.5rem;
            }

            .form-row {
              grid-template-columns: 1fr;
            }
          }
        `}</style>
      </div>
    </>
  );
}
