/**
 * UNBREAK ONE - Checkout Integration
 * Production-Ready Button Handlers
 * 
 * WICHTIG: Keine Design-Änderungen - nur Funktionalität ergänzen
 */

/**
 * Buy Standard Product (without configuration)
 * Usage: onclick="UnbreakCheckout.buyStandard('UNBREAK-WEIN-01')"
 */
const UnbreakCheckout = {
  
  /**
   * Standard Product Checkout
   * @param {string} sku - Product SKU (e.g., 'UNBREAK-WEIN-01')
   * @param {object} options - Optional customer data
   */
  async buyStandard(sku, options = {}) {
    try {
      // Show loading state (optional, uses existing button)
      const btn = event?.target;
      const originalText = btn?.textContent;
      if (btn) {
        btn.disabled = true;
        btn.textContent = '⏳ Lädt...';
      }

      // Call checkout API
      const response = await fetch('/api/checkout/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          product_sku: sku,
          config: {}, // Empty config for standard products
          customer: {
            email: options.email || null,
            name: options.name || null,
            address: options.address || null,
            country: options.country || 'DE'
          }
        }),
      });

      // Handle response
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Checkout failed');
      }

      const data = await response.json();
      
      // Redirect to Stripe Checkout
      if (data.checkout_url) {
        console.log('✓ Checkout Session erstellt:', data.order_id);
        window.location.href = data.checkout_url;
      } else {
        throw new Error('Keine Checkout-URL erhalten');
      }

    } catch (error) {
      console.error('❌ Checkout Error:', error);
      
      // Restore button
      if (btn) {
        btn.disabled = false;
        btn.textContent = originalText;
      }

      // Show user-friendly error
      alert(`Fehler beim Checkout: ${error.message}\n\nBitte versuche es erneut oder kontaktiere uns.`);
    }
  },

  /**
   * Configured Product Checkout (from 3D Configurator)
   * @param {object} config - Configuration object with color, finish, etc.
   */
  async buyConfigured(config) {
    try {
      // Show loading
      const btn = event?.target;
      const originalText = btn?.textContent;
      if (btn) {
        btn.disabled = true;
        btn.textContent = '⏳ Lädt...';
      }

      // Validate config
      if (!config || !config.color) {
        throw new Error('Bitte wähle zuerst eine Farbe aus');
      }

      // Default product SKU for configurator
      const sku = config.productSku || 'UNBREAK-GLAS-01';

      // Call checkout API
      const response = await fetch('/api/checkout/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          product_sku: sku,
          config: {
            color: config.color,
            finish: config.finish || 'matte',
            engraving: config.engraving || null,
            quantity: config.quantity || 1,
            // Add any other configurator options
            edition: config.edition || null,
          },
          customer: {
            email: config.email || null,
            name: config.name || null,
            address: config.address || null,
            country: config.country || 'DE'
          }
        }),
      });

      // Handle response
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Checkout failed');
      }

      const data = await response.json();
      
      console.log('✓ Konfiguration gespeichert:', data.configuration_id);
      console.log('✓ Order erstellt:', data.order_id);

      // Redirect to Stripe Checkout
      if (data.checkout_url) {
        window.location.href = data.checkout_url;
      } else {
        throw new Error('Keine Checkout-URL erhalten');
      }

    } catch (error) {
      console.error('❌ Checkout Error:', error);
      
      // Restore button
      if (btn) {
        btn.disabled = false;
        btn.textContent = originalText;
      }

      // Show user-friendly error
      alert(`Fehler beim Checkout: ${error.message}\n\nBitte versuche es erneut oder kontaktiere uns.`);
    }
  },

  /**
   * Quick Buy - One-click checkout für mobile/express
   * @param {string} sku - Product SKU
   * @param {number} quantity - Quantity (default 1)
   */
  async quickBuy(sku, quantity = 1) {
    return this.buyStandard(sku, { quantity });
  }
};

// ===========================================
// AUTO-BINDING: Automatic Button Integration
// ===========================================

/**
 * Global state for configurator data
 */
window.UnbreakCheckoutState = {
  lastConfig: null,
  initialized: false,
};

