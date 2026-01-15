/**
 * UNBREAK ONE - iFrame Language Bridge + Cart Integration
 * Communicates language changes from homepage to 3D configurator iframe
 * Listens for "Add to Cart" events from iframe
 */

(function() {
  'use strict';

  // Configuration
  const CONFIGURATOR_IFRAME_ID = 'configurator-iframe';
  const CONFIGURATOR_ORIGIN = (typeof window !== 'undefined' && window.ENV?.NEXT_PUBLIC_CONFIGURATOR_DOMAIN) ||
                               'https://unbreak-3-d-konfigurator.vercel.app';
  
  // Security: Allowed origins for postMessage
  const ALLOWED_ORIGINS = [
    (typeof window !== 'undefined' && window.ENV?.NEXT_PUBLIC_CONFIGURATOR_DOMAIN) || 'https://unbreak-3-d-konfigurator.vercel.app',
    typeof window !== 'undefined' ? window.location.origin : 'https://unbreak-one.com',
    'http://localhost:3000', // Dev
  ];

  /**
   * Check if origin is allowed (supports Vercel preview deployments)
   */
  function isOriginAllowed(origin) {
    // Exact match
    if (ALLOWED_ORIGINS.includes(origin)) {
      return true;
    }
    
    // Vercel preview deployments: https://unbreak-*.vercel.app
    const vercelPreviewPattern = /^https:\/\/unbreak-[a-z0-9-]+\.vercel\.app$/;
    if (vercelPreviewPattern.test(origin)) {
      return true;
    }
    
    return false;
  }
  
  let iframe = null;
  let currentLang = 'de';

  /**
   * Get current language from i18n system
   */
  function getCurrentLanguage() {
    if (window.i18n && typeof window.i18n.getCurrentLanguage === 'function') {
      return window.i18n.getCurrentLanguage();
    }
    // Fallback to localStorage
    return localStorage.getItem('preferredLanguage') || 'de';
  }

  /**
   * Send language to iframe via postMessage
   */
  function sendLanguageToIframe(lang) {
    if (!iframe || !iframe.contentWindow) {
      console.warn('[iFrame Bridge] iframe not ready');
      return;
    }

    const message = {
      type: 'SET_LOCALE',
      locale: lang,
      timestamp: Date.now()
    };

    console.log('[iFrame Bridge] Sending language to iframe:', lang);
    iframe.contentWindow.postMessage(message, CONFIGURATOR_ORIGIN);
    currentLang = lang;
  }

  /**
   * Update iframe src with language parameter
   */
  function updateIframeSrc(lang) {
    if (!iframe) return;

    const currentSrc = iframe.src || CONFIGURATOR_ORIGIN;
    const url = new URL(currentSrc);
    
    // Update or add lang parameter
    url.searchParams.set('lang', lang);
    
    // Only update if changed
    if (iframe.src !== url.toString()) {
      console.log('[iFrame Bridge] Updating iframe src with lang:', lang);
      iframe.src = url.toString();
    }
  }

  /**
   * Initialize iframe with current language
   */
  function initializeIframe() {
    iframe = document.getElementById(CONFIGURATOR_IFRAME_ID);
    
    if (!iframe) {
      console.warn('[iFrame Bridge] Configurator iframe not found, retrying...');
      setTimeout(initializeIframe, 500);
      return;
    }

    currentLang = getCurrentLanguage();
    console.log('[iFrame Bridge] Initializing with language:', currentLang);

    // Update src with language parameter
    updateIframeSrc(currentLang);

    // Send language when iframe loads
    iframe.addEventListener('load', function() {
      console.log('[iFrame Bridge] iframe loaded, sending language');
      setTimeout(() => sendLanguageToIframe(currentLang), 100);
    });

    // Listen for language changes from i18n system
    window.addEventListener('i18nLanguageChanged', function(e) {
      const newLang = e.detail?.lang || getCurrentLanguage();
      console.log('[iFrame Bridge] Language changed to:', newLang);
      sendLanguageToIframe(newLang);
    });

    // Listen for custom events (fallback)
    document.addEventListener('languageChanged', function(e) {
      const newLang = e.detail?.language || e.detail?.lang || getCurrentLanguage();
      console.log('[iFrame Bridge] Language changed (custom event):', newLang);
      sendLanguageToIframe(newLang);
    });

    // Listen for ACK from iframe (optional)
    window.addEventListener('message', handleIframeMessage);

    // Send initial language after short delay (ensure iframe is ready)
    setTimeout(() => sendLanguageToIframe(currentLang), 500);
  }

  /**
   * Handle incoming messages from iframe
   * Listens for: LOCALE_ACK, ADD_TO_CART, RESET_VIEW
   */
  function handleIframeMessage(event) {
    // Security: Check origin
    if (!isOriginAllowed(event.origin)) {
      console.warn('[iFrame Bridge] Blocked message from unknown origin:', event.origin);
      return;
    }

    // Verify message source is our iframe
    if (iframe && event.source !== iframe.contentWindow) {
      console.warn('[iFrame Bridge] Message source mismatch');
      return;
    }

    const { type, payload, config, reason } = event.data || {};

    switch (type) {
      case 'LOCALE_ACK':
        console.log('[iFrame Bridge] Received ACK from iframe:', payload?.locale);
        break;

      case 'UNBREAK_ONE_ADD_TO_CART':
        console.info('[iFrame Bridge] 🛒 Add to Cart received:', payload);
        handleAddToCart(payload);
        break;

      case 'configChanged':
        // Handle iframe's native format: {type: 'configChanged', reason: 'add_to_cart', config: {...}}
        if (reason === 'add_to_cart') {
          console.info('[iFrame Bridge] 🛒 Add to Cart (configChanged):', config);
          handleAddToCart(config);
        }
        break;

      case 'UNBREAK_ONE_RESET_VIEW':
        console.info('[iFrame Bridge] 🔄 Reset view received');
        // Optional: Track analytics or update UI
        break;

      default:
        // Ignore unknown message types
        break;
    }
  }

  /**
   * Handle Add to Cart event from iframe
   * Starts checkout flow with configured product
   */
  async function handleAddToCart(payload) {
    if (!payload) {
      console.error('[iFrame Bridge] Invalid Add to Cart payload');
      return;
    }

    try {
      console.log('[iFrame Bridge] Starting checkout with config:', payload);

      // Support both formats:
      // Format 1: {variant, config, pricing, locale} - from UNBREAK_ONE_ADD_TO_CART
      // Format 2: {product, parts, colors, ...} - from configChanged
      
      let productType, configuration;
      
      if (payload.variant && payload.config) {
        // Format 1 (structured)
        productType = payload.variant;
        configuration = payload.config;
      } else if (payload.product || payload.parts) {
        // Format 2 (iframe native) - use entire payload as config
        productType = payload.product || 'glass_holder'; // fallback
        configuration = payload;
      } else {
        throw new Error('Invalid config format - no product/variant found');
      }

      // Map to checkout API format
      const checkoutData = {
        productType: productType,
        configuration: configuration,
        locale: payload.locale || currentLang,
        metadata: {
          source: 'iframe_configurator',
          timestamp: new Date().toISOString(),
        }
      };

      // Call existing checkout API
      const response = await fetch('/api/checkout/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(checkoutData),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Checkout failed');
      }

      const { url } = await response.json();
      
      // Redirect to Stripe Checkout
      console.log('[iFrame Bridge] ✅ Redirecting to checkout:', url);
      window.location.href = url;

    } catch (error) {
      console.error('[iFrame Bridge] ❌ Checkout error:', error);
      alert(
        currentLang === 'de' 
          ? 'Fehler beim Checkout. Bitte versuchen Sie es erneut.' 
          : 'Checkout error. Please try again.'
      );
    }
  }

  /**
   * Initialize when DOM is ready
   */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeIframe);
  } else {
    initializeIframe();
  }

  // Expose API for manual control (optional)
  window.iframeBridge = {
    setLanguage: sendLanguageToIframe,
    getCurrentLanguage: getCurrentLanguage,
  };

})();  // Expose API for manual triggering
  window.iframeBridge = {
    setLanguage: sendLanguageToIframe,
    getCurrentLanguage: () => currentLang
  };

})();
