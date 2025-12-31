import { useRouter } from 'next/router';
import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import Head from 'next/head';
import AdminLayout from '../../../components/AdminLayout';

export default function ProductDetail() {
  const router = useRouter();
  const { id } = router.query;
  const { data: session, status } = useSession();
  
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  
  const [formData, setFormData] = useState({
    name_de: '',
    name_en: '',
    description_de: '',
    description_en: '',
    sku: '',
    base_price_cents: 0,
    stock_quantity: 0,
    active: true,
    image_url: '',
  });

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/admin/login');
    }
  }, [status, router]);

  useEffect(() => {
    if (!id || id === 'new') return;
    
    async function fetchProduct() {
      try {
        const res = await fetch(`/api/admin/products/${id}`);
        if (!res.ok) {
          throw new Error(`Failed to fetch product: ${res.status}`);
        }
        const data = await res.json();
        setProduct(data);
        setFormData({
          name_de: data.name_de || '',
          name_en: data.name_en || '',
          description_de: data.description_de || '',
          description_en: data.description_en || '',
          sku: data.sku || '',
          base_price_cents: data.base_price_cents || 0,
          stock_quantity: data.stock_quantity || 0,
          active: data.active ?? true,
          image_url: data.image_url || '',
        });
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    
    fetchProduct();
  }, [id]);

  const handleChange = (field, value) => {
    setFormData({ ...formData, [field]: value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);

    try {
      const url = id === 'new' ? '/api/admin/products' : `/api/admin/products/${id}`;
      const method = id === 'new' ? 'POST' : 'PATCH';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (!res.ok) {
        throw new Error('Speichern fehlgeschlagen');
      }

      const data = await res.json();
      
      if (id === 'new') {
        router.push(`/admin/products/${data.id}`);
      } else {
        setProduct(data);
        alert('Produkt erfolgreich aktualisiert');
      }
    } catch (err) {
      alert('Fehler beim Speichern: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  if (status === 'loading' || loading) {
    return (
      <AdminLayout>
        <div className="loading">Produkt wird geladen...</div>
      </AdminLayout>
    );
  }

  if (error) {
    return (
      <AdminLayout>
        <div className="error-state">
          <h2>Fehler</h2>
          <p>{error}</p>
          <button onClick={() => router.push('/admin/products')}>← Zurück zu Produkten</button>
        </div>
      </AdminLayout>
    );
  }

  const formatPrice = (cents) => (cents / 100).toFixed(2);

  return (
    <AdminLayout>
      <Head>
        <title>{id === 'new' ? 'Neues Produkt' : 'Produkt bearbeiten'} - Admin - UNBREAK ONE</title>
      </Head>

      <div className="product-detail">
        <div className="header">
          <button className="back-btn" onClick={() => router.push('/admin/products')}>
            ← Zurück
          </button>
          <h1>{id === 'new' ? 'Neues Produkt erstellen' : 'Produkt bearbeiten'}</h1>
        </div>

        <form onSubmit={handleSubmit} className="product-form">
          <div className="form-section">
            <h2>Grundinformationen</h2>
            
            <div className="form-row">
              <div className="form-group">
                <label>Produktname (Deutsch) *</label>
                <input
                  type="text"
                  value={formData.name_de}
                  onChange={(e) => handleChange('name_de', e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label>Produktname (Englisch)</label>
                <input
                  type="text"
                  value={formData.name_en}
                  onChange={(e) => handleChange('name_en', e.target.value)}
                />
              </div>
            </div>

            <div className="form-group">
              <label>Beschreibung (Deutsch)</label>
              <textarea
                value={formData.description_de}
                onChange={(e) => handleChange('description_de', e.target.value)}
                rows={4}
              />
            </div>

            <div className="form-group">
              <label>Beschreibung (Englisch)</label>
              <textarea
                value={formData.description_en}
                onChange={(e) => handleChange('description_en', e.target.value)}
                rows={4}
              />
            </div>
          </div>

          <div className="form-section">
            <h2>Preis & Lagerbestand</h2>
            
            <div className="form-row">
              <div className="form-group">
                <label>SKU</label>
                <input
                  type="text"
                  value={formData.sku}
                  onChange={(e) => handleChange('sku', e.target.value)}
                  placeholder="z.B. UNB-001"
                />
              </div>

              <div className="form-group">
                <label>Preis (€) *</label>
                <input
                  type="number"
                  step="0.01"
                  value={formatPrice(formData.base_price_cents)}
                  onChange={(e) => handleChange('base_price_cents', Math.round(parseFloat(e.target.value) * 100))}
                  required
                />
              </div>

              <div className="form-group">
                <label>Lagerbestand</label>
                <input
                  type="number"
                  value={formData.stock_quantity}
                  onChange={(e) => handleChange('stock_quantity', parseInt(e.target.value) || 0)}
                />
              </div>
            </div>
          </div>

          <div className="form-section">
            <h2>Medien</h2>
            
            <div className="form-group">
              <label>Bild-URL</label>
              <input
                type="url"
                value={formData.image_url}
                onChange={(e) => handleChange('image_url', e.target.value)}
                placeholder="https://..."
              />
              {formData.image_url && (
                <div className="image-preview">
                  <img src={formData.image_url} alt="Vorschau" />
                </div>
              )}
            </div>
          </div>

          <div className="form-section">
            <h2>Status</h2>
            
            <div className="form-group">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={formData.active}
                  onChange={(e) => handleChange('active', e.target.checked)}
                />
                <span>Produkt ist aktiv (im Shop sichtbar)</span>
              </label>
            </div>
          </div>

          <div className="form-actions">
            <button type="button" onClick={() => router.push('/admin/products')} className="btn-cancel">
              Abbrechen
            </button>
            <button type="submit" disabled={saving} className="btn-save">
              {saving ? 'Wird gespeichert...' : 'Speichern'}
            </button>
          </div>
        </form>
      </div>

      <style jsx>{`
        .product-detail {
          max-width: 900px;
          margin: 0 auto;
        }

        .header {
          margin-bottom: 32px;
        }

        .back-btn {
          background: #0a4d4d;
          color: #d4f1f1;
          border: none;
          padding: 8px 16px;
          border-radius: 6px;
          cursor: pointer;
          font-size: 14px;
          margin-bottom: 16px;
          transition: background 0.2s;
        }

        .back-btn:hover {
          background: #0d6666;
        }

        .header h1 {
          color: #d4f1f1;
          margin: 0;
        }

        .product-form {
          display: flex;
          flex-direction: column;
          gap: 32px;
        }

        .form-section {
          background: #262626;
          border: 1px solid #404040;
          border-radius: 8px;
          padding: 24px;
        }

        .form-section h2 {
          color: #d4f1f1;
          font-size: 18px;
          margin: 0 0 20px 0;
          padding-bottom: 12px;
          border-bottom: 1px solid #404040;
        }

        .form-row {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 16px;
        }

        .form-group {
          display: flex;
          flex-direction: column;
          gap: 8px;
          margin-bottom: 16px;
        }

        .form-group:last-child {
          margin-bottom: 0;
        }

        .form-group label {
          color: #94a3b8;
          font-size: 14px;
          font-weight: 600;
        }

        .form-group input,
        .form-group textarea {
          background: #1a1a1a;
          border: 1px solid #404040;
          border-radius: 6px;
          color: #d4f1f1;
          padding: 10px 12px;
          font-size: 14px;
          font-family: inherit;
        }

        .form-group input:focus,
        .form-group textarea:focus {
          outline: none;
          border-color: #0a4d4d;
        }

        .form-group textarea {
          resize: vertical;
        }

        .checkbox-label {
          display: flex;
          align-items: center;
          gap: 10px;
          cursor: pointer;
          color: #d4f1f1;
        }

        .checkbox-label input[type="checkbox"] {
          width: 18px;
          height: 18px;
          cursor: pointer;
        }

        .image-preview {
          margin-top: 12px;
          max-width: 200px;
          border-radius: 8px;
          overflow: hidden;
          border: 1px solid #404040;
        }

        .image-preview img {
          width: 100%;
          height: auto;
          display: block;
        }

        .form-actions {
          display: flex;
          gap: 12px;
          justify-content: flex-end;
          padding-top: 20px;
        }

        .btn-cancel,
        .btn-save {
          padding: 12px 24px;
          border-radius: 6px;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
          border: none;
        }

        .btn-cancel {
          background: #1a1a1a;
          color: #d4f1f1;
          border: 1px solid #404040;
        }

        .btn-cancel:hover {
          background: #222;
        }

        .btn-save {
          background: #0a4d4d;
          color: #d4f1f1;
        }

        .btn-save:hover:not(:disabled) {
          background: #0d6666;
        }

        .btn-save:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .loading,
        .error-state {
          text-align: center;
          padding: 48px;
          color: #94a3b8;
        }

        .error-state h2 {
          color: #ef4444;
          margin-bottom: 16px;
        }

        .error-state button {
          background: #0a4d4d;
          color: #d4f1f1;
          border: none;
          padding: 10px 20px;
          border-radius: 6px;
          cursor: pointer;
          font-size: 14px;
          margin-top: 16px;
        }
      `}</style>
    </AdminLayout>
  );
}

export async function getServerSideProps() {
  return { props: {} };
}
