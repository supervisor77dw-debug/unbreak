import { createClient } from '@supabase/supabase-js';
import Head from 'next/head';
import Script from 'next/script';
import { useEffect, useState } from 'react';
import { startCheckout } from '../lib/checkout-utils';

// Initialize Supabase client (client-side safe - uses anon key)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

export default function Shop({ initialProducts }) {
  const [products, setProducts] = useState(initialProducts || []);
  const [loading, setLoading] = useState(!initialProducts);
  const [checkoutLoading, setCheckoutLoading] = useState({});

  useEffect(() => {
    // If no SSR data, fetch client-side
    if (!initialProducts) {
      loadProducts();
    }
  }, []);

  async function loadProducts() {
    try {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('active', true)
        .order('sort_order', { ascending: true });

      if (error) throw error;
      setProducts(data || []);
    } catch (error) {
      console.error('Error loading products:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleBuyClick(product) {
    // Use centralized checkout utility
    await startCheckout({
      sku: product.sku,
      onLoading: (isLoading) => {
        setCheckoutLoading({ ...checkoutLoading, [product.id]: isLoading });
      },
      onError: (error) => {
        setCheckoutLoading({ ...checkoutLoading, [product.id]: false });
        alert(`Fehler: ${error.message}\n\nBitte versuchen Sie es erneut.`);
      },
    });
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
      </Head>

      {/* Header (dynamisch geladen via component) */}
      <div id="header-container"></div>

      <main className="page-content">
        {/* Hero Section */}
        <section className="shop-hero">
          <div className="container">
            <h1>Shop</h1>
            <p>
              Magnetische Halter für Gläser & Flaschen – Einzelprodukte,
              Bundles und vorkonfigurierte Sets
            </p>
          </div>
        </section>

        {/* Products Section */}
        <section className="products-section">
          <div className="container">
            <h2>Produkte</h2>

            {loading ? (
              <div className="loading-state">
                <div className="spinner"></div>
                <p>Produkte werden geladen...</p>
              </div>
            ) : products.length === 0 ? (
              <div className="empty-state">
                <p>Derzeit keine Produkte verfügbar.</p>
              </div>
            ) : (
              <div className="products-grid">
                {products.map((product) => (
                  <div key={product.id} className="product-card">
                    {product.image_url && (
                      <img
                        src={product.image_url}
                        alt={product.name}
                        className="product-image"
                      />
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
                          onClick={() => handleBuyClick(product)}
                          disabled={checkoutLoading[product.id]}
                        >
                          {checkoutLoading[product.id]
                            ? 'Lädt...'
                            : 'Kaufen'}
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
            <a href="/configurator" className="btn-primary">
              Zum Konfigurator
            </a>
          </div>
        </section>
      </main>

      {/* Footer (dynamisch geladen via component) */}
      <div id="footer-container"></div>

      {/* Load header/footer components */}
      <Script src="/components/header.js" strategy="afterInteractive" />
      <Script src="/components/footer.js" strategy="afterInteractive" />
      <Script src="/components/page-wrapper.js" strategy="afterInteractive" />

      <style jsx>{`
        .shop-hero {
          padding: var(--spacing-xl) 0;
          background: linear-gradient(
            135deg,
            var(--petrol-dark) 0%,
            var(--petrol) 100%
          );
          color: white;
          text-align: center;
        }

        .shop-hero h1 {
          font-size: 3rem;
          margin-bottom: 1rem;
        }

        .shop-hero p {
          font-size: 1.25rem;
          opacity: 0.9;
          max-width: 600px;
          margin: 0 auto;
        }

        .products-section {
          padding: var(--spacing-xl) 0;
          background: var(--background-light);
        }

        .products-section h2 {
          text-align: center;
          margin-bottom: var(--spacing-lg);
          font-size: 2rem;
          color: var(--text-primary);
        }

        .products-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
          gap: var(--spacing-lg);
          margin-top: var(--spacing-lg);
        }

        .product-card {
          background: white;
          border-radius: 12px;
          overflow: hidden;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
          transition: transform 0.3s ease, box-shadow 0.3s ease;
          display: flex;
          flex-direction: column;
        }

        .product-card:hover {
          transform: translateY(-4px);
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
        }

        .product-image {
          width: 100%;
          height: 260px;
          object-fit: cover;
          background: var(--background-light);
        }

        .product-content {
          padding: var(--spacing-md);
          flex: 1;
          display: flex;
          flex-direction: column;
        }

        .product-title {
          font-size: 1.35rem;
          font-weight: 600;
          color: var(--text-primary);
          margin-bottom: 0.75rem;
        }

        .product-description {
          font-size: 0.95rem;
          color: var(--text-muted);
          margin-bottom: var(--spacing-md);
          flex: 1;
          line-height: 1.5;
        }

        .product-footer {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-top: auto;
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
          padding: 0.75rem 1.5rem;
          border-radius: 8px;
          font-size: 1rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.3s ease;
        }

        .btn-buy:hover:not(:disabled) {
          background: var(--petrol-dark);
          transform: scale(1.05);
        }

        .btn-buy:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .loading-state,
        .empty-state {
          grid-column: 1 / -1;
          text-align: center;
          padding: var(--spacing-xl);
        }

        .spinner {
          border: 3px solid var(--border-light);
          border-top: 3px solid var(--petrol);
          border-radius: 50%;
          width: 40px;
          height: 40px;
          animation: spin 1s linear infinite;
          margin: 0 auto var(--spacing-md);
        }

        @keyframes spin {
          0% {
            transform: rotate(0deg);
          }
          100% {
            transform: rotate(360deg);
          }
        }

        .cta-section {
          padding: var(--spacing-xl) 0;
          text-align: center;
          background: var(--petrol-dark);
          color: white;
        }

        .cta-section h2 {
          margin-bottom: 1rem;
          font-size: 2rem;
        }

        .cta-section p {
          opacity: 0.9;
          margin-bottom: var(--spacing-md);
          font-size: 1.1rem;
        }

        .btn-primary {
          display: inline-block;
          background: white;
          color: var(--petrol-dark);
          padding: 1rem 2rem;
          border-radius: 8px;
          font-weight: 600;
          text-decoration: none;
          transition: all 0.3s ease;
        }

        .btn-primary:hover {
          transform: scale(1.05);
          box-shadow: 0 4px 12px rgba(255, 255, 255, 0.3);
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
        }
      `}</style>
    </>
  );
}

// Server-Side Rendering: Fetch products on server
export async function getServerSideProps() {
  // Always return valid props - never crash
  try {
    // Validate environment variables exist
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      console.warn('⚠️ SSR: Missing Supabase environment variables');
      return {
        props: {
          initialProducts: [],
        },
      };
    }

    // Create Supabase client on server-side
    const supabase = createClient(supabaseUrl, supabaseKey);

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
    // Catch ALL errors - never let SSR crash
    console.error('❌ SSR error loading products:', error.message || error);
    return {
      props: {
        initialProducts: [],
      },
    };
  }
}
