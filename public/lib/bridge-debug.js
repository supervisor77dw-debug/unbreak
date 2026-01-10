/**
 * UNBREAK ONE - Bridge Debug Logger
 * 
 * Central telemetry and debugging for iframe↔parent communication
 * 
 * @version 1.0.0
 */

(function() {
  'use strict';

  const MAX_LOG_ENTRIES = 50;
  const MAX_DROP_REASONS = 20;

  class BridgeDebugger {
    constructor() {
      this.enabled = false;
      this.logs = [];
      this.drops = [];
      this.stats = {
        messagesReceived: 0,
        messagesSent: 0,
        messagesDropped: 0,
        checkoutTriggered: 0,
        apiCallsStarted: 0,
        apiCallsSucceeded: 0,
        apiCallsFailed: 0,
        redirectAttempts: 0,
      };
      this.lastMessage = null;
      this.lastCheckoutRequest = null;
      this.lastCheckoutResponse = null;
      this.lastDropReason = null;
      this.lastCorrelationId = null;
      
      // Check URL params for debug mode
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get('debug') === '1' || localStorage.getItem('unbreak_bridge_debug') === 'true') {
        this.enable();
      }
    }

    enable() {
      this.enabled = true;
      window.__UNBREAK_BRIDGE_DEBUG__ = true;
      console.log('[BRIDGE_DEBUG] 🔍 Debug mode ENABLED');
    }

    disable() {
      this.enabled = false;
      window.__UNBREAK_BRIDGE_DEBUG__ = false;
      console.log('[BRIDGE_DEBUG] Debug mode disabled');
    }

    /**
     * Central logging function
     */
    log(stage, details = {}) {
      const entry = {
        timestamp: new Date().toISOString(),
        stage: stage,
        details: details,
      };

      this.logs.push(entry);
      if (this.logs.length > MAX_LOG_ENTRIES) {
        this.logs.shift();
      }

      // Always log to console in debug mode
      if (this.enabled) {
        const emoji = this.getEmoji(stage);
        console.log(`${emoji} [BRIDGE][${stage}]`, details);
      }

      // Emit event for UI updates
      window.dispatchEvent(new CustomEvent('unbreak-bridge-log', { detail: entry }));
    }

    getEmoji(stage) {
      const emojiMap = {
        'INIT': '🚀',
        'HANDSHAKE': '🤝',
        'MESSAGE_RECEIVED': '📨',
        'MESSAGE_SENT': '📤',
        'VALIDATION_OK': '✅',
        'VALIDATION_FAILED': '❌',
        'DROP': '🚫',
        'HANDLER_MATCHED': '🎯',
        'CHECKOUT_TRIGGER': '🛒',
        'API_CALL_START': '🔧',
        'API_CALL_SUCCESS': '✅',
        'API_CALL_FAILED': '❌',
        'REDIRECT_ATTEMPT': '🔀',
        'REDIRECT_SUCCESS': '✅',
        'ERROR': '🔥',
      };
      return emojiMap[stage] || '📋';
    }

    /**
     * Log message received
     */
    logMessageReceived(event) {
      this.stats.messagesReceived++;
      this.lastMessage = {
        origin: event.origin,
        data: event.data,
        timestamp: new Date().toISOString(),
      };

      this.log('MESSAGE_RECEIVED', {
        origin: event.origin,
        event: event.data?.event || event.data?.type,
        correlationId: event.data?.correlationId,
        rawKeys: Object.keys(event.data || {}),
      });
    }

    /**
     * Log message sent
     */
    logMessageSent(message, targetOrigin) {
      this.stats.messagesSent++;
      this.lastCorrelationId = message.correlationId;

      this.log('MESSAGE_SENT', {
        event: message.event,
        correlationId: message.correlationId,
        targetOrigin: targetOrigin,
      });
    }

    /**
     * Log validation result
     */
    logValidation(message, validationResult) {
      if (validationResult.valid) {
        this.log('VALIDATION_OK', {
          event: message.event,
          correlationId: message.correlationId,
        });
      } else {
        this.log('VALIDATION_FAILED', {
          event: message.event,
          correlationId: message.correlationId,
          errors: validationResult.errors,
        });
      }
    }

    /**
     * Log dropped message
     */
    logDrop(reason, details = {}) {
      this.stats.messagesDropped++;
      this.lastDropReason = { reason, details, timestamp: new Date().toISOString() };

      const dropEntry = {
        timestamp: new Date().toISOString(),
        reason: reason,
        details: details,
      };

      this.drops.push(dropEntry);
      if (this.drops.length > MAX_DROP_REASONS) {
        this.drops.shift();
      }

      this.log('DROP', { reason, ...details });

      console.warn(`⚠️ [BRIDGE][DROP] ${reason}`, details);
    }

    /**
     * Log handler matched
     */
    logHandlerMatched(handlerName, message) {
      this.log('HANDLER_MATCHED', {
        handler: handlerName,
        event: message.event,
        correlationId: message.correlationId,
      });
    }

    /**
     * Log checkout trigger
     */
    logCheckoutTrigger(config) {
      this.stats.checkoutTriggered++;
      
      this.log('CHECKOUT_TRIGGER', {
        variant: config.variant,
        hasColors: !!config.colors,
        quantity: config.quantity,
      });
    }

    /**
     * Log API call
     */
    logApiCall(endpoint, requestData) {
      this.stats.apiCallsStarted++;
      this.lastCheckoutRequest = {
        endpoint: endpoint,
        data: requestData,
        timestamp: new Date().toISOString(),
      };

      this.log('API_CALL_START', {
        endpoint: endpoint,
        dataKeys: Object.keys(requestData || {}),
      });
    }

    /**
     * Log API response
     */
    logApiResponse(endpoint, response, error = null) {
      if (error) {
        this.stats.apiCallsFailed++;
        this.lastCheckoutResponse = {
          endpoint: endpoint,
          error: error.message,
          timestamp: new Date().toISOString(),
        };

        this.log('API_CALL_FAILED', {
          endpoint: endpoint,
          error: error.message,
        });
      } else {
        this.stats.apiCallsSucceeded++;
        this.lastCheckoutResponse = {
          endpoint: endpoint,
          responseKeys: Object.keys(response || {}),
          timestamp: new Date().toISOString(),
        };

        this.log('API_CALL_SUCCESS', {
          endpoint: endpoint,
          responseKeys: Object.keys(response || {}),
          hasSessionId: !!response?.sessionId,
          hasUrl: !!response?.url,
        });
      }
    }

    /**
     * Log redirect attempt
     */
    logRedirect(url) {
      this.stats.redirectAttempts++;

      this.log('REDIRECT_ATTEMPT', {
        url: url,
      });
    }

    /**
     * Get debug dump
     */
    getDump() {
      return {
        enabled: this.enabled,
        stats: this.stats,
        lastMessage: this.lastMessage,
        lastCheckoutRequest: this.lastCheckoutRequest,
        lastCheckoutResponse: this.lastCheckoutResponse,
        lastDropReason: this.lastDropReason,
        lastCorrelationId: this.lastCorrelationId,
        recentLogs: this.logs.slice(-20),
        recentDrops: this.drops.slice(-10),
        timestamp: new Date().toISOString(),
      };
    }

    /**
     * Copy dump to clipboard
     */
    copyDump() {
      const dump = JSON.stringify(this.getDump(), null, 2);
      
      if (navigator.clipboard) {
        navigator.clipboard.writeText(dump).then(() => {
          console.log('[BRIDGE_DEBUG] ✅ Debug dump copied to clipboard');
          alert('Debug info copied to clipboard!');
        });
      } else {
        console.log('[BRIDGE_DEBUG] Debug dump:', dump);
        alert('Check console for debug dump (clipboard not available)');
      }
    }

    /**
     * Clear logs
     */
    clear() {
      this.logs = [];
      this.drops = [];
      this.stats = {
        messagesReceived: 0,
        messagesSent: 0,
        messagesDropped: 0,
        checkoutTriggered: 0,
        apiCallsStarted: 0,
        apiCallsSucceeded: 0,
        apiCallsFailed: 0,
        redirectAttempts: 0,
      };
      console.log('[BRIDGE_DEBUG] Logs cleared');
    }
  }

  // Create singleton instance
  window.UnbreakBridgeDebug = new BridgeDebugger();

  console.log('[BRIDGE_DEBUG] Logger initialized');

})();
