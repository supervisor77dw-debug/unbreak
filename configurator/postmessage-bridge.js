/**
 * PostMessage Bridge for Configurator ↔ Host Shop
 * 
 * Handles all cross-origin communication between:
 * - Configurator (iFrame child)
 * - Host Shop (parent window)
 * 
 * Message Format:
 * {
 *   namespace: "UNBREAK-ONE_CONFIG",
 *   type: "CONFIG_READY" | "DESIGN_CHANGED" | ...,
 *   payload: any,
 *   timestamp: ISO 8601
 * }
 */

import { validatePayloadV1 } from './design-payload-v1-types.js';

// Message namespace for all configurator communication
export const MESSAGE_NAMESPACE = 'UNBREAK-ONE_CONFIG';

// Configurator version
const CONFIGURATOR_VERSION = '1.0.0';

// Message types
export const MESSAGE_TYPES = {
  // Configurator → Host
  CONFIG_READY: 'CONFIG_READY',
  DESIGN_CHANGED: 'DESIGN_CHANGED',
  DESIGN_SNAPSHOT: 'DESIGN_SNAPSHOT',
  CURRENT_PAYLOAD: 'CURRENT_PAYLOAD',
  PREVIEWS_GENERATED: 'PREVIEWS_GENERATED',
  ERROR: 'ERROR',
  
  // Host → Configurator
  GET_CURRENT_PAYLOAD: 'GET_CURRENT_PAYLOAD',
  GENERATE_PREVIEWS: 'GENERATE_PREVIEWS',
  RESET_TO_DEFAULT: 'RESET_TO_DEFAULT',
  UPDATE_VARIANT: 'UPDATE_VARIANT',
  CLOSE_CONFIGURATOR: 'CLOSE_CONFIGURATOR'
};

// Debounce timer for DESIGN_CHANGED events
let designChangedDebounceTimer = null;
const DESIGN_CHANGED_DEBOUNCE_MS = 200; // 200ms debounce

// Origin allowlist (from env or config)
let allowedOrigins = [];

/**
 * Initialize the bridge with allowed origins
 * @param {string[]} origins - Array of allowed origin URLs
 */
export function initBridge(origins = []) {
  allowedOrigins = origins.length > 0 ? origins : ['*'];
  
  // Add listener for messages from host
  if (typeof window !== 'undefined') {
    window.addEventListener('message', handleIncomingMessage);
  }
  
  console.log('[PostMessageBridge] Initialized with origins:', allowedOrigins);
}

/**
 * Cleanup bridge (remove listener)
 */
export function destroyBridge() {
  if (typeof window !== 'undefined') {
    window.removeEventListener('message', handleIncomingMessage);
  }
  if (designChangedDebounceTimer) {
    clearTimeout(designChangedDebounceTimer);
  }
}

/**
 * Create message envelope
 * @param {string} type - Message type
 * @param {any} payload - Message payload
 * @returns {Object} Message envelope
 */
function createMessage(type, payload) {
  return {
    namespace: MESSAGE_NAMESPACE,
    type,
    payload,
    timestamp: new Date().toISOString()
  };
}

/**
 * Send message to parent (host shop)
 * @param {Object} message - Message envelope
 */
function sendToHost(message) {
  if (typeof window === 'undefined' || !window.parent) {
    console.warn('[PostMessageBridge] Cannot send: no parent window');
    return;
  }
  
  // Send to all allowed origins
  if (allowedOrigins.includes('*')) {
    window.parent.postMessage(message, '*');
  } else {
    allowedOrigins.forEach(origin => {
      window.parent.postMessage(message, origin);
    });
  }
  
  console.log('[PostMessageBridge] Sent:', message.type, message);
}

/**
 * Validate incoming message origin
 * @param {string} origin - Message origin
 * @returns {boolean}
 */
function isOriginAllowed(origin) {
  if (allowedOrigins.includes('*')) return true;
  return allowedOrigins.includes(origin);
}

/**
 * Handle incoming message from host
 * @param {MessageEvent} event
 */
function handleIncomingMessage(event) {
  const { data, origin } = event;
  
  // Validate origin
  if (!isOriginAllowed(origin)) {
    console.warn('[PostMessageBridge] Rejected message from unauthorized origin:', origin);
    return;
  }
  
  // Validate namespace
  if (!data || data.namespace !== MESSAGE_NAMESPACE) {
    return; // Not our message
  }
  
  console.log('[PostMessageBridge] Received:', data.type, data);
  
  // Dispatch to handler
  try {
    handleHostMessage(data);
  } catch (error) {
    console.error('[PostMessageBridge] Error handling message:', error);
    postError(error.message);
  }
}

/**
 * Handle message from host
 * Override this in your configurator implementation
 * @param {Object} message - Message envelope
 */
