// PROFESSIONAL PRODUCT MANAGEMENT - ADMIN EDIT FORM
// File: pages/admin/products/[id].js
// Replace the entire existing file with this version

import { useRouter } from 'next/router';
import { useState, useEffect, useCallback, useRef } from 'react';
import { useSession } from 'next-auth/react';
import Head from 'next/head';
import { getSupabasePublic } from '../../../lib/supabase';
import AdminLayout from '../../../components/AdminLayout';
import ProductImage from '../../../components/ProductImage';
import CroppedImage from '../../../components/CroppedImage';
import { getProductImageUrl } from '../../../lib/storage-utils';
import { 
  calculateCoverScale, 
  clampCropState, 
  sanitizeCropState, 
  getDefaultCrop,
  isValidSize,
  isValidCropState 
} from '../../../lib/crop-utils';

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
  const [imageVersion, setImageVersion] = useState(Date.now()); // Cache-busting
  
  // CRITICAL: Separate draft (UI live) from persisted (DB) crop state
  const [draftCrop, setDraftCrop] = useState({ scale: 1.0, x: 0, y: 0 });
  const latestDraftRef = useRef({ scale: 1.0, x: 0, y: 0 });
  
  // NEUE: Track Image + Container Size für coverScaleMin-Berechnung
  const [imageSize, setImageSize] = useState(null);
  const [containerSize, setContainerSize] = useState({ width: 400, height: 500 }); // Default 4:5
  
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    sku: '',
    base_price_cents: 0,
    active: true,
    image_url: '',
    image_path: '',
    image_crop_scale: 1.0,
    image_crop_x: 0,
    image_crop_y: 0,
    badge_label: '',
    shipping_text: 'Versand 3–5 Tage',
    highlights: ['', '', ''],
  });

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/admin/login');
    }
  }, [status, router]);

  // Sync latestDraftRef whenever draftCrop changes
  useEffect(() => {
    latestDraftRef.current = draftCrop;
  }, [draftCrop]);

  // Reset crop when image changes (wichtig für Cache-Busting)
  useEffect(() => {
    if (product?.image_path !== formData.image_path && formData.image_path) {
      console.log('[Admin] Image changed - resetting crop to defaults');
      const defaultCrop = { scale: 1.0, x: 0, y: 0 };
      setDraftCrop(defaultCrop);
      setFormData(prev => ({
        ...prev,
        image_crop_scale: defaultCrop.scale,
        image_crop_x: defaultCrop.x,
        image_crop_y: defaultCrop.y,
      }));
    }
  }, [product?.image_path]);

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
        
        // GUARD: Sanitize crop values (kann null/""/NaN aus DB sein!)
        const rawCrop = {
          scale: data.imageCropScale || data.image_crop_scale,
          x: data.imageCropX || data.image_crop_x,
          y: data.imageCropY || data.image_crop_y
        };
        const safeCrop = sanitizeCropState(rawCrop);
        
        // DEBUG: Warn wenn DB NaN hatte
        if (!isValidCropState(rawCrop)) {
          console.warn('[Admin] Invalid crop from DB, sanitized:', {
            productId: id,
            raw: rawCrop,
            sanitized: safeCrop
          });
        }
        
        setFormData({
          name: data.name || '',
          description: data.description || '',
          sku: data.sku || '',
          base_price_cents: data.base_price_cents || 0,
          active: data.active ?? true,
          image_url: data.image_url || '',
          image_path: data.image_path || '',
          image_crop_scale: safeCrop.scale,
          image_crop_x: safeCrop.x,
          image_crop_y: safeCrop.y,
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

  const handleCropChange = (newCrop) => {
    // GUARD: Validate incoming crop
    if (!isValidCropState(newCrop)) {
      console.error('[Admin] handleCropChange: INVALID CROP REJECTED!', newCrop);
      return;
    }
    
    // Optional: Clamping falls imageSize bekannt (ProductImage macht das auch intern)
    const finalCrop = imageSize && containerSize
      ? clampCropState(newCrop, imageSize, containerSize)
      : sanitizeCropState(newCrop);
    
    // DEBUG: UI draftCrop tracking
    console.log('🎨 [UI draftCrop]', {
      scale: finalCrop.scale,
      x: finalCrop.x,
      y: finalCrop.y,
      sourceImage: formData.image_path,
      previewFrame: '4:5',
      previewW: containerSize?.width || 'loading',
      previewH: containerSize?.height || 'loading',
    });
    
    // Update ONLY draftCrop (UI live state) - formData stays unchanged until Save
    setDraftCrop(finalCrop);
  };

  const handleZoomChange = (e) => {
    const newScale = parseFloat(e.target.value);
    
    const newCrop = { 
      scale: newScale, 
      x: draftCrop.x, 
      y: draftCrop.y 
    };
    
    // Clamp damit Position bei Zoom-Out nicht zu leeren Bereichen führt
    handleCropChange(newCrop);
  };

  const handleArrowMove = (dx, dy) => {
    const step = 10;
    
    const newCrop = {
      scale: draftCrop.scale,
      x: draftCrop.x + dx * step,
      y: draftCrop.y + dy * step,
    };
    
    // Clamp automatisch (keine hardcoded -200/+200 mehr!)
    handleCropChange(newCrop);
  };

  const handleResetCrop = () => {
    // WICHTIG: Reset auf coverScaleMin (nicht hardcoded 1.0!)
    const defaultCrop = imageSize && containerSize
      ? getDefaultCrop(imageSize, containerSize)
      : { scale: 1.0, x: 0, y: 0 };
    
    console.log('[Admin] Reset crop to default:', defaultCrop);
    handleCropChange(defaultCrop);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);

    try {
      const url = id === 'new' ? '/api/admin/products' : `/api/admin/products/${id}`;
      const method = id === 'new' ? 'POST' : 'PATCH';

      const highlights = formData.highlights.filter(h => h.trim() !== '');
      
      // CRITICAL: Use latestDraftRef to prevent stale state!
      const cropPayload = {
        image_crop_scale: latestDraftRef.current.scale,
        image_crop_x: latestDraftRef.current.x,
        image_crop_y: latestDraftRef.current.y,
      };
      
      // DEBUG: Save payload tracking
      console.log('💾 [SAVE payload]', {
        productId: id,
        crop: {
          scale: latestDraftRef.current.scale,
          x: latestDraftRef.current.x,
          y: latestDraftRef.current.y,
        },
        previewImagePath: formData.image_path,
      });

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          ...cropPayload, // Override with latest ref values
          highlights: highlights.length > 0 ? highlights : null,
        }),
      });

      if (!res.ok) {
        throw new Error('Speichern fehlgeschlagen');
      }

      const data = await res.json();
      
      console.log('✅ [Admin] Save response:', {
        productId: data.id,
        shop_image_path: data.shop_image_path || data.shopImagePath,
        thumb_path: data.thumb_path || data.thumbPath,
        crop: {
          scale: data.image_crop_scale || data.imageCropScale,
          x: data.image_crop_x || data.imageCropX,
          y: data.image_crop_y || data.imageCropY,
        }
      });
      
      if (id === 'new') {
        router.push(`/admin/products/${data.id}`);
      } else {
        // CRITICAL: Update product state with fresh data (includes new shop_image_path!)
        setProduct(data);
        
        // Bump version for cache-busting
        setImageVersion(Date.now());
        
        // Sync both formData AND draftCrop with saved values (in case backend modified them)
        const savedCrop = {
          scale: data.image_crop_scale || data.imageCropScale || latestDraftRef.current.scale,
          x: data.image_crop_x || data.imageCropX || latestDraftRef.current.x,
          y: data.image_crop_y || data.imageCropY || latestDraftRef.current.y,
        };
        
        setDraftCrop(savedCrop);
        
        setFormData(prev => ({
          ...prev,
          shop_image_path: data.shop_image_path || data.shopImagePath,
          thumb_path: data.thumb_path || data.thumbPath,
          image_crop_scale: savedCrop.scale,
          image_crop_x: savedCrop.x,
          image_crop_y: savedCrop.y,
        }));
        
        alert('Produkt erfolgreich aktualisiert ✓');
      }
    } catch (err) {
      console.error('[Admin] Save error:', err);
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
                {/* Upload Dropzone */}
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
                  ) : (formData.image_url || formData.image_path) ? (
                    <div className="image-uploaded">
                      <label className="replace-btn">
                        ✓ Bild hochgeladen - Ersetzen
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

                {/* CROP EDITOR mit 4:5 Ratio */}
                {(formData.image_url || formData.image_path) && (
                  <div className="image-control-panel">
                    <h3>🎨 Bildausschnitt bearbeiten (4:5 Format)</h3>
                    
                    <div className="crop-editor-layout">
                      {/* Interactive Crop Editor */}
                      <div className="crop-editor-container">
                        <label>✋ Ziehen & Zoomen:</label>
                        <CroppedImage
                          src={getProductImageUrl(formData.image_path, formData.image_url, product?.image_updated_at)}
                          alt={formData.name}
                          crop={draftCrop}
                          interactive={true}
                          onCropChange={handleCropChange}
                          onImageLoad={(size) => setImageSize(size)}
                        />
                        <small>💡 Mit Maus ziehen oder Touch verwenden</small>
                      </div>

                      {/* Crop Controls */}
                      <div className="crop-controls">
                        <label>🔍 Zoom:</label>
                        <input
                          type="range"
                          min={imageSize && containerSize && isValidSize(imageSize) && isValidSize(containerSize)
                            ? calculateCoverScale(imageSize, containerSize).toFixed(2)
                            : "1.0"
                          }
                          max="2.5"
                          step="0.1"
                          value={isFinite(draftCrop.scale) ? draftCrop.scale : 1.0}
                          onChange={handleZoomChange}
                          className="zoom-slider"
                          disabled={!imageSize}
                        />
                        <div className="zoom-value">
                          {isFinite(draftCrop.scale) 
                            ? `${draftCrop.scale.toFixed(1)}x` 
                            : 'NaN (FEHLER!)'}
                          {imageSize && containerSize && isValidSize(imageSize) && isValidSize(containerSize) && (
                            <small style={{display: 'block', fontSize: '11px', opacity: 0.7}}>
                              (Min: {calculateCoverScale(imageSize, containerSize).toFixed(2)}x)
                            </small>
                          )}
                          {!imageSize && (
                            <small style={{display: 'block', fontSize: '11px', color: '#999'}}>
                              Warte auf Bild...
                            </small>
                          )}
                        </div>

                        <label style={{marginTop: '16px'}}>🎯 Position (Feintuning):</label>
                        <div className="arrow-controls">
                          <button type="button" onClick={() => handleArrowMove(0, -1)} className="arrow-btn" disabled={!imageSize}>⬆️</button>
                          <div className="arrow-row">
                            <button type="button" onClick={() => handleArrowMove(-1, 0)} className="arrow-btn" disabled={!imageSize}>⬅️</button>
                            <button type="button" onClick={handleResetCrop} className="reset-btn" title="Zurücksetzen">🎯</button>
                            <button type="button" onClick={() => handleArrowMove(1, 0)} className="arrow-btn" disabled={!imageSize}>➡️</button>
                          </div>
                          <button type="button" onClick={() => handleArrowMove(0, 1)} className="arrow-btn" disabled={!imageSize}>⬇️</button>
                        </div>
                        <small>Pfeile verschieben um 10px{!imageSize && ' (warte auf Bild...)'}</small>

                        <div className="crop-info">
                          <strong>Aktuelle Position:</strong><br/>
                          X: {isFinite(draftCrop.x) ? `${draftCrop.x}px` : 'NaN (FEHLER!)'} | 
                          Y: {isFinite(draftCrop.y) ? `${draftCrop.y}px` : 'NaN (FEHLER!)'}
                        </div>
                      </div>
                    </div>

                    {/* Shop Preview - LIVE: Always uses draftCrop for instant feedback */}
                    <div className="shop-preview">
                      <label>👀 So sieht's im Shop aus (4:5):</label>
                      <CroppedImage
                        src={getProductImageUrl(formData.image_path, formData.image_url, product?.image_updated_at)}
                        alt={formData.name}
                        crop={draftCrop}
                      />
                      <small style={{color: '#10b981', fontSize: '0.85em', marginTop: '8px', display: 'block'}}>
                        ✓ Live Preview (reagiert sofort auf Änderungen)
                      </small>
                      {(() => {
                        const previewSrc = getProductImageUrl(formData.image_path, formData.image_url, product?.image_updated_at);
                        console.log('🔍 [PREVIEW SOURCE]', {
                          image_path: formData.image_path,
                          image_url: formData.image_url,
                          image_updated_at: product?.image_updated_at,
                          resolvedSrc: previewSrc,
                          draftCrop: { scale: draftCrop.scale, x: draftCrop.x, y: draftCrop.y }
                        });
                        return null;
                      })()}
                    </div>
                  </div>
                )}
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
        
        .image-uploaded { display: flex; justify-content: center; align-items: center; padding: 20px; }
        
        /* CROP EDITOR */
        .image-control-panel { margin-top: 24px; padding: 24px; background: #0f172a; border-radius: 12px; border: 1px solid #1e293b; }
        .image-control-panel h3 { font-size: 16px; color: #f8fafc; margin: 0 0 20px 0; }
        
        .crop-editor-layout { display: grid; grid-template-columns: 1fr 300px; gap: 24px; margin-bottom: 24px; }
        
        .crop-editor-container label { display: block; font-size: 13px; color: #94a3b8; margin-bottom: 12px; font-weight: 500; }
        .crop-editor-container small { display: block; margin-top: 8px; color: #64748b; font-size: 12px; }
        
        .crop-controls { display: flex; flex-direction: column; }
        .crop-controls label { display: block; font-size: 13px; color: #94a3b8; margin-bottom: 8px; font-weight: 500; }
        
        .zoom-slider { width: 100%; height: 6px; border-radius: 3px; background: #1e293b; 
          -webkit-appearance: none; appearance: none; outline: none; }
        .zoom-slider::-webkit-slider-thumb { -webkit-appearance: none; appearance: none; width: 18px; height: 18px; 
          border-radius: 50%; background: #0ea5e9; cursor: pointer; }
        .zoom-slider::-moz-range-thumb { width: 18px; height: 18px; border-radius: 50%; background: #0ea5e9; cursor: pointer; border: none; }
        .zoom-value { text-align: center; color: #f8fafc; font-weight: 600; margin-top: 8px; font-size: 14px; }
        
        .arrow-controls { display: grid; grid-template-rows: auto auto auto; gap: 4px; justify-items: center; margin-top: 8px; }
        .arrow-row { display: flex; gap: 4px; }
        .arrow-btn, .reset-btn { width: 40px; height: 40px; background: #1e293b; border: 1px solid #334155; 
          border-radius: 6px; cursor: pointer; font-size: 18px; transition: all 0.2s; }
        .arrow-btn:hover, .reset-btn:hover { background: #334155; border-color: #0ea5e9; }
        .reset-btn { background: #0ea5e9; border-color: #0ea5e9; }
        .reset-btn:hover { background: #0284c7; }
        
        .crop-info { margin-top: 16px; padding: 12px; background: #1e293b; border-radius: 6px; font-size: 12px; color: #cbd5e1; }
        
        .shop-preview { margin-top: 16px; padding-top: 16px; border-top: 1px solid #1e293b; }
        .shop-preview label { display: block; font-size: 13px; color: #94a3b8; margin-bottom: 12px; font-weight: 500; }
        
        @media (max-width: 768px) { 
          .form-row { grid-template-columns: 1fr; } 
          .crop-editor-layout { grid-template-columns: 1fr; }
        }
        
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
