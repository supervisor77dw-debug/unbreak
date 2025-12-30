import { useState } from 'react';

export default function ProductForm({ product, onSave, onCancel }) {
  const [formData, setFormData] = useState({
    name: product?.name || '',
    sku: product?.sku || '',
    description: product?.description || '',
    base_price_cents: product?.base_price_cents ? product.base_price_cents / 100 : '',
    image_url: product?.image_url || '',
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
    };
    reader.readAsDataURL(file);
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
        const error = await response.json();
        throw new Error(error.error || 'Upload fehlgeschlagen');
      }

      const { imageUrl } = await response.json();
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
        {imagePreview && (
          <div style={styles.imagePreview}>
            <img src={imagePreview} alt="Preview" style={styles.previewImg} />
          </div>
        )}
        <p style={styles.hint}>Max. 5MB, JPEG/PNG/WebP</p>
      </div>

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
  imagePreview: {
    marginTop: '12px',
    borderRadius: '8px',
    overflow: 'hidden',
    maxWidth: '200px',
  },
  previewImg: {
    width: '100%',
    height: 'auto',
    display: 'block',
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
