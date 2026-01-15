/**
 * UNBREAK ONE - Secure Configurator Bridge
 * Handles postMessage communication between shop and 3D configurator iframe
 * 
 * Security:
 * - Strict origin filtering (only https://unbreak-3-d-konfigurator.vercel.app)
 * - Config validation with 7 canonical colors
 * - No silent fallbacks or defaults
 * 
 * Config Structure:
 * - variant: "glass_holder" | "bottle_holder"
 * - colors: {base, arm, module, pattern} (all 4 required for glass_holder)
 * - 7 canonical color IDs: mint, green, purple, iceBlue, darkBlue, red, black
 * 
 * Features:
 * - Promise-based requestConfig() with timeout
 * - sessionStorage persistence with TTL
 * - Complete 4-part color structure (NO MAPPING!)
 * - Comprehensive error logging with trace_id
 * 
 * @version 2.0.0 - BREAKING: Changed to 4-part colors (base/arm/module/pattern)
 */

(function(window) {
    'use strict';
    
    // Configuration
    const CONFIGURATOR_ORIGIN = (typeof window !== 'undefined' && window.ENV?.NEXT_PUBLIC_CONFIGURATOR_DOMAIN) ||
                                 'https://unbreak-3-d-konfigurator.vercel.app';
    const REQUEST_TIMEOUT = 300; // ms
    const SESSION_TTL = 10 * 60 * 1000; // 10 minutes
    const SESSION_KEY = 'unbreak_config';
    
    // Canonical color IDs (matching configurator COLOR_PALETTE exactly)
    const CANONICAL_COLOR_IDS = [
        'mint',      // #a2d9ce
        'green',     // #145a32
        'purple',    // #4a235a
        'iceBlue',   // #5499c7
        'darkBlue',  // #1b2631
        'red',       // #b03a2e
        'black'      // #121212
    ];
    
    /**
     * ConfiguratorBridge - Manages secure iframe communication
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
            this.options = {
                debug: false,
                onReady: null,
                onConfigReceived: null,
                onError: null
            };
        }
        
        /**
         * Generate unique trace ID for logging
         */
        generateTraceId() {
            return 'trace_' + Math.random().toString(36).substring(2, 11);
        }
        
        /**
         * Initialize bridge with iframe element
         */
        init(iframeEl, options = {}) {
            this.iframe = iframeEl;
            this.options = { ...this.options, ...options };
            
            this.log(`[BRIDGE_INIT] Starting traceId=${this.traceId}`);
            this.log(`[BRIDGE_INIT] iframe src=${iframeEl.src}`);
            this.log(`[BRIDGE_INIT] Expected origin=${CONFIGURATOR_ORIGIN}`);
            
            // Set up message listener
            this.messageHandler = this.handleMessage.bind(this);
            window.addEventListener('message', this.messageHandler);
            
            // Track iframe load events
            iframeEl.addEventListener('load', () => {
                this.log('[3D_IFRAME_LOAD] iframe onload event fired');
            });
            
            iframeEl.addEventListener('error', (e) => {
                console.error('[3D_IFRAME_ERROR] iframe failed to load', e);
            });
            
            // Restore from sessionStorage if available
            this.restoreFromSession();
            
            this.log('[BRIDGE_INIT] Waiting for READY signal from iframe...');
        }
        
        /**
         * Handle incoming postMessage
         */
        handleMessage(event) {
            // CRITICAL: Strict origin check (no wildcards!)
            if (event.origin !== CONFIGURATOR_ORIGIN) {
                if (this.options.debug) {
                    console.log(`[UNBREAK_PARENT] Message BLOCKED - wrong origin: ${event.origin} (expected: ${CONFIGURATOR_ORIGIN})`);
                }
                return;
            }
            
            const data = event.data;
            if (!data || !data.type) {
                this.log(`[BRIDGE_MSG] Received message without type:`, data);
                return;
            }
            
            this.log(`[BRIDGE_MSG] ${data.type} from ${event.origin}`, data);
            
            switch (data.type) {
                case 'READY':
                case 'UNBREAK_CONFIG_READY':
                    this.log('[3D_READY_SIGNAL] Configurator sent READY signal');
                    this.handleReady(data);
                    break;
                    
                case 'LOADING':
                    const progress = data.progress || 0;
                    this.log(`[3D_LOAD_PROGRESS] ${progress}% - ${data.message || ''}`);
                    break;
                    
                case 'configChanged':
                case 'CONFIG_CHANGED':
                    this.log('[3D_CONFIG_CHANGED] User changed configuration in iframe');
                    this.handleConfigChanged(data.config || data, 'config_changed');
                    break;
                    
                case 'checkout_configuration':
                case 'GET_CONFIGURATION_RESPONSE':
                    this.log('[3D_CONFIG_RESPONSE] Received config in response to request');
                    this.handleConfigResponse(data.config || data);
                    break;
                    
                case 'ERROR':
                case 'UNBREAK_CONFIG_ERROR':
                    console.error('[3D_ERROR]', data.message || 'Unknown error', data);
                    this.handleError(data.message || 'Unknown error', false);
                    break;
                    
                default:
                    this.log(`[BRIDGE_MSG] Unknown message type: ${data.type}`);
            }
        }
        
        /**
         * Handle READY signal from iframe
         */
        handleReady(data) {
            this.ready = true;
            this.log(`READY timestamp=${Date.now()}`);
            
            // CRITICAL: Send acknowledgement back to iframe
            if (this.iframe && this.iframe.contentWindow) {
                this.iframe.contentWindow.postMessage({
                    type: 'READY_ACK',
                    source: 'parent'
                }, CONFIGURATOR_ORIGIN);
                this.log('Sent READY_ACK to iframe');
            }
            
            if (this.options.onReady) {
                this.options.onReady();
            }
        }
        
        /**
         * Handle config change from iframe
         */
        handleConfigChanged(config, reason = 'unknown') {
            try {
                // Validate config structure
                const validated = this.validateConfig(config);
                
                this.log(`CONFIG_RECEIVED reason=${reason} variant=${validated.variant} colors=${JSON.stringify(validated.colors)}`);
                
                // Store validated config
                this.lastConfig = validated;
                this.lastReceivedAt = Date.now();
                this.lastReason = reason;
                
                // Save to sessionStorage
                this.saveToSession();
                
                // Also store in legacy location for backward compatibility
                if (window.UnbreakCheckoutState) {
                    window.UnbreakCheckoutState.lastConfig = validated;
                }
                
                // Notify callback
                if (this.options.onConfigReceived) {
                    this.options.onConfigReceived(validated);
                }
                
            } catch (error) {
                this.handleError(`Config validation failed: ${error.message}`, false);
            }
        }
        
        /**
         * Handle config response from GET_CONFIGURATION request
         */
        handleConfigResponse(config) {
            try {
                const validated = this.validateConfig(config);
                
                this.log(`Config response received: ${JSON.stringify(validated.colors)}`);
                
                // Store config
                this.lastConfig = validated;
                this.lastReceivedAt = Date.now();
                this.lastReason = 'request';
                this.saveToSession();
                
                // Resolve any pending promises
                while (this.configPromiseResolvers.length > 0) {
                    const resolve = this.configPromiseResolvers.shift();
                    resolve(validated);
                }
                
            } catch (error) {
                // Reject pending promises
                while (this.configPromiseResolvers.length > 0) {
                    const reject = this.configPromiseResolvers.shift();
                    reject(error);
                }
                this.handleError(`Config response validation failed: ${error.message}`, false);
            }
        }
        
        /**
         * Validate configurator config structure
         * STRICT: No silent fallbacks, all errors thrown
         */
        validateConfig(config) {
            const errors = [];
            
            // Check config is an object
            if (!config || typeof config !== 'object') {
                throw new Error(`Config must be an object, got: ${typeof config}`);
            }
            
            // Check colors object exists
            if (!config.colors || typeof config.colors !== 'object') {
                throw new Error('Config.colors must be an object');
            }
            
            // Get variant (default to glass_holder)
            const variant = config.variant || 'glass_holder';
            
            if (!['glass_holder', 'bottle_holder'].includes(variant)) {
                errors.push(`Invalid variant: ${variant}`);
            }
            
            // For glass_holder: require all 4 parts
            // For bottle_holder: only pattern is configurable
            const requiredParts = variant === 'glass_holder' 
                ? ['base', 'arm', 'module', 'pattern']
                : ['pattern'];
            
            // Validate required parts
            for (const part of requiredParts) {
                const colorId = config.colors[part];
                
                if (!colorId) {
                    errors.push(`Missing required color: ${part}`);
                    continue;
                }
                
                if (!this.isCanonicalColorId(colorId)) {
                    errors.push(`Invalid color ID for ${part}: "${colorId}" (must be one of: ${CANONICAL_COLOR_IDS.join(', ')})`);
                }
            }
            
            // For bottle_holder, set non-configurable parts to black
            const colors = { ...config.colors };
            if (variant === 'bottle_holder') {
                colors.base = colors.base || 'black';
                colors.arm = colors.arm || 'black';
                colors.module = colors.module || 'black';
            }
            
            // Validate finish (optional)
            const finish = config.finish || 'matte';
            if (!['matte', 'glossy'].includes(finish)) {
                this.log(`Invalid finish: ${config.finish}, defaulting to matte`, null, true);
            }
            
            // If errors found, throw
            if (errors.length > 0) {
                throw new Error(`Config validation failed:\n${errors.map(e => `  - ${e}`).join('\n')}`);
            }
            
            // Return validated config with complete structure
            return {
                variant: variant,
                colors: {
                    base: colors.base,
                    arm: colors.arm,
                    module: colors.module,
                    pattern: colors.pattern
                },
                finish: finish,
                quantity: config.quantity || 1,
                source: 'configurator_iframe',
                config_version: '1.0.0',
                trace_id: this.traceId
            };
        }
        
        /**
         * Check if a value is a valid canonical color ID
         */
        isCanonicalColorId(value) {
            return typeof value === 'string' && CANONICAL_COLOR_IDS.includes(value);
        }
        
        /**
         * Request current configuration from iframe
         * Returns a Promise that resolves with validated config
         */
        async requestConfig() {
            if (!this.ready) {
                throw new Error('Configurator not ready yet');
            }
            
            this.log('requestConfig() called');
            
            // If we have recent config, return it immediately
            if (this.lastConfig && this.lastReceivedAt && 
                (Date.now() - this.lastReceivedAt) < 5000) {
                this.log('Using recent config from cache');
                return this.lastConfig;
            }
            
            // Request config from iframe
            return new Promise((resolve, reject) => {
                // Set timeout
                const timeout = setTimeout(() => {
                    this.log('requestConfig() timeout, checking sessionStorage...');
                    
                    // Try sessionStorage fallback
                    const cached = this.restoreFromSession();
                    if (cached) {
                        this.handleError('Using cached config from sessionStorage (iframe slow)', true);
                        resolve(cached);
                    } else {
                        reject(new Error('Timeout waiting for config'));
                    }
                }, REQUEST_TIMEOUT);
                
                // Store resolver
                this.configPromiseResolvers.push((config) => {
                    clearTimeout(timeout);
                    resolve(config);
                });
                
                // Send GET_CONFIGURATION message
                if (this.iframe && this.iframe.contentWindow) {
                    this.iframe.contentWindow.postMessage({
                        type: 'GET_CONFIGURATION',
                        trace_id: this.traceId,
                        timestamp: Date.now()
                    }, CONFIGURATOR_ORIGIN);
                    
                    this.log('GET_CONFIGURATION sent to iframe');
                } else {
                    clearTimeout(timeout);
                    reject(new Error('iframe not available'));
                }
            });
        }
        
        /**
         * Get last received config (may be stale)
         */
        getLastConfig() {
            return this.lastConfig;
        }
        
        /**
         * Check if iframe is ready
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
                    trace_id: this.traceId
                };
                sessionStorage.setItem(SESSION_KEY, JSON.stringify(data));
                this.log('Config saved to sessionStorage');
            } catch (error) {
                this.log(`sessionStorage save failed: ${error.message}`, null, true);
            }
        }
        
        /**
         * Restore config from sessionStorage
         */
        restoreFromSession() {
            try {
                const stored = sessionStorage.getItem(SESSION_KEY);
                if (!stored) return null;
                
                const data = JSON.parse(stored);
                const age = Date.now() - data.timestamp;
                
                if (age > SESSION_TTL) {
                    this.log('sessionStorage config expired, clearing');
                    sessionStorage.removeItem(SESSION_KEY);
                    return null;
                }
                
                this.log(`Restored config from sessionStorage (age: ${Math.round(age/1000)}s)`);
                this.lastConfig = data.config;
                this.lastReceivedAt = data.timestamp;
                this.lastReason = 'restored_from_session';
                
                return data.config;
                
            } catch (error) {
                this.log(`sessionStorage restore failed: ${error.message}`, null, true);
                return null;
            }
        }
        
        /**
         * Handle error
         */
        handleError(message, isWarning = false) {
            const prefix = isWarning ? '⚠️' : '❌';
            console.error(`${prefix} [UNBREAK_PARENT] ${message}`);
            
            if (this.options.onError) {
                this.options.onError(message, isWarning);
            }
        }
        
        /**
         * Log message
         */
        log(message, data = null, isWarning = false) {
            const prefix = isWarning ? '⚠️' : '✓';
            const fullMessage = `${prefix} [UNBREAK_PARENT] ${message}`;
            
            if (this.options.debug || isWarning) {
                if (data) {
                    console.log(fullMessage, data);
                } else {
                    console.log(fullMessage);
                }
            }
        }
        
        /**
         * Cleanup bridge
         */
        destroy() {
            if (this.messageHandler) {
                window.removeEventListener('message', this.messageHandler);
                this.messageHandler = null;
            }
            this.iframe = null;
            this.ready = false;
            this.log('Bridge destroyed');
        }
    }
    
    // Export to window
    window.ConfiguratorBridge = ConfiguratorBridge;
    
})(window);
