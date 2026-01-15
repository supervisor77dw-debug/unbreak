/**
 * UNBREAK ONE - iFrame Communication Bridge v2.2
 * 
 * Handles ALL communication with 3D configurator iframe
 * - Language synchronization with retry logic
 * - Config updates
 * - Add to Cart events
 * - Handshake & ACK protocol
 * 
 * @version 2.2.0
 * @requires bridge-schema.js
 * @requires bridge-debug.js
 * 
 * @changelog
 * v2.2.0 (2025-01-10):
 * - FOCUSED FIX: Language switching reliability
 * - Robust message type normalization (type || event)
 * - Enhanced GET_LANG handler with currentLang sync
 * - iframe ID changed to 'unbreak-configurator-iframe'
 * - Immediate language change logging on switch events
 * 
 * v2.1.0 (2025-01-10):
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
  const CONFIGURATOR_IFRAME_ID = 'unbreak-configurator-iframe';
  const CONFIGURATOR_ORIGIN = window.ENV?.NEXT_PUBLIC_CONFIGURATOR_DOMAIN || 
                               'https://unbreak-3-d-konfigurator.vercel.app';
  
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
    const payload = message.toJSON();
    
    // DETAILED MSG_OUT LOG
    console.info('[PARENT][MSG_OUT]', {
      event: payload.event,
      type: payload.type,
      payload: payload.payload,
      correlationId: payload.correlationId,
      targetOrigin
    });
    
    iframe.contentWindow.postMessage(payload, targetOrigin);
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
   * KOMPATIBILITÄT: Sendet BEIDE Felder (type + event) für maximale Kompatibilität
   */
  function sendLanguageToIframe(lang, retryCount = 0) {
    console.info('[PARENT][LANG] Sending language to iframe:', lang, retryCount > 0 ? `(retry ${retryCount}/${MAX_RETRIES})` : '');
    
    const message = new BridgeMessage(EventTypes.SET_LANG, { lang });
    const validation = message.validate();

    if (!validation.valid) {
      console.error('[PARENT][LANG] Invalid message:', validation.errors);
      return;
    }

    // Send to iframe
    if (!iframe || !iframe.contentWindow) {
      console.warn('[PARENT][LANG] iframe not ready, cannot send');
      return;
    }

    // KRITISCH: Sende BEIDE Felder für Kompatibilität
    const messageData = message.toJSON();
    messageData.type = messageData.event; // Duplicate event → type
    
    console.info('[PARENT][LANG] Message structure:', {
      event: messageData.event,
      type: messageData.type,
      lang: messageData.payload.lang,
      correlationId: messageData.correlationId
    });

    iframe.contentWindow.postMessage(messageData, CONFIGURATOR_ORIGIN);
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
   * PRIORITÄT: Spezifische Konvertierungen VOR generischen
   */
  function convertLegacyMessage(data) {
    // PRIO 1: Legacy format mit reason (SEHR SPEZIFISCH)
    // {type: 'configChanged', config: {...}, reason: 'add_to_cart'}
    if (data.type === 'configChanged' && data.reason === 'add_to_cart') {
      const config = data.config || {};
      console.log('[PARENT][BRIDGE] 🔄 Legacy ADD_TO_CART detected:', data.reason);
      return {
        event: 'UNBREAK_ADD_TO_CART',
        schemaVersion: '1.0',
        correlationId: 'legacy_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
        timestamp: new Date().toISOString(),
        payload: {
          variant: config.product_type || config.variant || 'glass_holder',
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

    // PRIO 2: configChanged OHNE reason → CONFIG_CHANGED (nicht ADD_TO_CART!)
    if (data.type === 'configChanged' && !data.reason) {
      const config = data.config || {};
      console.log('[PARENT][BRIDGE] 🔄 Legacy CONFIG_CHANGED detected');
      return {
        event: 'UNBREAK_CONFIG_CHANGED',
        schemaVersion: '1.0',
        correlationId: 'legacy_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
        timestamp: new Date().toISOString(),
        payload: config
      };
    }

    // PRIO 3: GENERIC - Any message with 'type' instead of 'event'
    if (data.type && !data.event) {
      // Map common type names to event names
      const typeToEventMap = {
        'UNBREAK_CONFIG_READY': 'UNBREAK_IFRAME_READY',
        'UNBREAK_SET_LANG': 'UNBREAK_SET_LANG',
        'UNBREAK_LANG_ACK': 'UNBREAK_LANG_ACK',
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

      console.log('[PARENT][BRIDGE] 🔄 Generic legacy conversion:', data.type, '→', eventName);
      return converted;
    }

    // Not a legacy format
    return null;
  }

  /**
   * Handle incoming messages from iframe
   * 
   * KOMPATIBILITÄT: Akzeptiert BEIDE Felder (type + event)
   * ROBUSTNESS: Normalisiert type||event VOR der Verarbeitung
   * IMPORTANT: Does NOT return true to avoid Chrome Extension conflicts
   */
  function handleMessage(event) {
    debug.logMessageReceived(event);
    
    // ROBUST: Normalize message type IMMEDIATELY
    const msgType = event.data?.type || event.data?.event;
    const d = event.data;
    
    // DETAILED MSG_IN LOG (compact format)
    console.info('[PARENT][MSG_IN]', {
      origin: event.origin,
      type: msgType,
      d: d
    });
    
    console.info('[PARENT][MSG_IN] Raw message received:', {
      origin: event.origin,
      normalizedType: msgType,
      hasType: !!event.data?.type,
      hasEvent: !!event.data?.event,
      type: event.data?.type,
      event: event.data?.event,
      reason: event.data?.reason,
      payload: event.data?.payload,
      config: event.data?.config ? 'present' : 'missing'
    });

    // Security: Check origin
    if (!isOriginAllowed(event.origin)) {
      debug.logDrop('origin_not_allowed', { 
        origin: event.origin,
        expected: CONFIGURATOR_ORIGIN 
      });
      return false;
    }

    // Verify message source
    const isFromIframe = iframe && event.source === iframe.contentWindow;
    const isFromSameOrigin = event.origin === window.location.origin;
    
    if (!isFromIframe && !isFromSameOrigin) {
      debug.logDrop('source_mismatch', { 
        isFromIframe,
        isFromSameOrigin
      });
      return false;
    }

    // KRITISCH: Try legacy conversion FIRST (before normalization)
    let messageData = event.data;
    const legacyConverted = convertLegacyMessage(messageData);
    if (legacyConverted) {
      console.log('[PARENT][BRIDGE] ✅ Converted legacy message:', messageData.type, '→', legacyConverted.event);
      messageData = legacyConverted;
    } else {
      // KOMPATIBILITÄT: Normalisiere type/event nur wenn KEINE Legacy-Konvertierung
      if (messageData && !messageData.event && messageData.type) {
        console.info('[PARENT][MSG_IN] Converting type→event:', messageData.type);
        messageData = { ...messageData, event: messageData.type };
      }
      if (messageData && !messageData.type && messageData.event) {
        console.info('[PARENT][MSG_IN] Converting event→type:', messageData.event);
        messageData = { ...messageData, type: messageData.event };
      }
    }

    // Parse message
    let message;
    try {
      message = BridgeMessage.fromJSON(messageData);
    } catch (error) {
      console.error('[PARENT][BRIDGE] ❌ Parse failed:', error.message, 'Data:', messageData);
      debug.logDrop('message_parse_failed', { 
        error: error.message,
        rawData: messageData 
      });
      return false;
    }

    // Validate message
    const validation = message.validate();
    debug.logValidation(message, validation);

    if (!validation.valid) {
      console.warn('[PARENT][BRIDGE] ⚠️ Validation failed:', {
        event: message.event,
        errors: validation.errors,
        payload: message.payload
      });
      
      debug.logDrop('message_validation_failed', { 
        event: message.event,
        errors: validation.errors
      });
      return false;
    }

    console.info('[PARENT][BRIDGE] ✅ Message validated, routing to handler:', message.event);

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
    
    // CRITICAL: Send language IMMEDIATELY after handshake
    const lang = getCurrentLanguage();
    currentLang = lang; // Update cache
    console.info('[PARENT][READY_ACK] 🌐 Sending language after handshake:', lang);
    sendLanguageToIframe(lang);
  }

  /**
   * Handler: Get Language
   * iframe requests current language - respond with SET_LANG
   */
  function handleGetLang(message) {
    // SYNC: Ensure currentLang is up-to-date from i18n
    const freshLang = getCurrentLanguage();
    if (freshLang !== currentLang) {
      console.warn('[PARENT][GET_LANG] currentLang was stale! Updating:', currentLang, '→', freshLang);
      currentLang = freshLang;
    }
    
    console.info('[PARENT][GET_LANG] 🌐 iframe requests language, responding with:', currentLang, {
      fromCache: currentLang,
      fromI18n: freshLang,
      correlationId: message.correlationId
    });
    // Respond with current language using new protocol
    sendLanguageToIframe(currentLang);
  }

  /**
   * Handler: Language ACK
   * iframe confirms language change
   * KOMPATIBILITÄT: Akzeptiert LANG_ACK, SET_LOCALE_ACK, SET_LOCALE
   * Prüft lang ODER locale im payload
   */
  function handleLangAck(message) {
    const lang = message.payload?.lang || message.payload?.locale;
    const replyTo = message.replyTo;

    console.info('[PARENT][LANG][ACK] ✅ ACK received from iframe:', {
      eventField: message.event,
      typeField: message.type,
      checkingField: message.event ? 'event' : 'type',
      lang,
      correlationId: message.correlationId,
      replyTo
    });
    
    // Update debug tracking
    if (window.UnbreakBridgeDebug) {
      window.UnbreakBridgeDebug.lastAckReceived = {
        event: message.event,
        type: message.type,
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
      console.log(`[PARENT][LANG][ACK] ✅ Confirmed in ${latency}ms (after ${pending.retries} retries)`);
      console.log(`[PARENT][LANG][ACK] ✅ Language synchronized: ${lang}`);
    } else {
      // ACK without pending request
      console.log('[PARENT][LANG][ACK] Received ACK (no pending request, might be unsolicited update)');
    }

    // Update current language
    if (lang && lang !== currentLang) {
      currentLang = lang;
      console.log('[PARENT][LANG] Language updated:', currentLang);
    }
  }
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
   * Adds configured product to shopping cart
   */
  async function handleAddToCart(message) {
    const config = message.payload;

    console.log('[PARENT][CART] *** ADD_TO_CART received ***');
    console.table({
      'SKU': config.variant === 'bottle_holder' ? 'UNBREAK-WEIN-01' : 'UNBREAK-GLAS-01',
      'Variant': config.variant,
      'Base Color': config.colors?.base,
      'Arm Color': config.colors?.arm,
      'Module Color': config.colors?.module,
      'Pattern Color': config.colors?.pattern,
      'Finish': config.finish,
      'Quantity': config.quantity,
      'Language': config.locale || config.lang || 'de',
      'Price': config.pricing?.totalPrice || 4900
    });

    debug.logCheckoutTrigger(config);

    if (!config || !config.variant) {
      console.error('[PARENT][CART] ❌ Invalid config - missing variant');
      debug.logDrop('add_to_cart_invalid_config', { config });
      return;
    }

    try {
      console.log('[CONFIG_ADD_TO_CART_START]', { variant: config.variant, timestamp: Date.now() });
      
      // Import cart module
      const { getCart } = await import('/lib/cart.js');
      const cart = getCart();

      // Prepare cart item from configurator config
      const cartItem = {
        product_id: 'glass_configurator', // Special ID for configurator items
        sku: config.variant === 'bottle_holder' ? 'UNBREAK-WEIN-CONFIG' : 'UNBREAK-GLAS-CONFIG',
        name: config.variant === 'bottle_holder' ? 'Flaschenhalter (konfiguriert)' : 'Glashalter (konfiguriert)',
        title_de: config.variant === 'bottle_holder' ? 'Flaschenhalter (konfiguriert)' : 'Glashalter (konfiguriert)',
        price: 0, // Will be calculated from config
        configured: true,
        config: config, // Full configuration
        image_url: config.preview_image || null,
      };

      // Add to cart (synchronous)
      const success = cart.addItem(cartItem);

      if (!success) {
        console.error('[CONFIG_ADD_TO_CART_ERROR]', 'addItem returned false', { cartItem });
        alert('Fehler beim Hinzufügen zum Warenkorb. Bitte versuchen Sie es erneut.');
        return;
      }

      // Get current cart state
      const currentCart = cart.getItems();
      console.log('[CONFIG_ADD_TO_CART_SUCCESS]', { 
        cart_count: currentCart.length,
        items: currentCart.map(i => ({ sku: i.sku, qty: i.quantity })),
        timestamp: Date.now()
      });

      // CRITICAL: Force localStorage write completion before redirect
      // LocalStorage is synchronous, but we add safety delay
      await new Promise(resolve => setTimeout(resolve, 200));

      // Verify cart was saved
      const verifyCart = cart.getItems();
      if (verifyCart.length === 0) {
        console.error('[CONFIG_ADD_TO_CART_ERROR]', 'Cart empty after save!');
        alert('Fehler: Warenkorb konnte nicht gespeichert werden.');
        return;
      }

      console.log('[CONFIG_ADD_TO_CART_REDIRECT]', '/cart');
      
      // Redirect to cart page
      window.location.href = '/cart';

    } catch (error) {
      console.error('[CONFIG_ADD_TO_CART_ERROR]', error.message, error.stack);
      console.error('[PARENT][CHECKOUT] ❌ Stack:', error.stack);
      debug.logApiResponse('/api/checkout/create', null, error);
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
    // 1) SOFORT-DEBUG: Init logging
    console.info('[LANG][PARENT] init binding', {
      url: location.href,
      ready: document.readyState
    });
    
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
    
    // 1) GLOBALER CLICK-TRACER (capture phase, temporary debug)
    document.addEventListener('click', (e) => {
      const el = e.target.closest?.('[data-lang],[data-language],#langSwitch,.lang-switch,button,a');
      if (el && /DE|EN/i.test(el.innerText || '')) {
        console.info('[LANG][PARENT][CLICK]', {
          text: el.innerText.trim(),
          id: el.id,
          cls: el.className
        });
      }
    }, true);
    
    // 2) ROBUST EVENT DELEGATION für Language Switch
    document.addEventListener('click', (e) => {
      const btn = e.target.closest?.('[data-lang="de"],[data-lang="en"],#langSwitch .de,#langSwitch .en,.lang-switch button');
      if (!btn) return;
      
      const lang = btn.dataset.lang || (btn.innerText.trim().toLowerCase().includes('en') ? 'en' : 'de');
      console.info('[LANG][PARENT] switch ->', lang);
      console.info('[PARENT][LANG_SWITCH_CLICKED]', lang); // Explicit click confirmation
      
      // Update via i18n if available
      if (window.i18n?.setLanguage) {
        window.i18n.setLanguage(lang);
      }
      
      // Update currentLang
      currentLang = lang;
      
      // DIRECT send to iframe
      const targetIframe = document.getElementById(CONFIGURATOR_IFRAME_ID) || document.querySelector('iframe');
      if (targetIframe?.contentWindow) {
        const message = {
          type: 'UNBREAK_SET_LANG',
          event: 'UNBREAK_SET_LANG', // Both fields for compatibility
          lang: lang,
          correlationId: Date.now() + '',
          timestamp: new Date().toISOString(),
          payload: { lang }
        };
        
        targetIframe.contentWindow.postMessage(message, CONFIGURATOR_ORIGIN);
        console.info('[LANG][PARENT][MSG_OUT] UNBREAK_SET_LANG', lang);
      }
    }, true);
    
    // 1) OVERLAY DIAGNOSE (delayed until DOM is fully rendered)
    setTimeout(() => {
      const langButtons = document.querySelectorAll('[data-lang="de"],[data-lang="en"],.lang-switch button');
      console.info('[OVERLAY_CHECK] Found', langButtons.length, 'language buttons');
      
      langButtons.forEach((btn, idx) => {
        const rect = btn.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        
        const elementAtPoint = document.elementFromPoint(centerX, centerY);
        const isSameOrChild = elementAtPoint === btn || btn.contains(elementAtPoint);
        
        console.info(`[OVERLAY_CHECK] Button ${idx} (${btn.textContent?.trim()}):`, {
          rect: { left: rect.left, top: rect.top, width: rect.width, height: rect.height },
          center: { x: centerX, y: centerY },
          isSameOrChild,
          elementAtPoint: elementAtPoint?.tagName + (elementAtPoint?.className ? '.' + elementAtPoint.className : ''),
          topElement: !isSameOrChild ? {
            tag: elementAtPoint?.tagName,
            class: elementAtPoint?.className,
            id: elementAtPoint?.id,
            zIndex: elementAtPoint ? window.getComputedStyle(elementAtPoint).zIndex : null,
            pointerEvents: elementAtPoint ? window.getComputedStyle(elementAtPoint).pointerEvents : null,
            position: elementAtPoint ? window.getComputedStyle(elementAtPoint).position : null
          } : null
        });
        
        // If overlay detected, try to fix it
        if (!isSameOrChild && elementAtPoint) {
          console.warn('[OVERLAY_CHECK] ⚠️ Button is covered by:', elementAtPoint);
          
          // Try to fix: set pointer-events: none on covering element
          const pointerEvents = window.getComputedStyle(elementAtPoint).pointerEvents;
          if (pointerEvents !== 'none') {
            console.info('[OVERLAY_CHECK] Attempting to fix: setting pointer-events: none on covering element');
            elementAtPoint.style.pointerEvents = 'none';
          }
        }
      });
    }, 500); // Wait 500ms for DOM to be fully rendered

    // Register message listener ONCE (prevent spam)
    if (!messageListener) {
      messageListener = handleMessage;
      window.addEventListener('message', messageListener);
      debug.log('INIT', { listenerRegistered: true });
    }

    // Listen for language changes from i18n system
    document.addEventListener('languageChanged', function(e) {
      const newLang = e.detail?.language || e.detail?.lang || getCurrentLanguage();
      const oldLang = currentLang;
      currentLang = newLang;
      
      console.info('[PARENT][LANG_SWITCH] 🌍 Language switched:', {
        from: oldLang,
        to: newLang,
        eventDetail: e.detail,
        timestamp: new Date().toISOString()
      });
      
      sendLanguageToIframe(newLang);
      
      // Wait 1s for ACK, warn if not received
      const ackCheckTimeout = setTimeout(() => {
        const hasRecentAck = window.UnbreakBridgeDebug?.lastAckReceived?.lang === newLang;
        if (!hasRecentAck) {
          console.warn('[PARENT][LANG_SWITCH] ⚠️ No ACK received within 1s for language:', newLang);
        } else {
          console.info('[PARENT][LANG_SWITCH] ✅ ACK confirmed for language:', newLang);
        }
      }, 1000);
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
