import { useState } from 'react';
import ProductImage from '../ProductImage';

export default function ProductForm({ product, onSave, onCancel }) {
  const [formData, setFormData] = useState({
    name: product?.name || '',
    sku: product?.sku || '',
    description: product?.description || '',
    base_price_cents: product?.base_price_cents ? product.base_price_cents / 100 : '',
    image_url: product?.image_url || '',
    image_crop_scale: product?.image_crop_scale || 1.0,
    image_crop_x: product?.image_crop_x || 0,
    image_crop_y: product?.image_crop_y || 0,
  });
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(product?.image_url || null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  function handleChange(e) {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  }

  function handleImageChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!['image/jpeg', 'image/png', 'image/webp', 'image/jpg'].includes(file.type)) {
      setError('Nur JPEG, PNG und WebP Bilder erlaubt');
      return;
    }

    // Validate file size (5MB)
    if (file.size > 5 * 1024 * 1024) {
      setError('Datei zu groß. Maximal 5MB erlaubt.');
      return;
    }

    setError(null);
    setImageFile(file);

    // Create preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setImagePreview(reader.result);
      // WICHTIG: Reset crop when new image is uploaded
      setFormData(prev => ({
        ...prev,
        image_crop_scale: 1.0,
        image_crop_x: 0,
        image_crop_y: 0,
      }));
    };
    reader.readAsDataURL(file);
  }

  // Crop handlers
  function handleCropChange(newCrop) {
    console.log('📐 Crop changed:', newCrop);
    setFormData(prev => ({
      ...prev,
      image_crop_scale: newCrop.scale,
      image_crop_x: newCrop.x,
      image_crop_y: newCrop.y,
    }));
  }

  function handleZoomChange(e) {
    const scale = parseFloat(e.target.value);
    console.log('🔍 Zoom changed:', scale);
    setFormData(prev => ({
      ...prev,
      image_crop_scale: scale,
    }));
  }

  function handleResetCrop() {
    console.log('↻ Reset crop');
    setFormData(prev => ({
      ...prev,
      image_crop_scale: 1.0,
      image_crop_x: 0,
      image_crop_y: 0,
    }));
  }

  // Pfeil-Buttons für Feintuning (10px Steps)
  function handleArrowMove(direction) {
    console.log('⬆️ Arrow move:', direction);
    const step = 10;
    setFormData(prev => {
      let newX = prev.image_crop_x;
      let newY = prev.image_crop_y;
      
      switch(direction) {
        case 'up': newY = Math.max(-200, newY - step); break;
        case 'down': newY = Math.min(200, newY + step); break;
        case 'left': newX = Math.max(-200, newX - step); break;
        case 'right': newX = Math.min(200, newX + step); break;
      }
      
      return { ...prev, image_crop_x: newX, image_crop_y: newY };
    });
  }

  async function uploadImage() {
    if (!imageFile) return formData.image_url;

    setUploading(true);
    try {
      const formDataUpload = new FormData();
      formDataUpload.append('image', imageFile);

      const response = await fetch('/api/products/upload', {
        method: 'POST',
        body: formDataUpload,
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Upload error response:', errorData);
        throw new Error(errorData.error || 'Upload fehlgeschlagen');
      }

      const { imageUrl } = await response.json();
      console.log('✅ Image uploaded, URL:', imageUrl);
      console.log('   Verify this URL works in browser!');
      return imageUrl;
    } catch (err) {
      console.error('Upload error:', err);
      throw err;
    } finally {
      setUploading(false);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setSaving(true);

    try {
      // Upload image first if selected
      let imageUrl = formData.image_url;
      if (imageFile) {
        imageUrl = await uploadImage();
      }

      // Prepare product data
      const productData = {
        name: formData.name,
        sku: formData.sku,
        description: formData.description || null,
        base_price_cents: Math.round(parseFloat(formData.base_price_cents) * 100),
        image_url: imageUrl || null,
        image_crop_scale: formData.image_crop_scale,
        image_crop_x: formData.image_crop_x,
        image_crop_y: formData.image_crop_y,
      };

      await onSave(productData);
    } catch (err) {
      console.error('Save error:', err);
      setError(err.message || 'Fehler beim Speichern');
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} style={styles.form}>
      {error && (
        <div style={styles.error}>{error}</div>
      )}

      <div style={styles.formGroup}>
        <label style={styles.label}>SKU *</label>
        <input
          type="text"
          name="sku"
          value={formData.sku}
          onChange={handleChange}
          required
          style={styles.input}
          placeholder="z.B. UBO-001"
        />
      </div>

      <div style={styles.formGroup}>
        <label style={styles.label}>Produktname *</label>
        <input
          type="text"
          name="name"
          value={formData.name}
          onChange={handleChange}
          required
          style={styles.input}
          placeholder="z.B. UNBREAK ONE Standard"
        />
      </div>

      <div style={styles.formGroup}>
        <label style={styles.label}>Beschreibung</label>
        <textarea
          name="description"
          value={formData.description}
          onChange={handleChange}
          rows={4}
          style={{ ...styles.input, resize: 'vertical' }}
          placeholder="Produktbeschreibung..."
        />
      </div>

      <div style={styles.formGroup}>
        <label style={styles.label}>Preis (EUR) *</label>
        <input
          type="number"
          name="base_price_cents"
          value={formData.base_price_cents}
          onChange={handleChange}
          required
          min="0"
          step="0.01"
          style={styles.input}
          placeholder="999.00"
        />
      </div>

      <div style={styles.formGroup}>
        <label style={styles.label}>Produktbild</label>
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={handleImageChange}
          style={styles.fileInput}
        />
        <p style={styles.hint}>Max. 5MB, JPEG/PNG/WebP</p>
      </div>

      {/* CROP EDITOR: Zoom + Drag + Reset */}
      {imagePreview && (
        <div style={styles.cropEditor}>
          <label style={styles.label}>Bild-Anpassung (4:5 Hochformat)</label>
          
          {/* Live Preview mit Drag */}
          <div style={styles.previewSection}>
            <div style={styles.previewLabel}>
              <span>Shop-Vorschau (4:5)</span>
              <span style={styles.previewHint}>← Ziehen zum Verschieben</span>
            </div>
            <ProductImage
              src={imagePreview}
              alt="Preview"
              crop={{
                scale: formData.image_crop_scale,
                x: formData.image_crop_x,
                y: formData.image_crop_y,
              }}
              variant="adminPreview"
              interactive={true}
              onCropChange={handleCropChange}
            />
          </div>

          {/* Zoom Slider */}
          <div style={styles.controlGroup}>
            <label style={styles.controlLabel}>
              Zoom: {formData.image_crop_scale.toFixed(2)}x
            </label>
            <input
              type="range"
              min="1.0"
              max="2.5"
              step="0.01"
              value={formData.image_crop_scale}
              onChange={handleZoomChange}
              style={styles.slider}
            />
            <div style={styles.sliderLabels}>
              <span>1.0x</span>
              <span>2.5x</span>
            </div>
          </div>

          {/* Position Display + Pfeil-Buttons */}
          <div style={styles.controlGroup}>
            <label style={styles.controlLabel}>
              Position: X={formData.image_crop_x} Y={formData.image_crop_y}
            </label>
            
            {/* Pfeil-Steuerung */}
            <div style={styles.arrowControls}>
              <div style={styles.arrowRow}>
                <div style={styles.arrowSpacer}></div>
                <button
                  type="button"
                  onClick={() => handleArrowMove('up')}
                  style={styles.arrowBtn}
                  title="Bild nach oben (10px)"
                >
                  ▲
                </button>
                <div style={styles.arrowSpacer}></div>
              </div>
              <div style={styles.arrowRow}>
                <button
                  type="button"
                  onClick={() => handleArrowMove('left')}
                  style={styles.arrowBtn}
                  title="Bild nach links (10px)"
                >
                  ◀
                </button>
                <div style={styles.arrowCenter}>
                  Feintuning
                </div>
                <button
                  type="button"
                  onClick={() => handleArrowMove('right')}
                  style={styles.arrowBtn}
                  title="Bild nach rechts (10px)"
                >
                  ▶
                </button>
              </div>
              <div style={styles.arrowRow}>
                <div style={styles.arrowSpacer}></div>
                <button
                  type="button"
                  onClick={() => handleArrowMove('down')}
                  style={styles.arrowBtn}
                  title="Bild nach unten (10px)"
                >
                  ▼
                </button>
                <div style={styles.arrowSpacer}></div>
              </div>
            </div>
            
            <p style={styles.hint}>
              Tipp: Direkt im Bild ziehen oder Pfeile für Feintuning (10px Schritte)
            </p>
          </div>

          {/* Reset Button */}
          <button
            type="button"
            onClick={handleResetCrop}
            style={styles.btnReset}
          >
            ↻ Zurücksetzen (Zoom & Position)
          </button>
        </div>
      )}

      <div style={styles.actions}>
        <button
          type="button"
          onClick={onCancel}
          disabled={saving || uploading}
          style={styles.btnSecondary}
        >
          Abbrechen
        </button>
        <button
          type="submit"
          disabled={saving || uploading}
          style={styles.btnPrimary}
        >
          {saving ? 'Speichert...' : uploading ? 'Lädt Bild hoch...' : product ? 'Aktualisieren' : 'Erstellen'}
        </button>
      </div>
    </form>
  );
}

const styles = {
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
  },
  error: {
    padding: '12px',
    background: 'rgba(255, 77, 77, 0.1)',
    border: '1px solid rgba(255, 77, 77, 0.3)',
    borderRadius: '8px',
    color: '#ff9999',
    fontSize: '14px',
  },
  formGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  label: {
    fontSize: '14px',
    fontWeight: '500',
    color: 'rgba(255, 255, 255, 0.9)',
  },
  input: {
    padding: '12px',
    background: 'rgba(255, 255, 255, 0.05)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    borderRadius: '8px',
    color: '#fff',
    fontSize: '15px',
  },
  fileInput: {
    padding: '8px',
    background: 'rgba(255, 255, 255, 0.05)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    borderRadius: '8px',
    color: '#fff',
    fontSize: '14px',
  },
  cropEditor: {
    marginTop: '24px',
    padding: '20px',
    background: 'rgba(255, 255, 255, 0.03)',
    borderRadius: '12px',
    border: '1px solid rgba(255, 255, 255, 0.1)',
  },
  previewSection: {
    marginBottom: '20px',
  },
  previewLabel: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '12px',
    fontSize: '14px',
    fontWeight: '500',
    color: 'rgba(255, 255, 255, 0.9)',
  },
  previewHint: {
    fontSize: '12px',
    color: 'rgba(255, 255, 255, 0.5)',
    fontWeight: '400',
  },
  controlGroup: {
    marginBottom: '16px',
  },
  controlLabel: {
    display: 'block',
    fontSize: '14px',
    fontWeight: '500',
    color: 'rgba(255, 255, 255, 0.9)',
    marginBottom: '8px',
  },
  slider: {
    width: '100%',
    height: '6px',
    borderRadius: '3px',
    background: 'rgba(255, 255, 255, 0.1)',
    outline: 'none',
    cursor: 'pointer',
  },
  sliderLabels: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: '12px',
    color: 'rgba(255, 255, 255, 0.5)',
    marginTop: '4px',
  },
  btnReset: {
    padding: '10px 20px',
    background: 'rgba(255, 255, 255, 0.08)',
    border: '1px solid rgba(255, 255, 255, 0.2)',
    borderRadius: '8px',
    color: 'rgba(255, 255, 255, 0.9)',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '500',
    width: '100%',
  },
  arrowControls: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    marginTop: '12px',
    marginBottom: '8px',
  },
  arrowRow: {
    display: 'flex',
    justifyContent: 'center',
    gap: '4px',
  },
  arrowSpacer: {
    width: '36px',
  },
  arrowCenter: {
    width: '80px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '11px',
    color: 'rgba(255, 255, 255, 0.4)',
  },
  arrowBtn: {
    width: '36px',
    height: '36px',
    background: 'rgba(255, 255, 255, 0.08)',
    border: '1px solid rgba(255, 255, 255, 0.2)',
    borderRadius: '6px',
    color: 'rgba(255, 255, 255, 0.9)',
    cursor: 'pointer',
    fontSize: '16px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all 0.2s',
  },
  hint: {
    fontSize: '12px',
    color: 'rgba(255, 255, 255, 0.5)',
    marginTop: '4px',
  },
  actions: {
    display: 'flex',
    gap: '12px',
    justifyContent: 'flex-end',
    marginTop: '12px',
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
  btnSecondary: {
    padding: '12px 24px',
    background: 'rgba(255, 255, 255, 0.08)',
    border: '1px solid rgba(255, 255, 255, 0.2)',
    borderRadius: '8px',
    color: 'rgba(255, 255, 255, 0.9)',
    cursor: 'pointer',
    fontSize: '15px',
  },
};
