import Head from 'next/head';
import Script from 'next/script';
import { useEffect, useState } from 'react';
import { getSupabasePublic, getSupabaseAdmin } from '../lib/supabase';

export default function Shop({ initialProducts }) {
  const [products, setProducts] = useState(initialProducts || []);
  const [loading, setLoading] = useState(!initialProducts);
  const [error, setError] = useState(null);

  useEffect(() => {
    // If no SSR data, fetch client-side
    if (!initialProducts || initialProducts.length === 0) {
      loadProducts();
    }
    
    // Re-initialize checkout buttons after products render
    // (checkout.js auto-inits on DOMContentLoaded, but we need to re-init after dynamic render)
    const timer = setTimeout(() => {
      if (window.initCheckoutButtons) {
        window.initCheckoutButtons();
        console.log('[Shop] Re-initialized checkout buttons after product render');
      }
    }, 100);
    
    return () => clearTimeout(timer);
  }, [initialProducts]);

  async function loadProducts() {
    try {
      const supabase = getSupabaseAdmin() || getSupabasePublic();
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
      
      // Re-init checkout buttons after products loaded
      setTimeout(() => {
        if (window.initCheckoutButtons) {
          window.initCheckoutButtons();
          console.log('[Shop] Re-initialized checkout buttons after loadProducts');
        }
      }, 100);
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
          padding: calc(var(--spacing-xl, 64px) * 1.5) 0 var(--spacing-lg, 40px);
          background: linear-gradient(135deg, #084F55 0%, #0A6C74 100%);
          color: white;
          text-align: center;
          margin-bottom: var(--spacing-xl, 64px);
        }

        .shop-hero h1 {
          font-size: clamp(2rem, 5vw, 3.5rem);
          margin-bottom: 1rem;
          font-weight: 700;
          font-family: var(--font-heading, 'Montserrat', sans-serif);
        }

        .shop-hero p {
          font-size: clamp(1rem, 2vw, 1.35rem);
          opacity: 0.95;
          max-width: 700px;
          margin: 0 auto;
          line-height: 1.6;
          font-weight: 400;
        }

        .products-section {
          padding: var(--spacing-xl, 64px) 0;
          background: var(--color-hellgrau, #F5F5F5);
        }

        .products-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 2rem;
          margin-top: var(--spacing-lg, 40px);
        }

        @media (max-width: 1024px) {
          .products-grid {
            grid-template-columns: repeat(2, 1fr);
            gap: 1.5rem;
          }
        }

        @media (max-width: 640px) {
          .products-grid {
            grid-template-columns: 1fr;
            gap: 1.25rem;
          }
        }

        .product-card {
          display: flex;
          flex-direction: column;
          overflow: hidden;
          background: rgba(255, 255, 255, 0.9);
          backdrop-filter: blur(10px);
          border: 1px solid rgba(10, 108, 116, 0.1);
          border-radius: 12px;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
        }

        .product-card:hover {
          transform: translateY(-8px);
          box-shadow: 0 16px 40px rgba(10, 108, 116, 0.15);
          border-color: rgba(10, 108, 116, 0.3);
        }

        .product-image-wrapper {
          width: 100%;
          height: 280px;
          overflow: hidden;
          background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
          position: relative;
        }

        .product-image {
          width: 100%;
          height: 100%;
          object-fit: cover;
          transition: transform 0.5s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .product-card:hover .product-image {
          transform: scale(1.08);
        }

        .product-content {
          padding: 1.75rem;
          flex: 1;
          display: flex;
          flex-direction: column;
        }

        .product-title {
          font-size: 1.5rem;
          font-weight: 700;
          color: var(--color-graphit, #1A1A1A);
          margin-bottom: 0.75rem;
          font-family: var(--font-heading, 'Montserrat', sans-serif);
          line-height: 1.3;
        }

        .product-description {
          font-size: 0.95rem;
          color: var(--color-anthrazit, #5A5A5A);
          margin-bottom: 1.5rem;
          flex: 1;
          line-height: 1.7;
          min-height: 3em;
        }

        .product-footer {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding-top: 1.25rem;
          border-top: 1px solid rgba(0, 0, 0, 0.08);
          gap: 1rem;
        }

        .product-price {
          font-size: 2rem;
          font-weight: 800;
          color: var(--color-petrol-deep, #0A6C74);
          font-family: var(--font-heading, 'Montserrat', sans-serif);
          white-space: nowrap;
        }

        .btn-buy {
          background: linear-gradient(135deg, #0A6C74 0%, #084F55 100%);
          color: white;
          border: none;
          padding: 0.85rem 2rem;
          border-radius: 8px;
          font-size: 1rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          font-family: var(--font-heading, 'Montserrat', sans-serif);
          white-space: nowrap;
          box-shadow: 0 4px 12px rgba(10, 108, 116, 0.2);
        }

        .btn-buy:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 20px rgba(10, 108, 116, 0.35);
          background: linear-gradient(135deg, #0d8592 0%, #0a5f68 100%);
        }

        .btn-buy:active {
          transform: translateY(0);
        }

        .btn-buy.loading {
          opacity: 0.6;
          cursor: wait;
        }

        .loading-state,
        .error-state,
        .empty-state {
          text-align: center;
          padding: var(--spacing-xl, 64px);
          min-height: 400px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          background: white;
          border-radius: 12px;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
        }

        .spinner {
          border: 4px solid rgba(10, 108, 116, 0.1);
          border-top: 4px solid #0A6C74;
          border-radius: 50%;
          width: 60px;
          height: 60px;
          animation: spin 0.8s linear infinite;
          margin-bottom: 1.5rem;
        }

        @keyframes spin {
          0% {
            transform: rotate(0deg);
          }
          100% {
            transform: rotate(360deg);
          }
        }

        .loading-state p {
          color: var(--color-anthrazit, #5A5A5A);
          font-size: 1.1rem;
          font-weight: 500;
        }

        .error-message {
          color: #dc3545;
          margin-bottom: 1.5rem;
          font-size: 1.1rem;
          font-weight: 500;
        }

        .btn-retry {
          background: linear-gradient(135deg, #0A6C74 0%, #084F55 100%);
          color: white;
          border: none;
          padding: 0.85rem 2.5rem;
          border-radius: 8px;
          font-size: 1rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.3s ease;
          font-family: var(--font-heading, 'Montserrat', sans-serif);
        }

        .btn-retry:hover {
          transform: translateY(-2px);
          box-shadow: 0 6px 16px rgba(10, 108, 116, 0.3);
        }

        .empty-state h2 {
          font-size: 2.25rem;
          margin-bottom: 1rem;
          color: var(--color-graphit, #1A1A1A);
          font-weight: 700;
        }

        .empty-state p {
          font-size: 1.15rem;
          color: var(--color-anthrazit, #5A5A5A);
          margin-bottom: var(--spacing-lg, 40px);
          max-width: 500px;
          line-height: 1.6;
        }

        .btn-primary {
          display: inline-block;
          background: linear-gradient(135deg, #0A6C74 0%, #084F55 100%);
          color: white;
          padding: 1rem 2.5rem;
          border-radius: 8px;
          font-weight: 600;
          text-decoration: none;
          transition: all 0.3s ease;
          font-size: 1.1rem;
          font-family: var(--font-heading, 'Montserrat', sans-serif);
        }

        .btn-primary:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 20px rgba(10, 108, 116, 0.3);
        }

        .cta-section {
          padding: calc(var(--spacing-xl, 64px) * 1.5) 0;
          text-align: center;
          background: linear-gradient(135deg, #084F55 0%, #0A6C74 100%);
          color: white;
        }

        .cta-section h2 {
          margin-bottom: 1rem;
          font-size: clamp(1.75rem, 4vw, 2.5rem);
          font-weight: 700;
          font-family: var(--font-heading, 'Montserrat', sans-serif);
        }

        .cta-section p {
          opacity: 0.95;
          margin-bottom: var(--spacing-md, 24px);
          font-size: clamp(1rem, 2vw, 1.2rem);
          max-width: 600px;
          margin-left: auto;
          margin-right: auto;
          line-height: 1.6;
        }

        .btn-cta-secondary {
          display: inline-block;
          background: white;
          color: var(--color-petrol-dark, #084F55);
          padding: 1.1rem 2.75rem;
          border-radius: 8px;
          font-weight: 700;
          text-decoration: none;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          font-size: 1.1rem;
          font-family: var(--font-heading, 'Montserrat', sans-serif);
          box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
        }

        .btn-cta-secondary:hover {
          transform: translateY(-3px);
          box-shadow: 0 10px 28px rgba(0, 0, 0, 0.25);
        }

        @media (max-width: 768px) {
          .shop-hero {
            padding: var(--spacing-lg, 40px) 0;
          }

          .product-content {
            padding: 1.5rem;
          }

          .product-price {
            font-size: 1.75rem;
          }

          .btn-buy {
            padding: 0.75rem 1.5rem;
            font-size: 0.95rem;
          }

          .product-footer {
            flex-direction: column;
            align-items: flex-start;
            gap: 1rem;
          }

          .btn-buy {
            width: 100%;
          }
        }
      `}</style>
    </>
  );
}

// Server-Side Rendering: Fetch products on server
export async function getServerSideProps() {
  try {
    const supabase = getSupabaseAdmin() || getSupabasePublic();

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
