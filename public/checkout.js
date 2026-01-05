/**
 * UNBREAK ONE - Checkout Integration
 * Production-Ready Button Handlers
 * 
 * WICHTIG: Keine Design-Änderungen - nur Funktionalität ergänzen
 */

console.log('🚀 [CHECKOUT] checkout.js START - File is being executed');

// Initialize trace if available
if (typeof window.UnbreakTrace !== 'undefined') {
    window.UnbreakTrace.start('checkout_page_load');
    console.log('✅ [TRACE] Trace system initialized on checkout page');
}

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
   * Add to Cart (from Configurator or Shop)
   * @param {object} config - Configuration object
   * @param {Event} clickEvent - Click event for button feedback
   */
  async addToCart(config, clickEvent = null) {
    console.log('🛒 [ADD_TO_CART] Button clicked!', {
      config: config,
      hasEvent: !!clickEvent,
      timestamp: new Date().toISOString()
    });

    const btn = clickEvent?.target;
    const originalText = btn?.textContent || 'In den Warenkorb';

    try {
      if (btn) {
        btn.disabled = true;
        btn.textContent = '⏳ Wird hinzugefügt...';
      }

      // Validate config
      if (!config || (!config.colors && !config.color)) {
        console.error('❌ [ADD_TO_CART] No configuration available');
        throw new Error('Keine Konfiguration verfügbar - bitte wähle zuerst im Konfigurator');
      }

      // Add to cart (localStorage for now)
      const cart = JSON.parse(localStorage.getItem('unbreak_cart') || '[]');
      cart.push({
        id: Date.now(),
        product_sku: config.product_sku || 'UNBREAK-GLAS-01',
        config: config,
        quantity: 1,
        added_at: new Date().toISOString()
      });
      localStorage.setItem('unbreak_cart', JSON.stringify(cart));

      console.log('✅ [ADD_TO_CART] Item added to cart', { cartSize: cart.length });

      // Success feedback
      if (btn) {
        btn.textContent = '✓ Hinzugefügt!';
        setTimeout(() => {
          btn.disabled = false;
          btn.textContent = originalText;
        }, 2000);
      }

      // Optional: Show cart count badge
      const badge = document.querySelector('.cart-badge');
      if (badge) {
        badge.textContent = cart.length;
        badge.style.display = 'block';
      }

    } catch (error) {
      console.error('❌ [ADD_TO_CART] Error:', error);
      if (btn) {
        btn.disabled = false;
        btn.textContent = originalText;
      }
      alert('Fehler beim Hinzufügen zum Warenkorb: ' + error.message);
    }
  },

  /**
   * Configured Product Checkout (from 3D Configurator)
   * @param {object} config - DEPRECATED: Use ConfiguratorBridge instead
   * @param {Event} clickEvent - Optional click event for button feedback
   */
  async buyConfigured(config, clickEvent = null) {
    // START TRACE
    const trace_id = window.UnbreakTrace ? window.UnbreakTrace.start('checkout_configured') : crypto.randomUUID();
    
    // Store button reference and original text BEFORE try block
    const btn = clickEvent?.target;
    const originalText = btn?.textContent || '🛍️ Jetzt kaufen';
    
    try {
      console.log('🛍️ [CHECKOUT] buyConfigured called');
      
      // Show loading
      if (btn) {
        btn.disabled = true;
        btn.textContent = '⏳ Lädt...';
        console.log('🛒 [CHECKOUT] Button disabled, showing loading...');
      }

      // ✅ Get validated config from ConfiguratorBridge v2.0.0
      if (!window.ConfiguratorBridge) {
        console.error('❌ [CHECKOUT] ConfiguratorBridge not available!');
        throw new Error('Konfigurator nicht geladen - bitte lade die Seite neu');
      }

      console.log('[CHECKOUT] trace_id=' + trace_id + ' requesting config from bridge...');
      config = await window.ConfiguratorBridge.requestConfig();
      console.log('[CHECKOUT] trace_id=' + trace_id + ' received validated config:', config);
      
      if (window.UnbreakTrace) {
        window.UnbreakTrace.logConfig(config, 'CHECKOUT_CONFIG_FROM_BRIDGE');
      }

      // Validate required fields (bridge should already validate, but double-check)
      if (!config || !config.colors || !config.variant) {
        console.error('❌ [CHECKOUT] Invalid config from bridge!', config);
        
        if (window.UnbreakTrace) {
          window.UnbreakTrace.log('CONFIG_INVALID_FROM_BRIDGE', {
            config: config
          }, 'ERROR');
        }
        
        throw new Error('Keine Konfiguration verfügbar - bitte wähle zuerst Farben im Konfigurator');
      }

      // ✅ Config is already validated by bridge (4-part colors: base/arm/module/pattern)
      console.log('✅ [CHECKOUT] Validated config from bridge:', {
        variant: config.variant,
        colors: config.colors,
        finish: config.finish,
        quantity: config.quantity
      });

      // Determine product SKU from variant
      const sku = config.variant === 'bottle_holder' ? 'UNBREAK-WEIN-01' : 'UNBREAK-GLAS-01';
      
      console.log('🛒 [CHECKOUT] Using SKU:', { trace_id, sku });
      console.log('🛒 [CHECKOUT] Calling API with config:', { trace_id, config });
      
      // Log before API call
      if (window.UnbreakTrace) {
          window.UnbreakTrace.log('CHECKOUT_API_CALL', {
              endpoint: '/api/checkout/create',
              product_sku: sku,
              config_summary: {
                  colors: config.colors,
                  color: config.color,
                  finish: config.finish,
                  product: config.product
              }
          });
      }

      // Call checkout API - send complete validated config from bridge
      console.log('[CHECKOUT] trace_id=' + trace_id + ' sending config:', config);
      
      const response = await fetch('/api/checkout/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Trace-ID': trace_id // Send trace_id to server
        },
        body: JSON.stringify({
          trace_id,
          product_sku: sku,
          config: config, // ✅ Send complete config (variant, colors.base/arm/module/pattern, finish, etc.)
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
        const errorData = await response.json();
        if (window.UnbreakTrace) {
          window.UnbreakTrace.log('CHECKOUT_API_ERROR', {
            status: response.status,
            error: errorData.error,
            details: errorData.details
          }, 'ERROR');
        }
        console.error('❌ [CHECKOUT] API error:', errorData);
        throw new Error(errorData.error || 'Checkout failed');
      }

      const data = await response.json();
      
      if (window.UnbreakTrace) {
        window.UnbreakTrace.log('CHECKOUT_API_SUCCESS', {
          order_id: data.order_id,
          has_checkout_url: !!data.checkout_url
        });
      }
      
      console.log('✓ [CHECKOUT] Konfiguration gespeichert:', data.configuration_id);
      console.log('✓ [CHECKOUT] Order erstellt:', data.order_id);
      console.log('✓ [CHECKOUT] Checkout URL:', data.checkout_url);

      // Redirect to Stripe Checkout
      if (data.checkout_url) {
        if (window.UnbreakTrace) {
          window.UnbreakTrace.log('CHECKOUT_REDIRECT', {
            url: data.checkout_url.substring(0, 50) + '...',
            order_id: data.order_id
          });
        }
        console.log('🔄 [CHECKOUT] Redirecting to Stripe...');
        window.location.href = data.checkout_url;
      } else {
        console.error('❌ [CHECKOUT] No checkout URL in response!');
        throw new Error('Keine Checkout-URL erhalten');
      }

    } catch (error) {
      console.error('❌ [CHECKOUT] Error:', error);
      
      // Restore button (use stored originalText from function start)
      if (btn) {
        btn.disabled = false;
        btn.textContent = originalText;
        console.log('🔄 [CHECKOUT] Button restored');
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

console.log('📦 [CHECKOUT] State object created:', window.UnbreakCheckoutState);

/**
 * Initialize checkout buttons automatically
 * Idempotent - can be called multiple times safely
 */
function initCheckoutButtons() {
  console.log('🔧 [INIT] initCheckoutButtons called');
  console.log('🔧 [INIT] Document ready state:', document.readyState);
  
  // Standard Product Buttons
  const standardButtons = document.querySelectorAll('[data-checkout="standard"]');
  console.log('🔧 [INIT] Found standard buttons:', standardButtons.length);
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
  
  // Add to Cart Buttons
  const cartButtons = document.querySelectorAll('[data-checkout="add-to-cart"]');
  console.log('🔧 [INIT] Found add-to-cart buttons:', cartButtons.length);
  cartButtons.forEach(button => {
    if (button.dataset.bound === '1') return;
    
    button.addEventListener('click', (e) => {
      e.preventDefault();
      console.log('🛒 [CART] Add to cart button clicked');
      
      const config = window.UnbreakCheckoutState?.lastConfig;
      
      if (!config) {
        console.error('❌ [CART] No configuration available');
        alert('Bitte wähle zuerst eine Konfiguration im Konfigurator');
        return;
      }
      
      UnbreakCheckout.addToCart(config, e);
    });
    
    button.dataset.bound = '1';
  });

  // Configured Product Buttons (Configurator)
  const configuredButtons = document.querySelectorAll('[data-checkout="configured"]');
  console.log('🔧 [INIT] Found configured buttons:', configuredButtons.length);
  configuredButtons.forEach(button => {
    // Skip if already bound
    if (button.dataset.bound === '1') {
      console.log('⏭️ [INIT] Button already bound, skipping');
      return;
    }
    
    const productSku = button.dataset.productSku || 'UNBREAK-GLAS-01';
    console.log('🔧 [INIT] Binding configured button with SKU:', productSku);
    
    button.addEventListener('click', async (e) => {
      e.preventDefault();
      
      console.log('🛒 [CHECKOUT] Button clicked');
      console.log('🛒 [CHECKOUT] Button element:', button);
      console.log('🛒 [CHECKOUT] Product SKU:', productSku);
      
      // Get bridge reference
      const bridge = window.getConfiguratorBridge && window.getConfiguratorBridge();
      
      if (!bridge) {
        console.error('❌ [CHECKOUT] ConfiguratorBridge not found!');
        alert('Fehler: Konfigurator-Verbindung nicht gefunden');
        return;
      }
      
      // Check if ready
      if (!bridge.isReady()) {
        console.warn('⚠️ [CHECKOUT] Configurator not ready yet');
        alert('Bitte warten Sie, bis der Konfigurator vollständig geladen ist');
        return;
      }
      
      // Request config from bridge
      console.log('📤 [CHECKOUT] Requesting config from bridge...');
      let config;
      
      try {
        config = await bridge.requestConfig();
        console.log('✅ [CHECKOUT] Got config from bridge:', config);
      } catch (error) {
        console.error('❌ [CHECKOUT] Failed to get config:', error);
        alert('Bitte wählen Sie zuerst Farben im Konfigurator');
        return;
      }
      
      // Validate config (4-part colors: base, arm, module, pattern)
      if (!config || !config.colors || !config.colors.base || !config.colors.arm || !config.colors.module || !config.colors.pattern) {
        console.error('❌ [CHECKOUT] Invalid config structure:', config);
        alert('Konfiguration unvollständig - bitte wählen Sie alle Farben');
        return;
      }
      
      // Add SKU to config if not present
      config.productSku = config.productSku || productSku;
      
      console.log('🛒 [CHECKOUT] Final config for buyConfigured:', config);
      
      UnbreakCheckout.buyConfigured(config, e); // Pass click event for button feedback
    });
    
    // Mark as bound
    button.dataset.bound = '1';
  });
  
  console.log(`✓ Checkout buttons initialized: ${standardButtons.length + configuredButtons.length + cartButtons.length} buttons (${standardButtons.length} standard, ${configuredButtons.length} configured, ${cartButtons.length} cart)`);
}

/**
 * Listen to configurator updates via postMessage
 */
function initConfiguratorListener() {
  console.log('🔊 [INIT] initConfiguratorListener called');
  
  if (window.UnbreakCheckoutState.initialized) {
    console.log('⏭️ [INIT] Listener already initialized, skipping');
    return;
  }
  
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
      console.log('⚠️ [MESSAGE] Allowed origins are:', allowedOrigins);
      console.log('⚠️ [MESSAGE] Full event data:', event.data);
      return; // Ignore messages from unknown origins
    }
    
    console.log('✅ [MESSAGE] Origin allowed, processing message');
    
    // Handle config updates from configurator
    if (event.data.type === 'UNBREAK_CONFIG_UPDATE') {
      // Handle old format: {color, finish, ...}
      window.UnbreakCheckoutState.lastConfig = event.data.config;
      console.log('✓ [CONFIG] Updated from configurator (old format):', event.data.config);
    } else if (event.data.type === 'configChanged' || event.data.type === 'checkout_configuration') {
      // Handle new format from iframe: {product_name, product_variant, colors: {...}, ...}
      console.log('📦 [CONFIG] Received from configurator iframe:', event.data);
      
      const rawConfig = event.data.config || event.data;
      
      // Preserve complete colors object - DO NOT flatten to single color!
      const transformedConfig = {
        colors: rawConfig.colors || (rawConfig.color ? {base: rawConfig.color, top: rawConfig.color} : null),
        color: rawConfig.color || null, // Keep for legacy compatibility
        finish: rawConfig.finish || 'matte',
        product: rawConfig.product_variant || rawConfig.product || 'glass_holder',
        engraving: rawConfig.engraving || null,
        quantity: rawConfig.quantity || 1,
      };
      
      window.UnbreakCheckoutState.lastConfig = transformedConfig;
      console.log('✓ [CONFIG] Transformed and saved:', transformedConfig);
      
      // Log color change if trace active
      if (window.UnbreakTrace && transformedConfig.colors) {
        window.UnbreakTrace.logConfig(transformedConfig, 'POSTMESSAGE_CONFIG_UPDATE');
      }
    } else {
      console.log('ℹ️ [MESSAGE] Unknown message type, data:', event.data);
      
      // Try to extract config from any message containing product info
      if (event.data.product_name || event.data.product_variant || event.data.colors) {
        console.log('📦 [CONFIG] Found product data in unknown message type, processing...');
        
        const rawConfig = event.data;
        const transformedConfig = {
          colors: rawConfig.colors || null, // PRESERVE full colors object
          color: rawConfig.color || null,
          finish: rawConfig.finish || 'matte',
          product: rawConfig.product_variant || rawConfig.product || 'glass_holder',
          engraving: rawConfig.engraving || null,
          quantity: rawConfig.quantity || 1,
        };
        
        window.UnbreakCheckoutState.lastConfig = transformedConfig;
        console.log('✓ [CONFIG] Extracted and saved from unknown type:', transformedConfig);
        
        if (window.UnbreakTrace) {
          window.UnbreakTrace.logConfig(transformedConfig, 'UNKNOWN_MESSAGE_CONFIG');
        }
      }
    }
  });
  
  console.log('✅ [INIT] postMessage listener attached');
  window.UnbreakCheckoutState.initialized = true;
}

/**
 * Initialize on DOM ready
 */
if (typeof window !== 'undefined') {
  // Make UnbreakCheckout available globally
  window.UnbreakCheckout = UnbreakCheckout;
  
  // EVENT DELEGATION: Global click handler for buy buttons (always works)
  document.addEventListener('click', function(e) {
    const buyButton = e.target.closest('[data-checkout="configured"]');
    if (!buyButton) return;
    
    // Mark delegation as active
    buyButton._delegationActive = true;
    
    // Only handle if no direct handler bound (fallback)
    if (buyButton.dataset.bound === '1') return;
    
    e.preventDefault();
    const traceId = 'click_' + Date.now();
    console.log('[BUY] click captured via delegation, trace_id=' + traceId);
    
    if (window.UnbreakDebugPanel) {
      window.UnbreakDebugPanel.logMessage('BUY_CLICK', 'to', 'Button click captured via delegation');
    }
    
    // Try to get config from bridge
    const bridge = window.getConfiguratorBridge?.();
    if (!bridge) {
      console.error('[BUY] Bridge not found');
      alert('Konfigurator-Bridge nicht gefunden');
      return;
    }
    
    if (!bridge.isReady()) {
      console.warn('[BUY] Bridge not ready');
      alert('Bitte warten - Konfigurator lädt noch');
      return;
    }
    
    // Request config
    bridge.requestConfig().then(config => {
      console.log('[BUY] Got config, calling buyConfigured');
      UnbreakCheckout.buyConfigured(config, e);
    }).catch(err => {
      console.error('[BUY] Config request failed:', err);
      
      // Try fallback to window.__unbreakLastConfig
      const fallback = window.__unbreakLastConfig;
      if (fallback) {
        console.log('[BUY] Using fallback config from window.__unbreakLastConfig');
        UnbreakCheckout.buyConfigured(fallback, e);
      } else {
        alert('Keine Konfiguration verfügbar - bitte wählen Sie zuerst Farben');
      }
    });
  });
  
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
  
  console.log('✅ [CHECKOUT] checkout.js loaded and initialized');
  console.log('✅ [CHECKOUT] UnbreakCheckout available:', typeof window.UnbreakCheckout);
  console.log('✅ [CHECKOUT] State initialized:', window.UnbreakCheckoutState);
  console.log('✅ [CHECKOUT] Event delegation active for [data-checkout="configured"]');
  
  // Mark all buttons as having delegation active
  setTimeout(() => {
    document.querySelectorAll('[data-checkout="configured"]').forEach(btn => {
      btn._delegationActive = true;
    });
  }, 100);
}
