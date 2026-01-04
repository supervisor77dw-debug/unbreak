/**
 * UNBREAK Configurator Bridge
 * Secure postMessage integration between shop and 3D configurator iframe
 * 
 * Security: Strict origin filtering, validation, no silent fallbacks
 * @version 1.0.0
 */

const CONFIGURATOR_ORIGIN = 'https://unbreak-3-d-konfigurator.vercel.app';
const CONFIG_REQUEST_TIMEOUT = 300; // ms - configurator promises <100ms
const CONFIG_FRESHNESS_THRESHOLD = 5000; // ms - use cached if recent
const SESSION_STORAGE_KEY = 'unbreak:lastConfig';
const SESSION_STORAGE_MAX_AGE = 600000; // 10 minutes

// Color mapping: Configurator → Shop supported colors
const COLOR_MAP = {
  // Configurator colors
  'black': 'graphite',
  'red': 'petrol',
  'purple': 'anthracite',
  // Shop native colors (passthrough)
  'graphite': 'graphite',
  'anthracite': 'anthracite',
  'petrol': 'petrol',
  'silver': 'silver',
  'gold': 'gold',
};

const VALID_FINISHES = ['matte', 'glossy'];

/**
 * ConfiguratorBridge - Manages iframe communication
 */
class ConfiguratorBridge {
  constructor() {
    this.iframe = null;
    this.ready = false;
    this.lastConfig = null;
    this.lastReceivedAt = null;
    this.lastReason = null;
    this.messageHandler = null;
    this.configPromiseResolvers = [];
    this.traceId = this.generateTraceId();
  }

  /**
   * Initialize bridge with iframe element
   * @param {HTMLIFrameElement} iframeEl 
   * @param {Object} options 
   */
  init(iframeEl, options = {}) {
    if (this.messageHandler) {
      console.warn('[UNBREAK_PARENT] Bridge already initialized');
      return;
    }

    this.iframe = iframeEl;
    this.options = {
      debug: options.debug || false,
      onReady: options.onReady || null,
      onConfigReceived: options.onConfigReceived || null,
      onError: options.onError || null,
    };

    // Set up message listener
    this.messageHandler = this.handleMessage.bind(this);
    window.addEventListener('message', this.messageHandler);

    console.log('[UNBREAK_PARENT] Bridge initialized', {
      traceId: this.traceId,
      origin: CONFIGURATOR_ORIGIN,
      debug: this.options.debug
    });

    // Try to restore from sessionStorage
    this.restoreFromSession();
  }

  /**
   * Handle incoming postMessage
   * @param {MessageEvent} event 
   */
  handleMessage(event) {
    // SECURITY: Strict origin check
    if (event.origin !== CONFIGURATOR_ORIGIN) {
      if (this.options.debug) {
        console.log('[UNBREAK_PARENT] Blocked message from unauthorized origin:', event.origin);
      }
      return;
    }

    const { type, config, reason } = event.data;

    // Log all messages in debug mode
    if (this.options.debug) {
      console.log('[UNBREAK_PARENT] Message received:', { type, config, reason });
    }

    switch (type) {
      case 'UNBREAK_CONFIG_READY':
        this.handleReady();
        break;

      case 'configChanged':
      case 'UNBREAK_CONFIG_UPDATE':
      case 'checkout_configuration':
        this.handleConfigChanged(config, reason);
        break;

      default:
        if (this.options.debug) {
          console.log('[UNBREAK_PARENT] Unknown message type:', type);
        }
    }
  }

  /**
   * Handle READY signal from configurator
   */
  handleReady() {
    this.ready = true;
    console.log('[UNBREAK_PARENT] READY', {
      traceId: this.traceId,
      timestamp: new Date().toISOString()
    });

    if (this.options.onReady) {
      this.options.onReady();
    }
  }

