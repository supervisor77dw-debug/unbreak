import Head from 'next/head';
import Script from 'next/script';
import { useEffect, useState } from 'react';
import { getSupabasePublic } from '../lib/supabase';

export default function Shop({ initialProducts }) {
  const [products, setProducts] = useState(initialProducts || []);
  const [loading, setLoading] = useState(!initialProducts);
  const [error, setError] = useState(null);

  useEffect(() => {
    // If no SSR data, fetch client-side
    if (!initialProducts || initialProducts.length === 0) {
      loadProducts();
    }
  }, [initialProducts]);

  async function loadProducts() {
    try {
      const supabase = getSupabasePublic();
      if (!supabase) {
        throw new Error('Supabase client not available');
      }

      const { data, error: fetchError } = await supabase
        .from('products')
        .select('*')
        .eq('active', true)
        .order('sort_order', { ascending: true });

      if (fetchError) throw fetchError;
      setProducts(data || []);
      setError(null);
    } catch (err) {
      console.error('Error loading products:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function formatPrice(cents) {
    return new Intl.NumberFormat('de-DE', {
      style: 'currency',
      currency: 'EUR',
    }).format(cents / 100);
  }

  return (
    <>
      <Head>
        <title>Shop – UNBREAK ONE | Magnetische Halter kaufen</title>
        <meta
          name="description"
          content="UNBREAK ONE Shop: Professionelle magnetische Weinglashalter und Flaschenhalter. Jetzt online kaufen."
        />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <link rel="stylesheet" href="/styles.css" />
        <link rel="stylesheet" href="/i18n.css" />
        <link rel="stylesheet" href="/animations.css" />
      </Head>

      {/* Header (dynamisch geladen via component) */}
      <div id="header-container"></div>

      <main className="page-content">
        {/* Hero Section */}
        <section className="shop-hero">
          <div className="container">
            <h1 data-i18n="shop.title">Shop</h1>
            <p data-i18n="shop.subtitle">
              Magnetische Halter für Gläser & Flaschen – Einzelprodukte,
              Bundles und vorkonfigurierte Sets
            </p>
          </div>
        </section>

        {/* Products Section */}
        <section className="products-section">
          <div className="container">
            {loading ? (
              <div className="loading-state">
                <div className="spinner"></div>
                <p>Produkte werden geladen...</p>
              </div>
            ) : error ? (
              <div className="error-state">
                <p className="error-message">
                  Fehler beim Laden der Produkte: {error}
                </p>
                <button onClick={loadProducts} className="btn-retry">
                  Erneut versuchen
                </button>
              </div>
            ) : products.length === 0 ? (
              <div className="empty-state">
                <h2>Bald verfügbar</h2>
                <p>Unsere Produkte werden gerade vorbereitet.</p>
                <a href="/configurator.html" className="btn-primary">
                  Zum Konfigurator
                </a>
              </div>
            ) : (
              <div className="products-grid">
                {products.map((product) => (
                  <div key={product.id} className="product-card glass-card">
                    {product.image_url && (
                      <div className="product-image-wrapper">
                        <img
                          src={product.image_url}
                          alt={product.name}
                          className="product-image"
                        />
                      </div>
                    )}

                    <div className="product-content">
                      <h3 className="product-title">{product.name}</h3>
                      <p className="product-description">
                        {product.short_description_de || product.description}
                      </p>

                      <div className="product-footer">
                        <span className="product-price">
                          {formatPrice(product.base_price_cents)}
                        </span>

                        <button
                          className="btn-buy"
                          data-checkout="standard"
                          data-sku={product.sku}
                        >
                          Kaufen
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* CTA Section */}
        <section className="cta-section">
          <div className="container">
            <h2>Individuelle Konfiguration gewünscht?</h2>
            <p>
              Gestalte deinen eigenen UNBREAK ONE mit unserem 3D-Konfigurator
            </p>
            <a href="/configurator.html" className="btn-cta-secondary">
              Zum Konfigurator
            </a>
          </div>
        </section>
      </main>

      {/* Footer (dynamisch geladen via component) */}
      <div id="footer-container"></div>

      {/* Load Components */}
      <Script src="/components/header.js" strategy="afterInteractive" />
      <Script src="/components/footer.js" strategy="afterInteractive" />
      <Script src="/components/page-wrapper.js" strategy="afterInteractive" />
      <Script src="/i18n.js" strategy="afterInteractive" />
      <Script src="/animations.js" strategy="afterInteractive" />
      
      {/* Checkout Integration - Auto-initializes buy buttons */}
      <Script src="/lib/checkout.js" strategy="afterInteractive" />

      <style jsx>{`
        .shop-hero {
          padding: calc(var(--spacing-xl) * 2) 0 var(--spacing-xl);
          background: linear-gradient(
            135deg,
            var(--petrol-dark) 0%,
            var(--petrol) 100%
          );
          color: white;
          text-align: center;
          margin-bottom: var(--spacing-xl);
        }

        .shop-hero h1 {
          font-size: 3rem;
          margin-bottom: 1rem;
          font-weight: 600;
        }

        .shop-hero p {
          font-size: 1.25rem;
          opacity: 0.95;
          max-width: 600px;
          margin: 0 auto;
          line-height: 1.6;
        }

        .products-section {
          padding: var(--spacing-xl) 0;
          background: var(--background-light);
        }

        .products-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
          gap: var(--spacing-lg);
          margin-top: var(--spacing-lg);
        }

        .product-card {
          display: flex;
          flex-direction: column;
          overflow: hidden;
          transition: all 0.3s ease;
        }

        .product-card:hover {
          transform: translateY(-8px);
          box-shadow: 0 12px 32px rgba(0, 0, 0, 0.15);
        }

        .product-image-wrapper {
          width: 100%;
          height: 260px;
          overflow: hidden;
          background: var(--background-light);
        }

        .product-image {
          width: 100%;
          height: 100%;
          object-fit: cover;
          transition: transform 0.3s ease;
        }

        .product-card:hover .product-image {
          transform: scale(1.05);
        }

        .product-content {
          padding: var(--spacing-md);
          flex: 1;
          display: flex;
          flex-direction: column;
        }

        .product-title {
          font-size: 1.5rem;
          font-weight: 600;
          color: var(--text-primary);
          margin-bottom: 0.75rem;
        }

        .product-description {
          font-size: 0.95rem;
          color: var(--text-muted);
          margin-bottom: var(--spacing-md);
          flex: 1;
          line-height: 1.6;
        }

        .product-footer {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding-top: var(--spacing-sm);
          border-top: 1px solid var(--border-light);
        }

        .product-price {
          font-size: 1.75rem;
          font-weight: 700;
          color: var(--petrol);
        }

        .btn-buy {
          background: var(--petrol);
          color: white;
          border: none;
          padding: 0.75rem 1.75rem;
          border-radius: 8px;
          font-size: 1rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.3s ease;
        }

        .btn-buy:hover {
          background: var(--petrol-dark);
          transform: scale(1.05);
        }

        .btn-buy:active {
          transform: scale(0.98);
        }

        .loading-state,
        .error-state,
        .empty-state {
          text-align: center;
          padding: var(--spacing-xl);
          min-height: 400px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
        }

        .spinner {
          border: 3px solid var(--border-light);
          border-top: 3px solid var(--petrol);
          border-radius: 50%;
          width: 50px;
          height: 50px;
          animation: spin 1s linear infinite;
          margin-bottom: var(--spacing-md);
        }

        @keyframes spin {
          0% {
            transform: rotate(0deg);
          }
          100% {
            transform: rotate(360deg);
          }
        }

        .error-message {
          color: var(--error-color, #e00);
          margin-bottom: var(--spacing-md);
          font-size: 1.1rem;
        }

        .btn-retry {
          background: var(--petrol);
          color: white;
          border: none;
          padding: 0.75rem 2rem;
          border-radius: 8px;
          font-size: 1rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.3s ease;
        }

        .btn-retry:hover {
          background: var(--petrol-dark);
        }

        .empty-state h2 {
          font-size: 2rem;
          margin-bottom: 1rem;
          color: var(--text-primary);
        }

        .empty-state p {
          font-size: 1.1rem;
          color: var(--text-muted);
          margin-bottom: var(--spacing-lg);
        }

        .cta-section {
          padding: calc(var(--spacing-xl) * 2) 0;
          text-align: center;
          background: var(--petrol-dark);
          color: white;
        }

        .cta-section h2 {
          margin-bottom: 1rem;
          font-size: 2rem;
          font-weight: 600;
        }

        .cta-section p {
          opacity: 0.95;
          margin-bottom: var(--spacing-md);
          font-size: 1.1rem;
        }

        .btn-cta-secondary {
          display: inline-block;
          background: white;
          color: var(--petrol-dark);
          padding: 1rem 2.5rem;
          border-radius: 8px;
          font-weight: 600;
          text-decoration: none;
          transition: all 0.3s ease;
          font-size: 1.1rem;
        }

        .btn-cta-secondary:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 20px rgba(255, 255, 255, 0.3);
        }

        @media (max-width: 768px) {
          .shop-hero h1 {
            font-size: 2rem;
          }

          .shop-hero p {
            font-size: 1rem;
          }

          .products-grid {
            grid-template-columns: 1fr;
          }

          .cta-section h2 {
            font-size: 1.5rem;
          }

          .product-price {
            font-size: 1.5rem;
          }

          .btn-buy {
            padding: 0.65rem 1.5rem;
            font-size: 0.95rem;
          }
        }
      `}</style>
    </>
  );
}

// Server-Side Rendering: Fetch products on server
export async function getServerSideProps() {
  try {
    const supabase = getSupabasePublic();

    // If no client available, return empty (client will retry)
    if (!supabase) {
      console.warn('⚠️ SSR: Supabase client not available');
      return {
        props: {
          initialProducts: [],
        },
      };
    }

    // Fetch products with timeout protection
    const { data: products, error } = await Promise.race([
      supabase
        .from('products')
        .select('*')
        .eq('active', true)
        .order('sort_order', { ascending: true }),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Timeout')), 5000)
      ),
    ]);

    if (error) {
      console.warn('⚠️ SSR: Supabase query error:', error.message);
      return {
        props: {
          initialProducts: [],
        },
      };
    }

    return {
      props: {
        initialProducts: products || [],
      },
    };
  } catch (error) {
    // Never crash - always return valid props
    console.error('❌ SSR error:', error.message || error);
    return {
      props: {
        initialProducts: [],
      },
    };
  }
}
