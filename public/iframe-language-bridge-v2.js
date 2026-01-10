/**
 * UNBREAK ONE - iFrame Communication Bridge v2.0
 * 
 * Handles ALL communication with 3D configurator iframe
 * - Language synchronization
 * - Config updates
 * - Add to Cart events
 * - Handshake & ACK protocol
 * 
 * @version 2.0.0
 * @requires bridge-schema.js
 * @requires bridge-debug.js
 */

(function() {
  'use strict';

  // Wait for dependencies
  if (!window.UnbreakBridge || !window.UnbreakBridgeDebug) {
    console.error('[BRIDGE] Dependencies not loaded! Requires: bridge-schema.js, bridge-debug.js');
    return;
  }

  const { EventTypes, BridgeMessage, isOriginAllowed } = window.UnbreakBridge;
  const debug = window.UnbreakBridgeDebug;

  // Configuration
  const CONFIGURATOR_IFRAME_ID = 'configurator-iframe';
  const CONFIGURATOR_ORIGIN = 'https://unbreak-3-d-konfigurator.vercel.app';
  
  let iframe = null;
  let currentLang = 'de';
  let handshakeComplete = false;
  let messageListener = null; // Store reference to prevent re-registration

  /**
   * Get current language from i18n system
   */
  function getCurrentLanguage() {
    if (window.i18n && typeof window.i18n.getCurrentLanguage === 'function') {
      return window.i18n.getCurrentLanguage();
    }
    return localStorage.getItem('preferredLanguage') || 'de';
  }

  /**
   * Send message to iframe (with schema validation)
   */
  function sendToIframe(event, payload = {}, options = {}) {
    if (!iframe || !iframe.contentWindow) {
      debug.logDrop('iframe_not_ready', { event });
      return;
    }

    const message = new BridgeMessage(event, payload, options);
    const validation = message.validate();

    if (!validation.valid) {
      debug.logDrop('invalid_outgoing_message', { 
        event, 
        errors: validation.errors 
      });
      console.error('[BRIDGE] Invalid message:', validation.errors);
      return;
    }

    const targetOrigin = CONFIGURATOR_ORIGIN;
    iframe.contentWindow.postMessage(message.toJSON(), targetOrigin);
    
    debug.logMessageSent(message, targetOrigin);
  }

  /**
   * Send language to iframe
   */
  function sendLanguageToIframe(lang) {
    sendToIframe(EventTypes.SET_LOCALE, { locale: lang });
  }

  /**
   * Handle incoming messages from iframe
   */
  function handleMessage(event) {
    debug.logMessageReceived(event);

    // Security: Check origin
    if (!isOriginAllowed(event.origin)) {
      debug.logDrop('origin_not_allowed', { 
        origin: event.origin,
        expected: CONFIGURATOR_ORIGIN 
      });
      return;
    }

    // Verify message source
    if (iframe && event.source !== iframe.contentWindow) {
      debug.logDrop('source_mismatch', {});
      return;
    }

    // Parse message
    let message;
    try {
      message = BridgeMessage.fromJSON(event.data);
    } catch (error) {
      debug.logDrop('message_parse_failed', { 
        error: error.message,
        rawData: event.data 
      });
      return;
    }

    // Validate message
    const validation = message.validate();
    debug.logValidation(message, validation);

    if (!validation.valid) {
      debug.logDrop('message_validation_failed', { 
        errors: validation.errors 
      });
      return;
    }

    // Route to handler
    routeMessage(message);
  }

  /**
   * Route message to appropriate handler
   */
  function routeMessage(message) {
    switch (message.event) {
      case EventTypes.IFRAME_READY:
        debug.logHandlerMatched('handleIframeReady', message);
        handleIframeReady(message);
        break;

      case EventTypes.ACK:
        debug.logHandlerMatched('handleAck', message);
        handleAck(message);
        break;

      case EventTypes.CONFIG_CHANGED:
        debug.logHandlerMatched('handleConfigChanged', message);
        handleConfigChanged(message);
        break;

      case EventTypes.ADD_TO_CART:
        debug.logHandlerMatched('handleAddToCart', message);
        handleAddToCart(message);
        break;

      case EventTypes.RESET_VIEW:
        debug.logHandlerMatched('handleResetView', message);
        handleResetView(message);
        break;

      case EventTypes.ERROR:
        debug.logHandlerMatched('handleError', message);
        handleError(message);
        break;

      default:
        debug.logDrop('unknown_event_type', { 
          event: message.event 
        });
        break;
    }
  }

  /**
   * Handler: iframe Ready
   */
  function handleIframeReady(message) {
    console.log('[BRIDGE] 🤝 iframe is READY, starting handshake');
    
    const iframeVersion = message.payload?.iframeVersion || 'unknown';
    const supportedLocales = message.payload?.supportedLocales || ['de', 'en'];

    debug.log('HANDSHAKE', {
      iframeVersion,
      supportedLocales,
    });

    // Send PARENT_HELLO + current locale
    sendToIframe(EventTypes.PARENT_HELLO, {
      locale: currentLang,
      parentVersion: '2.0.0',
      supportedSchemaVersion: window.UnbreakBridge.SCHEMA_VERSION,
    }, {
      replyTo: message.correlationId
    });

    handshakeComplete = true;
  }

  /**
   * Handler: ACK
   */
  function handleAck(message) {
    const status = message.payload?.status;
    const acknowledges = message.payload?.acknowledges;

    debug.log('HANDSHAKE', {
      acknowledges,
      status,
    });

    if (status === 'error') {
      console.warn('[BRIDGE] iframe returned error ACK:', message.payload?.message);
    }
  }

  /**
   * Handler: Config Changed
   */
  function handleConfigChanged(message) {
    const config = message.payload;
    
    // Store in bridge (if using ConfiguratorBridge)
    if (window.getConfiguratorBridge) {
      const bridge = window.getConfiguratorBridge();
      if (bridge) {
        bridge.lastConfig = config;
        bridge.lastReceivedAt = Date.now();
      }
    }

    // Emit custom event for listeners
    window.dispatchEvent(new CustomEvent('unbreak-config-changed', { 
      detail: config 
    }));

    debug.log('HANDLER_MATCHED', {
      handler: 'CONFIG_CHANGED',
      variant: config.variant,
      hasColors: !!config.colors,
    });
  }

  /**
   * Handler: Add to Cart
   */
  async function handleAddToCart(message) {
    const config = message.payload;

    debug.logCheckoutTrigger(config);

    if (!config || !config.variant) {
      debug.logDrop('add_to_cart_invalid_config', { config });
      alert('Ungültige Konfiguration. Bitte versuchen Sie es erneut.');
      return;
    }

    try {
      // Check if UnbreakCheckout is available
      if (!window.UnbreakCheckout?.createCheckoutSession) {
        debug.log('ERROR', {
          error: 'UnbreakCheckout.createCheckoutSession not available',
        });
        alert('Checkout-System nicht geladen. Bitte laden Sie die Seite neu.');
        return;
      }

      // Call checkout API
      const endpoint = '/api/checkout/create-checkout-session';
      debug.logApiCall(endpoint, config);

      const url = await window.UnbreakCheckout.createCheckoutSession(config);

      debug.logApiResponse(endpoint, { url });

      // Redirect to Stripe
      debug.logRedirect(url);
      window.location.href = url;

    } catch (error) {
      debug.logApiResponse('/api/checkout/create-checkout-session', null, error);
      
      console.error('[BRIDGE] ❌ Checkout failed:', error);
      alert(
        currentLang === 'de' 
          ? 'Fehler beim Checkout. Bitte versuchen Sie es erneut.' 
          : 'Checkout error. Please try again.'
      );
    }
  }

  /**
   * Handler: Reset View
   */
  function handleResetView(message) {
    debug.log('HANDLER_MATCHED', {
      handler: 'RESET_VIEW',
    });

    // Optional: Track analytics
    if (window.UnbreakTrace) {
      window.UnbreakTrace.log('IFRAME_RESET_VIEW', {});
    }
  }

  /**
   * Handler: Error
   */
  function handleError(message) {
    const errorCode = message.payload?.code;
    const errorMessage = message.payload?.message;

    debug.log('ERROR', {
      code: errorCode,
      message: errorMessage,
    });

    console.error('[BRIDGE] iframe reported error:', errorCode, errorMessage);
  }

  /**
   * Initialize iframe bridge
   */
  function initializeIframe() {
    iframe = document.getElementById(CONFIGURATOR_IFRAME_ID);

    if (!iframe) {
      debug.logDrop('iframe_not_found', { id: CONFIGURATOR_IFRAME_ID });
      return;
    }

    debug.log('INIT', {
      iframeId: CONFIGURATOR_IFRAME_ID,
      iframeSrc: iframe.src,
      expectedOrigin: CONFIGURATOR_ORIGIN,
    });

    currentLang = getCurrentLanguage();

    // Register message listener ONCE (prevent spam)
    if (!messageListener) {
      messageListener = handleMessage;
      window.addEventListener('message', messageListener);
      debug.log('INIT', { listenerRegistered: true });
    }

    // Listen for language changes from i18n system
    document.addEventListener('languageChanged', function(e) {
      const newLang = e.detail?.language || e.detail?.lang || getCurrentLanguage();
      currentLang = newLang;
      sendLanguageToIframe(newLang);
    });

    // Send initial language after short delay (ensure iframe is ready)
    setTimeout(() => {
      sendLanguageToIframe(currentLang);
    }, 500);
  }

  /**
   * Initialize when DOM is ready
   */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeIframe);
  } else {
    initializeIframe();
  }

  // Expose API for manual control
  window.iframeBridge = {
    version: '2.0.0',
    setLanguage: sendLanguageToIframe,
    getCurrentLanguage: getCurrentLanguage,
    isHandshakeComplete: () => handshakeComplete,
    sendMessage: sendToIframe,
  };

  debug.log('INIT', { 
    version: '2.0.0',
    schemaVersion: window.UnbreakBridge.SCHEMA_VERSION,
  });

})();
