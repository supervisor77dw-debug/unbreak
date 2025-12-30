export default function ProductList({ products, onEdit, onDelete, onApprove, onReject, isAdmin, currentUserId }) {
  
  function getStatusBadge(status) {
    const badges = {
      draft: { color: '#999', text: 'Entwurf' },
      pending_review: { color: '#ff9800', text: 'Ausstehend' },
      approved: { color: '#4caf50', text: 'Freigegeben' },
      rejected: { color: '#f44336', text: 'Abgelehnt' }
    };
    const badge = badges[status] || badges.draft;
    return <span style={{ ...styles.badge, background: badge.color }}>{badge.text}</span>;
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
    });
  }

  if (products.length === 0) {
    return (
      <div style={styles.empty}>
        <p>Keine Produkte gefunden</p>
      </div>
    );
  }

  return (
    <div style={styles.list}>
      {products.map(product => {
        const isOwner = product.created_by === currentUserId;
        const canEdit = isAdmin || isOwner;
        const canApprove = isAdmin && product.status === 'pending_review';

        return (
          <div key={product.id} style={styles.card}>
            <div style={styles.cardContent}>
              {/* Image */}
              {product.image_url ? (
                <div style={styles.imageContainer}>
                  <img 
                    src={product.image_url} 
                    alt={product.name} 
                    style={styles.image}
                    onError={(e) => {
                      console.error('❌ Image load failed:', product.image_url);
                      e.target.style.display = 'none';
                    }}
                    onLoad={() => console.log('✅ Image loaded:', product.image_url)}
                  />
                </div>
              ) : (
                <div style={styles.imageContainer}>
                  <div style={styles.placeholder}>Kein Bild</div>
                </div>
              )}

              {/* Info */}
              <div style={styles.info}>
                <div style={styles.header}>
                  <div>
                    <h3 style={styles.title}>{product.name}</h3>
                    <p style={styles.sku}>SKU: {product.sku}</p>
                  </div>
                  {getStatusBadge(product.status)}
                </div>

                {product.description && (
                  <p style={styles.description}>{product.description}</p>
                )}

                <div style={styles.meta}>
                  <span>{formatPrice(product.base_price_cents)}</span>
                  <span>•</span>
                  <span>Erstellt: {formatDate(product.created_at)}</span>
                </div>
              </div>

              {/* Actions */}
              <div style={styles.actions}>
                {canEdit && (
                  <button
                    onClick={() => onEdit(product)}
                    style={styles.btnSecondary}
                  >
                    Bearbeiten
                  </button>
                )}

                {canApprove && (
                  <>
                    <button
                      onClick={() => onApprove(product.id)}
                      style={styles.btnApprove}
                    >
                      ✓ Freigeben
                    </button>
                    <button
                      onClick={() => onReject(product.id)}
                      style={styles.btnReject}
                    >
                      ✗ Ablehnen
                    </button>
                  </>
                )}

                {canEdit && (
                  <button
                    onClick={() => onDelete(product.id, product.name)}
                    style={styles.btnDanger}
                  >
                    Löschen
                  </button>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

const styles = {
  list: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  empty: {
    textAlign: 'center',
    padding: '60px 20px',
    background: 'rgba(255, 255, 255, 0.03)',
    borderRadius: '12px',
    color: 'rgba(255, 255, 255, 0.5)',
  },
  card: {
    background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.08) 0%, rgba(255, 255, 255, 0.04) 100%)',
    backdropFilter: 'blur(20px)',
    borderRadius: '12px',
    border: '1px solid rgba(255, 255, 255, 0.12)',
    padding: '20px',
    transition: 'all 0.3s ease',
  },
  cardContent: {
    display: 'flex',
    gap: '20px',
    alignItems: 'start',
  },
  imageContainer: {
    width: '120px',
    height: '120px',
    flexShrink: 0,
    borderRadius: '8px',
    overflow: 'hidden',
    background: 'rgba(0, 0, 0, 0.2)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  image: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  },
  placeholder: {
    fontSize: '12px',
    color: 'rgba(255, 255, 255, 0.3)',
    textAlign: 'center',
  },
  info: {
    flex: 1,
    minWidth: 0,
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'start',
    marginBottom: '12px',
  },
  title: {
    fontSize: '18px',
    fontWeight: '600',
    marginBottom: '4px',
  },
  sku: {
    fontSize: '13px',
    color: 'rgba(255, 255, 255, 0.5)',
  },
  badge: {
    padding: '4px 12px',
    borderRadius: '12px',
    fontSize: '12px',
    fontWeight: 'bold',
    color: '#fff',
  },
  description: {
    fontSize: '14px',
    color: 'rgba(255, 255, 255, 0.7)',
    marginBottom: '12px',
    lineHeight: '1.5',
  },
  meta: {
    fontSize: '13px',
    color: 'rgba(255, 255, 255, 0.5)',
    display: 'flex',
    gap: '8px',
  },
  actions: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    marginLeft: 'auto',
  },
  btnSecondary: {
    padding: '8px 16px',
    background: 'rgba(255, 255, 255, 0.08)',
    border: '1px solid rgba(255, 255, 255, 0.2)',
    borderRadius: '8px',
    color: 'rgba(255, 255, 255, 0.9)',
    cursor: 'pointer',
    fontSize: '14px',
    whiteSpace: 'nowrap',
  },
  btnApprove: {
    padding: '8px 16px',
    background: '#4caf50',
    border: 'none',
    borderRadius: '8px',
    color: '#fff',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '600',
    whiteSpace: 'nowrap',
  },
  btnReject: {
    padding: '8px 16px',
    background: '#ff9800',
    border: 'none',
    borderRadius: '8px',
    color: '#fff',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '600',
    whiteSpace: 'nowrap',
  },
  btnDanger: {
    padding: '8px 16px',
    background: 'rgba(255, 77, 77, 0.1)',
    border: '1px solid rgba(255, 77, 77, 0.3)',
    borderRadius: '8px',
    color: '#ff9999',
    cursor: 'pointer',
    fontSize: '14px',
    whiteSpace: 'nowrap',
  },
};