export function handleHostMessage(message) {
  const { type, payload } = message;
  
  switch (type) {
    case MESSAGE_TYPES.GET_CURRENT_PAYLOAD:
      console.log('[PostMessageBridge] Host requested current payload');
      // Trigger getCurrentPayload callback
      if (window.configuratorBridge?.onGetCurrentPayload) {
        window.configuratorBridge.onGetCurrentPayload();
      }
      break;
      
    case MESSAGE_TYPES.GENERATE_PREVIEWS:
      console.log('[PostMessageBridge] Host requested preview generation');
      // Trigger generatePreviews callback
      if (window.configuratorBridge?.onGeneratePreviews) {
        window.configuratorBridge.onGeneratePreviews();
      }
      break;
      
    case MESSAGE_TYPES.RESET_TO_DEFAULT:
      console.log('[PostMessageBridge] Host requested reset to default');
      // Trigger reset callback
      if (window.configuratorBridge?.onResetToDefault) {
        window.configuratorBridge.onResetToDefault();
      }
      break;
      
    case MESSAGE_TYPES.UPDATE_VARIANT:
      console.log('[PostMessageBridge] Host requested variant update:', payload);
      // Trigger variant update callback
      if (window.configuratorBridge?.onUpdateVariant) {
        window.configuratorBridge.onUpdateVariant(payload);
      }
      break;
      
    case MESSAGE_TYPES.CLOSE_CONFIGURATOR:
      console.log('[PostMessageBridge] Host requested close');
      // Trigger close callback
      if (window.configuratorBridge?.onClose) {
        window.configuratorBridge.onClose();
      }
      break;
      
    default:
      console.warn('[PostMessageBridge] Unknown message type:', type);
  }
}

/**
 * Post CONFIG_READY event to host
 * @param {string} productFamily
 * @param {string[]} capabilities - List of supported features
 */
export function postConfigReady(productFamily, capabilities = []) {
  const payload = {
    configuratorVersion: CONFIGURATOR_VERSION,
    productFamily,
    capabilities: [
      'design-state-export',
      'preview-generation',
      'sku-based-pricing',
      'premium-addons',
      'customization-fees',
      ...capabilities
    ],
    ready: true
  };
  
  const message = createMessage(MESSAGE_TYPES.CONFIG_READY, payload);
  sendToHost(message);
}

/**
 * Post DESIGN_CHANGED event to host (debounced)
 * @param {Object} designPayload - DesignPayloadV1 object
 */
export function postDesignChanged(designPayload) {
  // Clear existing timer
  if (designChangedDebounceTimer) {
    clearTimeout(designChangedDebounceTimer);
  }
  
  // Debounce to avoid flooding host with updates
  designChangedDebounceTimer = setTimeout(() => {
    // Validate payload before sending
    const validation = validatePayloadV1(designPayload);
    if (!validation.valid) {
      console.error('[PostMessageBridge] Invalid design payload:', validation.errors);
      postError('Invalid design payload: ' + validation.errors.join(', '));
      return;
    }
    
    const message = createMessage(MESSAGE_TYPES.DESIGN_CHANGED, designPayload);
    sendToHost(message);
  }, DESIGN_CHANGED_DEBOUNCE_MS);
}

/**
 * Post DESIGN_SNAPSHOT event to host (immediate, not debounced)
 * Use for explicit user actions like "Save Design" button
 * @param {Object} designPayload - DesignPayloadV1 object
 */
export function postDesignSnapshot(designPayload) {
  // Validate payload before sending
  const validation = validatePayloadV1(designPayload);
  if (!validation.valid) {
    console.error('[PostMessageBridge] Invalid design payload:', validation.errors);
    postError('Invalid design payload: ' + validation.errors.join(', '));
    return;
  }
  
  const message = createMessage(MESSAGE_TYPES.DESIGN_SNAPSHOT, designPayload);
  sendToHost(message);
}

/**
 * Post CURRENT_PAYLOAD response to host
 * (Response to GET_CURRENT_PAYLOAD request)
 * @param {Object} designPayload - DesignPayloadV1 object
 */
export function postCurrentPayload(designPayload) {
  // Validate payload before sending
  const validation = validatePayloadV1(designPayload);
  if (!validation.valid) {
    console.error('[PostMessageBridge] Invalid design payload:', validation.errors);
    postError('Invalid design payload: ' + validation.errors.join(', '));
    return;
  }
  
  const message = createMessage(MESSAGE_TYPES.CURRENT_PAYLOAD, designPayload);
  sendToHost(message);
}

/**
 * Post PREVIEWS_GENERATED event to host
 * @param {Object} previews - { heroUrl, thumbUrl }
 */
export function postPreviewsGenerated(previews) {
  const message = createMessage(MESSAGE_TYPES.PREVIEWS_GENERATED, previews);
  sendToHost(message);
}

/**
 * Post ERROR event to host
 * @param {string} errorMessage
 * @param {Object} [details] - Optional error details
 */
export function postError(errorMessage, details = null) {
  const payload = {
    error: errorMessage,
    details,
    timestamp: new Date().toISOString()
  };
  
  const message = createMessage(MESSAGE_TYPES.ERROR, payload);
  sendToHost(message);
}

/**
 * Register callbacks for host messages
 * @param {Object} callbacks
 * @param {Function} [callbacks.onGetCurrentPayload]
 * @param {Function} [callbacks.onGeneratePreviews]
 * @param {Function} [callbacks.onResetToDefault]
 * @param {Function} [callbacks.onUpdateVariant]
 * @param {Function} [callbacks.onClose]
 */
export function registerCallbacks(callbacks) {
  window.configuratorBridge = window.configuratorBridge || {};
  
  if (callbacks.onGetCurrentPayload) {
    window.configuratorBridge.onGetCurrentPayload = callbacks.onGetCurrentPayload;
  }
  if (callbacks.onGeneratePreviews) {
    window.configuratorBridge.onGeneratePreviews = callbacks.onGeneratePreviews;
  }
  if (callbacks.onResetToDefault) {
    window.configuratorBridge.onResetToDefault = callbacks.onResetToDefault;
  }
  if (callbacks.onUpdateVariant) {
    window.configuratorBridge.onUpdateVariant = callbacks.onUpdateVariant;
  }
  if (callbacks.onClose) {
    window.configuratorBridge.onClose = callbacks.onClose;
  }
  
  console.log('[PostMessageBridge] Callbacks registered');
}
