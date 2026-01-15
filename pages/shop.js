import Head from 'next/head';
import Script from 'next/script';
import { useEffect, useState } from 'react';
import { getSupabasePublic, getSupabaseAdmin } from '../lib/supabase';
import { getCart } from '../lib/cart';
import Layout from '../components/Layout';
import ProductImage from '../components/ProductImage';
import { getProductImageUrl } from '../lib/storage-utils';
import { buildConfiguratorUrl, getCurrentLanguage, createConfiguratorClickHandler } from '../lib/configuratorLink';
import { debugLog, debugWarn, errorLog } from '../lib/debugUtils';
import { showUserMessage } from '../lib/uiMessages';
import { getSiteUrl } from '../lib/urls';

// CRITICAL: Force dynamic rendering - no ISR, no static, no edge cache
export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * Translate badge labels (MVP: common badges only)
 * MUST be outside component for SSR compatibility
 */
const translateBadge = (badgeLabel, currentLang = 'de') => {
  if (!badgeLabel) return '';
  
  const badgeMap = {
    // DE -> EN mapping
    'Neu': currentLang === 'de' ? 'Neu' : 'New',
    'Bestseller': currentLang === 'de' ? 'Bestseller' : 'Bestseller',
    'Gastro Edition': currentLang === 'de' ? 'Gastro Edition' : 'Gastro Edition',
    'Limitiert': currentLang === 'de' ? 'Limitiert' : 'Limited',
    'Premium': currentLang === 'de' ? 'Premium' : 'Premium',
    'Angebot': currentLang === 'de' ? 'Angebot' : 'Sale',
  };
  
  return badgeMap[badgeLabel] || badgeLabel; // Fallback to original
};

