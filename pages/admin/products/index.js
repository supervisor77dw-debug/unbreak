import { useSession } from 'next-auth/react';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import AdminLayout from '../../../components/AdminLayout';
import { getProductImageUrl } from '../../../lib/storage-utils';

export async function getServerSideProps() {
  return { props: {} };
}

export default function ProductsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all'); // all, active, inactive

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/admin/login');
    }
  }, [status, router]);

  useEffect(() => {
    if (session) {
      fetchProducts();
    }
  }, [session, search, filter]);

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.append('search', search);
      if (filter !== 'all') params.append('active', filter === 'active');

      const res = await fetch(`/api/admin/products?${params}`);
      if (res.ok) {
        const data = await res.json();
        setProducts(data.products || []);
      }
    } catch (err) {
      console.error('Failed to fetch products:', err);
    } finally {
      setLoading(false);
    }
  };

  const toggleActive = async (productId, currentStatus) => {
    if (!confirm(`Produkt ${currentStatus ? 'deaktivieren' : 'aktivieren'}?`)) {
      return;
    }

    try {
      const res = await fetch(`/api/admin/products/${productId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: !currentStatus }),
      });

      if (res.ok) {
        fetchProducts();
      } else {
        alert('Fehler beim Aktualisieren');
      }
    } catch (err) {
      alert('Fehler: ' + err.message);
    }
  };

  if (status === 'loading' || !session) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: '#0f0f0f', color: '#fff' }}>
        Wird geladen...
      </div>
    );
  }

  // Only ADMIN can access product management
  if (session.user.role !== 'ADMIN') {
    return (
      <AdminLayout>
        <Head>
          <title>Zugriff verweigert - UNBREAK ONE Admin</title>
        </Head>
        <div style={{ padding: '40px' }}>
          <div style={{ 
            background: '#1a1a1a', 
            padding: '60px', 
            borderRadius: '12px', 
            textAlign: 'center',
            border: '1px solid #ff4444'
          }}>
            <div style={{ fontSize: '48px', marginBottom: '20px' }}>🔒</div>
            <h2 style={{ color: '#ff4444', fontSize: '24px', marginBottom: '10px' }}>Zugriff verweigert</h2>
            <p style={{ color: '#888' }}>Sie benötigen die ADMIN-Rolle für die Produktverwaltung</p>
          </div>
        </div>
      </AdminLayout>
    );
  }

  const formatPrice = (cents) => `€${(cents / 100).toFixed(2)}`;

  return (
    <AdminLayout>
      <Head>
        <title>Produkte - Admin - UNBREAK ONE</title>
      </Head>

      <div className="admin-page-header">
        <div>
          <h1>Produktverwaltung</h1>
          <p>Produkte, Preise und Lagerbestände verwalten</p>
        </div>
        <Link href="/admin/products/new" className="add-button">
          + Neues Produkt
        </Link>
      </div>

      <div className="admin-filters">
        <input
          type="text"
          placeholder="Nach Produktname oder SKU suchen..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="admin-search-input"
        />

        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="admin-filter-select"
        >
          <option value="all">Alle Produkte</option>
          <option value="active">Nur Aktive</option>
          <option value="inactive">Nur Inaktive</option>
        </select>
      </div>

      {loading ? (
        <div className="admin-loading">Produkte werden geladen...</div>
      ) : products.length === 0 ? (
        <div className="admin-empty">
          <p>Keine Produkte gefunden</p>
        </div>
      ) : (
        <div className="admin-table-container">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Bild</th>
                <th>Name</th>
                <th>SKU</th>
                <th>Beschreibung</th>
                <th>Preis</th>
                <th>Status</th>
                <th>Aktionen</th>
              </tr>
            </thead>
            <tbody>
              {products.map((product) => {
                const imageUrl = getProductImageUrl(product.image_path, product.image_url);
                
                return (
                  <tr key={product.id}>
                    <td>
                      <div className="product-image" title={`Image: ${product.image_path || product.image_url || 'none'}\nURL: ${imageUrl}`}>
                        <img 
                          src={imageUrl}
                          alt={product.name}
                          loading="lazy"
                          onError={(e) => {
                            console.warn('[ProductImage] Load failed:', {
                              productId: product.id,
                              sku: product.sku,
                              attemptedUrl: e.target.src,
                              imagePath: product.image_path,
                              imageUrl: product.image_url,
                            });
                            // Fallback zu Placeholder
                            if (e.target.src !== window.location.origin + '/images/product-weinglashalter.jpg') {
                              e.target.src = '/images/product-weinglashalter.jpg';
                            } else {
                              // Auch Placeholder failed → zeige Icon
                              e.target.style.display = 'none';
                              e.target.nextSibling.style.display = 'flex';
                            }
                          }}
                          onLoad={(e) => {
                            // Erfolgreich geladen - verstecke Fallback Icon
                            if (e.target.nextSibling) {
                              e.target.nextSibling.style.display = 'none';
                            }
                          }}
                        />
                        <div className="no-image" style={{ display: 'none' }}>
                          📦
                        </div>
                      </div>
                    </td>
                  <td>
                    <div className="product-name">{product.name}</div>
                  </td>
                  <td className="mono">{product.sku || '—'}</td>
                  <td>
                    {product.description && (
                      <div className="product-desc">{product.description.substring(0, 80)}...</div>
                    )}
                  </td>
                  <td className="price-cell">{formatPrice(product.base_price_cents)}</td>
                  <td>
                    <button
                      onClick={() => toggleActive(product.id, product.active)}
                      className={`status-toggle ${product.active ? 'active' : 'inactive'}`}
                    >
                      {product.active ? '✓ Aktiv' : '✗ Inaktiv'}
                    </button>
                  </td>
                  <td>
                    <Link href={`/admin/products/${product.id}`} className="action-link">
                      Bearbeiten →
                    </Link>
                  </td>
                </tr>
              );
              })}
            </tbody>
          </table>
        </div>
      )}

      <style jsx>{`
        .admin-page-header {
          margin-bottom: 30px;
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 20px;
        }

        .admin-page-header h1 {
          color: #fff;
          font-size: 32px;
          font-weight: 700;
          margin: 0 0 8px 0;
        }

        .admin-page-header p {
          color: #666;
          margin: 0;
        }

        .add-button {
          background: #0a4d4d;
          color: #d4f1f1;
          border: none;
          border-radius: 6px;
          padding: 10px 20px;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          text-decoration: none;
          transition: all 0.2s;
          white-space: nowrap;
          display: inline-block;
        }

        .add-button:hover {
          background: #0d6666;
          transform: translateY(-1px);
        }

        .admin-filters {
          display: flex;
          gap: 12px;
          margin-bottom: 24px;
          flex-wrap: wrap;
        }

        .admin-search-input {
          flex: 1;
          min-width: 250px;
          background: #1a1a1a;
          border: 1px solid #2a2a2a;
          border-radius: 6px;
          color: #fff;
          font-size: 14px;
          padding: 10px 14px;
        }

        .admin-filter-select {
          min-width: 180px;
          background: #1a1a1a;
          border: 1px solid #2a2a2a;
          border-radius: 6px;
          color: #fff;
          font-size: 14px;
          padding: 10px 14px;
        }

        .admin-search-input:focus,
        .admin-filter-select:focus {
          outline: none;
          border-color: #0a4d4d;
        }

        .admin-table-container {
          background: #1a1a1a;
          border: 1px solid #2a2a2a;
          border-radius: 12px;
          overflow: hidden;
        }

        .admin-table {
          width: 100%;
          border-collapse: collapse;
        }

        .admin-table thead {
          background: #222;
        }

        .admin-table th {
          color: #999;
          font-size: 13px;
          font-weight: 600;
          text-align: left;
          padding: 14px 16px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .admin-table td {
          color: #ddd;
          font-size: 14px;
          padding: 16px;
          border-top: 1px solid #2a2a2a;
        }

        .admin-table tbody tr:hover {
          background: #222;
        }

        .product-image {
          width: 60px;
          height: 60px;
          border-radius: 6px;
          overflow: hidden;
          background: #222;
          display: flex;
          align-items: center;
          justify-content: center;
          position: relative;
          border: 1px solid #333;
        }

        .product-image img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
        }

        .no-image {
          font-size: 24px;
          position: absolute;
          color: #666;
        }

        .product-name {
          font-weight: 500;
          color: #fff;
        }

        .product-desc {
          color: #999;
          font-size: 13px;
          margin-top: 4px;
        }

        .mono {
          font-family: monospace;
          color: #999;
        }

        .price-cell {
          font-weight: 600;
          font-family: monospace;
          color: #0a4d4d;
        }

        .stock-badge {
          display: inline-block;
          padding: 4px 10px;
          border-radius: 4px;
          font-size: 12px;
          font-weight: 600;
        }

        .stock-badge.ok {
          background: #065f46;
          color: #d1fae5;
        }

        .stock-badge.low {
          background: #854d0e;
          color: #fef3c7;
        }

        .stock-badge.out {
          background: #991b1b;
          color: #fee2e2;
        }

        .status-toggle {
          padding: 4px 12px;
          border-radius: 4px;
          font-size: 12px;
          font-weight: 600;
          border: none;
          cursor: pointer;
          transition: all 0.2s;
        }

        .status-toggle.active {
          background: #065f46;
          color: #d1fae5;
        }

        .status-toggle.inactive {
          background: #991b1b;
          color: #fee2e2;
        }

        .status-toggle:hover {
          opacity: 0.8;
        }

        .product-image {
          width: 60px;
          height: 60px;
          border-radius: 6px;
          overflow: hidden;
          background: #1a1a1a;
          border: 1px solid #333;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .product-image img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .no-image {
          font-size: 24px;
          color: #555;
          display: flex;
          align-items: center;
          justify-content: center;
          width: 100%;
          height: 100%;
        }

        .action-link {
          color: #0a4d4d;
          text-decoration: none;
          font-weight: 500;
          font-size: 13px;
        }

        .action-link:hover {
          text-decoration: underline;
        }

        .admin-loading,
        .admin-empty {
          text-align: center;
          padding: 60px 20px;
          color: #666;
          font-size: 16px;
        }

        @media (max-width: 768px) {
          .admin-table-container {
            overflow-x: auto;
          }
        }
      `}</style>
    </AdminLayout>
  );
}

