/**
 * UNBREAK ONE - Persistent Debug Panel
 * Shows all critical configurator states VISUALLY in the UI
 * NO dependency on Console, NO timing issues, NO scrolling
 */

(function(window) {
    'use strict';
    
    class DebugPanel {
        constructor() {
            this.panel = null;
            this.state = {
                // Iframe
                iframeFound: false,
                iframeSelector: null,
                iframeSrc: null,
                iframeContentWindow: false,
                iframeOrigin: null,
                
                // Ready/Bridge
                readyReceived: false,
                readyTimestamp: null,
                lastMessageFromIframe: null,
                lastMessageFromIframeTime: null,
                lastMessageToIframe: null,
                lastMessageToIframeTime: null,
                
                // Config
                configExists: false,
                configVariant: null,
                configColors: null,
                missingColors: [],
                
                // Button
                buttonFound: false,
                buttonDisabled: false,
                buttonDisabledReason: null,
                buttonHandlerBound: false,
                
                // Errors
                errors: []
            };
            
            this.init();
        }
        
        init() {
            // Create panel element
            this.panel = document.createElement('div');
            this.panel.id = 'persistent-debug-panel';
            this.panel.style.cssText = `
                position: fixed;
                top: 50px;
                right: 10px;
                width: 400px;
                max-height: 90vh;
                background: #0f172a;
                border: 2px solid #0891b2;
                border-radius: 8px;
                padding: 12px;
                font-family: 'Courier New', monospace;
                font-size: 11px;
                color: #e2e8f0;
                overflow-y: auto;
                z-index: 999999;
                box-shadow: 0 10px 40px rgba(0,0,0,0.5);
            `;
            
            // Wait for DOM
            if (document.body) {
                document.body.appendChild(this.panel);
            } else {
                document.addEventListener('DOMContentLoaded', () => {
                    document.body.appendChild(this.panel);
                });
            }
            
            // Start auto-update
            this.startAutoUpdate();
            
            console.log('[DEBUG_PANEL] Initialized - UI panel active');
        }
        
        startAutoUpdate() {
            // Update every 100ms for real-time feedback
            setInterval(() => this.update(), 100);
        }
        
        update() {
            if (!this.panel) return;
            
            // Detect iframe state
            const iframe = document.getElementById('configurator-iframe') || document.querySelector('iframe');
            this.state.iframeFound = !!iframe;
            this.state.iframeSelector = iframe ? (iframe.id ? `#${iframe.id}` : 'iframe') : null;
            this.state.iframeSrc = iframe ? iframe.src : null;
            this.state.iframeContentWindow = iframe ? !!iframe.contentWindow : false;
            this.state.iframeOrigin = iframe && iframe.src ? new URL(iframe.src).origin : null;
            
            // Detect bridge state
            const bridge = window.ConfiguratorBridge ? 
                (window.getConfiguratorBridge ? window.getConfiguratorBridge() : null) : null;
            
            if (bridge) {
                this.state.readyReceived = bridge.ready || bridge.isReady?.() || false;
                this.state.readyTimestamp = bridge.readyTimestamp || null;
                this.state.configExists = !!bridge.lastConfig;
                
                if (bridge.lastConfig) {
                    this.state.configVariant = bridge.lastConfig.variant;
                    this.state.configColors = bridge.lastConfig.colors;
                    
                    // Check missing required colors
                    const required = bridge.lastConfig.variant === 'bottle_holder' 
                        ? ['pattern'] 
                        : ['base', 'arm', 'module', 'pattern'];
                    this.state.missingColors = required.filter(key => !bridge.lastConfig.colors?.[key]);
                }
            }
            
            // Detect button state
            const button = document.getElementById('configurator-buy-now-btn') || 
                          document.querySelector('[data-checkout="configured"]');
            this.state.buttonFound = !!button;
            this.state.buttonDisabled = button ? button.disabled : null;
            this.state.buttonHandlerBound = button ? !!button._boundHandler || !!button.onclick : false;
            
            // Determine disabled reason
            if (button && button.disabled) {
                if (!this.state.iframeFound) {
                    this.state.buttonDisabledReason = 'Iframe not found in DOM';
                } else if (!this.state.readyReceived) {
                    this.state.buttonDisabledReason = 'Waiting for READY signal from iframe';
                } else if (!this.state.configExists) {
                    this.state.buttonDisabledReason = 'No config received from iframe yet';
                } else if (this.state.missingColors.length > 0) {
                    this.state.buttonDisabledReason = `Missing colors: ${this.state.missingColors.join(', ')}`;
                } else {
                    this.state.buttonDisabledReason = 'Unknown reason (check code)';
                }
            } else if (button && !button.disabled) {
                this.state.buttonDisabledReason = null;
            } else {
                this.state.buttonDisabledReason = 'Button not found in DOM';
            }
            
            this.render();
        }
        
        render() {
            const formatTime = (ts) => {
                if (!ts) return '—';
                const date = new Date(ts);
                return date.toLocaleTimeString('de-DE') + '.' + date.getMilliseconds().toString().padStart(3, '0');
            };
            
            const statusIcon = (bool) => bool ? '✅' : '❌';
            
            this.panel.innerHTML = `
                <div style="background: #1e293b; padding: 8px; margin: -12px -12px 12px -12px; border-radius: 6px 6px 0 0; border-bottom: 2px solid #0891b2;">
                    <strong style="color: #0891b2; font-size: 13px;">🔧 PERSISTENT DEBUG PANEL</strong>
                    <div style="color: #94a3b8; font-size: 9px; margin-top: 4px;">${new Date().toLocaleTimeString('de-DE')}</div>
                </div>
                
                <!-- IFRAME STATUS -->
                <div style="margin-bottom: 12px;">
                    <div style="color: #0891b2; font-weight: bold; margin-bottom: 6px; border-bottom: 1px solid #334155; padding-bottom: 4px;">
                        📦 IFRAME STATUS
                    </div>
                    <div style="margin-left: 8px; line-height: 1.6;">
                        <div>${statusIcon(this.state.iframeFound)} Found: <span style="color: ${this.state.iframeFound ? '#10b981' : '#ef4444'}">${this.state.iframeFound ? 'YES' : 'NO'}</span></div>
                        ${this.state.iframeSelector ? `<div>→ Selector: <code style="color: #fbbf24">${this.state.iframeSelector}</code></div>` : ''}
                        ${this.state.iframeSrc ? `<div>→ Src: <code style="color: #94a3b8; font-size: 9px;">${this.state.iframeSrc.substring(0, 50)}...</code></div>` : ''}
                        <div>${statusIcon(this.state.iframeContentWindow)} contentWindow: <span style="color: ${this.state.iframeContentWindow ? '#10b981' : '#ef4444'}">${this.state.iframeContentWindow ? 'YES' : 'NO'}</span></div>
                        ${this.state.iframeOrigin ? `<div>→ Origin: <code style="color: #94a3b8">${this.state.iframeOrigin}</code></div>` : ''}
                    </div>
                </div>
                
                <!-- READY / BRIDGE -->
                <div style="margin-bottom: 12px;">
                    <div style="color: #0891b2; font-weight: bold; margin-bottom: 6px; border-bottom: 1px solid #334155; padding-bottom: 4px;">
                        🔗 READY / BRIDGE
                    </div>
                    <div style="margin-left: 8px; line-height: 1.6;">
                        <div>${statusIcon(this.state.readyReceived)} READY: <span style="color: ${this.state.readyReceived ? '#10b981' : '#ef4444'}">${this.state.readyReceived ? 'RECEIVED' : 'NOT YET'}</span></div>
                        ${this.state.readyTimestamp ? `<div>→ At: <code style="color: #94a3b8">${formatTime(this.state.readyTimestamp)}</code></div>` : ''}
                        ${this.state.lastMessageFromIframe ? `
                            <div style="margin-top: 4px; color: #10b981;">← From iframe: <code>${this.state.lastMessageFromIframe}</code></div>
                            <div style="margin-left: 12px; color: #94a3b8; font-size: 9px;">${formatTime(this.state.lastMessageFromIframeTime)}</div>
                        ` : '<div style="color: #64748b;">← No messages from iframe</div>'}
                        ${this.state.lastMessageToIframe ? `
                            <div style="margin-top: 4px; color: #3b82f6;">→ To iframe: <code>${this.state.lastMessageToIframe}</code></div>
                            <div style="margin-left: 12px; color: #94a3b8; font-size: 9px;">${formatTime(this.state.lastMessageToIframeTime)}</div>
                        ` : ''}
                    </div>
                </div>
                
                <!-- CONFIG STATE -->
                <div style="margin-bottom: 12px;">
                    <div style="color: #0891b2; font-weight: bold; margin-bottom: 6px; border-bottom: 1px solid #334155; padding-bottom: 4px;">
                        ⚙️ CONFIG STATE
                    </div>
                    <div style="margin-left: 8px; line-height: 1.6;">
                        <div>${statusIcon(this.state.configExists)} Config: <span style="color: ${this.state.configExists ? '#10b981' : '#ef4444'}">${this.state.configExists ? 'EXISTS' : 'MISSING'}</span></div>
                        ${this.state.configVariant ? `<div>→ Variant: <code style="color: #fbbf24">${this.state.configVariant}</code></div>` : ''}
                        ${this.state.configColors ? `
                            <div style="margin-top: 4px; color: #94a3b8;">→ Colors:</div>
                            <div style="margin-left: 12px; background: #1e293b; padding: 6px; border-radius: 4px; margin-top: 2px;">
                                ${Object.entries(this.state.configColors).map(([key, val]) => 
                                    `<div><span style="color: #64748b">${key}:</span> <span style="color: ${val ? '#10b981' : '#ef4444'}">${val || '❌ missing'}</span></div>`
                                ).join('')}
                            </div>
                        ` : '<div style="color: #64748b;">No colors data</div>'}
                        ${this.state.missingColors.length > 0 ? `
                            <div style="margin-top: 6px; background: #7f1d1d; padding: 6px; border-radius: 4px; color: #fca5a5;">
                                ⚠️ Missing required: ${this.state.missingColors.join(', ')}
                            </div>
                        ` : ''}
                    </div>
                </div>
                
                <!-- BUY BUTTON -->
                <div style="margin-bottom: 12px;">
                    <div style="color: #0891b2; font-weight: bold; margin-bottom: 6px; border-bottom: 1px solid #334155; padding-bottom: 4px;">
                        🛒 BUY BUTTON
                    </div>
                    <div style="margin-left: 8px; line-height: 1.6;">
                        <div>${statusIcon(this.state.buttonFound)} Found: <span style="color: ${this.state.buttonFound ? '#10b981' : '#ef4444'}">${this.state.buttonFound ? 'YES' : 'NO'}</span></div>
                        ${this.state.buttonFound ? `
                            <div>→ Disabled: <span style="color: ${this.state.buttonDisabled ? '#ef4444' : '#10b981'}">${this.state.buttonDisabled ? 'TRUE' : 'FALSE'}</span></div>
                            ${this.state.buttonDisabled && this.state.buttonDisabledReason ? `
                                <div style="margin-top: 6px; background: #7f1d1d; padding: 6px; border-radius: 4px; color: #fca5a5;">
                                    <strong>🚫 DISABLED REASON:</strong><br>
                                    ${this.state.buttonDisabledReason}
                                </div>
                            ` : ''}
                            <div>${statusIcon(this.state.buttonHandlerBound)} Handler: <span style="color: ${this.state.buttonHandlerBound ? '#10b981' : '#ef4444'}">${this.state.buttonHandlerBound ? 'BOUND' : 'NOT BOUND'}</span></div>
                        ` : `
                            <div style="margin-top: 6px; background: #7f1d1d; padding: 6px; border-radius: 4px; color: #fca5a5;">
                                <strong>🚫 NOT FOUND IN DOM</strong><br>
                                Searched for: #configurator-buy-now-btn, [data-checkout="configured"]
                            </div>
                        `}
                    </div>
                </div>
                
                <!-- ERRORS -->
                ${this.state.errors.length > 0 ? `
                    <div style="margin-bottom: 12px;">
                        <div style="color: #ef4444; font-weight: bold; margin-bottom: 6px; border-bottom: 1px solid #7f1d1d; padding-bottom: 4px;">
                            ⚠️ ERRORS (Last ${Math.min(5, this.state.errors.length)})
                        </div>
                        <div style="margin-left: 8px; line-height: 1.4;">
                            ${this.state.errors.slice(-5).reverse().map(err => `
                                <div style="background: #7f1d1d; padding: 6px; margin-bottom: 4px; border-radius: 4px; font-size: 10px;">
                                    <div style="color: #fca5a5;"><strong>${err.source || 'unknown'}</strong> @ ${formatTime(err.timestamp)}</div>
                                    <div style="color: #fecaca; margin-top: 2px;">${err.message}</div>
                                    ${err.context ? `<div style="color: #94a3b8; margin-top: 2px; font-size: 9px;">${err.context}</div>` : ''}
                                </div>
                            `).join('')}
                        </div>
                    </div>
                ` : ''}
            `;
        }
        
        // Public methods to log messages/errors
        logMessage(type, direction, message) {
            if (direction === 'from') {
                this.state.lastMessageFromIframe = type;
                this.state.lastMessageFromIframeTime = Date.now();
            } else {
                this.state.lastMessageToIframe = type;
                this.state.lastMessageToIframeTime = Date.now();
            }
        }
        
        logError(message, source, context) {
            this.state.errors.push({
                timestamp: Date.now(),
                message,
                source,
                context
            });
            // Keep max 20 errors
            if (this.state.errors.length > 20) {
                this.state.errors.shift();
            }
        }
        
        setReady(timestamp) {
            this.state.readyReceived = true;
            this.state.readyTimestamp = timestamp || Date.now();
        }
    }
    
    // Export globally
    window.UnbreakDebugPanel = new DebugPanel();
    
})(window);
