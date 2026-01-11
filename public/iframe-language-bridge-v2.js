/**
 * UNBREAK ONE - iFrame Communication Bridge v2.1
 * 
 * Handles ALL communication with 3D configurator iframe
 * - Language synchronization with retry logic
 * - Config updates
 * - Add to Cart events
 * - Handshake & ACK protocol
 * 
 * @version 2.1.0
 * @requires bridge-schema.js
 * @requires bridge-debug.js
 * 
 * @changelog
 * v2.1.0 (2026-01-10):
 * - Added retry logic: Max 10 retries @ 2s timeout
 * - Reduced warn-noise in production mode
 * - Support for multiple ACK formats (LANG_ACK, SET_LOCALE_ACK, SET_LOCALE)
 * - Enhanced debug tracking (lastLangSent, lastAckReceived, retries)
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
   * ACK tracking for language changes
   */
  const pendingAcks = new Map(); // correlationId → {lang, sentAt, timeoutId, retries}
  const ACK_TIMEOUT_MS = 2000; // 2 seconds (war 3000)
  const MAX_RETRIES = 10; // Max retries (=> max ~20s)
  
  /**
   * Check if in production mode (no debug enabled)
   */
  function isProduction() {
    return !window.__UNBREAK_BRIDGE_DEBUG__ && 
           !localStorage.getItem('unbreak_bridge_debug') &&
           !new URLSearchParams(window.location.search).get('debug');
  }

  /**
   * Send language to iframe with ACK tracking and retry logic
   */
  function sendLanguageToIframe(lang, retryCount = 0) {
    console.info('[LANG][PARENT→IFRAME]', lang, retryCount > 0 ? `(retry ${retryCount}/${MAX_RETRIES})` : '');
    
    const message = new BridgeMessage(EventTypes.SET_LANG, { lang });
    const validation = message.validate();

    if (!validation.valid) {
      console.error('[LANG] Invalid message:', validation.errors);
      return;
    }

    // Send to iframe
    if (!iframe || !iframe.contentWindow) {
      console.warn('[LANG] iframe not ready, cannot send');
      return;
    }

    iframe.contentWindow.postMessage(message.toJSON(), CONFIGURATOR_ORIGIN);
    debug.logMessageSent(message, CONFIGURATOR_ORIGIN);
    
    // Update debug tracking
    if (window.UnbreakBridgeDebug) {
      window.UnbreakBridgeDebug.lastLangSent = {
        lang,
        correlationId: message.correlationId,
        timestamp: new Date().toISOString(),
        retryCount
      };
      window.UnbreakBridgeDebug.langRetries = retryCount;
    }

    // Track pending ACK with retry logic
    const timeoutId = setTimeout(() => {
      if (pendingAcks.has(message.correlationId)) {
        const pending = pendingAcks.get(message.correlationId);
        
        // Check if we should retry
        if (retryCount < MAX_RETRIES) {
          // Retry: Send again
          if (isProduction()) {
            console.log('[LANG][RETRY]', lang, `attempt ${retryCount + 1}/${MAX_RETRIES}`);
          } else {
            console.warn('[LANG][RETRY]', lang, `attempt ${retryCount + 1}/${MAX_RETRIES}`);
          }
          
          pendingAcks.delete(message.correlationId);
          sendLanguageToIframe(lang, retryCount + 1);
        } else {
          // Max retries reached
          if (isProduction()) {
            console.log('[LANG][NO_ACK] Max retries reached for language:', lang);
          } else {
            console.warn('[LANG][NO_ACK] Max retries reached for language:', lang);
          }
          pendingAcks.delete(message.correlationId);
        }
      }
    }, ACK_TIMEOUT_MS);

    pendingAcks.set(message.correlationId, {
      lang,
      sentAt: Date.now(),
      timeoutId,
      retries: retryCount
    });
  }

  /**
   * Convert legacy message format to Bridge v2.0 format
   */
  function convertLegacyMessage(data) {
    // GENERIC: Any message with 'type' instead of 'event'
    // Convert type → event if message doesn't have 'event' field
    if (data.type && !data.event) {
      // Map common type names to event names
      const typeToEventMap = {
        'UNBREAK_CONFIG_READY': 'UNBREAK_IFRAME_READY',
        'UNBREAK_SET_LANG': 'UNBREAK_SET_LANG',
        'UNBREAK_LANG_ACK': 'UNBREAK_LANG_ACK',
        'configChanged': 'UNBREAK_CONFIG_CHANGED',
        'addToCart': 'UNBREAK_ADD_TO_CART',
        'resetView': 'UNBREAK_RESET_VIEW',
        'error': 'UNBREAK_ERROR',
        'ready': 'UNBREAK_IFRAME_READY',
        'langAck': 'UNBREAK_LANG_ACK',
        'languageChanged': 'UNBREAK_LANG_ACK',
      };

      const eventName = typeToEventMap[data.type] || data.type;
      
      // Build v2.0 compliant message
      const converted = {
        event: eventName,
        schemaVersion: data.schemaVersion || '1.0',
        correlationId: data.correlationId || 'legacy_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
        timestamp: data.timestamp || new Date().toISOString(),
        payload: data.payload || data.config || data.data || {}
      };

      // Special handling for specific types
      if (data.type === 'UNBREAK_CONFIG_READY' || data.type === 'ready') {
        converted.payload = {
          iframeVersion: data.version || data.payload?.version || '1.0.0',
          supportedSchemaVersion: data.supportedSchemaVersion || '1.0',
          supportedLocales: data.supportedLocales || data.payload?.supportedLocales || ['de', 'en']
        };
      }

      console.log('[BRIDGE] 🔄 Generic legacy conversion:', data.type, '→', eventName);
      return converted;
    }

    // Legacy format: {type: 'configChanged', config: {...}, reason: 'add_to_cart'}
    if (data.type === 'configChanged' && data.reason === 'add_to_cart') {
      const config = data.config || {};
      return {
        event: 'UNBREAK_ADD_TO_CART',
        schemaVersion: '1.0',
        correlationId: 'legacy_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
        timestamp: new Date().toISOString(),
        payload: {
          variant: config.product_type || 'glass_holder',
          sku: config.product_type === 'bottle_holder' ? 'UNBREAK-WEIN-01' : 'UNBREAK-GLAS-01',
          colors: {
            base: config.base || 'mint',
            arm: config.arm || 'darkBlue',
            module: config.module || 'black',
            pattern: config.pattern || 'red'
          },
          finish: config.finish || 'matte',
          quantity: config.quantity || 1,
          locale: config.lang || 'de',
          pricing: {
            basePrice: 4900,
            totalPrice: 4900
          }
        }
      };
    }

    // Not a legacy format
    return null;
  }

  /**
   * Handle incoming messages from iframe
   * 
   * IMPORTANT: Does NOT return true to avoid Chrome Extension conflicts
   * ("A listener indicated an asynchronous response..." error)
   */
  function handleMessage(event) {
    debug.logMessageReceived(event);

    // Security: Check origin
    if (!isOriginAllowed(event.origin)) {
      debug.logDrop('origin_not_allowed', { 
        origin: event.origin,
        expected: CONFIGURATOR_ORIGIN 
      });
      return false; // Explicitly return false
    }

    // Verify message source
    // Allow messages from:
    // 1. iframe (production)
    // 2. Same origin (test/debug mode)
    const isFromIframe = iframe && event.source === iframe.contentWindow;
    const isFromSameOrigin = event.origin === window.location.origin;
    
    if (!isFromIframe && !isFromSameOrigin) {
      debug.logDrop('source_mismatch', { 
        isFromIframe,
        isFromSameOrigin,
        source: event.source?.location?.href || 'unknown'
      });
      return false; // Explicitly return false
    }

    // Try to convert legacy format
    let messageData = event.data;
    const legacyConverted = convertLegacyMessage(event.data);
    if (legacyConverted) {
      console.log('[BRIDGE] 🔄 Converted legacy message:', event.data.type, '→', legacyConverted.event);
      messageData = legacyConverted;
    }

    // Parse message
    let message;
    try {
      message = BridgeMessage.fromJSON(messageData);
    } catch (error) {
      debug.logDrop('message_parse_failed', { 
        error: error.message,
        rawData: messageData 
      });
      return false; // Explicitly return false
    }

    // Validate message
    const validation = message.validate();
    debug.logValidation(message, validation);

    if (!validation.valid) {
      // Log detailed errors for debugging
      console.warn('[BRIDGE] ⚠️ Message validation failed:', {
        event: message.event,
        errors: validation.errors,
        payload: message.payload,
        rawData: messageData
      });
      
      debug.logDrop('message_validation_failed', { 
        event: message.event,
        errors: validation.errors,
        payload: message.payload
      });
      return false; // Explicitly return false
    }

    // Route to handler
    routeMessage(message);
    
    // Return false to indicate synchronous handling (no async response expected)
    return false;
  }

  /**
   * Route message to appropriate handler
   */
  function routeMessage(message) {
    // Update debug tracking
    if (window.UnbreakBridgeDebug) {
      window.UnbreakBridgeDebug.lastMessageType = message.event;
      window.UnbreakBridgeDebug.lastOrigin = CONFIGURATOR_ORIGIN;
    }
    
    switch (message.event) {
      case EventTypes.IFRAME_READY:
        debug.logHandlerMatched('handleIframeReady', message);
        handleIframeReady(message);
        break;

      case EventTypes.GET_LANG:
        debug.logHandlerMatched('handleGetLang', message);
        handleGetLang(message);
        break;

      case EventTypes.LANG_ACK:
      case EventTypes.SET_LOCALE_ACK: // Support both ACK variants
      case EventTypes.SET_LOCALE:     // Some iframes might echo SET_LOCALE as ACK
        debug.logHandlerMatched('handleLangAck', message);
        handleLangAck(message);
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
   * Handler: Get Language
   * iframe requests current language - respond with SET_LANG
   */
  function handleGetLang(message) {
    console.log('[BRIDGE] 🌐 iframe requests language, sending:', currentLang);
    
    // Respond with current language using new protocol
    sendLanguageToIframe(currentLang);
  }

  /**
   * Handler: Language ACK
   * iframe confirms language change
   * Supports multiple ACK formats: LANG_ACK, SET_LOCALE_ACK, SET_LOCALE
   */
  function handleLangAck(message) {
    const lang = message.payload?.lang || message.payload?.locale;
    const replyTo = message.replyTo;

    console.info('[LANG][IFRAME→PARENT][ACK received]', {
      event: message.event,
      lang,
      replyTo
    });
    
    // Update debug tracking
    if (window.UnbreakBridgeDebug) {
      window.UnbreakBridgeDebug.lastAckReceived = {
        event: message.event,
        lang,
        timestamp: new Date().toISOString(),
        correlationId: message.correlationId,
        replyTo
      };
    }

    // Clear timeout if this is a reply to our SET_LANG
    if (replyTo && pendingAcks.has(replyTo)) {
      const pending = pendingAcks.get(replyTo);
      clearTimeout(pending.timeoutId);
      pendingAcks.delete(replyTo);

      const latency = Date.now() - pending.sentAt;
      console.log(`[LANG][ACK] ✅ Confirmed in ${latency}ms (after ${pending.retries} retries)`);
    } else {
      // ACK without pending request - might be unsolicited update
      console.log('[LANG][ACK] Received (no pending request)');
    }

    // Update current language if different
    if (lang && lang !== currentLang) {
      currentLang = lang;
      console.log('[LANG] ✅ Language synchronized:', lang);
    }
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
      if (!window.UnbreakCheckout?.createCheckoutFromConfig) {
        debug.log('ERROR', {
          error: 'UnbreakCheckout.createCheckoutFromConfig not available',
        });
        alert('Checkout-System nicht geladen. Bitte laden Sie die Seite neu.');
        return;
      }

      // Call checkout API
      const endpoint = '/api/checkout/create';
      debug.logApiCall(endpoint, config);

      const checkoutUrl = await window.UnbreakCheckout.createCheckoutFromConfig(config);

      debug.logApiResponse(endpoint, { url: checkoutUrl });

      // Redirect to Stripe
      debug.logRedirect(checkoutUrl);
      window.location.href = checkoutUrl;

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
      console.log('[LANG] Language switched to:', newLang);
      sendLanguageToIframe(newLang);
    });

    // AKTIV: Send initial language immediately when iframe loads
    iframe.addEventListener('load', function() {
      console.log('[LANG] iframe loaded, sending initial language:', currentLang);
      // Wait 200ms to ensure iframe JS is initialized
      setTimeout(() => {
        sendLanguageToIframe(currentLang);
      }, 200);
    });

    // Fallback: Also send after timeout if load event didn't fire
    setTimeout(() => {
      console.log('[LANG] Fallback: ensuring language is set:', currentLang);
      sendLanguageToIframe(currentLang);
    }, 800);
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
