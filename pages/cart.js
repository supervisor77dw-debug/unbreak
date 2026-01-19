import { useEffect, useState } from 'react';
import { getCart, formatPrice } from '../lib/cart';
import { createClient } from '@supabase/supabase-js';
import { isPreviewMode } from '../lib/urls';
import { ts, getCurrentLanguage } from '../lib/i18n-shop';
import { resolveCartItemPrice, calculateCartTotal, validateCartItemPrice } from '../lib/pricing/cartPriceResolver';

// Client-side Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export default function CartPage() {
  const [cartItems, setCartItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [pricingSnapshot, setPricingSnapshot] = useState(null);
  const [loadingPricing, setLoadingPricing] = useState(false);
  const [isClient, setIsClient] = useState(false); // Fix hydration mismatch
  const [adminTestMode, setAdminTestMode] = useState(false); // Admin test checkout
  const [isAdmin, setIsAdmin] = useState(false); // Admin detection
  const cart = getCart();

  // Fix SSR/Client hydration mismatch for i18n
  useEffect(() => {
    setIsClient(true);
    
    // Check for admin role to enable test mode toggle
    // Admin can be detected via: URL param, localStorage, or session role
    const urlParams = new URLSearchParams(window.location.search);
    const adminFromUrl = urlParams.get('admin_test') === 'true';
    const adminFromStorage = localStorage.getItem('unbreak_admin_test_enabled') === 'true';
    
    // Also check Supabase session for admin role
    supabase.auth.getSession().then(({ data: { session } }) => {
      const userRole = session?.user?.user_metadata?.role || session?.user?.app_metadata?.role;
      const isAdminUser = userRole === 'admin' || userRole === 'ops';
      
      if (isAdminUser || adminFromUrl || adminFromStorage) {
        setIsAdmin(true);
        console.log('🔑 [CART] Admin mode available');
      }
    });
  }, []);

  // Safe translation wrapper (prevents SSR/Client mismatch)
  const t = (key) => {
    if (!isClient) return ''; // SSR: return empty string
    return ts(key); // Client: use i18n
  };

  // Load cart items on mount
  useEffect(() => {
    setCartItems(cart.getItems());

    // Listen for cart changes
    const unsubscribe = cart.onChange((items) => {
      setCartItems(items);
    });

    return unsubscribe;
  }, []);

  // Fetch pricing from server when cart changes
  useEffect(() => {
    if (cartItems.length === 0) {
      setPricingSnapshot(null);
      return;
    }

    async function fetchPricing() {
      setLoadingPricing(true);
      try {
        const response = await fetch('/api/pricing/calculate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ items: cart.getCheckoutPayload() }),
        });

        if (!response.ok) {
          console.error('[Cart] Pricing fetch failed:', response.status);
          setPricingSnapshot(null);
          return;
        }

        const data = await response.json();
        console.log('[CART] Pricing API response:', data);
        console.log('[CART] grand_total_cents:', data.grand_total_cents);
        setPricingSnapshot(data);
      } catch (err) {
        console.error('[Cart] Pricing error:', err);
        setPricingSnapshot(null);
      } finally {
        setLoadingPricing(false);
      }
    }

    fetchPricing();
  }, [cartItems]);

  // Debug logging (preview only)
  useEffect(() => {
    if (isPreviewMode()) {
      const locale = window.i18n?.getCurrentLanguage() || 
                     document.cookie.match(/unbreakone_lang=([^;]+)/)?.[1] || 
                     localStorage.getItem('unbreakone_lang') || 
                     'default';
      const cookieSource = document.cookie.includes('unbreakone_lang') ? 'cookie' : 
                          localStorage.getItem('unbreakone_lang') ? 'localStorage' : 'default';
      
      console.log('[I18N] locale=%s source=%s', locale, cookieSource);
      console.log('[CART] items=%d subtotal=%d total=%d', 
        cartItems.length, 
        cart.getTotal(), 
        cart.getTotal()
      );
    }
  }, [cartItems]);

  const handleQuantityChange = (productId, newQuantity) => {
    if (cart.updateQuantity(productId, newQuantity)) {
      setCartItems(cart.getItems());
    }
  };

  const handleRemoveItem = (productId) => {
    cart.removeItem(productId);
    setCartItems(cart.getItems());
  };

  const handleCheckout = async () => {
    if (cart.isEmpty()) {
      setError('Warenkorb ist leer');
      return;
    }

    // Debug log (preview only)
    if (isPreviewMode()) {
      console.log('[CHECKOUT] start ok items=%d total=%d', cartItems.length, cart.getTotal());
    }

    setLoading(true);
    setError(null);

    try {
      // Get current user (optional)
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      // Get current language for Stripe Checkout locale
      const currentLang = getCurrentLanguage(); // Use i18n-shop helper

      const payload = {
        items: cart.getCheckoutPayload(),
        email: session?.user?.email || null,
        locale: currentLang, // Pass language to Stripe Checkout
      };
      
      // ADMIN TEST MODE: Add mode=test if admin has enabled it
      if (adminTestMode && isAdmin) {
        payload.mode = 'test';
        console.log('🧪 [CHECKOUT] Admin Test Mode - using mode=test');
      }

      const headers = {
        'Content-Type': 'application/json',
      };

      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      
      // ADMIN TEST MODE: Add admin key header
      if (adminTestMode && isAdmin) {
        const adminKey = localStorage.getItem('unbreak_admin_api_key') || 
                         process.env.NEXT_PUBLIC_ADMIN_API_KEY;
        if (adminKey) {
          headers['x-admin-test-key'] = adminKey;
        }
      }

      const response = await fetch('/api/checkout/standard', {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Checkout failed');
      }

      // Redirect to Stripe
      if (data.url) {
        window.location.href = data.url;
      } else {
        throw new Error('No checkout URL returned');
      }

    } catch (err) {
      console.error('Checkout error:', err);
      setError(err.message);
      setLoading(false);
    }
  };

  // ====================================================================
  // PRICING: Use pricing snapshot from server (SINGLE SOURCE OF TRUTH)
  // ====================================================================
  // Items are already normalized to unit_price_cents in lib/cart.js
  // No need to normalize here - just use the canonical schema
  
  // DEBUG: Log cart items (canonical schema validation)
  if (typeof window !== 'undefined' && window.location?.search?.includes('debugCart=1')) {
    console.log('[CART][ITEMS_NORMALIZED]', cartItems.map(i => ({
      sku: i.sku,
      qty: i.quantity,
      unit_price_cents: i.unit_price_cents,
      currency: i.currency,
      // DIAGNOSE: Show ALL price fields to find legacy data
      _legacy_price: i.price,
      _legacy_price_cents: i.price_cents,
      _legacy_base_price: i.base_price,
    })));
    
    // CRITICAL: Warn if legacy fields still present
    cartItems.forEach(item => {
      if (item.price !== undefined || item.price_cents !== undefined || item.base_price !== undefined) {
        console.error('[CART][LEGACY_DATA_DETECTED]', {
          sku: item.sku,
          has_legacy_price: item.price !== undefined,
          has_legacy_price_cents: item.price_cents !== undefined,
          has_legacy_base_price: item.base_price !== undefined,
          unit_price_cents: item.unit_price_cents,
          message: 'MIGRATION FAILED! Clear localStorage or restart dev server!'
        });
      }
    });
  }

  // Use pricing snapshot from server (SINGLE SOURCE OF TRUTH)
  // Fallback to local calculation if snapshot not available yet
  const calculateLocalSubtotal = () => {
    let total = 0;
    cartItems.forEach(item => {
      const line_total = item.unit_price_cents * item.quantity;
      console.log('[CART][TOTALS] Item:', {
        sku: item.sku,
        unit_price_cents: item.unit_price_cents,
        qty: item.quantity,
        line_total
      });
      total += line_total;
    });
    console.log('[CART][TOTALS] computed_subtotal:', total);
    return total;
  };

  const subtotal = pricingSnapshot?.subtotal_cents || calculateLocalSubtotal();
  const shipping = pricingSnapshot?.shipping_cents || 0;
  const total = pricingSnapshot?.grand_total_cents || (subtotal + shipping);

  // Debug logging for pricing
  if (isPreviewMode() || (typeof window !== 'undefined' && window.location?.search?.includes('debugCart=1'))) {
    console.log('[CART PRICING]', {
      snapshot_subtotal: pricingSnapshot?.subtotal_cents,
      calculated_subtotal: calculateLocalSubtotal(),
      snapshot_shipping: pricingSnapshot?.shipping_cents,
      snapshot_total: pricingSnapshot?.grand_total_cents,
      final_subtotal: subtotal,
      final_shipping: shipping,
      final_total: total,
      using_snapshot: !!pricingSnapshot,
    });
  }

  // Defensive checks for NaN
  const isValidPrice = (val) => Number.isFinite(val) && val >= 0;
  const safeSubtotal = isValidPrice(subtotal) ? subtotal : 0;
  const safeShipping = isValidPrice(shipping) ? shipping : 0;
  const safeTotal = isValidPrice(total) ? total : (safeSubtotal + safeShipping);

  if (cartItems.length === 0) {
    return (
      <div style={{ maxWidth: '800px', margin: '40px auto', padding: '20px' }}>
        <h1>{t('cart.title')}</h1>
        <p>{t('cart.empty')}</p>
        <a href="/" style={{ color: '#007bff', textDecoration: 'underline' }}>
          {t('cart.continueShopping')}
        </a>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '800px', margin: '40px auto', padding: '20px' }}>
      <h1>{t('cart.title')}</h1>

      {error && (
        <div style={{ 
          padding: '15px', 
          marginBottom: '20px', 
          backgroundColor: '#f8d7da', 
          color: '#721c24',
          borderRadius: '4px'
        }}>
          {error}
        </div>
      )}

      <div style={{ marginBottom: '30px' }}>
        {cartItems.map((item) => (
          <div
            key={item.product_id}
            style={{
              display: 'flex',
              alignItems: 'center',
              padding: '20px',
              borderBottom: '1px solid #e0e0e0',
              gap: '20px'
            }}
          >
            {/* Image */}
            {item.image_url && (
              <img
                src={item.image_url}
                alt={item.name}
                style={{
                  width: '80px',
                  height: '80px',
                  objectFit: 'cover',
                  borderRadius: '4px'
                }}
              />
            )}

            {/* Product Info */}
            <div style={{ flex: 1 }}>
              <h3 style={{ margin: '0 0 5px 0' }}>{item.name}</h3>
              <p style={{ margin: 0, color: '#666', fontSize: '14px' }}>
                SKU: {item.sku}
              </p>
              <p style={{ margin: '5px 0 0 0', fontWeight: 'bold' }}>
                €{formatPrice(item.unit_price_cents)}
              </p>
              {(() => {
                // DEBUG: Log what field we're using for display
                if (typeof window !== 'undefined' && window.location?.search?.includes('debugCart=1')) {
                  console.log('[CART][LINE_ITEM_RENDER]', {
                    sku: item.sku,
                    displaying_unit_price_cents: item.unit_price_cents,
                    formatted: formatPrice(item.unit_price_cents),
                  });
                }
                const priceError = validateCartItemPrice(item, item.unit_price_cents);
                if (priceError) {
                  return <p style={{ margin: '5px 0 0 0', color: '#dc3545', fontSize: '12px' }}>{priceError}</p>;
                }
                return null;
              })()}
            </div>

            {/* Quantity Controls */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <button
                onClick={() => handleQuantityChange(item.product_id, item.quantity - 1)}
                disabled={item.quantity <= 1}
                style={{
                  padding: '5px 10px',
                  fontSize: '16px',
                  border: '1px solid #ccc',
                  backgroundColor: item.quantity <= 1 ? '#f0f0f0' : 'white',
                  cursor: item.quantity <= 1 ? 'not-allowed' : 'pointer',
                  borderRadius: '4px'
                }}
              >
                −
              </button>

              <input
                type="number"
                min="1"
                max="99"
                value={item.quantity}
                onChange={(e) => handleQuantityChange(item.product_id, e.target.value)}
                style={{
                  width: '60px',
                  padding: '5px',
                  textAlign: 'center',
                  border: '1px solid #ccc',
                  borderRadius: '4px'
                }}
              />

              <button
                onClick={() => handleQuantityChange(item.product_id, item.quantity + 1)}
                disabled={item.quantity >= 99}
                style={{
                  padding: '5px 10px',
                  fontSize: '16px',
                  border: '1px solid #ccc',
                  backgroundColor: item.quantity >= 99 ? '#f0f0f0' : 'white',
                  cursor: item.quantity >= 99 ? 'not-allowed' : 'pointer',
                  borderRadius: '4px'
                }}
              >
                +
              </button>
            </div>

            {/* Subtotal */}
            <div style={{ minWidth: '100px', textAlign: 'right' }}>
              <p style={{ margin: 0, fontWeight: 'bold', fontSize: '18px' }}>
                €{formatPrice(item.unit_price_cents * item.quantity)}
              </p>
            </div>

            {/* Remove Button */}
            <button
              onClick={() => handleRemoveItem(item.product_id)}
              style={{
                padding: '8px 12px',
                color: '#dc3545',
                border: '1px solid #dc3545',
                backgroundColor: 'white',
                cursor: 'pointer',
                borderRadius: '4px'
              }}
            >
              {t('cart.remove')}
            </button>
          </div>
        ))}
      </div>

      {/* Cart Summary */}
      <div style={{ 
        padding: '20px', 
        backgroundColor: '#f8f9fa', 
        borderRadius: '4px',
        marginBottom: '20px'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
          <span>{t('cart.subtotal')}:</span>
          <span>€{formatPrice(safeSubtotal)}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
          <span>{t('cart.shipping')}:</span>
          <span>{safeShipping === 0 ? t('cart.freeShipping') : `€${formatPrice(safeShipping)}`}</span>
        </div>
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          paddingTop: '10px',
          borderTop: '2px solid #dee2e6',
          fontSize: '20px',
          fontWeight: 'bold'
        }}>
          <span>{t('cart.grandTotal')}:</span>
          <span>€{formatPrice(safeTotal)}</span>
        </div>
      </div>

      {/* Admin Test Mode Toggle (only visible to admins) */}
      {isAdmin && (
        <div style={{
          marginBottom: '15px',
          padding: '12px',
          backgroundColor: adminTestMode ? '#fff3cd' : '#f8f9fa',
          border: adminTestMode ? '2px solid #ffc107' : '1px solid #dee2e6',
          borderRadius: '4px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={adminTestMode}
              onChange={(e) => setAdminTestMode(e.target.checked)}
              style={{ marginRight: '10px', width: '18px', height: '18px' }}
            />
            <span style={{ fontWeight: 'bold', color: adminTestMode ? '#856404' : '#495057' }}>
              🧪 Test-Modus (keine echte Zahlung)
            </span>
          </label>
          {adminTestMode && (
            <span style={{ 
              fontSize: '12px', 
              color: '#856404',
              backgroundColor: '#ffc107',
              padding: '2px 8px',
              borderRadius: '4px'
            }}>
              ADMIN TEST
            </span>
          )}
        </div>
      )}

      {/* Checkout Button */}
      <button
        onClick={handleCheckout}
        disabled={loading}
        style={{
          width: '100%',
          padding: '15px',
          fontSize: '18px',
          fontWeight: 'bold',
          color: 'white',
          backgroundColor: loading ? '#6c757d' : (adminTestMode ? '#ffc107' : '#28a745'),
          border: 'none',
          borderRadius: '4px',
          cursor: loading ? 'not-allowed' : 'pointer'
        }}
      >
        {loading ? t('cart.redirectingToStripe') : (adminTestMode ? '🧪 Test-Checkout' : t('cart.checkout'))}
      </button>
    </div>
  );
}
