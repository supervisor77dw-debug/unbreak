import Head from 'next/head';
import Script from 'next/script';
import { useEffect, useState } from 'react';
import { getSupabasePublic, getSupabaseAdmin } from '../lib/supabase';
import { getCart } from '../lib/cart';
import Layout from '../components/Layout';

export default function Shop({ initialProducts }) {
  const [products, setProducts] = useState(initialProducts || []);
  const [loading, setLoading] = useState(!initialProducts);
  const [error, setError] = useState(null);
  const [cartCount, setCartCount] = useState(0);
  const cart = typeof window !== 'undefined' ? getCart() : null;

  useEffect(() => {
    // Update cart count on mount and when cart changes
    if (cart) {
      setCartCount(cart.getItemCount());
      
      // Listen for cart cleared event (from success page)
      const handleCartCleared = () => {
        console.log('🔄 [SHOP] Cart cleared event received - updating UI');
        setCartCount(0);
      };
      
      window.addEventListener('cart:cleared', handleCartCleared);
      
      const unsubscribe = cart.onChange(() => {
        setCartCount(cart.getItemCount());
      });
      
      return () => {
        window.removeEventListener('cart:cleared', handleCartCleared);
        unsubscribe();
      };
    }
  }, []);

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
        .order('created_at', { ascending: true });

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

  function handleAddToCart(product) {
    if (!cart) return;
    
    const success = cart.addItem(product);
    if (success) {
      // Show feedback (you could add a toast notification here)
      console.log('Added to cart:', product.name);
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
        <title>Shop – UNBREAK ONE | Magnetische Halter kaufen</title>
        <meta
          name="description"
          content="UNBREAK ONE Shop: Professionelle magnetische Weinglashalter und Flaschenhalter. Jetzt online kaufen."
        />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      </Head>

      <main className="page-content">
        {/* Cart Badge in Header */}
        {cartCount > 0 && (
          <a href="/cart" className="cart-badge-float">
            🛒 {cartCount}
          </a>
        )}

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
                          onClick={() => handleAddToCart(product)}
                        >
                          In den Warenkorb
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

      <style jsx>{`
        .cart-badge-float {
          position: fixed;
          top: 20px;
          right: 20px;
          background: #ff6b35;
          color: white;
          padding: 10px 16px;
          border-radius: 50px;
          font-weight: 600;
          text-decoration: none;
          box-shadow: 0 4px 12px rgba(255, 107, 53, 0.4);
          z-index: 1000;
          transition: transform 0.2s;
        }
        .cart-badge-float:hover {
          transform: scale(1.05);
        }
      `}</style>
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
