/**
 * UNBREAK ONE - Bridge Message Schema v1.0
 * 
 * Verbindliches Contract für iframe↔parent Kommunikation
 * 
 * @version 1.0.0
 * @since 2026-01-09
 */

(function() {
  'use strict';

  const SCHEMA_VERSION = '1.0';

  /**
   * Valid event types
   */
  const EventTypes = {
    // Parent → iframe
    PARENT_HELLO: 'UNBREAK_PARENT_HELLO',
    SET_LOCALE: 'UNBREAK_SET_LOCALE',
    SET_LANG: 'UNBREAK_SET_LANG', // NEW: Direct language command
    GET_CONFIG: 'UNBREAK_GET_CONFIG',
    
    // iframe → Parent
    IFRAME_READY: 'UNBREAK_IFRAME_READY',
    GET_LANG: 'UNBREAK_GET_LANG', // iframe requests current language
    LANG_ACK: 'UNBREAK_LANG_ACK', // NEW: Language change acknowledged
    SET_LOCALE_ACK: 'UNBREAK_SET_LOCALE_ACK', // Alternative ACK format
    ACK: 'UNBREAK_ACK',
    CONFIG_CHANGED: 'UNBREAK_CONFIG_CHANGED',
    ADD_TO_CART: 'UNBREAK_ADD_TO_CART',
    RESET_VIEW: 'UNBREAK_RESET_VIEW',
    ERROR: 'UNBREAK_ERROR',
  };

  /**
   * Message structure
   */
  class BridgeMessage {
    constructor(event, payload = {}, options = {}) {
      this.event = event;
      this.schemaVersion = SCHEMA_VERSION;
      this.correlationId = options.correlationId || this.generateCorrelationId();
      this.timestamp = new Date().toISOString();
      this.payload = payload;
      
      // Optional metadata
      if (options.replyTo) this.replyTo = options.replyTo;
      if (options.error) this.error = options.error;
    }

    generateCorrelationId() {
      return `msg_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
    }

    toJSON() {
      return {
        event: this.event,
        schemaVersion: this.schemaVersion,
        correlationId: this.correlationId,
        timestamp: this.timestamp,
        payload: this.payload,
        ...(this.replyTo && { replyTo: this.replyTo }),
        ...(this.error && { error: this.error })
      };
    }

    static fromJSON(data) {
      if (!data || typeof data !== 'object') {
        throw new Error('Invalid message data');
      }

      const msg = new BridgeMessage(data.event, data.payload, {
        correlationId: data.correlationId
      });

      msg.schemaVersion = data.schemaVersion || '0.0'; // Legacy support
      msg.timestamp = data.timestamp;
      if (data.replyTo) msg.replyTo = data.replyTo;
      if (data.error) msg.error = data.error;

      return msg;
    }

    validate() {
      const errors = [];

      // Check required fields
      if (!this.event) errors.push('Missing required field: event');
      if (!this.schemaVersion) errors.push('Missing required field: schemaVersion');
      if (!this.correlationId) errors.push('Missing required field: correlationId');
      if (!this.timestamp) errors.push('Missing required field: timestamp');

      // Check event type
      const validEvents = Object.values(EventTypes);
      if (!validEvents.includes(this.event)) {
        errors.push(`Invalid event type: ${this.event} (must be one of: ${validEvents.join(', ')})`);
      }

      // Check schema version
      if (this.schemaVersion !== SCHEMA_VERSION) {
        errors.push(`Schema version mismatch: expected ${SCHEMA_VERSION}, got ${this.schemaVersion}`);
      }

      return {
        valid: errors.length === 0,
        errors: errors
      };
    }
  }

  /**
   * Origin validation - Dynamic based on environment
   */
  const AllowedOrigins = {
    PRODUCTION: (function() {
      const origins = [];
      
      // Try to get domains from window.__ENV__ (injected by Next.js)
      if (typeof window !== 'undefined' && window.__ENV__) {
        if (window.__ENV__.NEXT_PUBLIC_CONFIGURATOR_DOMAIN) {
          origins.push(window.__ENV__.NEXT_PUBLIC_CONFIGURATOR_DOMAIN);
        }
        if (window.__ENV__.NEXT_PUBLIC_SITE_URL) {
          origins.push(window.__ENV__.NEXT_PUBLIC_SITE_URL);
        }
      }
      
      // Fallback to production domains if ENV not available
      if (origins.length === 0) {
        origins.push('https://unbreak-one.com');
      }
      
      return origins;
    })(),
    
    DEVELOPMENT: [
      'http://localhost:3000',
      'http://localhost:5173',
      'http://127.0.0.1:3000',
    ],
    
    // Vercel preview deployments
    VERCEL_PREVIEW_PATTERN: /^https:\/\/unbreak-[a-z0-9-]+\.vercel\.app$/,
  };

  /**
   * Check if origin is allowed
   */
  function isOriginAllowed(origin) {
    // Exact match
    const allAllowed = [
      ...AllowedOrigins.PRODUCTION,
      ...AllowedOrigins.DEVELOPMENT
    ];

    if (allAllowed.includes(origin)) {
      return true;
    }

    // Pattern match for Vercel previews
    if (AllowedOrigins.VERCEL_PREVIEW_PATTERN.test(origin)) {
      return true;
    }

    return false;
  }

  /**
   * Payload schemas for each event type
   */
  const PayloadSchemas = {
    [EventTypes.PARENT_HELLO]: {
      locale: 'string',
      parentVersion: 'string',
      supportedSchemaVersion: 'string',
    },

    [EventTypes.IFRAME_READY]: {
      iframeVersion: 'string',
      supportedSchemaVersion: 'string',
      supportedLocales: 'array',
    },

    [EventTypes.ACK]: {
      acknowledges: 'string', // correlationId of message being acknowledged
      status: 'string', // 'success' | 'error'
      message: 'string?',
    },

    [EventTypes.SET_LOCALE]: {
      locale: 'string', // 'de' | 'en'
    },

    [EventTypes.SET_LANG]: {
      lang: 'string', // 'de' | 'en' - simplified protocol
    },

    [EventTypes.GET_LANG]: {
      // iframe requests current language - no payload required
    },

    [EventTypes.LANG_ACK]: {
      lang: 'string', // 'de' | 'en' - confirmed language
    },

    [EventTypes.CONFIG_CHANGED]: {
      variant: 'string', // 'glass_holder' | 'bottle_holder'
      colors: 'object',
      finish: 'string',
      quantity: 'number',
    },

    [EventTypes.ADD_TO_CART]: {
      variant: 'string',
      sku: 'string',
      colors: 'object',
      finish: 'string',
      quantity: 'number',
      pricing: 'object?',
      locale: 'string',
    },

    [EventTypes.ERROR]: {
      code: 'string',
      message: 'string',
      details: 'object?',
    },
  };

  // Export to global scope
  window.UnbreakBridge = {
    SCHEMA_VERSION,
    EventTypes,
    AllowedOrigins,
    BridgeMessage,
    isOriginAllowed,
    PayloadSchemas,
  };

  console.log('[BRIDGE_SCHEMA] v' + SCHEMA_VERSION + ' loaded');

})();