  /**
   * Handle config change from configurator
   * @param {Object} config 
   * @param {string} reason 
   */
  handleConfigChanged(config, reason) {
    const timestamp = Date.now();

    // VALIDATION: Config must exist
    if (!config) {
      console.error('[UNBREAK_PARENT] CONFIG_INVALID: config is null/undefined');
      this.handleError('Config is missing');
      return;
    }

    // VALIDATION: Colors object must exist
    if (!config.colors || typeof config.colors !== 'object') {
      console.error('[UNBREAK_PARENT] CONFIG_INVALID: colors object missing', config);
      this.handleError('Colors configuration is missing');
      return;
    }

    // VALIDATION: Required color areas
    const requiredAreas = ['base', 'top', 'middle'];
    const missingAreas = requiredAreas.filter(area => !config.colors[area]);
    
    if (missingAreas.length > 0) {
      console.error('[UNBREAK_PARENT] CONFIG_INVALID: missing color areas:', missingAreas);
      this.handleError(`Missing colors for areas: ${missingAreas.join(', ')}`);
      return;
    }

    // NORMALIZE: Map and validate colors
    const normalizedColors = {};
    for (const [area, color] of Object.entries(config.colors)) {
      const lowerColor = color.toLowerCase();
      const mappedColor = COLOR_MAP[lowerColor];
      
      if (!mappedColor) {
        console.warn('[UNBREAK_PARENT] Unknown color value:', color, '- using as-is');
        normalizedColors[area] = lowerColor;
      } else {
        normalizedColors[area] = mappedColor;
      }
    }

    // NORMALIZE: Validate finish
    let finish = config.finish || 'matte';
    finish = finish.toLowerCase();
    
    if (!VALID_FINISHES.includes(finish)) {
      console.warn('[UNBREAK_PARENT] Invalid finish:', config.finish, '- defaulting to matte');
      finish = 'matte';
    }

    // Build validated config
    const validatedConfig = {
      colors: normalizedColors,
      finish: finish,
      quantity: config.quantity || 1,
      product: config.product || config.product_sku || 'glass_holder',
      product_name: config.product_name || 'UNBREAK ONE Glass Holder',
      product_sku: config.product_sku || 'UNBREAK-GLAS-01',
      preview_image_url: config.preview_image_url || null,
      engraving: config.engraving || null,
    };

    // Store config
    this.lastConfig = validatedConfig;
    this.lastReceivedAt = timestamp;
    this.lastReason = reason || 'unknown';

    console.log('[UNBREAK_PARENT] CONFIG_RECEIVED', {
      traceId: this.traceId,
      reason: this.lastReason,
      timestamp: new Date(timestamp).toISOString(),
      colors: validatedConfig.colors,
      finish: validatedConfig.finish
    });

    // Save to sessionStorage
    this.saveToSession();

    // Notify callbacks
    if (this.options.onConfigReceived) {
      this.options.onConfigReceived(validatedConfig);
    }

    // Resolve any pending promises (from requestConfig)
    while (this.configPromiseResolvers.length > 0) {
      const resolve = this.configPromiseResolvers.shift();
      resolve(validatedConfig);
    }
  }

  /**
   * Request config from configurator (pull-based)
   * @returns {Promise<Object>} Resolved config
   */
  async requestConfig() {
    // Fast path: Use recent config if fresh
    if (this.lastConfig && this.lastReceivedAt) {
      const age = Date.now() - this.lastReceivedAt;
      if (age < CONFIG_FRESHNESS_THRESHOLD) {
        console.log('[UNBREAK_PARENT] Using fresh config', { age: `${age}ms` });
        return this.lastConfig;
      }
    }

    // Check iframe availability
    if (!this.iframe || !this.iframe.contentWindow) {
      throw new Error('Configurator iframe not available');
    }

    console.log('[UNBREAK_PARENT] Requesting config from iframe...');

    // Send GET_CONFIGURATION request
    this.iframe.contentWindow.postMessage(
      { type: 'GET_CONFIGURATION' },
      CONFIGURATOR_ORIGIN
    );

    // Wait for response with timeout
    return new Promise((resolve, reject) => {
      // Add to resolver queue
      this.configPromiseResolvers.push(resolve);

      // Timeout handler
      const timeout = setTimeout(() => {
        // Remove from queue
        const index = this.configPromiseResolvers.indexOf(resolve);
        if (index > -1) {
          this.configPromiseResolvers.splice(index, 1);
        }

        // Try sessionStorage fallback
        const sessionConfig = this.getSessionConfig();
        if (sessionConfig) {
          const age = Date.now() - sessionConfig.timestamp;
          const ageMinutes = Math.floor(age / 60000);
          
          console.warn('[UNBREAK_PARENT] Timeout - using session config', {
            age: `${ageMinutes}m ${Math.floor((age % 60000) / 1000)}s`
          });
          
          this.handleError(`Using last configuration from ${ageMinutes} minute(s) ago`, true);
          resolve(sessionConfig.config);
        } else {
          reject(new Error('Config request timeout - no response from configurator'));
        }
      }, CONFIG_REQUEST_TIMEOUT);

      // Override resolve to clear timeout
      const originalResolve = this.configPromiseResolvers[this.configPromiseResolvers.length - 1];
      this.configPromiseResolvers[this.configPromiseResolvers.length - 1] = (config) => {
        clearTimeout(timeout);
        originalResolve(config);
      };
    });
  }

