/**
 * Integration Manager - Bi-directional postMessage contract
 * 
 * Handles communication between:
 * - Configurator (iFrame) 
 * - Host Shop (parent window)
 * 
 * Security:
 * - Strict origin validation
 * - Message shape validation
 * - No arbitrary code execution
 * 
 * Features:
 * - Debounced change events
 * - Full design export/import
 * - Preview-only export
 * - Locale/currency updates
 * - Health check (PING/PONG)
 */

import { 
  createEmptyDesignPayload, 
  validateDesignPayload,
  calculatePayloadSize,
  formatPayloadSize
} from './design-payload-schema.js';

export class IntegrationManager {
  constructor(options = {}) {
    this.options = {
      allowedOrigins: options.allowedOrigins || [
        'https://unbreak-one.vercel.app',
        'https://www.unbreakone.de',
        'http://localhost:3000'
      ],
      debounceMs: options.debounceMs || 300,
      debug: options.debug || false,
      onDesignChanged: options.onDesignChanged || null,
      onImportDesign: options.onImportDesign || null,
      onSetLocale: options.onSetLocale || null,
      ...options
    };
    
    this.currentDesign = null;
    this.changeDebounceTimer = null;
    this.messageHandler = null;
    this.eventLog = [];
    this.maxLogEntries = 50;
    
    this._setupMessageListener();
    
    if (this.options.debug) {
      this._log('IntegrationManager initialized', {
        allowedOrigins: this.options.allowedOrigins,
        debounceMs: this.options.debounceMs
      });
    }
  }
  
  /**
   * Set up postMessage listener
   * @private
   */
  _setupMessageListener() {
    this.messageHandler = (event) => {
      // Security: Validate origin
      if (!this._isAllowedOrigin(event.origin)) {
        this._log('Rejected message from unauthorized origin', { origin: event.origin }, true);
        return;
      }
      
      // Validate message shape
      const message = event.data;
      if (!message || typeof message !== 'object' || typeof message.type !== 'string') {
        this._log('Rejected malformed message', { message }, true);
        return;
      }
      
      this._log('Received message', { type: message.type, origin: event.origin });
      
      // Route message
      this._handleMessage(message, event.origin);
    };
    
    window.addEventListener('message', this.messageHandler);
    
    // Cleanup on page hide
    window.addEventListener('pagehide', () => {
      this.destroy();
    });
  }
  
  /**
   * Check if origin is in allowlist
   * @private
   */
  _isAllowedOrigin(origin) {
    return this.options.allowedOrigins.includes(origin);
  }
  
  /**
   * Handle incoming message
   * @private
   */
  _handleMessage(message, origin) {
    const { type, payload } = message;
    
    switch (type) {
      case 'REQUEST_EXPORT_DESIGN':
        this._handleExportDesignRequest(origin);
        break;
        
      case 'REQUEST_EXPORT_PREVIEWS':
        this._handleExportPreviewsRequest(origin);
        break;
        
      case 'IMPORT_DESIGN':
        this._handleImportDesign(payload, origin);
        break;
        
      case 'SET_LOCALE':
        this._handleSetLocale(payload, origin);
        break;
        
      case 'PING':
        this._handlePing(origin);
        break;
        
      default:
        this._log('Unknown message type', { type }, true);
    }
  }
  
  /**
   * Handle export design request
   * @private
   */
  _handleExportDesignRequest(origin) {
    if (!this.currentDesign) {
      this._sendMessage(origin, 'EXPORT_DESIGN_RESULT', {
        ok: false,
        error: 'No design available'
      });
      return;
    }
    
    const validation = validateDesignPayload(this.currentDesign);
    if (!validation.valid) {
      this._sendMessage(origin, 'EXPORT_DESIGN_RESULT', {
        ok: false,
        error: 'Invalid design payload',
        validationErrors: validation.errors
      });
      return;
    }
    
    this._sendMessage(origin, 'EXPORT_DESIGN_RESULT', {
      ok: true,
      payload: this.currentDesign,
      size: calculatePayloadSize(this.currentDesign),
      sizeFormatted: formatPayloadSize(calculatePayloadSize(this.currentDesign))
    });
  }
  
  /**
   * Handle export previews request
   * @private
   */
  _handleExportPreviewsRequest(origin) {
    if (!this.currentDesign) {
      this._sendMessage(origin, 'EXPORT_PREVIEWS_RESULT', {
        ok: false,
        error: 'No design available'
      });
      return;
    }
    
    this._sendMessage(origin, 'EXPORT_PREVIEWS_RESULT', {
      ok: true,
      previews: this.currentDesign.previews,
      designId: this.currentDesign.designId
    });
  }
  
