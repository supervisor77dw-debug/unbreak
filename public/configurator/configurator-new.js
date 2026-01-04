/**
 * UNBREAK ONE - 3D Configurator Integration
 * PRODUCTION VERSION - Uses ConfiguratorBridge for secure communication
 * 
 * Security:
 * - Strict origin checking via ConfiguratorBridge
 * - No silent fallbacks or petrol defaults
 * - Full validation before checkout
 */

(function() {
    'use strict';
    
    // Initialize ConfiguratorBridge
    let bridge = null;
    let configReady = false;
    
    // Debug mode from URL
    const urlParams = new URLSearchParams(window.location.search);
    const DEBUG_MODE = urlParams.get('debug') === '1';
    
    console.log('[CONFIGURATOR_PAGE] Initializing...');
    
    document.addEventListener('DOMContentLoaded', () => {
        const iframe = document.getElementById('configurator-iframe');
        const loadingOverlay = document.getElementById('loading-overlay');
        const errorContainer = document.getElementById('error-container');
        const readyBadge = createReadyBadge();
        const debugPanel = DEBUG_MODE ? createDebugPanel() : null;
        
        if (!iframe) {
            console.error('[CONFIGURATOR_PAGE] iframe not found!');
            return;
        }
        
        // Initialize bridge
        bridge = new window.ConfiguratorBridge();
        bridge.init(iframe, {
            debug: DEBUG_MODE,
            onReady: () => {
                configReady = true;
                hideLoading();
                showReadyBadge();
                if (debugPanel) updateDebugPanel();
            },
            onConfigReceived: (config) => {
                if (debugPanel) updateDebugPanel();
                console.log('[CONFIGURATOR_PAGE] Config received:', config);
            },
            onError: (message, isWarning) => {
                if (isWarning) {
                    showWarning(message);
                } else {
                    showError(message);
                }
            }
        });
        
        // Global fallback: Hide loader after 2s
        setTimeout(() => {
            if (loadingOverlay && !configReady) {
                console.log('[CONFIGURATOR_PAGE] Fallback: Hiding loader after timeout');
                hideLoading();
            }
        }, 2000);
        
        function hideLoading() {
            if (loadingOverlay) {
                loadingOverlay.style.opacity = '0';
                setTimeout(() => {
                    loadingOverlay.classList.add('hidden');
                }, 400);
            }
            if (iframe) {
                iframe.classList.add('ready');
            }
        }
        
        function showReadyBadge() {
            readyBadge.textContent = '✓ Ready';
            readyBadge.style.background = '#065f46';
            readyBadge.style.color = '#d1fae5';
        }
        
        function showWarning(message) {
            if (errorContainer) {
                errorContainer.style.display = 'block';
                errorContainer.style.background = '#854d0e';
                errorContainer.querySelector('#error-message').textContent = '⚠️ ' + message;
            }
        }
        
        function showError(message) {
            if (errorContainer) {
                errorContainer.style.display = 'block';
                errorContainer.style.background = '#991b1b';
                errorContainer.querySelector('#error-message').textContent = '❌ ' + message;
            }
        }
        
        function createReadyBadge() {
            const badge = document.createElement('div');
            badge.id = 'ready-badge';
            badge.textContent = '⏳ Loading...';
            badge.style.cssText = `
                position: fixed;
                top: 80px;
                right: 20px;
                padding: 8px 16px;
                background: #854d0e;
                color: #fef3c7;
                border-radius: 6px;
                font-size: 13px;
                font-weight: 600;
                z-index: 9999;
                box-shadow: 0 4px 12px rgba(0,0,0,0.2);
            `;
            document.body.appendChild(badge);
            return badge;
        }
        
        function createDebugPanel() {
            const panel = document.createElement('div');
            panel.id = 'debug-panel';
            panel.style.cssText = `
                position: fixed;
                bottom: 100px;
                right: 20px;
                width: 350px;
                max-height: 400px;
                background: #1a1a1a;
                border: 2px solid #0891b2;
                border-radius: 8px;
                padding: 12px;
                font-family: monospace;
                font-size: 11px;
                color: #d4f1f1;
                overflow-y: auto;
                z-index: 9999;
                box-shadow: 0 4px 20px rgba(0,0,0,0.4);
            `;
            panel.innerHTML = `
                <div style="font-weight: 700; margin-bottom: 8px; color: #0891b2;">🔧 Debug Panel</div>
                <div id="debug-content"></div>
            `;
            document.body.appendChild(panel);
            return panel;
        }
        
        function updateDebugPanel() {
            if (!debugPanel) return;
            
            const config = bridge.getLastConfig();
            const content = debugPanel.querySelector('#debug-content');
            
            content.innerHTML = `
                <div style="margin: 4px 0;"><strong>Ready:</strong> ${bridge.isReady() ? '✓' : '✗'}</div>
                <div style="margin: 4px 0;"><strong>Last Config:</strong></div>
                ${config ? `
                    <div style="margin-left: 12px; margin-top: 4px;">
                        <div><strong>Colors:</strong></div>
                        <div style="margin-left: 12px;">
                            Base: ${config.colors.base}<br>
                            Top: ${config.colors.top}<br>
                            Middle: ${config.colors.middle}
                        </div>
                        <div style="margin-top: 4px;"><strong>Finish:</strong> ${config.finish}</div>
                        <div><strong>Received:</strong> ${bridge.lastReceivedAt ? new Date(bridge.lastReceivedAt).toLocaleTimeString() : 'never'}</div>
                        <div><strong>Reason:</strong> ${bridge.lastReason || 'unknown'}</div>
                    </div>
                ` : '<div style="margin-left: 12px; color: #94a3b8;">No config yet</div>'}
            `;
        }
        
        // Cleanup on page hide
        window.addEventListener('pagehide', () => {
            if (bridge) {
                bridge.destroy();
            }
        });
    });
    
    // Export bridge reference for button handler
    window.getConfiguratorBridge = () => bridge;
    
})(); // End IIFE
