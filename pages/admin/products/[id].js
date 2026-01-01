// PROFESSIONAL PRODUCT MANAGEMENT - ADMIN EDIT FORM
// File: pages/admin/products/[id].js
// Replace the entire existing file with this version

import { useRouter } from 'next/router';
import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import Head from 'next/head';
import AdminLayout from '../../../components/AdminLayout';
import { getProductImageUrl } from '../../../lib/storage-utils';

export default function ProductDetail() {
  const router = useRouter();
  const { id } = router.query;
  const { data: session, status } = useSession();
  
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    sku: '',
    base_price_cents: 0,
    active: true,
    image_url: '',
    badge_label: '',
    shipping_text: 'Versand 3–5 Tage',
    highlights: ['', '', ''],
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
        
        // Parse highlights from JSONB
        let highlightsArray = ['', '', ''];
        if (data.highlights) {
          try {
            const parsed = typeof data.highlights === 'string' 
              ? JSON.parse(data.highlights) 
              : data.highlights;
            if (Array.isArray(parsed)) {
              highlightsArray = [...parsed, '', ''].slice(0, 3);
            }
          } catch (e) {
            console.warn('Failed to parse highlights:', e);
          }
        }
        
        setFormData({
          name: data.name || '',
          description: data.description || '',
          sku: data.sku || '',
          base_price_cents: data.base_price_cents || 0,
          active: data.active ?? true,
          image_url: data.image_url || '',
          badge_label: data.badge_label || '',
          shipping_text: data.shipping_text || 'Versand 3–5 Tage',
          highlights: highlightsArray,
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

  const handleHighlightChange = (index, value) => {
    const newHighlights = [...formData.highlights];
    newHighlights[index] = value;
    setFormData({ ...formData, highlights: newHighlights });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);

    try {
      const url = id === 'new' ? '/api/admin/products' : `/api/admin/products/${id}`;
      const method = id === 'new' ? 'POST' : 'PATCH';

      const highlights = formData.highlights.filter(h => h.trim() !== '');

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          highlights: highlights.length > 0 ? highlights : null,
        }),
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

  const handleImageUpload = async (file) => {
    if (!file) return;
    
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      alert('Ungültiges Dateiformat. Bitte JPG, PNG oder WebP verwenden.');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      alert('Datei zu groß. Maximale Größe: 5MB');
      return;
    }

    setUploading(true);
    setError(null); // Clear previous errors

    try {
      const formDataUpload = new FormData();
      formDataUpload.append('image', file);

      console.log('[Admin] Uploading image for product', id);

      const res = await fetch(`/api/admin/products/${id}/upload-image`, {
        method: 'POST',
        body: formDataUpload,
      });

      const data = await res.json();

      if (!res.ok) {
        console.error('[Admin] Upload failed:', {
          status: res.status,
          error: data.error,
          details: data.details,
          bucket: data.bucket,
          path: data.path,
        });
        throw new Error(data.error || data.details || 'Upload fehlgeschlagen');
      }

      console.log('[Admin] Upload success:', data);
      
      // Update form state with new image data (API returns camelCase from Prisma)
      setFormData(prev => ({
        ...prev,
        image_url: data.imageUrl,
        image_path: data.imagePath,
      }));
      
      // Update product state (convert to snake_case for consistency with Supabase fetch)
      setProduct(prev => ({
        ...prev,
        image_url: data.imageUrl,
        image_path: data.imagePath,
      }));

      alert('Bild erfolgreich hochgeladen!');
    } catch (err) {
      console.error('[Admin] Upload error:', err);
      setError('Upload-Fehler: ' + err.message);
      alert('Upload-Fehler: ' + err.message);
    } finally {
      setUploading(false);
    }
  };

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (id === 'new') {
      alert('Bitte speichern Sie das Produkt zuerst, bevor Sie ein Bild hochladen.');
      return;
    }

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleImageUpload(e.dataTransfer.files[0]);
    }
  }, [id]);

  const handleDrag = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

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
        <title>{id === 'new' ? 'Neues Produkt' : 'Produkt bearbeiten'} - Admin</title>
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
            
            <div className="form-group">
              <label>Produktname *</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => handleChange('name', e.target.value)}
                placeholder="z.B. Weinglashalter"
                required
              />
            </div>

            <div className="form-group">
              <label>Beschreibung</label>
              <textarea
                value={formData.description}
                onChange={(e) => handleChange('description', e.target.value)}
                placeholder="Produktbeschreibung..."
                rows={4}
              />
            </div>
          </div>

          <div className="form-section">
            <h2>Preis & SKU</h2>
            
            <div className="form-row">
              <div className="form-group">
                <label>SKU *</label>
                <input
                  type="text"
                  value={formData.sku}
                  onChange={(e) => handleChange('sku', e.target.value)}
                  placeholder="z.B. UNBREAK-WEIN-01"
                  required
                  disabled={id !== 'new'}
                />
                {id !== 'new' && (
                  <small>SKU kann nach Erstellung nicht geändert werden</small>
                )}
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
            </div>
          </div>

          <div className="form-section">
            <h2>Produktbild</h2>
            
            {id === 'new' ? (
              <div className="upload-hint">
                <p>💡 Bitte speichern Sie das Produkt zuerst, bevor Sie ein Bild hochladen.</p>
              </div>
            ) : (
              <div className="image-upload-section">
                <div 
                  className={`dropzone ${dragActive ? 'active' : ''} ${uploading ? 'uploading' : ''}`}
                  onDragEnter={handleDrag}
                  onDragLeave={handleDrag}
                  onDragOver={handleDrag}
                  onDrop={handleDrop}
                >
                  {uploading ? (
                    <div className="upload-progress">
                      <div className="spinner"></div>
                      <p>Bild wird hochgeladen...</p>
                    </div>
                  ) : (formData.image_url || formData.image_path || product?.image_path || product?.image_url) ? (
                    <div className="image-preview-large">
                      <img 
                        src={getProductImageUrl(formData.image_path || product?.image_path, formData.image_url || product?.image_url)} 
                        alt={formData.name}
                        onError={(e) => {
                          console.error('[ProductImage] Preview load failed:', {
                            src: e.target.src,
                            formData: { image_path: formData.image_path, image_url: formData.image_url },
                            product: { image_path: product?.image_path, image_url: product?.image_url },
                          });
                          e.target.style.display = 'none';
                          e.target.nextSibling.style.display = 'flex';
                        }}
                        onLoad={() => {
                          console.log('[ProductImage] Preview loaded successfully');
                        }}
                      />
                      <div className="image-placeholder" style={{ display: 'none' }}>
                        <svg width="60" height="60" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                          <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                          <circle cx="8.5" cy="8.5" r="1.5"></circle>
                          <polyline points="21 15 16 10 5 21"></polyline>
                        </svg>
                      </div>
                      <div className="image-actions">
                        <label className="replace-btn">
                          Bild ersetzen
                          <input
                            type="file"
                            accept="image/jpeg,image/jpg,image/png,image/webp"
                            onChange={(e) => {
                              if (e.target.files && e.target.files[0]) {
                                handleImageUpload(e.target.files[0]);
                              }
                            }}
                            style={{ display: 'none' }}
                          />
                        </label>
                      </div>
                    </div>
                  ) : (
                    <div className="dropzone-content">
                      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                        <polyline points="17 8 12 3 7 8"></polyline>
                        <line x1="12" y1="3" x2="12" y2="15"></line>
                      </svg>
                      <p><strong>Bild hochladen</strong></p>
                      <p>Ziehen Sie ein Bild hierher oder klicken Sie zum Auswählen</p>
                      <label className="select-file-btn">
                        Datei auswählen
                        <input
                          type="file"
                          accept="image/jpeg,image/jpg,image/png,image/webp"
                          onChange={(e) => {
                            if (e.target.files && e.target.files[0]) {
                              handleImageUpload(e.target.files[0]);
                            }
                          }}
                          style={{ display: 'none' }}
                        />
                      </label>
                      <small>JPG, PNG oder WebP (max. 5MB)</small>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="form-section">
            <h2>Shop-Anzeige</h2>
            
            <div className="form-group">
              <label>Badge / Label <span className="optional">(optional)</span></label>
              <input
                type="text"
                value={formData.badge_label}
                onChange={(e) => handleChange('badge_label', e.target.value.slice(0, 20))}
                placeholder='z.B. "Gastro Edition" oder "Bestseller"'
                maxLength={20}
              />
              <small>Max. 20 Zeichen. Wird als Pill-Badge angezeigt.</small>
              {formData.badge_label && (
                <div className="badge-preview">
                  <span className="badge-pill">{formData.badge_label}</span>
                </div>
              )}
            </div>

            <div className="form-group">
              <label>Versandzeit</label>
              <select
                value={formData.shipping_text}
                onChange={(e) => handleChange('shipping_text', e.target.value)}
              >
                <option value="Versand 1–3 Tage">Versand 1–3 Tage</option>
                <option value="Versand 3–5 Tage">Versand 3–5 Tage</option>
                <option value="Versand 5–7 Tage">Versand 5–7 Tage</option>
                <option value="Versand 1–2 Wochen">Versand 1–2 Wochen</option>
                <option value="Auf Anfrage">Auf Anfrage</option>
              </select>
              <small>Wird unter dem Preis im Shop angezeigt.</small>
            </div>

            <div className="form-group">
              <label>Highlights / USPs <span className="optional">(optional, max. 3)</span></label>
              {formData.highlights.map((highlight, index) => (
                <input
                  key={index}
                  type="text"
                  value={highlight}
                  onChange={(e) => handleHighlightChange(index, e.target.value)}
                  placeholder={`USP ${index + 1} (z.B. "Made in Germany")`}
                  maxLength={50}
                  style={{ marginBottom: '8px' }}
                />
              ))}
              <small>Kurze Verkaufsargumente (je max. 50 Zeichen).</small>
            </div>
          </div>

          <div className="form-section">
            <h2>Status</h2>
            <div className="form-group checkbox-group">
              <label>
                <input
                  type="checkbox"
                  checked={formData.active}
                  onChange={(e) => handleChange('active', e.target.checked)}
                />
                <span>Aktiv (im Shop sichtbar)</span>
              </label>
            </div>
          </div>

          <div className="form-actions">
            <button 
              type="button" 
              className="btn-secondary" 
              onClick={() => router.push('/admin/products')}
              disabled={saving}
            >
              Abbrechen
            </button>
            <button 
              type="submit" 
              className="btn-primary" 
              disabled={saving}
            >
              {saving ? 'Speichern...' : 'Speichern'}
            </button>
          </div>
        </form>
      </div>

      <style jsx>{`
        .product-detail { max-width: 900px; margin: 0 auto; }
        .header { margin-bottom: 32px; }
        .back-btn { background: none; border: none; color: #0ea5e9; cursor: pointer; font-size: 14px; padding: 0; margin-bottom: 16px; }
        .back-btn:hover { text-decoration: underline; }
        .product-form { display: flex; flex-direction: column; gap: 32px; }
        .form-section { background: #1e293b; border-radius: 12px; padding: 24px; }
        .form-section h2 { font-size: 18px; margin: 0 0 20px 0; color: #f8fafc; }
        .form-group { margin-bottom: 20px; }
        .form-group:last-child { margin-bottom: 0; }
        .form-group label { display: block; margin-bottom: 8px; color: #cbd5e1; font-size: 14px; font-weight: 500; }
        .form-group input[type="text"], .form-group input[type="number"], .form-group textarea, .form-group select { 
          width: 100%; padding: 10px 12px; background: #0f172a; border: 1px solid #334155; border-radius: 6px; 
          color: #f8fafc; font-size: 14px; 
        }
        .form-group input:focus, .form-group textarea:focus, .form-group select:focus { outline: none; border-color: #0ea5e9; }
        .form-group input:disabled { opacity: 0.5; cursor: not-allowed; }
        .form-group small { color: #64748b; font-size: 12px; display: block; margin-top: 4px; }
        .form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
        .checkbox-group label { display: flex; align-items: center; gap: 8px; cursor: pointer; }
        .checkbox-group input[type="checkbox"] { width: 18px; height: 18px; cursor: pointer; }
        .optional { color: #64748b; font-weight: normal; font-size: 12px; }
        
        .upload-hint { background: #1e3a8a; border: 1px solid #3b82f6; border-radius: 8px; padding: 16px; color: #93c5fd; }
        .upload-hint p { margin: 0; font-size: 14px; }
        
        .dropzone { border: 2px dashed #334155; border-radius: 12px; padding: 40px 20px; text-align: center; 
          background: #0f172a; transition: all 0.2s; cursor: pointer; }
        .dropzone.active { border-color: #0ea5e9; background: #1e293b; }
        .dropzone.uploading { cursor: wait; }
        .dropzone-content { display: flex; flex-direction: column; align-items: center; gap: 12px; }
        .dropzone-content svg { color: #64748b; }
        .dropzone-content p { margin: 0; color: #cbd5e1; }
        .dropzone-content small { color: #64748b; font-size: 12px; }
        
        .select-file-btn { display: inline-block; padding: 8px 16px; background: #0ea5e9; color: white; 
          border-radius: 6px; cursor: pointer; font-size: 14px; font-weight: 500; transition: background 0.2s; }
        .select-file-btn:hover { background: #0284c7; }
        
        .upload-progress { display: flex; flex-direction: column; align-items: center; gap: 12px; }
        .spinner { width: 40px; height: 40px; border: 3px solid #334155; border-top-color: #0ea5e9; 
          border-radius: 50%; animation: spin 0.8s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
        
        .image-preview-large { position: relative; }
        .image-preview-large img { width: 100%; max-width: 400px; height: auto; border-radius: 8px; margin: 0 auto; display: block; }
        .image-placeholder { width: 100%; max-width: 400px; height: 300px; background: #0f172a; border: 1px solid #334155; 
          border-radius: 8px; display: flex; align-items: center; justify-content: center; color: #64748b; margin: 0 auto; }
        .image-actions { margin-top: 16px; text-align: center; }
        .replace-btn { display: inline-block; padding: 8px 16px; background: #334155; color: #f8fafc; 
          border-radius: 6px; cursor: pointer; font-size: 14px; transition: background 0.2s; }
        .replace-btn:hover { background: #475569; }
        
        .badge-preview { margin-top: 12px; }
        .badge-pill { display: inline-block; padding: 4px 12px; background: linear-gradient(135deg, #0ea5e9, #3b82f6); 
          color: white; border-radius: 16px; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; }
        
        .form-actions { display: flex; gap: 12px; justify-content: flex-end; padding-top: 16px; }
        .btn-primary, .btn-secondary { padding: 12px 24px; border-radius: 6px; font-size: 14px; font-weight: 500; 
          cursor: pointer; transition: all 0.2s; border: none; }
        .btn-primary { background: #0ea5e9; color: white; }
        .btn-primary:hover:not(:disabled) { background: #0284c7; }
        .btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
        .btn-secondary { background: #334155; color: #f8fafc; }
        .btn-secondary:hover:not(:disabled) { background: #475569; }
        
        .loading, .error-state { padding: 40px; text-align: center; color: #cbd5e1; }
        @media (max-width: 768px) { .form-row { grid-template-columns: 1fr; } }
      `}</style>
    </AdminLayout>
  );
}