  /**
   * Handle import design request
   * @private
   */
  async _handleImportDesign(payload, origin) {
    const { designPayload } = payload;
    
    // Validate payload
    const validation = validateDesignPayload(designPayload);
    if (!validation.valid) {
      this._sendMessage(origin, 'IMPORT_DESIGN_RESULT', {
        ok: false,
        error: 'Invalid design payload',
        issues: validation.errors
      });
      return;
    }
    
    // Callback to configurator to load design
    if (this.options.onImportDesign) {
      try {
        const result = await this.options.onImportDesign(designPayload);
        
        if (result.ok) {
          this.currentDesign = designPayload;
          this._sendMessage(origin, 'IMPORT_DESIGN_RESULT', {
            ok: true,
            designId: designPayload.designId
          });
        } else {
          this._sendMessage(origin, 'IMPORT_DESIGN_RESULT', {
            ok: false,
            error: result.error || 'Failed to import design',
            issues: result.issues || []
          });
        }
      } catch (error) {
        this._log('Import design error', { error: error.message }, true);
        this._sendMessage(origin, 'IMPORT_DESIGN_RESULT', {
          ok: false,
          error: error.message
        });
      }
    } else {
      this._sendMessage(origin, 'IMPORT_DESIGN_RESULT', {
        ok: false,
        error: 'onImportDesign callback not configured'
      });
    }
  }
  
  /**
   * Handle set locale request
   * @private
   */
  _handleSetLocale(payload, origin) {
    const { locale, currency } = payload;
    
    if (this.options.onSetLocale) {
      this.options.onSetLocale({ locale, currency });
    }
    
    // Update current design if exists
    if (this.currentDesign) {
      if (locale) this.currentDesign.locale = locale;
      if (currency) this.currentDesign.currency = currency;
      this.currentDesign.updatedAt = new Date().toISOString();
    }
    
    this._sendMessage(origin, 'SET_LOCALE_RESULT', {
      ok: true,
      locale: locale || this.currentDesign?.locale,
      currency: currency || this.currentDesign?.currency
    });
  }
  
  /**
   * Handle ping request
   * @private
   */
  _handlePing(origin) {
    this._sendMessage(origin, 'PONG', {
      timestamp: new Date().toISOString(),
      version: 'integration.v1'
    });
  }
  
  /**
   * Send message to parent window
   * @private
   */
  _sendMessage(targetOrigin, type, payload) {
    if (!window.parent) return;
    
    const message = { type, payload };
    
    this._log('Sending message', { type, targetOrigin });
    
    window.parent.postMessage(message, targetOrigin);
  }
  
  /**
   * Broadcast message to all allowed origins
   * @private
   */
  _broadcastMessage(type, payload) {
    this.options.allowedOrigins.forEach(origin => {
      this._sendMessage(origin, type, payload);
    });
  }
  
  /**
   * Update current design and notify host (debounced)
   * @public
   */
  updateDesign(designPayload) {
    this.currentDesign = {
      ...designPayload,
      updatedAt: new Date().toISOString()
    };
    
    // Callback for local changes
    if (this.options.onDesignChanged) {
      this.options.onDesignChanged(this.currentDesign);
    }
    
    // Debounced notification to host
    if (this.changeDebounceTimer) {
      clearTimeout(this.changeDebounceTimer);
    }
    
    this.changeDebounceTimer = setTimeout(() => {
      this._broadcastConfigChanged();
    }, this.options.debounceMs);
  }
  
  /**
   * Broadcast config changed event
   * @private
   */
  _broadcastConfigChanged() {
    if (!this.currentDesign) return;
    
    this._broadcastMessage('CONFIG_CHANGED', {
      designId: this.currentDesign.designId,
      validation: this.currentDesign.validation,
      selections: this.currentDesign.selections,
      updatedAt: this.currentDesign.updatedAt,
      // Optional price hint if calculated
      priceHint: this.currentDesign.priceHint || null
    });
  }
  
  /**
   * Notify host that configurator is ready
   * @public
   */
  notifyReady() {
    this._broadcastMessage('UNBREAK_CONFIG_READY', {
      ok: true,
      version: 'integration.v1',
      timestamp: new Date().toISOString()
    });
  }
  
  /**
   * Notify host of an error
   * @public
   */
  notifyError(message, stack = null) {
    this._broadcastMessage('UNBREAK_CONFIG_ERROR', {
      message,
      stack,
      timestamp: new Date().toISOString()
    });
  }
  
  /**
   * Notify host of loading progress
   * @public
   */
  notifyLoading(progress, message = null) {
    this._broadcastMessage('UNBREAK_CONFIG_LOADING', {
      progress: Math.round(progress),
      message,
      timestamp: new Date().toISOString()
    });
  }
  
  /**
   * Get current design
   * @public
   */
  getCurrentDesign() {
    return this.currentDesign;
  }
  
  /**
   * Get event log
   * @public
   */
  getEventLog() {
    return [...this.eventLog];
  }
  
  /**
   * Clear event log
   * @public
   */
  clearEventLog() {
    this.eventLog = [];
  }
  
  /**
   * Log event
   * @private
   */
  _log(message, data = null, isError = false) {
    const entry = {
      timestamp: new Date().toISOString(),
      message,
      data,
      isError
    };
    
    this.eventLog.push(entry);
    if (this.eventLog.length > this.maxLogEntries) {
      this.eventLog.shift();
    }
    
    if (this.options.debug) {
      const logFn = isError ? console.error : console.log;
      logFn(`[IntegrationManager] ${message}`, data || '');
    }
  }
  
  /**
   * Clean up resources
   * @public
   */
  destroy() {
    if (this.messageHandler) {
      window.removeEventListener('message', this.messageHandler);
      this.messageHandler = null;
    }
    
    if (this.changeDebounceTimer) {
      clearTimeout(this.changeDebounceTimer);
      this.changeDebounceTimer = null;
    }
    
    this._log('IntegrationManager destroyed');
  }
}
