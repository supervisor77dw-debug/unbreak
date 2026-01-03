/**
 * Configurator Bridge - Host App Integration
 * 
 * Manages iframe-based 3D configurator integration:
 * - Mounts configurator iframe
 * - Receives postMessage events from configurator
 * - Validates origin and message format
 * - Stores current design payload
 * - Provides API for requesting snapshots/previews
 * 
 * Security: Strict origin validation with allowlist
 */

// Message namespace from configurator
const MESSAGE_NAMESPACE = 'UNBREAK-ONE_CONFIG';

// Message types
const MESSAGE_TYPES = {
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

/**
 * ConfiguratorBridge class
 * Single instance per configurator iframe
 */
export class ConfiguratorBridge {
  constructor(options = {}) {
    this.iframeUrl = options.iframeUrl || null;
    this.containerId = options.containerId || 'configurator-container';
    this.allowedOrigins = options.allowedOrigins || [];
    this.onReady = options.onReady || null;
    this.onDesignChanged = options.onDesignChanged || null;
    this.onDesignSnapshot = options.onDesignSnapshot || null;
    this.onError = options.onError || null;
    this.debug = options.debug || false;
    
    this.iframe = null;
    this.isReady = false;
    this.lastPayload = null;
    this.configuratorInfo = null;
    this.messageLog = [];
    
    // Bind methods
    this.handleMessage = this.handleMessage.bind(this);
  }
  
  /**
   * Mount iframe and initialize bridge
   */
  mount() {
    if (!this.iframeUrl) {
      throw new Error('ConfiguratorBridge: iframeUrl is required');
    }
    
    const container = document.getElementById(this.containerId);
    if (!container) {
      throw new Error(`ConfiguratorBridge: Container #${this.containerId} not found`);
    }
    
    // Create iframe
    this.iframe = document.createElement('iframe');
    this.iframe.id = 'configurator-iframe';
    this.iframe.src = this.iframeUrl;
    this.iframe.style.width = '100%';
    this.iframe.style.height = '100%';
    this.iframe.style.border = 'none';
    this.iframe.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture';
    
    container.appendChild(this.iframe);
    
    // Add message listener
    window.addEventListener('message', this.handleMessage);
    
    this.log('Bridge mounted, waiting for CONFIG_READY...');
  }
  
  /**
   * Unmount iframe and cleanup
   */
  unmount() {
    if (this.iframe) {
      this.iframe.remove();
      this.iframe = null;
    }
    
    window.removeEventListener('message', this.handleMessage);
    
    this.isReady = false;
    this.lastPayload = null;
    this.configuratorInfo = null;
    
    this.log('Bridge unmounted');
  }
  
  /**
   * Handle incoming postMessage from configurator
   */
  handleMessage(event) {
    const { data, origin } = event;
    
    // Validate origin
    if (!this.isOriginAllowed(origin)) {
      this.log('⚠️ Rejected message from unauthorized origin:', origin);
      return;
    }
    
    // Validate namespace
    if (!data || data.namespace !== MESSAGE_NAMESPACE) {
      return; // Not our message
    }
    
    // Validate message structure
    if (!data.type || !data.timestamp) {
      this.log('⚠️ Invalid message structure:', data);
      return;
    }
    
    this.logMessage('received', data.type, data.payload);
    this.log('📩 Received:', data.type, data);
    
    // Dispatch by type
    switch (data.type) {
      case MESSAGE_TYPES.CONFIG_READY:
        this.handleConfigReady(data.payload);
        break;
        
      case MESSAGE_TYPES.DESIGN_CHANGED:
        this.handleDesignChanged(data.payload);
        break;
        
      case MESSAGE_TYPES.DESIGN_SNAPSHOT:
        this.handleDesignSnapshot(data.payload);
        break;
        
      case MESSAGE_TYPES.CURRENT_PAYLOAD:
        this.handleCurrentPayload(data.payload);
        break;
        
      case MESSAGE_TYPES.PREVIEWS_GENERATED:
        this.handlePreviewsGenerated(data.payload);
        break;
        
      case MESSAGE_TYPES.ERROR:
        this.handleError(data.payload);
        break;
        
      default:
        this.log('⚠️ Unknown message type:', data.type);
    }
  }
  
  /**
   * Handle CONFIG_READY event
   */
  handleConfigReady(payload) {
    this.isReady = true;
    this.configuratorInfo = payload;
    
    this.log('✅ Configurator ready:', payload);
    
    if (this.onReady) {
      this.onReady(payload);
    }
  }
  
  /**
   * Handle DESIGN_CHANGED event (debounced updates)
   */
  handleDesignChanged(payload) {
    this.lastPayload = payload;
    
    this.log('🔄 Design changed:', {
      designId: payload.designId,
      baseComponents: payload.baseComponents?.length,
      addons: payload.premiumAddons?.length,
      customization: payload.customization?.enabled
    });
    
    if (this.onDesignChanged) {
      this.onDesignChanged(payload);
    }
  }
  
  /**
   * Handle DESIGN_SNAPSHOT event (explicit save)
   */
  handleDesignSnapshot(payload) {
    this.lastPayload = payload;
    
    this.log('📸 Design snapshot:', {
      designId: payload.designId,
      timestamp: payload.updatedAt
    });
    
    if (this.onDesignSnapshot) {
      this.onDesignSnapshot(payload);
    }
  }
  
  /**
   * Handle CURRENT_PAYLOAD response
   */
  handleCurrentPayload(payload) {
    this.lastPayload = payload;
    
    this.log('📦 Current payload received:', {
      designId: payload.designId
    });
  }
  
  /**
   * Handle PREVIEWS_GENERATED event
   */
  handlePreviewsGenerated(payload) {
    this.log('🖼️ Previews generated:', payload);
    
    // Update last payload if it exists
    if (this.lastPayload && this.lastPayload.previews) {
      this.lastPayload.previews = {
        ...this.lastPayload.previews,
        ...payload
      };
    }
  }
  
  /**
   * Handle ERROR event
   */
  handleError(payload) {
    this.log('❌ Configurator error:', payload);
    
    if (this.onError) {
      this.onError(payload);
    }
  }
  
  /**
   * Send message to configurator
   */
  sendMessage(type, payload = null) {
    if (!this.iframe || !this.iframe.contentWindow) {
      this.log('⚠️ Cannot send message: iframe not ready');
      return;
    }
    
    const message = {
      namespace: MESSAGE_NAMESPACE,
      type,
      payload,
      timestamp: new Date().toISOString()
    };
    
    // Send to all allowed origins
    this.allowedOrigins.forEach(origin => {
      this.iframe.contentWindow.postMessage(message, origin);
    });
    
    this.logMessage('sent', type, payload);
    this.log('📤 Sent:', type, message);
  }
  
  /**
   * Request current payload from configurator
   * @returns {Promise<Object>} Resolves when CURRENT_PAYLOAD received
   */
  requestCurrentPayload() {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Timeout waiting for CURRENT_PAYLOAD'));
      }, 5000);
      
      // Set up one-time listener
      const originalHandler = this.handleCurrentPayload.bind(this);
      this.handleCurrentPayload = (payload) => {
        clearTimeout(timeout);
        this.handleCurrentPayload = originalHandler;
        originalHandler(payload);
        resolve(payload);
      };
      
      // Send request
      this.sendMessage(MESSAGE_TYPES.GET_CURRENT_PAYLOAD);
    });
  }
  
  /**
   * Request preview generation
   */
  requestPreviews() {
    this.sendMessage(MESSAGE_TYPES.GENERATE_PREVIEWS);
  }
  
  /**
   * Request reset to default
   */
  requestReset() {
    this.sendMessage(MESSAGE_TYPES.RESET_TO_DEFAULT);
  }
  
  /**
   * Update variant
   */
  updateVariant(variantKey) {
    this.sendMessage(MESSAGE_TYPES.UPDATE_VARIANT, { variantKey });
  }
  
  /**
   * Close configurator
   */
  close() {
    this.sendMessage(MESSAGE_TYPES.CLOSE_CONFIGURATOR);
  }
  
  /**
   * Get current payload (from cache)
   * @returns {Object|null}
   */
  getCurrentPayload() {
    return this.lastPayload;
  }
  
  /**
   * Get configurator info
   * @returns {Object|null}
   */
  getConfiguratorInfo() {
    return this.configuratorInfo;
  }
  
  /**
   * Check if origin is allowed
   */
  isOriginAllowed(origin) {
    if (this.allowedOrigins.includes('*')) return true;
    return this.allowedOrigins.includes(origin);
  }
  
  /**
   * Log message
   */
  log(...args) {
    if (this.debug) {
      console.log('[ConfiguratorBridge]', ...args);
    }
  }
  
  /**
   * Log message event
   */
  logMessage(direction, type, payload) {
    const entry = {
      timestamp: new Date().toISOString(),
      direction,
      type,
      payload
    };
    
    this.messageLog.unshift(entry);
    
    // Keep last 50
    if (this.messageLog.length > 50) {
      this.messageLog = this.messageLog.slice(0, 50);
    }
  }
  
  /**
   * Get message log
   */
  getMessageLog() {
    return this.messageLog;
  }
}

/**
 * Create and mount configurator bridge
 * Convenience function for common setup
 */
export function createConfiguratorBridge(options) {
  const bridge = new ConfiguratorBridge(options);
  
  // Auto-mount if DOM ready
  if (typeof window !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => bridge.mount());
    } else {
      bridge.mount();
    }
  }
  
  return bridge;
}

/**
 * Get allowed origins from environment
 */
export function getAllowedOrigins() {
  if (typeof window === 'undefined') return [];
  
  const isDevelopment = window.location.hostname === 'localhost';
  
  if (isDevelopment) {
    return [
      'http://localhost:3000',
      'http://localhost:3001',
      'http://localhost:4000'
    ];
  }
  
  return [
    'https://unbreak.one',
    'https://www.unbreak.one',
    'https://configurator.unbreak.one',
    'https://staging.unbreak.one'
  ];
}
