import Head from 'next/head';
import Script from 'next/script';
import { useEffect, useState } from 'react';
import { getSupabasePublic, getSupabaseAdmin } from '../lib/supabase';
import Layout from '../components/Layout';

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
      const supabase = getSupabasePublic();
      if (!supabase) {
        throw new Error('Supabase client not available');
      }

      const { data, error: fetchError } = await supabase
        .from('products')
        .select('*')
        .eq('active', true)
        .order('created_at', { ascending: true });

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

  // Fallback images based on product name/SKU
  function getProductImage(product) {
    // If image_url exists in database, use it
    if (product.image_url) {
      return product.image_url;
    }

    // Fallback based on product name or SKU
    const name = (product.name || '').toLowerCase();
    const sku = (product.sku || '').toLowerCase();

    if (name.includes('weinglas') || name.includes('glass') || sku.includes('glass')) {
      return '/images/products/glass-holder.jpg';
    }
    
    if (name.includes('flasche') || name.includes('bottle') || sku.includes('bottle')) {
      return '/images/products/bottle-holder.jpg';
    }
    
    if (name.includes('set') || name.includes('premium') || name.includes('bundle')) {
      return '/images/products/premium-set.jpg';
    }

    // Default fallback
    return '/images/products/glass-holder.jpg';
  }

  return (
    <Layout>
      <Head>
        <title>Shop  UNBREAK ONE | Magnetische Halter kaufen</title>
        <meta
          name="description"
          content="UNBREAK ONE Shop: Professionelle magnetische Weinglashalter und Flaschenhalter. Jetzt online kaufen."
        />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      </Head>

      <main className="page-content">
        {/* Hero Section */}
        <section className="shop-hero">
          <div className="container">
            <h1 data-i18n="shop.title">Shop</h1>
            <p data-i18n="shop.subtitle">
              Magnetische Halter für Gläser & Flaschen  Einzelprodukte,
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
              <div className="shop-grid">
                {products.map((product) => (
                  <div key={product.id} className="product-card glass-card">
                    <div className="product-image-wrapper">
                      <img
                        src={getProductImage(product)}
                        alt={product.name}
                        className="product-image"
                      />
                    </div>

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

      {/* Checkout Integration */}
      <Script src="/lib/checkout.js" strategy="afterInteractive" type="module" />
    </Layout>
  );
}

export async function getServerSideProps() {
  try {
    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('active', true)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('[SSR] Error fetching products:', error);
      return { props: { initialProducts: [] } };
    }

    return {
      props: {
        initialProducts: data || [],
      },
    };
  } catch (err) {
    console.error('[SSR] Unexpected error:', err);
    return { props: { initialProducts: [] } };
  }
}