/**
 * Initialize checkout buttons automatically
 * Idempotent - can be called multiple times safely
 */
function initCheckoutButtons() {
  // Standard Product Buttons
  const standardButtons = document.querySelectorAll('[data-checkout="standard"]');
  standardButtons.forEach(button => {
    // Skip if already bound
    if (button.dataset.bound === '1') return;
    
    const sku = button.dataset.sku;
    const qty = parseInt(button.dataset.qty || '1', 10);
    
    if (!sku) {
      console.warn('Checkout button missing data-sku:', button);
      return;
    }
    
    button.addEventListener('click', (e) => {
      e.preventDefault();
      UnbreakCheckout.buyStandard(sku, { quantity: qty });
    });
    
    // Mark as bound
    button.dataset.bound = '1';
  });
  
  // Configured Product Buttons (Configurator)
  const configuredButtons = document.querySelectorAll('[data-checkout="configured"]');
  configuredButtons.forEach(button => {
    // Skip if already bound
    if (button.dataset.bound === '1') return;
    
    const productSku = button.dataset.productSku || 'UNBREAK-GLAS-01';
    
    button.addEventListener('click', (e) => {
      e.preventDefault();
      
      console.log('🛒 [CHECKOUT] Button clicked');
      console.log('🛒 [CHECKOUT] Current state:', window.UnbreakCheckoutState);
      
      // Use last config from state
      const config = window.UnbreakCheckoutState.lastConfig;
      
      console.log('🛒 [CHECKOUT] Config from state:', config);
      
      if (!config || !config.color) {
        console.warn('⚠️ [CHECKOUT] No config or color found!');
        console.log('⚠️ [CHECKOUT] Proceeding with default config...');
        
        // Fallback: Use default config
        const fallbackConfig = {
          color: 'petrol',
          finish: 'matte',
          productSku: productSku,
        };
        
        console.log('✓ [CHECKOUT] Using fallback config:', fallbackConfig);
        
        UnbreakCheckout.buyConfigured(fallbackConfig);
        return;
      }
      
      console.log('✓ [CHECKOUT] Calling buyConfigured with:', {
        productSku,
        ...config
      });
      
      UnbreakCheckout.buyConfigured({
        productSku: productSku,
        ...config
      });
    });
    
    // Mark as bound
    button.dataset.bound = '1';
  });
  
  console.log(`✓ Checkout buttons initialized: ${standardButtons.length + configuredButtons.length} buttons`);
}

/**
 * Listen to configurator updates via postMessage
 */
function initConfiguratorListener() {
  if (window.UnbreakCheckoutState.initialized) return;
  
  window.addEventListener('message', (event) => {
    console.log('📨 [MESSAGE] Received:', {
      origin: event.origin,
      type: event.data?.type,
      data: event.data
    });
    
    // Security: Check origin (adjust for your configurator domain)
    const allowedOrigins = [
      'https://unbreak-3-d-konfigurator.vercel.app',
      window.location.origin,
    ];
    
    if (!allowedOrigins.includes(event.origin)) {
      console.warn('⚠️ [MESSAGE] Blocked - unknown origin:', event.origin);
      return; // Ignore messages from unknown origins
    }
    
    // Handle config updates from configurator
    if (event.data.type === 'UNBREAK_CONFIG_UPDATE') {
      window.UnbreakCheckoutState.lastConfig = event.data.config;
      console.log('✓ [CONFIG] Updated from configurator:', event.data.config);
    }
  });
  
  window.UnbreakCheckoutState.initialized = true;
}

/**
 * Initialize on DOM ready
 */
if (typeof window !== 'undefined') {
  // Make UnbreakCheckout available globally
  window.UnbreakCheckout = UnbreakCheckout;
  
  // Auto-initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      initCheckoutButtons();
      initConfiguratorListener();
    });
  } else {
    // DOM already loaded
    initCheckoutButtons();
    initConfiguratorListener();
  }
  
  // Re-initialize on dynamic content changes (MutationObserver)
  const observer = new MutationObserver(() => {
    initCheckoutButtons(); // Idempotent
  });
  
  // Observe body for new buttons
  if (document.body) {
    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });
  }
}

// Export for module usage
export default UnbreakCheckout;