  /**
   * Get last received config
   * @returns {Object|null}
   */
  getLastConfig() {
    return this.lastConfig;
  }

  /**
   * Check if configurator is ready
   * @returns {boolean}
   */
  isReady() {
    return this.ready;
  }

  /**
   * Save config to sessionStorage
   */
  saveToSession() {
    if (!this.lastConfig) return;

    try {
      const data = {
        config: this.lastConfig,
        timestamp: this.lastReceivedAt,
        reason: this.lastReason
      };
      sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(data));
    } catch (e) {
      console.warn('[UNBREAK_PARENT] Failed to save to sessionStorage:', e);
    }
  }

  /**
   * Restore config from sessionStorage
   */
  restoreFromSession() {
    const sessionConfig = this.getSessionConfig();
    
    if (sessionConfig) {
      const age = Date.now() - sessionConfig.timestamp;
      console.log('[UNBREAK_PARENT] Restored from session', {
        age: `${Math.floor(age / 1000)}s`,
        reason: sessionConfig.reason
      });
      
      this.lastConfig = sessionConfig.config;
      this.lastReceivedAt = sessionConfig.timestamp;
      this.lastReason = sessionConfig.reason + ' (restored)';
    }
  }

  /**
   * Get config from sessionStorage if valid
   * @returns {Object|null}
   */
  getSessionConfig() {
    try {
      const stored = sessionStorage.getItem(SESSION_STORAGE_KEY);
      if (!stored) return null;

      const data = JSON.parse(stored);
      const age = Date.now() - data.timestamp;

      // Check max age
      if (age > SESSION_STORAGE_MAX_AGE) {
        console.log('[UNBREAK_PARENT] Session config too old, discarding');
        sessionStorage.removeItem(SESSION_STORAGE_KEY);
        return null;
      }

      return data;
    } catch (e) {
      console.warn('[UNBREAK_PARENT] Failed to restore from sessionStorage:', e);
      return null;
    }
  }

  /**
   * Handle error
   * @param {string} message 
   * @param {boolean} isWarning 
   */
  handleError(message, isWarning = false) {
    if (isWarning) {
      console.warn('[UNBREAK_PARENT] WARNING:', message);
    } else {
      console.error('[UNBREAK_PARENT] ERROR:', message);
    }

    if (this.options.onError) {
      this.options.onError(message, isWarning);
    }
  }

  /**
   * Generate trace ID
   * @returns {string}
   */
  generateTraceId() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  /**
   * Clean up bridge
   */
  destroy() {
    if (this.messageHandler) {
      window.removeEventListener('message', this.messageHandler);
      this.messageHandler = null;
    }

    this.iframe = null;
    this.ready = false;
    this.lastConfig = null;
    this.lastReceivedAt = null;
    this.configPromiseResolvers = [];

    console.log('[UNBREAK_PARENT] Bridge destroyed');
  }
}

// Export for use in browser
if (typeof window !== 'undefined') {
  window.ConfiguratorBridge = ConfiguratorBridge;
}

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ConfiguratorBridge;
}
