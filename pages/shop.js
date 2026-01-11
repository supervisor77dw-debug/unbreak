import Head from 'next/head';
import Script from 'next/script';
import { useEffect, useState } from 'react';
import { getSupabasePublic, getSupabaseAdmin } from '../lib/supabase';
import { getCart } from '../lib/cart';
import Layout from '../components/Layout';
import ProductImage from '../components/ProductImage';
import { getProductImageUrl } from '../lib/storage-utils';
import { buildConfiguratorUrl, getCurrentLanguage, createConfiguratorClickHandler } from '../lib/configuratorLink';

// CRITICAL: Force dynamic rendering - no ISR, no static, no edge cache
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function Shop({ initialProducts }) {
  const [products, setProducts] = useState(initialProducts || []);
  const [loading, setLoading] = useState(!initialProducts);
  const [error, setError] = useState(null);
  const [cartCount, setCartCount] = useState(0);
  const [currentLang, setCurrentLang] = useState('de');
  const [returnDebug, setReturnDebug] = useState(null); // Debug info for configurator return
  const cart = typeof window !== 'undefined' ? getCart() : null;

  useEffect(() => {
    // Detect current language from i18n system
    if (typeof window !== 'undefined' && window.i18n) {
      setCurrentLang(window.i18n.getCurrentLanguage() || 'de');
      
      // Listen for language changes
      const handleLangChange = (e) => {
        setCurrentLang(e.detail?.lang || 'de');
      };
      window.addEventListener('languageChanged', handleLangChange);
      window.addEventListener('i18nReady', handleLangChange);
      
      return () => {
        window.removeEventListener('languageChanged', handleLangChange);
        window.removeEventListener('i18nReady', handleLangChange);
      };
    }
  }, []);

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

  // Configurator Return Handler: session/sessionId/cfgId detection (robust)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    const urlParams = new URLSearchParams(window.location.search);
    // Support multiple param names for backward compatibility
    const sessionId = 
      urlParams.get('sessionId') || 
      urlParams.get('session') || 
      urlParams.get('cfgId');
    
    if (sessionId) {
      console.log('[SHOP][RETURN] sessionParam=', {
        sessionId,
        raw: window.location.search
      });
      setReturnDebug({ sessionId, status: 'loading' });
      loadConfigSession(sessionId);
    }
  }, []);

  async function loadConfigSession(sessionId) {
    try {
      // 1. Fetch session from API
      console.log('[SHOP][RETURN] Loading session...');
      const response = await fetch(`/api/config-session/${sessionId}`);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('[SHOP][RETURN] Session not found or expired:', errorText);
        setReturnDebug({ sessionId, status: 'error', error: 'Session not found' });
        
        // Show error toast
        showToast('❌ Konfiguration nicht gefunden', 'error');
        
        // Clean URL
        window.history.replaceState({}, '', '/shop');
        return;
      }
      
      const data = await response.json();
      const { lang, config } = data;
      
      console.log('[SHOP][RETURN] Session loaded:', { lang, configKeys: Object.keys(config || {}) });
      setReturnDebug({ sessionId, status: 'loaded', config });
      
      // 2. Map config → cart item
      const cartItem = {
        id: 'glass_configurator',
        sku: 'glass_configurator',
        name: lang === 'en' ? 'Glass Holder – Custom' : 'Glashalter – Konfigurator',
        price: 4900, // 49€ (can be from config later)
        quantity: 1,
        configured: true,
        config: config, // Store full config for order processing
        meta: {
          source: 'configurator',
          sessionId: sessionId,
          colors: config.colors || {},
          pattern: config.pattern || null,
        }
      };
      
      console.log('[SHOP][RETURN] Cart item prepared:', cartItem);
      
      // 3. Add to cart (NO CHECKOUT)
      if (!cart) {
        console.error('[SHOP][CART] Cart not initialized!');
        setReturnDebug({ sessionId, status: 'error', error: 'Cart not initialized' });
        showToast('❌ Warenkorb konnte nicht geladen werden', 'error');
        window.history.replaceState({}, '', '/shop');
        return;
      }
      
      const success = cart.addItem(cartItem);
      
      if (success) {
        const newCount = cart.getItemCount();
        console.log('[SHOP][CART] Add OK (cartCount=', newCount, ')');
        setReturnDebug({ sessionId, status: 'success', cartCount: newCount });
        setCartCount(newCount);
        
        // 4. Clean URL (remove sessionId)
        window.history.replaceState({}, '', '/shop');
        
        // 5. Delete session (cleanup)
        fetch(`/api/config-session/${sessionId}`, { method: 'DELETE' })
          .catch(err => console.warn('[SHOP][RETURN] Cleanup failed:', err));
        
        // 6. Success toast
        showToast('✓ In den Warenkorb gelegt', 'success');
        
      } else {
        console.error('[SHOP][CART] Add failed - cart.addItem returned false');
        setReturnDebug({ sessionId, status: 'error', error: 'Add to cart failed' });
        showToast('❌ Fehler beim Hinzufügen', 'error');
        window.history.replaceState({}, '', '/shop');
      }
      
    } catch (error) {
      console.error('[SHOP][RETURN] Error:', error);
      setReturnDebug({ sessionId, status: 'error', error: error.message });
      showToast('❌ Fehler beim Laden der Konfiguration', 'error');
      window.history.replaceState({}, '', '/shop');
    }
  }
  
  /**
   * Show toast notification
   */
  function showToast(message, type = 'success') {
    const bgColor = type === 'success' ? '#059669' : '#dc2626';
    const notification = document.createElement('div');
    notification.style.cssText = `
      position: fixed;
      top: 80px;
      right: 20px;
      background: ${bgColor};
      color: white;
      padding: 16px 24px;
      border-radius: 8px;
      box-shadow: 0 4px 6px rgba(0,0,0,0.1);
      z-index: 10000;
      font-family: sans-serif;
      font-size: 14px;
      animation: slideIn 0.3s ease-out;
    `;
    notification.textContent = message;
    document.body.appendChild(notification);
    
    setTimeout(() => {
      notification.style.opacity = '0';
      notification.style.transition = 'opacity 0.3s';
      setTimeout(() => notification.remove(), 300);
    }, 3000);
  }

  async function loadProducts() {
    try {
      const supabase = getSupabasePublic();
      if (!supabase) {
        throw new Error('Supabase client not available');
      }

      // NO CACHE: Ensure fresh data after admin edits
      const { data, error: fetchError } = await supabase
        .from('products')
        .select('*')
        .eq('active', true)
        .order('created_at', { ascending: true });

      if (fetchError) throw fetchError;
      
      // IMMUTABLE: Set new array (prevents mutations affecting other products)
      setProducts(data ? [...data] : []);
      setError(null);
    } catch (err) {
      console.error('Error loading products:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  /**
   * Build configurator URL with language and return URL
   * Now using central utility function
   */
  const getConfiguratorUrl = () => {
    // SSR-safe: Return placeholder during server-side rendering
    if (typeof window === 'undefined') {
      return buildConfiguratorUrl('de', 'https://unbreak-one.vercel.app/shop');
    }
    const currentLang = getCurrentLanguage();
    return buildConfiguratorUrl(currentLang, `${window.location.origin}/shop`);
  };
  
  /**
   * Handle configurator click - navigate in same tab
   */
  const handleConfiguratorClick = (e) => {
    if (e) e.preventDefault();
    if (typeof window === 'undefined') return;
    
    const currentLang = getCurrentLanguage();
    const returnUrl = `${window.location.origin}/shop`;
    const configUrl = buildConfiguratorUrl(currentLang, returnUrl);
    
    // Debug logging (only in dev/preview)
    const isDev = process.env.NODE_ENV === 'development' || 
                  window.location.hostname.includes('vercel.app');
    
    if (isDev) {
      console.log('[NAV] Configurator click -> resolvedUrl=', configUrl);
      console.log('[NAV] external=true');
    }
    
    window.location.assign(configUrl);
  };

  function handleAddToCart(product) {
    console.log('🛒 [SHOP] handleAddToCart called with:', product);
    
    if (!cart) {
      console.error('❌ [SHOP] Cart not initialized!');
      alert('Warenkorb konnte nicht geladen werden. Bitte Seite neu laden.');
      return;
    }
    
    console.log('🛒 [SHOP] Cart instance:', cart);
    console.log('🛒 [SHOP] Product ID:', product.id);
    
    const success = cart.addItem(product);
    
    console.log('🛒 [SHOP] addItem result:', success);
    
    if (success) {
      console.log('✅ [SHOP] Added to cart:', product.name || product.title_de);
      
      // Visual feedback
      const btn = event?.target;
      if (btn) {
        const originalText = btn.textContent;
        btn.textContent = '✓ Hinzugefügt!';
        btn.style.background = '#059669';
        
        setTimeout(() => {
          btn.textContent = originalText;
          btn.style.background = '';
        }, 1500);
      }
      
      // Show cart count update
      alert(`✓ ${product.title_de || product.name} wurde zum Warenkorb hinzugefügt!\n\nWarenkorb: ${cart.getItemCount()} Artikel`);
    } else {
      console.error('❌ [SHOP] Failed to add item to cart');
      alert('Fehler beim Hinzufügen zum Warenkorb');
    }
  }

  function formatPrice(cents) {
    return new Intl.NumberFormat('de-DE', {
      style: 'currency',
      currency: 'EUR',
    }).format(cents / 100);
  }

  // Get product image URL using central storage utility
  function getProductImage(product) {
    // PRIORITY: Server-generierte Shop-Images (800x1000, 4:5, mit Crop)
    if (product.shop_image_path || product.shopImagePath) {
      const shopPath = product.shop_image_path || product.shopImagePath;
      const { data } = supabase.storage.from('product-images').getPublicUrl(shopPath);
      if (data?.publicUrl) {
        return data.publicUrl;
      }
    }
    
    // FALLBACK: Original mit Crop (via ProductImage Component)
    // Use central storage utility with fallback chain:
    // 1. image_path → Public URL from product-images bucket (+ Cache-Buster)
    // 2. image_url → Legacy URL
    // 3. Fallback based on SKU/name
    const storageUrl = getProductImageUrl(
      product.image_path, 
      product.image_url,
      product.image_updated_at || product.imageUpdatedAt
    );
    
    // If storage utility returned placeholder, try SKU-based fallback
    if (storageUrl === '/images/placeholder-product.jpg') {
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

      return '/images/products/glass-holder.jpg';
    }

    return storageUrl;
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
        
        {/* Debug Box for Configurator Return (only in dev/preview) */}
        {returnDebug && (typeof window !== 'undefined' && 
          (process.env.NODE_ENV === 'development' || window.location.hostname.includes('vercel.app'))) && (
          <div style={{
            position: 'fixed',
            bottom: '20px',
            left: '20px',
            background: returnDebug.status === 'error' ? '#fef2f2' : returnDebug.status === 'success' ? '#f0fdf4' : '#fffbeb',
            border: `2px solid ${returnDebug.status === 'error' ? '#dc2626' : returnDebug.status === 'success' ? '#059669' : '#f59e0b'}`,
            padding: '16px',
            borderRadius: '8px',
            boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
            zIndex: 9999,
            maxWidth: '300px',
            fontSize: '12px',
            fontFamily: 'monospace'
          }}>
            <div style={{ fontWeight: 'bold', marginBottom: '8px', color: '#111' }}>
              🔍 Configurator Return Debug
            </div>
            <div style={{ color: '#666' }}>
              <div><strong>SessionId:</strong> {returnDebug.sessionId?.substring(0, 8)}...</div>
              <div><strong>Status:</strong> {returnDebug.status}</div>
              {returnDebug.error && <div style={{ color: '#dc2626' }}><strong>Error:</strong> {returnDebug.error}</div>}
              {returnDebug.cartCount && <div><strong>Cart Count:</strong> {returnDebug.cartCount}</div>}
            </div>
            <button 
              onClick={() => setReturnDebug(null)}
              style={{
                marginTop: '8px',
                padding: '4px 8px',
                background: '#666',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '11px'
              }}
            >
              Close
            </button>
          </div>
        )}
        
        {/* Cart Badge in Header */}
        {cartCount > 0 && (
          <a href="/cart" className="cart-badge-float">
            🛒 {cartCount}
          </a>
        )}

        {/* Hero Section */}
        <section className="shop-hero">
          <div className="container">
            <h1>UNBREAK ONE Shop</h1>
            <p className="hero-subtitle">
              Magnetische Halter für Gläser & Flaschen – Professionelle Qualität Made in Germany
            </p>
            
            {/* Trust Bar */}
            <div className="trust-bar">
              <div className="trust-item">
                <span className="trust-icon">✓</span>
                <span>Sicherer Checkout</span>
              </div>
              <div className="trust-item">
                <span className="trust-icon">🚚</span>
                <span>Versand 3–5 Tage</span>
              </div>
              <div className="trust-item">
                <span className="trust-icon">🇩🇪</span>
                <span>Made in Germany</span>
              </div>
              <div className="trust-item">
                <span className="trust-icon">💬</span>
                <span>Premium Support</span>
              </div>
            </div>
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
                <a href={getConfiguratorUrl()} onClick={handleConfiguratorClick} className="btn-primary">
                  Zum Konfigurator
                </a>
              </div>
            ) : (
              <div className="shop-grid">
                {products.map((product) => {
                  // Parse highlights from JSONB
                  let highlights = [];
                  if (product.highlights) {
                    try {
                      highlights = typeof product.highlights === 'string' 
                        ? JSON.parse(product.highlights) 
                        : product.highlights;
                    } catch (e) {
                      console.warn('Failed to parse highlights:', e);
                    }
                  }
                  
                  return (
                    <div key={product.id} className="product-card">
                      {product.badge_label && (
                        <div className="product-badge">{product.badge_label}</div>
                      )}
                      
                      {/* SHOP: Nutzt NUR shop_image_path (server-generiert 900x1125, 4:5, mit Crop) */}
                      {/* KEIN Transform/Fallback - Platzhalter wenn fehlend */}
                      {(() => {
                        const hasServerCrop = product.shop_image_path || product.shopImagePath;
                        
                        if (hasServerCrop) {
                          const shopPath = product.shop_image_path || product.shopImagePath;
                          const supabase = getSupabasePublic();
                          const { data } = supabase.storage.from('product-images').getPublicUrl(shopPath);
                          
                          if (data?.publicUrl) {
                            // CACHE-BUSTING: Add ?v=updated_at to prevent stale images
                            const cacheVersion = product.image_updated_at || product.imageUpdatedAt || Date.now();
                            const cacheBustedUrl = `${data.publicUrl}?v=${cacheVersion}`;
                            
                            // 🔍 DEBUG LOG: What Shop renders (SOURCE OF TRUTH)
                            console.log('🛒 [SHOP RENDER]', {
                              productId: product.id,
                              sku: product.sku,
                              shop_image_path: product.shop_image_path,
                              thumb_path: product.thumb_path,
                              image_path: product.image_path,
                              image_updated_at: product.image_updated_at,
                              srcUsed: cacheBustedUrl,
                              fallbackUsed: false,
                              cacheVersion,
                            });
                            
                            return (
                              <ProductImage
                                key={`shop-${product.id}-${shopPath}`}
                                src={cacheBustedUrl}
                                alt={product.name}
                                crop={{ scale: 1.0, x: 0, y: 0 }}
                                variant="card"
                              />
                            );
                          }
                        }
                        
                        // FEHLT shop_image_path → Platzhalter (KEIN TRANSFORM FALLBACK!)
                        console.error('❌ [SHOP RENDER] Missing shop_image_path!', {
                          productId: product.id,
                          sku: product.sku,
                          shop_image_path: product.shop_image_path || 'MISSING',
                          thumb_path: product.thumb_path || 'MISSING',
                          image_path: product.image_path || 'MISSING',
                          fallbackUsed: 'placeholder',
                          ACTION_REQUIRED: 'Open product in admin and save to regenerate',
                        });
                        return (
                          <div className="product-image-placeholder">
                            <div className="placeholder-icon">📷</div>
                            <div className="placeholder-text">Bild fehlt</div>
                            <div className="placeholder-hint">Bitte im Admin bearbeiten</div>
                          </div>
                        );
                      })()}

                      <div className="product-content">
                        <h3 className="product-title">{product.name}</h3>
                        <p className="product-description">
                          {product.short_description_de || product.description || 'Professioneller magnetischer Halter'}
                        </p>

                        {Array.isArray(highlights) && highlights.length > 0 && (
                          <ul className="product-highlights">
                            {highlights.slice(0, 3).map((highlight, index) => (
                              <li key={index}>{highlight}</li>
                            ))}
                          </ul>
                        )}

                        <div className="product-price-section">
                          <div className="price-wrapper">
                            <span className="product-price">
                              {formatPrice(product.base_price_cents)} €
                            </span>
                            <span className="price-label">inkl. MwSt.</span>
                          </div>
                          <div className="product-trust">
                            <span className="trust-icon-small">🚚</span> {product.shipping_text || 'Versand 3–5 Tage'}
                          </div>
                        </div>

                        <button
                          className="btn-add-to-cart"
                          onClick={() => handleAddToCart(product)}
                        >
                          In den Warenkorb
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </section>

        {/* CTA Section - Premium Configurator Block */}
        <section className="configurator-cta-section">
          <div className="container">
            <div className="configurator-block">
              <div className="configurator-content">
                <span className="configurator-badge">Individuell</span>
                <h2>Gestalte deinen eigenen UNBREAK ONE</h2>
                <p>
                  Wähle Farbe, Material und Größe in unserem 3D-Konfigurator.
                  Perfekt abgestimmt auf deine Einrichtung.
                </p>
                <div className="configurator-actions">
                  <a href={getConfiguratorUrl()} onClick={handleConfiguratorClick} className="btn-configurator-primary">
                    Jetzt gestalten
                  </a>
                  <a href="#products" className="btn-configurator-secondary">
                    Welche Varianten gibt es?
                  </a>
                </div>
              </div>
              <div className="configurator-visual">
                <div className="configurator-preview">
                  <span className="preview-label">Live 3D Preview</span>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      <style jsx>{`
        /* ============================================
           SHOP PAGE - PREMIUM DESIGN
           ============================================ */
        
        /* Cart Badge */
        .cart-badge-float {
          position: fixed;
          top: 20px;
          right: 20px;
          background: linear-gradient(135deg, #0A6C74, #084F55);
          color: white;
          padding: 12px 20px;
          border-radius: 50px;
          font-weight: 600;
          text-decoration: none;
          box-shadow: 0 4px 16px rgba(10, 108, 116, 0.4);
          z-index: 1000;
          transition: all 0.3s ease;
          font-size: 16px;
        }
        .cart-badge-float:hover {
          transform: translateY(-2px);
          box-shadow: 0 6px 24px rgba(10, 108, 116, 0.5);
        }

        /* Hero Section */
        .shop-hero {
          background: linear-gradient(135deg, #0A6C74 0%, #1A1A1A 100%);
          color: white;
          padding: clamp(60px, 10vh, 100px) 0 clamp(50px, 8vh, 80px);
          text-align: center;
        }
        
        .shop-hero h1 {
          font-size: clamp(2.5rem, 5vw, 3.5rem);
          font-weight: 700;
          margin-bottom: 1rem;
          letter-spacing: -0.02em;
        }
        
        .hero-subtitle {
          font-size: clamp(1.1rem, 2vw, 1.3rem);
          opacity: 0.95;
          max-width: 700px;
          margin: 0 auto 3rem;
          line-height: 1.6;
        }

        /* Trust Bar */
        .trust-bar {
          display: flex;
          flex-wrap: wrap;
          justify-content: center;
          gap: clamp(1.5rem, 4vw, 3rem);
          margin-top: 3rem;
        }
        
        .trust-item {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          font-size: clamp(0.9rem, 1.5vw, 1rem);
          font-weight: 500;
        }
        
        .trust-icon {
          font-size: 1.2em;
        }

        /* Products Section */
        .products-section {
          padding: clamp(60px, 10vh, 100px) 0;
          background: #F8F9FA;
        }

        /* Shop Grid - Responsive */
        .shop-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(min(100%, 320px), 1fr));
          gap: clamp(1.5rem, 3vw, 2.5rem);
          margin-top: 2rem;
        }

        @media (min-width: 768px) {
          .shop-grid {
            grid-template-columns: repeat(2, 1fr);
          }
        }

        @media (min-width: 1200px) {
          .shop-grid {
            grid-template-columns: repeat(3, 1fr);
          }
        }

        /* Product Card */
        .product-card {
          background: white;
          border-radius: 12px;
          overflow: hidden;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
          transition: all 0.3s ease;
          display: flex;
          flex-direction: column;
          position: relative;
        }

        .product-card:hover {
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
          transform: translateY(-4px);
        }

        /* Featured Product (Gastro) */
        .product-card-featured {
          border: 2px solid #0A6C74;
        }

        .product-badge {
          position: absolute;
          top: 16px;
          right: 16px;
          background: linear-gradient(135deg, #0A6C74, #084F55);
          color: white;
          padding: 6px 14px;
          border-radius: 20px;
          font-size: 0.85rem;
          font-weight: 600;
          z-index: 10;
          box-shadow: 0 2px 8px rgba(10, 108, 116, 0.3);
        }

        /* Image Placeholder (when shop_image_path missing) */
        .product-image-placeholder {
          aspect-ratio: 4 / 5;
          background: linear-gradient(135deg, #f5f5f5 0%, #e8e8e8 100%);
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 12px;
          color: #999;
        }

        .placeholder-icon {
          font-size: 3rem;
          opacity: 0.5;
        }

        .placeholder-text {
          font-size: 1rem;
          font-weight: 600;
          color: #666;
        }

        .placeholder-hint {
          font-size: 0.85rem;
          color: #999;
        }

        /* Product Content */
        .product-content {
          padding: clamp(1.25rem, 3vw, 1.75rem);
          display: flex;
          flex-direction: column;
          flex: 1;
        }

        .product-title {
          font-size: clamp(1.25rem, 2.5vw, 1.5rem);
          font-weight: 700;
          color: #1A1A1A;
          margin: 0 0 0.75rem 0;
          line-height: 1.3;
        }

        .product-description {
          font-size: clamp(0.95rem, 1.5vw, 1.05rem);
          color: #666;
          line-height: 1.6;
          margin: 0 0 1rem 0;
        }

        /* Product Highlights/USPs */
        .product-highlights {
          list-style: none;
          padding: 0;
          margin: 0 0 1.5rem 0;
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }

        .product-highlights li {
          font-size: 0.9rem;
          color: #0A6C74;
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .product-highlights li::before {
          content: '✓';
          font-weight: bold;
          color: #0A6C74;
        }

        /* Price Section */
        .product-price-section {
          margin-bottom: 1.25rem;
        }

        .price-wrapper {
          display: flex;
          align-items: baseline;
          gap: 0.5rem;
          margin-bottom: 0.5rem;
        }

        .product-price {
          font-size: clamp(1.75rem, 3vw, 2rem);
          font-weight: 700;
          color: #0A6C74;
        }

        .price-label {
          font-size: 0.85rem;
          color: #999;
        }

        .product-trust {
          display: flex;
          align-items: center;
          gap: 0.4rem;
          font-size: 0.9rem;
          color: #666;
        }

        .trust-icon-small {
          font-size: 1.1em;
        }

        /* Add to Cart Button */
        .btn-add-to-cart {
          width: 100%;
          padding: clamp(14px, 2vw, 16px) clamp(24px, 4vw, 32px);
          background: linear-gradient(135deg, #0A6C74, #084F55);
          color: white;
          border: none;
          border-radius: 8px;
          font-size: clamp(1rem, 2vw, 1.1rem);
          font-weight: 600;
          cursor: pointer;
          transition: all 0.3s ease;
          box-shadow: 0 2px 8px rgba(10, 108, 116, 0.2);
        }

        .btn-add-to-cart:hover {
          background: linear-gradient(135deg, #084F55, #063D43);
          transform: translateY(-2px);
          box-shadow: 0 4px 16px rgba(10, 108, 116, 0.3);
        }

        .btn-add-to-cart:active {
          transform: translateY(0);
        }

        /* Loading State */
        .loading-state {
          text-align: center;
          padding: 4rem 2rem;
        }

        .spinner {
          border: 4px solid #f3f3f3;
          border-top: 4px solid #0A6C74;
          border-radius: 50%;
          width: 48px;
          height: 48px;
          animation: spin 1s linear infinite;
          margin: 0 auto 1.5rem;
        }

        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }

        /* Empty/Error States */
        .empty-state, .error-state {
          text-align: center;
          padding: 4rem 2rem;
        }

        .empty-state h2, .error-state .error-message {
          font-size: clamp(1.5rem, 3vw, 2rem);
          margin-bottom: 1rem;
          color: #1A1A1A;
        }

        .btn-retry, .btn-primary {
          padding: 14px 32px;
          background: linear-gradient(135deg, #0A6C74, #084F55);
          color: white;
          border: none;
          border-radius: 8px;
          font-size: 1.05rem;
          font-weight: 600;
          cursor: pointer;
          text-decoration: none;
          display: inline-block;
          transition: all 0.3s ease;
        }

        .btn-retry:hover, .btn-primary:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 16px rgba(10, 108, 116, 0.3);
        }

        /* Configurator CTA Section */
        .configurator-cta-section {
          padding: clamp(80px, 12vh, 120px) 0;
          background: linear-gradient(135deg, #F8F9FA 0%, #E8EDF2 100%);
        }

        .configurator-block {
          display: grid;
          grid-template-columns: 1fr;
          gap: 3rem;
          background: white;
          border-radius: 16px;
          padding: clamp(2rem, 5vw, 3rem);
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.08);
        }

        @media (min-width: 768px) {
          .configurator-block {
            grid-template-columns: 1.2fr 1fr;
            align-items: center;
          }
        }

        .configurator-badge {
          display: inline-block;
          background: linear-gradient(135deg, #0A6C74, #084F55);
          color: white;
          padding: 6px 16px;
          border-radius: 20px;
          font-size: 0.9rem;
          font-weight: 600;
          margin-bottom: 1rem;
        }

        .configurator-content h2 {
          font-size: clamp(1.75rem, 4vw, 2.5rem);
          font-weight: 700;
          color: #1A1A1A;
          margin: 0 0 1rem 0;
          line-height: 1.2;
        }

        .configurator-content p {
          font-size: clamp(1rem, 2vw, 1.15rem);
          color: #666;
          line-height: 1.7;
          margin-bottom: 2rem;
        }

        .configurator-actions {
          display: flex;
          flex-wrap: wrap;
          gap: 1rem;
        }

        .btn-configurator-primary {
          padding: clamp(14px, 2vw, 16px) clamp(28px, 4vw, 40px);
          background: linear-gradient(135deg, #0A6C74, #084F55);
          color: white;
          text-decoration: none;
          border-radius: 8px;
          font-size: clamp(1rem, 2vw, 1.1rem);
          font-weight: 600;
          transition: all 0.3s ease;
          display: inline-block;
          box-shadow: 0 4px 16px rgba(10, 108, 116, 0.2);
        }

        .btn-configurator-primary:hover {
          transform: translateY(-2px);
          box-shadow: 0 6px 24px rgba(10, 108, 116, 0.3);
        }

        .btn-configurator-secondary {
          padding: clamp(14px, 2vw, 16px) clamp(28px, 4vw, 40px);
          background: transparent;
          color: #0A6C74;
          text-decoration: none;
          border: 2px solid #0A6C74;
          border-radius: 8px;
          font-size: clamp(1rem, 2vw, 1.1rem);
          font-weight: 600;
          transition: all 0.3s ease;
          display: inline-block;
        }

        .btn-configurator-secondary:hover {
          background: #0A6C74;
          color: white;
        }

        .configurator-visual {
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .configurator-preview {
          width: 100%;
          max-width: 400px;
          aspect-ratio: 1;
          background: linear-gradient(135deg, #E8EDF2, #F8F9FA);
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          border: 2px dashed #0A6C74;
        }

        .preview-label {
          color: #0A6C74;
          font-weight: 600;
          font-size: 1.1rem;
        }

        /* Mobile Optimizations */
        @media (max-width: 767px) {
          .trust-bar {
            grid-template-columns: repeat(2, 1fr);
            gap: 1.5rem;
          }
          
          .trust-item {
            justify-content: center;
            font-size: 0.9rem;
          }

          .configurator-actions {
            flex-direction: column;
          }

          .btn-configurator-primary,
          .btn-configurator-secondary {
            width: 100%;
            text-align: center;
          }
        }

        /* Accessibility */
        .btn-add-to-cart:focus,
        .btn-configurator-primary:focus,
        .btn-configurator-secondary:focus {
          outline: 3px solid #0A6C74;
          outline-offset: 2px;
        }
      `}</style>
    </Layout>
  );
}

export async function getServerSideProps({ res }) {
  // CRITICAL: Set aggressive no-cache headers
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');

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

    // LOG: What DB returned (verify fresh data)
    console.log('📦 [SHOP SSR] Products loaded from DB:', {
      count: data?.length || 0,
      products: data?.map(p => ({
        id: p.id,
        sku: p.sku,
        shop_image_path: p.shop_image_path,
        thumb_path: p.thumb_path,
        image_updated_at: p.image_updated_at,
      })),
    });

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
