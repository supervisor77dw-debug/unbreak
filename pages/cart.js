import { useEffect, useState } from 'react';
import { getCart, formatPrice } from '../lib/cart';
import { createClient } from '@supabase/supabase-js';
import { isPreviewMode } from '../lib/urls';
import { ts } from '../lib/i18n-shop';

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
  const cart = getCart();

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

      const payload = {
        items: cart.getCheckoutPayload(),
        email: session?.user?.email || null,
      };

      const headers = {
        'Content-Type': 'application/json',
      };

      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
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

  // Use pricing snapshot from server (SINGLE SOURCE OF TRUTH)
  // Fallback to local calculation if snapshot not available yet
  const subtotal = pricingSnapshot?.subtotal_cents || cart.getTotal();
  const shipping = pricingSnapshot?.shipping_cents || 0;
  const total = pricingSnapshot?.grand_total_cents || (subtotal + shipping);

  // Debug logging for pricing
  if (pricingSnapshot && isPreviewMode()) {
    console.log('[CART PRICING]', {
      snapshot_subtotal: pricingSnapshot.subtotal_cents,
      snapshot_shipping: pricingSnapshot.shipping_cents,
      snapshot_total: pricingSnapshot.grand_total_cents,
      calculated_total: subtotal + shipping,
      final_subtotal: subtotal,
      final_shipping: shipping,
      final_total: total
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
        <h1>{ts('cart.title')}</h1>
        <p>{ts('cart.empty')}</p>
        <a href="/" style={{ color: '#007bff', textDecoration: 'underline' }}>
          {ts('cart.continueShopping')}
        </a>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '800px', margin: '40px auto', padding: '20px' }}>
      <h1>{ts('cart.title')}</h1>

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
                €{formatPrice(item.price)}
              </p>
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
                €{formatPrice(item.price * item.quantity)}
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
              Entfernen
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
          <span>{ts('cart.subtotal')}:</span>
          <span>€{formatPrice(safeSubtotal)}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
          <span>{ts('cart.shipping')}:</span>
          <span>{safeShipping === 0 ? ts('cart.freeShipping') : `€${formatPrice(safeShipping)}`}</span>
        </div>
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          paddingTop: '10px',
          borderTop: '2px solid #dee2e6',
          fontSize: '20px',
          fontWeight: 'bold'
        }}>
          <span>{ts('cart.grandTotal')}:</span>
          <span>€{formatPrice(safeTotal)}</span>
        </div>
      </div>

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
          backgroundColor: loading ? '#6c757d' : '#28a745',
          border: 'none',
          borderRadius: '4px',
          cursor: loading ? 'not-allowed' : 'pointer'
        }}
      >
        {loading ? ts('cart.redirectingToStripe') : ts('cart.checkout')}
      </button>
    </div>
  );
}