export default function Shop({ initialProducts }) {
  // Use vanilla i18n system (window.i18n) - synced with language-switch.js
  const [currentLang, setCurrentLang] = useState('de');
  const [products, setProducts] = useState(initialProducts || []);
  const [loading, setLoading] = useState(!initialProducts);
  const [error, setError] = useState(null);
  const [cartCount, setCartCount] = useState(0);
  const cart = typeof window !== 'undefined' ? getCart() : null;

  // Sync with window.i18n language changes
  useEffect(() => {
    if (typeof window !== 'undefined') {
      // Set initial language from window.i18n
      const initLang = () => {
        if (window.i18n) {
          const lang = window.i18n.getCurrentLanguage() || 'de';
          debugLog('shop', 'Setting initial language:', lang);
          setCurrentLang(lang);
        }
      };
      
      // Try immediately if i18n already loaded
      initLang();
      
      // Listen for language changes from vanilla toggle
      const handleLanguageChange = (e) => {
        const newLang = e.detail?.lang || 'de';
        debugLog('shop', 'Language changed event:', newLang);
        setCurrentLang(newLang);
      };
      
      // Listen for both event types
      window.addEventListener('languageChanged', handleLanguageChange);
      window.addEventListener('i18nLanguageChanged', handleLanguageChange);
      
      // Also listen for i18n ready (in case it loads after component mount)
      window.addEventListener('i18nReady', handleLanguageChange);
      
      return () => {
        window.removeEventListener('languageChanged', handleLanguageChange);
        window.removeEventListener('i18nLanguageChanged', handleLanguageChange);
        window.removeEventListener('i18nReady', handleLanguageChange);
      };
    }
  }, []);

  useEffect(() => {
    // Update cart count on mount and when cart changes
    if (cart) {
      setCartCount(cart.getItemCount());
      
      // Listen for cart cleared event (from success page)
      const handleCartCleared = () => {
        debugLog('shop', 'Cart cleared event received - updating UI');
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

  // Configurator Return Handler: Check for pending item from localStorage
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    const urlParams = new URLSearchParams(window.location.search);
    const fromConfigurator = urlParams.get('from') === 'configurator';
    
    if (fromConfigurator) {
      debugLog('shop:return', 'Configurator return detected');
      
      // Load pending item from localStorage (set by /config-return page)
      try {
        const pendingItem = localStorage.getItem('pendingConfiguratorItem');
        
        if (pendingItem) {
          const cartItem = JSON.parse(pendingItem);
          debugLog('shop:return', 'Loading pending configurator item:', cartItem);
          
          // Add to cart
          if (cart) {
            const success = cart.addItem(cartItem);
            
            if (success) {
              debugLog('shop:cart', 'Configurator item added successfully');
              setCartCount(cart.getItemCount());
              showUserMessage('addToCart', 'success', currentLang, 1500);
            } else {
              errorLog('shop:cart', 'Failed to add configurator item');
              showUserMessage('cartAddFailed', 'error', currentLang);
            }
          } else {
            errorLog('shop:cart', 'Cart not initialized');
          }
          
          // Clean up
          localStorage.removeItem('pendingConfiguratorItem');
          window.history.replaceState({}, '', '/shop');
        } else {
          debugWarn('shop:return', 'No pending configurator item found');
          window.history.replaceState({}, '', '/shop');
        }
      } catch (err) {
        errorLog('shop:return', 'Failed to load pending item:', err);
        window.history.replaceState({}, '', '/shop');
      }
    }
    
    // Handle error flags
    const error = urlParams.get('error');
    if (error) {
      errorLog('shop:return', 'Error flag:', error);
      showUserMessage('configLoadFailed', 'error', currentLang);
      window.history.replaceState({}, '', '/shop');
    }
  }, [cart, currentLang]);

  /**
   * Translation helper - uses window.i18n
   */
  const t = (key) => {
    if (typeof window !== 'undefined' && window.i18n) {
      return window.i18n.t(key);
    }
    return ''; // Fallback for SSR
  };

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
      return buildConfiguratorUrl('de', `${getSiteUrl()}/shop`);
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
    
    debugLog('shop:nav', 'Configurator click -> resolvedUrl=', configUrl);
    debugLog('shop:nav', 'external=true');
    
    window.location.assign(configUrl);
  };

  function handleAddToCart(product) {
    debugLog('shop:cart', 'handleAddToCart called with:', product);
    
    if (!cart) {
      errorLog('shop:cart', 'Cart not initialized!');
      showUserMessage('cartLoadFailed', 'error', currentLang);
      return;
    }
    
    debugLog('shop:cart', 'Cart instance:', cart);
    debugLog('shop:cart', 'Product ID:', product.id);
    
    const success = cart.addItem(product);
    
    debugLog('shop:cart', 'addItem result:', success);
    
    if (success) {
      debugLog('shop:cart', 'Added to cart:', product.name || product.title_de);
      
      // Visual feedback on button (subtle)
      const btn = event?.target;
      if (btn) {
        const originalText = btn.textContent;
        btn.textContent = '✓';
        btn.style.background = '#059669';
        
        setTimeout(() => {
          btn.textContent = originalText;
          btn.style.background = '';
        }, 1200);
      }
      
      // No popup - cart count updates automatically
    } else {
      errorLog('shop:cart', 'Failed to add item to cart');
      showUserMessage('cartAddFailed', 'error', currentLang);
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
        
        {/* Cart Badge in Header */}
        {cartCount > 0 && (
          <a href="/cart" className="cart-badge-float">
            🛒 {cartCount}
          </a>
        )}

        {/* Hero Section */}
        <section className="shop-hero">
          <div className="container">
            <h1>{t('shop.hero.title')}</h1>
            <p className="hero-subtitle">
              {t('shop.hero.subtitle')}
            </p>
            
            {/* Trust Bar */}
            <div className="trust-bar">
              <div className="trust-item">
                <span className="trust-icon">✓</span>
                <span>{currentLang === 'de' ? 'Sicherer Checkout' : 'Secure Checkout'}</span>
              </div>
              <div className="trust-item">
                <span className="trust-icon">🚚</span>
                <span>{currentLang === 'de' ? 'Versand 3–5 Tage' : 'Shipping 3–5 days'}</span>
              </div>
              <div className="trust-item">
                <span className="trust-icon">🇩🇪</span>
                <span>Made in Germany</span>
              </div>
              <div className="trust-item">
                <span className="trust-icon">💬</span>
                <span>{currentLang === 'de' ? 'Premium Support' : 'Premium Support'}</span>
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
                <p>{t('shop.loading')}</p>
              </div>
            ) : error ? (
              <div className="error-state">
                <p className="error-message">
                  {currentLang === 'de' ? 'Fehler beim Laden der Produkte:' : 'Error loading products:'} {error}
                </p>
                <button onClick={loadProducts} className="btn-retry">
                  {currentLang === 'de' ? 'Erneut versuchen' : 'Retry'}
                </button>
              </div>
            ) : products.length === 0 ? (
              <div className="empty-state">
                <h2>{currentLang === 'de' ? 'Bald verfügbar' : 'Coming Soon'}</h2>
                <p>{currentLang === 'de' ? 'Unsere Produkte werden gerade vorbereitet.' : 'Our products are being prepared.'}</p>
                <a href={getConfiguratorUrl()} onClick={handleConfiguratorClick} className="btn-primary">
                  {t('shop.cta.button')}
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
                        <div className="product-badge">{translateBadge(product.badge_label, currentLang)}</div>
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
                          {currentLang === 'de' 
                            ? (product.short_description_de || product.description || 'Professioneller magnetischer Halter')
                            : (product.short_description_en || product.description_en || 'Professional magnetic holder')
                          }
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
                            <span className="price-label">{currentLang === 'de' ? 'inkl. MwSt.' : 'incl. VAT'}</span>
                          </div>
                          <div className="product-trust">
                            <span className="trust-icon-small">🚚</span> {product.shipping_text || (currentLang === 'de' ? 'Versand 3–5 Tage' : 'Shipping 3–5 days')}
                          </div>
                        </div>

                        <button
                          className="btn-add-to-cart"
                          onClick={() => handleAddToCart(product)}
                        >
                          {currentLang === 'de' ? 'In den Warenkorb' : 'Add to Cart'}
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
                <span className="configurator-badge">{currentLang === 'de' ? 'Individuell' : 'Custom'}</span>
                <h2>{t('shop.cta.title')}</h2>
                <p>
                  {t('shop.cta.text')}
                </p>
                <div className="configurator-actions">
                  <a href={getConfiguratorUrl()} onClick={handleConfiguratorClick} className="btn-configurator-primary">
                    {t('shop.cta.button')}
                  </a>
                  <a href="#products" className="btn-configurator-secondary">
                    {currentLang === 'de' ? 'Welche Varianten gibt es?' : 'What variants are available?'}
                  </a>
                </div>
              </div>
              <div className="configurator-visual">
                <div className="configurator-preview">
                  <span className="preview-label">{currentLang === 'de' ? 'Live 3D Preview' : 'Live 3D Preview'}</span>
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
