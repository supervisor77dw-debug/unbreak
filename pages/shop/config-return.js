import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { getCart } from '../../lib/cart';

/**
 * Config Return Page
 * 
 * Handles return from external configurator (config.unbreak-one.com)
 * 
 * Flow:
 * 1. Read query param: session
 * 2. Load config session from API
 * 3. Validate required fields
 * 4. Map config to shop product/variant
 * 5. Add to cart
 * 6. Show success message
 * 7. Redirect to /cart
 */
export default function ConfigReturn() {
  const router = useRouter();
  const [status, setStatus] = useState('loading'); // loading | success | error
  const [message, setMessage] = useState('Konfiguration wird geladen...');
  const [redirecting, setRedirecting] = useState(false);

  useEffect(() => {
    // Only run on client side
    if (!router.isReady) return;

    const { session } = router.query;

    if (!session) {
      setStatus('error');
      setMessage('Fehlende Session-ID. Bitte verwende den Link vom Konfigurator.');
      return;
    }

    loadAndProcessSession(session);
  }, [router.isReady, router.query]);

  async function loadAndProcessSession(sessionId) {
    try {
      console.info('[CONFIG_RETURN] Loading session:', sessionId);

      // 1. Fetch session from API
      const response = await fetch(`/api/config-session/${sessionId}`);
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Session nicht gefunden oder abgelaufen');
      }

      const data = await response.json();
      console.info('[CONFIG_RETURN] Session loaded:', data);

      const { lang, config } = data;

      // 2. Validate required fields
      if (!config) {
        throw new Error('Ungültige Konfiguration - keine Daten erhalten');
      }

      // Validate product type
      const productType = config.product_type || config.productType;
      if (!productType) {
        throw new Error('Ungültige Konfiguration - Produkttyp fehlt');
      }

      // Validate parts/colors (at least one must exist)
      const hasParts = config.parts && Object.keys(config.parts).length > 0;
      const hasColors = config.colors && Object.keys(config.colors).length > 0;
      
      if (!hasParts && !hasColors) {
        throw new Error('Ungültige Konfiguration - keine Farben/Teile definiert');
      }

      // Validate quantity
      const quantity = parseInt(config.quantity || 1, 10);
      if (isNaN(quantity) || quantity < 1) {
        throw new Error('Ungültige Menge');
      }

      // 3. Map config to shop product
      const cartItem = mapConfigToProduct(config, lang);
      
      // 4. Add to cart
      const cart = getCart();
      if (!cart) {
        throw new Error('Warenkorb konnte nicht initialisiert werden');
      }

      const success = cart.addItem(cartItem);
      
      if (!success) {
        throw new Error('Produkt konnte nicht zum Warenkorb hinzugefügt werden');
      }

      console.info('[CONFIG_RETURN] Added to cart successfully');

      // 5. Cleanup session
      fetch(`/api/config-session/${sessionId}`, { method: 'DELETE' })
        .catch(err => console.warn('[CONFIG_RETURN] Session cleanup failed:', err));

      // 6. Show success
      setStatus('success');
      setMessage(
        lang === 'en' 
          ? '✓ Configuration added to cart!' 
          : '✓ Konfiguration wurde in den Warenkorb gelegt!'
      );

      // 7. Redirect to cart after 1.5s
      setRedirecting(true);
      setTimeout(() => {
        router.push('/cart');
      }, 1500);

    } catch (error) {
      console.error('[CONFIG_RETURN] Error:', error);
      setStatus('error');
      setMessage(error.message || 'Ein Fehler ist aufgetreten');
    }
  }

  /**
   * Map configurator config to cart product structure
   */
  function mapConfigToProduct(config, lang) {
    // Determine product type and variant
    const productType = config.product_type || config.productType || 'glass_holder';
    const variant = productType === 'bottle_holder' ? 'bottle_holder' : 'glass_holder';
    
    // Determine SKU
    const sku = config.sku || config.product_sku || 'UNBREAK-GLAS-01';
    
    // Product name based on variant and language
    let name;
    if (variant === 'bottle_holder') {
      name = lang === 'en' ? 'UNBREAK ONE Bottle Holder' : 'UNBREAK ONE Weinflaschenhalter';
    } else {
      name = lang === 'en' ? 'UNBREAK ONE Glass Holder' : 'UNBREAK ONE Weinglashalter';
    }

    // Base price (configurator should include final price, fallback to base)
    const price = config.price || config.total_price || 4900; // 49€ base

    // Quantity
    const quantity = parseInt(config.quantity || 1, 10);

    // Build cart item
    return {
      id: `${sku}-${Date.now()}`, // Unique ID for cart
      product_id: sku,              // For product lookup
      sku: sku,
      name: name,
      price: price,                  // Price in cents
      quantity: quantity,
      variant: variant,
      image_url: null,               // TODO: Get from config or product database
      configured: true,              // Mark as configured product
      config: config,                // Store full config for order processing
    };
  }

  return (
    <>
      <Head>
        <title>Konfigurator - UNBREAK ONE</title>
        <style>{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
      </Head>

      <div style={styles.container}>
        <div style={styles.card}>
          {status === 'loading' && (
            <>
              <div style={styles.spinner}></div>
              <p style={styles.message}>{message}</p>
            </>
          )}

          {status === 'success' && (
            <>
              <div style={styles.successIcon}>✓</div>
              <p style={styles.successMessage}>{message}</p>
              {redirecting && (
                <p style={styles.redirectInfo}>
                  Du wirst zum Warenkorb weitergeleitet...
                </p>
              )}
            </>
          )}

          {status === 'error' && (
            <>
              <div style={styles.errorIcon}>✕</div>
              <p style={styles.errorMessage}>{message}</p>
              <div style={styles.actions}>
                <button 
                  onClick={() => router.push('/shop')} 
                  style={styles.button}
                >
                  Zum Shop
                </button>
                <button 
                  onClick={() => window.location.href = 'https://config.unbreak-one.com'} 
                  style={styles.buttonSecondary}
                >
                  Zurück zum Konfigurator
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}

// Inline styles for minimal dependencies
const styles = {
  container: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    padding: '20px',
  },
  card: {
    background: 'white',
    borderRadius: '12px',
    padding: '40px',
    maxWidth: '500px',
    width: '100%',
    boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
    textAlign: 'center',
  },
  spinner: {
    width: '50px',
    height: '50px',
    margin: '0 auto 20px',
    border: '4px solid #f3f3f3',
    borderTop: '4px solid #667eea',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
  },
  message: {
    fontSize: '16px',
    color: '#666',
    margin: 0,
  },
  successIcon: {
    fontSize: '64px',
    color: '#059669',
    marginBottom: '20px',
  },
  successMessage: {
    fontSize: '18px',
    color: '#059669',
    fontWeight: '600',
    margin: 0,
  },
  redirectInfo: {
    fontSize: '14px',
    color: '#999',
    marginTop: '10px',
  },
  errorIcon: {
    fontSize: '64px',
    color: '#dc2626',
    marginBottom: '20px',
  },
  errorMessage: {
    fontSize: '18px',
    color: '#dc2626',
    fontWeight: '600',
    margin: '0 0 30px 0',
  },
  actions: {
    display: 'flex',
    gap: '10px',
    justifyContent: 'center',
    flexWrap: 'wrap',
  },
  button: {
    padding: '12px 24px',
    background: '#667eea',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    fontSize: '16px',
    cursor: 'pointer',
    fontWeight: '600',
    transition: 'background 0.2s',
  },
  buttonSecondary: {
    padding: '12px 24px',
    background: 'transparent',
    color: '#667eea',
    border: '2px solid #667eea',
    borderRadius: '6px',
    fontSize: '16px',
    cursor: 'pointer',
    fontWeight: '600',
    transition: 'all 0.2s',
  },
};

// Add spinner animation (needs to be in global CSS or using styled-components)
// For now, this is just a visual reference
