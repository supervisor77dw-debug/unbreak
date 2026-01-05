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
                
                // Message Tap
                messagesFromIframe: [], // Last 10
                messagesToIframe: [], // Last 10
                blockedMessages: 0,
                lastBlockedReason: null,
                
                // Config
                configExists: false,
                configVariant: null,
                configColors: null,
                configTimestamp: null,
                missingColors: [],
                configSchema: null, // 'legacy-3part', '4part', 'bottle_holder'
                
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
            
            // Check if handler bound (either direct or via delegation)
            this.state.buttonHandlerBound = button ? 
                (!!button.dataset.bound || !!button.onclick || !!button._delegationActive) : false;
            
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
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <div>
                            <strong style="color: #0891b2; font-size: 13px;">🔧 PERSISTENT DEBUG PANEL</strong>
                            <div style="color: #94a3b8; font-size: 9px; margin-top: 4px;">${new Date().toLocaleTimeString('de-DE')}</div>
                        </div>
                        <div style="display: flex; gap: 6px;">
                            <button id="simulate-config-btn" style="background: #f59e0b; color: white; border: none; padding: 4px 8px; border-radius: 4px; cursor: pointer; font-size: 10px; font-weight: bold;">
                                Test Config
                            </button>
                            <button id="copy-debug-report-btn" style="background: #0891b2; color: white; border: none; padding: 4px 12px; border-radius: 4px; cursor: pointer; font-size: 10px; font-weight: bold;">
                                Copy Report
                            </button>
                        </div>
                    </div>
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
                        
                        <div style="margin-top: 8px; color: #94a3b8; font-size: 10px;">
                            📨 Messages FROM iframe (${this.state.messagesFromIframe.length}):
                        </div>
                        ${this.state.messagesFromIframe.length > 0 ? `
                            <div style="background: #1e293b; padding: 4px; border-radius: 4px; margin-top: 2px; max-height: 100px; overflow-y: auto;">
                                ${this.state.messagesFromIframe.slice(-10).reverse().map(msg => `
                                    <div style="font-size: 9px; color: #10b981; border-bottom: 1px solid #334155; padding: 2px 0;">
                                        <span style="color: #64748b;">${formatTime(msg.timestamp)}</span> <strong>${msg.type}</strong>
                                        ${msg.data ? `<div style="color: #94a3b8; margin-left: 8px;">${JSON.stringify(msg.data).substring(0, 80)}...</div>` : ''}
                                    </div>
                                `).join('')}
                            </div>
                        ` : '<div style="color: #64748b; font-size: 9px;">None yet</div>'}
                        
                        <div style="margin-top: 8px; color: #94a3b8; font-size: 10px;">
                            📤 Messages TO iframe (${this.state.messagesToIframe.length}):
                        </div>
                        ${this.state.messagesToIframe.length > 0 ? `
                            <div style="background: #1e293b; padding: 4px; border-radius: 4px; margin-top: 2px; max-height: 80px; overflow-y: auto;">
                                ${this.state.messagesToIframe.slice(-10).reverse().map(msg => `
                                    <div style="font-size: 9px; color: #3b82f6; padding: 2px 0;">
                                        <span style="color: #64748b;">${formatTime(msg.timestamp)}</span> <strong>${msg.type}</strong>
                                    </div>
                                `).join('')}
                            </div>
                        ` : '<div style="color: #64748b; font-size: 9px;">None yet</div>'}
                        
                        ${this.state.blockedMessages > 0 ? `
                            <div style="margin-top: 6px; background: #7f1d1d; padding: 4px; border-radius: 4px; font-size: 9px; color: #fca5a5;">
                                🚫 Blocked: ${this.state.blockedMessages} | Last: ${this.state.lastBlockedReason}
                            </div>
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
                        ${this.state.configTimestamp ? `<div>→ Received: <code style="color: #94a3b8">${formatTime(this.state.configTimestamp)}</code></div>` : ''}
                        ${this.state.configSchema ? `<div>→ Schema: <code style="color: #fbbf24">${this.state.configSchema}</code></div>` : ''}
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
            
            // Bind copy button
            setTimeout(() => {
                const copyBtn = this.panel.querySelector('#copy-debug-report-btn');
                if (copyBtn && !copyBtn._bound) {
                    copyBtn._bound = true;
                    copyBtn.onclick = () => this.copyDebugReport();
                }
                
                const simulateBtn = this.panel.querySelector('#simulate-config-btn');
                if (simulateBtn && !simulateBtn._bound) {
                    simulateBtn._bound = true;
                    simulateBtn.onclick = () => this.simulateConfig();
                }
            }, 0);
        }
        
        // Public methods to log messages/errors
        logMessage(type, direction, message, data = null) {
            const entry = {
                type,
                message,
                data,
                timestamp: Date.now()
            };
            
            if (direction === 'from') {
                this.state.lastMessageFromIframe = type;
                this.state.lastMessageFromIframeTime = Date.now();
                this.state.messagesFromIframe.push(entry);
                if (this.state.messagesFromIframe.length > 10) {
                    this.state.messagesFromIframe.shift();
                }
            } else {
                this.state.lastMessageToIframe = type;
                this.state.lastMessageToIframeTime = Date.now();
                this.state.messagesToIframe.push(entry);
                if (this.state.messagesToIframe.length > 10) {
                    this.state.messagesToIframe.shift();
                }
            }
        }
        
        logBlocked(origin, reason) {
            this.state.blockedMessages++;
            this.state.lastBlockedReason = `${origin}: ${reason}`;
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
        
        setConfig(config, schema) {
            this.state.configExists = true;
            this.state.configVariant = config.variant;
            this.state.configColors = config.colors;
            this.state.configTimestamp = Date.now();
            this.state.configSchema = schema;
        }
        
        generateReport() {
            const formatTime = (ts) => {
                if (!ts) return 'N/A';
                const date = new Date(ts);
                return date.toISOString();
            };
            
            const report = [];
            
            report.push('════════════════════════════════════════════════');
            report.push('UNBREAK ONE - DEBUG REPORT');
            report.push('════════════════════════════════════════════════');
            report.push('Generated: ' + new Date().toISOString());
            report.push('');
            
            // A) PAGE INFO
            report.push('─────────────────────────────────────────────────');
            report.push('A) PAGE INFO');
            report.push('─────────────────────────────────────────────────');
            report.push('URL: ' + window.location.href);
            report.push('Build: ' + (window.UNBREAK_BUILD_INFO?.commit || 'unknown'));
            report.push('UserAgent: ' + navigator.userAgent);
            report.push('');
            
            // B) IFRAME
            report.push('─────────────────────────────────────────────────');
            report.push('B) IFRAME STATE');
            report.push('─────────────────────────────────────────────────');
            report.push('Found: ' + (this.state.iframeFound ? 'YES' : 'NO'));
            report.push('Selector: ' + (this.state.iframeSelector || 'N/A'));
            report.push('Src: ' + (this.state.iframeSrc || 'N/A'));
            report.push('Origin: ' + (this.state.iframeOrigin || 'N/A'));
            report.push('contentWindow: ' + (this.state.iframeContentWindow ? 'YES' : 'NO'));
            report.push('');
            
            // C) BRIDGE STATE
            report.push('─────────────────────────────────────────────────');
            report.push('C) BRIDGE STATE');
            report.push('─────────────────────────────────────────────────');
            report.push('READY received: ' + (this.state.readyReceived ? 'YES' : 'NO'));
            report.push('READY timestamp: ' + formatTime(this.state.readyTimestamp));
            report.push('Config exists: ' + (this.state.configExists ? 'YES' : 'NO'));
            report.push('Config schema: ' + (this.state.configSchema || 'N/A'));
            report.push('Config variant: ' + (this.state.configVariant || 'N/A'));
            report.push('Config timestamp: ' + formatTime(this.state.configTimestamp));
            if (this.state.configColors) {
                report.push('Config colors:');
                Object.entries(this.state.configColors).forEach(([key, val]) => {
                    report.push('  ' + key + ': ' + (val || 'MISSING'));
                });
            }
            report.push('Handler bound: ' + (this.state.buttonHandlerBound ? 'YES' : 'NO'));
            report.push('Button found: ' + (this.state.buttonFound ? 'YES' : 'NO'));
            report.push('Button disabled: ' + (this.state.buttonDisabled ? 'YES' : 'NO'));
            report.push('Disabled reason: ' + (this.state.buttonDisabledReason || 'N/A'));
            report.push('');
            
            // D) MESSAGES FROM IFRAME
            report.push('─────────────────────────────────────────────────');
            report.push('D) MESSAGES FROM IFRAME (last 20)');
            report.push('─────────────────────────────────────────────────');
            if (this.state.messagesFromIframe.length === 0) {
                report.push('None');
            } else {
                this.state.messagesFromIframe.slice(-20).forEach(msg => {
                    const payload = msg.data ? JSON.stringify(msg.data).substring(0, 500) : 'N/A';
                    report.push(formatTime(msg.timestamp) + ' | ' + msg.type + ' | ' + payload);
                });
            }
            report.push('');
            
            // E) MESSAGES TO IFRAME
            report.push('─────────────────────────────────────────────────');
            report.push('E) MESSAGES TO IFRAME (last 20)');
            report.push('─────────────────────────────────────────────────');
            if (this.state.messagesToIframe.length === 0) {
                report.push('None');
            } else {
                this.state.messagesToIframe.slice(-20).forEach(msg => {
                    report.push(formatTime(msg.timestamp) + ' | ' + msg.type + ' | ' + (msg.message || ''));
                });
            }
            report.push('');
            
            // F) ERRORS
            report.push('─────────────────────────────────────────────────');
            report.push('F) ERRORS (last 20)');
            report.push('─────────────────────────────────────────────────');
            if (this.state.errors.length === 0) {
                report.push('None');
            } else {
                this.state.errors.slice(-20).forEach(err => {
                    report.push(formatTime(err.timestamp) + ' | ' + err.source + ' | ' + err.message);
                    if (err.context) {
                        report.push('  Context: ' + err.context);
                    }
                });
            }
            report.push('');
            
            // G) RAW STATE DUMP
            report.push('─────────────────────────────────────────────────');
            report.push('G) RAW STATE DUMP');
            report.push('─────────────────────────────────────────────────');
            report.push('window.__unbreakLastConfig:');
            report.push(JSON.stringify(window.__unbreakLastConfig, null, 2) || 'undefined');
            report.push('');
            report.push('sessionStorage unbreak_config:');
            try {
                const stored = sessionStorage.getItem('unbreak_config');
                report.push(stored || 'empty');
            } catch (e) {
                report.push('Error reading: ' + e.message);
            }
            report.push('');
            report.push('Blocked messages: ' + this.state.blockedMessages);
            report.push('Last blocked reason: ' + (this.state.lastBlockedReason || 'N/A'));
            report.push('');
            report.push('════════════════════════════════════════════════');
            report.push('END OF REPORT');
            report.push('════════════════════════════════════════════════');
            
            return report.join('\n');
        }
        
        async copyDebugReport() {
            const report = this.generateReport();
            
            try {
                await navigator.clipboard.writeText(report);
                this.showToast('✓ Copied (' + report.length + ' chars)', '#10b981');
                console.log('[DEBUG_PANEL] Report copied to clipboard');
            } catch (err) {
                console.warn('[DEBUG_PANEL] Clipboard API failed, showing fallback', err);
                this.showFallbackCopy(report);
            }
        }
        
        showToast(message, color) {
            const toast = document.createElement('div');
            toast.textContent = message;
            toast.style.cssText = `
                position: fixed;
                top: 60px;
                right: 420px;
                background: ${color};
                color: white;
                padding: 12px 20px;
                border-radius: 6px;
                font-family: monospace;
                font-size: 12px;
                font-weight: bold;
                z-index: 9999999;
                box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            `;
            document.body.appendChild(toast);
            setTimeout(() => toast.remove(), 3000);
        }
        
        showFallbackCopy(text) {
            const overlay = document.createElement('div');
            overlay.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: rgba(0,0,0,0.8);
                z-index: 99999999;
                display: flex;
                align-items: center;
                justify-content: center;
            `;
            
            const modal = document.createElement('div');
            modal.style.cssText = `
                background: #1e293b;
                padding: 20px;
                border-radius: 8px;
                max-width: 800px;
                max-height: 80vh;
                overflow: auto;
            `;
            
            const textarea = document.createElement('textarea');
            textarea.value = text;
            textarea.style.cssText = `
                width: 100%;
                min-height: 400px;
                font-family: monospace;
                font-size: 11px;
                padding: 12px;
                background: #0f172a;
                color: #e2e8f0;
                border: 2px solid #0891b2;
                border-radius: 4px;
            `;
            textarea.select();
            
            const closeBtn = document.createElement('button');
            closeBtn.textContent = 'Close (CTRL+C to copy)';
            closeBtn.style.cssText = `
                margin-top: 12px;
                padding: 8px 16px;
                background: #0891b2;
                color: white;
                border: none;
                border-radius: 4px;
                cursor: pointer;
                font-weight: bold;
            `;
            closeBtn.onclick = () => overlay.remove();
            
            modal.appendChild(textarea);
            modal.appendChild(closeBtn);
            overlay.appendChild(modal);
            document.body.appendChild(overlay);
        }
        
        simulateConfig() {
            const testConfig = {
                variant: 'glass_holder',
                colors: {
                    base: 'black',
                    top: 'red',
                    middle: 'purple'
                },
                finish: 'matte',
                quantity: 1,
                source: 'debug_panel_simulation',
                config_version: '1.0.0',
                trace_id: 'sim_' + Date.now()
            };
            
            console.log('[DEBUG_PANEL] Simulating config:', testConfig);
            
            // Store globally
            window.__unbreakLastConfig = testConfig;
            
            // Update panel
            this.setConfig(testConfig, 'legacy-3part');
            
            // Trigger bridge if available
            const bridge = window.getConfiguratorBridge?.();
            if (bridge && bridge.handleConfigChanged) {
                bridge.handleConfigChanged(testConfig, 'debug_simulation');
            }
            
            this.showToast('✓ Test config set', '#10b981');
        }
    }
    
    // Export globally
    window.UnbreakDebugPanel = new DebugPanel();
    
})(window);
