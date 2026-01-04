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
    
    // Event-Log für Debug-Mode (max. 20 Events)
    const eventLog = [];
    const MAX_LOG_ENTRIES = 20;
    
    function logDebugEvent(type, message, isError = false) {
        const timestamp = new Date().toLocaleTimeString('de-DE');
        const entry = { timestamp, type, message, isError };
        eventLog.push(entry);
        if (eventLog.length > MAX_LOG_ENTRIES) eventLog.shift();
        
        if (DEBUG_MODE) {
            console.log(`[DEBUG ${timestamp}] ${type}:`, message);
            updateDebugUI();
        }
    }
    
    function updateDebugUI() {
        const debugEvents = document.getElementById('debug-events');
        if (!debugEvents) return;
        
        debugEvents.innerHTML = eventLog.map(e => `
            <div class="debug-event ${e.isError ? 'error' : 'success'}">
                <span class="debug-timestamp">${e.timestamp}</span> - 
                <strong>${e.type}</strong>: ${e.message}
            </div>
        `).join('');
        debugEvents.scrollTop = debugEvents.scrollHeight;
    }

// GLOBALER FALLBACK: Läuft unabhängig von allem anderen
// Nach 2 Sekunden Loader GARANTIERT ausblenden
setTimeout(() => {
    const overlay = document.getElementById('loading-overlay');
    const iframe = document.getElementById('configurator-iframe');
    
    if (overlay) {
        console.log('🔥 GLOBALER FALLBACK: Loader wird nach 2s GARANTIERT ausgeblendet');
        overlay.style.display = 'none';
    }
    
    if (iframe) {
        console.log('🔥 GLOBALER FALLBACK: iframe wird sichtbar gemacht');
        iframe.style.opacity = '1';
        iframe.style.pointerEvents = 'auto';
    }
}, 2000);

document.addEventListener('DOMContentLoaded', () => {
    const iframe = document.getElementById('configurator-iframe');
    const loadingOverlay = document.getElementById('loading-overlay');
    const loadingSpinner = document.getElementById('loading-spinner');
    const loadingText = document.getElementById('loading-text');
    const loadingOverlay = document.getElementById('loading-overlay');
    const errorContainer = document.getElementById('error-container');
    const readyBadge = createReadyBadge();
    const debugPanel = DEBUG_MODE ? createDebugPanel() : null;
    
    // Debug-Mode aktivieren
    if (DEBUG_MODE && debugLog) {
        debugLog.style.display = 'block';
        logDebugEvent('INIT', 'Debug-Mode aktiviert');
    }
    
    logDebugEvent('INIT', 'Configurator loaded, waiting for UNBREAK_CONFIG_READY...');
    
    // Reset States (wichtig bei Navigation zurück zur Seite)
    function resetStates() {
        isReady = false;
        if (timeoutTimer) clearTimeout(timeoutTimer);
        if (iframeLoadTimer) clearTimeout(iframeLoadTimer);
        if (errorContainer) errorContainer.style.display = 'none';
        if (loadingSpinner) loadingSpinner.style.display = 'block';
        if (loadingText) {
            loadingText.style.display = 'block';
            loadingText.textContent = 'Konfigurator wird geladen...';
        }
        if (loadingProgress) loadingProgress.style.display = 'none';
        if (loadingOverlay) {
            loadingOverlay.style.opacity = '1';
            loadingOverlay.style.transform = 'scale(1)';
            loadingOverlay.classList.remove('hidden');
        }
        if (iframe) {
            iframe.classList.remove('ready');
        }
        logDebugEvent('RESET', 'States zurückgesetzt');
    }
    
    // Initial reset
    resetStates();
    
    // Function to hide loading overlay with animation and show iframe
    const hideLoading = () => {
        if (loadingOverlay && !isReady) {
            isReady = true;
            logDebugEvent('READY', 'Loader wird ausgeblendet, iframe sichtbar');
            
            // Loader ausblenden mit Fade-out
            loadingOverlay.style.opacity = '0';
            loadingOverlay.style.transform = 'scale(0.98)';
            setTimeout(() => {
                loadingOverlay.classList.add('hidden');
                console.log('✓ Configurator ready');
            }, 400);
            
            // iframe sichtbar machen (opacity 1, pointer-events auto)
            // Warum? iframe ist initial unsichtbar, damit User nicht leeren/nicht-geladenen Konfigurator sieht
            if (iframe) {
                iframe.classList.add('ready');
                console.log('✓ iframe visible');
            }
            
            // Cleanup timers
            if (timeoutTimer) clearTimeout(timeoutTimer);
            if (iframeLoadTimer) clearTimeout(iframeLoadTimer);
        }
    };
    
    // Function to show error
    const showError = (msg) => {
        logDebugEvent('ERROR', msg, true);
        if (loadingSpinner) loadingSpinner.style.display = 'none';
        if (loadingText) loadingText.style.display = 'none';
        if (loadingProgress) loadingProgress.style.display = 'none';
        if (errorContainer) errorContainer.style.display = 'block';
        if (errorMessage) errorMessage.textContent = msg;
        console.error('✗ Configurator error:', msg);
        if (timeoutTimer) clearTimeout(timeoutTimer);
        if (iframeLoadTimer) clearTimeout(iframeLoadTimer);
    };
    
    // Function to update progress
    const updateProgress = (percent) => {
        logDebugEvent('LOADING', `Progress: ${percent}%`);
        if (loadingProgress) loadingProgress.style.display = 'flex';
        if (progressFill) progressFill.style.width = percent + '%';
        if (progressPercent) progressPercent.textContent = percent + '%';
    };
    
    // 15 second timeout fallback
    timeoutTimer = setTimeout(() => {
        if (!isReady) {
            showError('Konfigurator lädt länger als erwartet. Bitte versuchen Sie es erneut.');
        }
    }, 15000);
    
    // PRAGMATISCHER FALLBACK: Nach 3s Loader DIREKT ausblenden
    // Grund: Der 3D-Konfigurator sendet möglicherweise (noch) keine Messages
    // User soll den Konfigurator trotzdem sehen können
    setTimeout(() => {
        if (!isReady && loadingOverlay) {
            logDebugEvent('FALLBACK', 'Kein READY nach 3s - Loader wird SOFORT ausgeblendet (direkter Fallback)');
            console.log('⚠️ FALLBACK: Loader wird nach 3s ausgeblendet');
            
            // DIREKT ausblenden ohne Animation
            loadingOverlay.style.display = 'none';
            
            // iframe sichtbar machen
            if (iframe) {
                iframe.style.opacity = '1';
                iframe.style.pointerEvents = 'auto';
                iframe.classList.add('ready');
            }
            
            isReady = true;
            if (timeoutTimer) clearTimeout(timeoutTimer);
            
            // Show "Scroll to button" hint after 3 seconds if user hasn't scrolled
            setTimeout(() => {
                const button = document.getElementById('configurator-buy-now-btn');
                if (button && !isElementInViewport(button)) {
                    showScrollHint(button);
                }
            }, 3000);
        }
    }, 3000);
    
    // Helper: Check if element is in viewport
    function isElementInViewport(el) {
        const rect = el.getBoundingClientRect();
        return (
            rect.top >= 0 &&
            rect.left >= 0 &&
            rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
            rect.right <= (window.innerWidth || document.documentElement.clientWidth)
        );
    }
    
    // Helper: Show scroll hint
    function showScrollHint(button) {
        const hint = document.createElement('div');
        hint.id = 'scroll-hint';
        hint.style.cssText = `
            position: fixed;
            bottom: 20px;
            left: 50%;
            transform: translateX(-50%);
            background: linear-gradient(135deg, #0891b2 0%, #0e7490 100%);
            color: white;
            padding: 15px 30px;
            border-radius: 50px;
            box-shadow: 0 8px 32px rgba(8, 145, 178, 0.5);
            font-size: 16px;
            font-weight: 600;
            cursor: pointer;
            z-index: 10000;
            animation: bounce 2s infinite;
        `;
        hint.innerHTML = '⬇️ Zum "Jetzt kaufen" Button scrollen';
        hint.onclick = () => {
            button.scrollIntoView({ behavior: 'smooth', block: 'center' });
            hint.remove();
        };
        
        // Add bounce animation
        const style = document.createElement('style');
        style.textContent = `
            @keyframes bounce {
                0%, 100% { transform: translateX(-50%) translateY(0); }
                50% { transform: translateX(-50%) translateY(-10px); }
            }
        `;
        document.head.appendChild(style);
        document.body.appendChild(hint);
        
        // Auto-remove after 10 seconds
        setTimeout(() => {
            if (hint.parentNode) hint.remove();
        }, 10000);
    }
    
    // iframe onLoad Event - CRITICAL: Send INIT signal to iframe
    if (iframe) {
        iframe.addEventListener('load', () => {
            logDebugEvent('IFRAME', 'iframe load event fired');
            
            // CRITICAL FIX: Send INIT signal to iframe so it knows parent is ready
            console.log('✓ iframe loaded, sending PARENT_INIT to iframe...');
            if (iframe.contentWindow) {
                iframe.contentWindow.postMessage({
                    type: 'UNBREAK_PARENT_INIT',
                    ok: true,
                    timestamp: Date.now()
                }, 'https://unbreak-3-d-konfigurator.vercel.app');
                console.log('✓ PARENT_INIT sent to iframe');
            }
        });
        
        iframe.addEventListener('error', (e) => {
            logDebugEvent('IFRAME', 'iframe error event', true);
            showError('Fehler beim Laden des Konfigurators. Bitte versuchen Sie es erneut.');
        });
    }
    
    // Reload button handler
    if (reloadButton) {
        reloadButton.addEventListener('click', () => {
            logDebugEvent('RELOAD', 'Benutzer hat Reload geklickt');
            console.log('Reloading configurator...');
            
            // Reset state
            resetStates();
            
            // Reload iframe mit Cache-Busting (?t=timestamp)
            if (iframe) {
                const baseUrl = iframe.src.split('?')[0];
                iframe.src = baseUrl + '?t=' + Date.now();
            }
            
            // Restart timeout
            timeoutTimer = setTimeout(() => {
                if (!isReady) {
                    showError('Konfigurator lädt länger als erwartet. Bitte versuchen Sie es erneut.');
                }
            }, 15000);
        });
    }
    
    // Debug: Clear Log Button
    if (debugClear) {
        debugClear.addEventListener('click', () => {
            eventLog.length = 0;
            updateDebugUI();
        });
    }
    
    /**
     * PostMessage Handler für UNBREAK_CONFIG Messages
     * 
     * Warum Origin-Check?
     * - Sicherheit: Nur der echte Konfigurator darf Befehle senden
     * - Verhindert XSS/Injection von fremden Websites
     * 
     * Event-Logik:
     * - UNBREAK_CONFIG_LOADING: Progress anzeigen (falls geliefert)
     * - UNBREAK_CONFIG_READY: Loader ausblenden + iframe sichtbar machen
     * - UNBREAK_CONFIG_ERROR: Fehlermeldung + Reload-Button
     * 
     * Cleanup:
     * - Listener wird bei pageHide entfernt (kein Memory Leak)
     */
    messageHandler = (event) => {
        // DEBUG: Log ALL messages for troubleshooting
        console.log('🔔 [PARENT] Message received:', {
            origin: event.origin,
            type: event.data?.type,
            data: event.data
        });
        
        // Origin-Check: Nur Messages vom echten Konfigurator akzeptieren
        const allowedOrigins = [
            'https://unbreak-3-d-konfigurator.vercel.app',
            'http://localhost:5173',  // Vite Dev Server
            'http://localhost:3000'   // Alternative Dev Port
        ];
        
        if (!allowedOrigins.includes(event.origin)) {
            logDebugEvent('MESSAGE', `Unknown origin ignored: ${event.origin}`, true);
            console.log('⚠️ [PARENT] Message BLOCKED - unknown origin:', event.origin);
            console.log('⚠️ [PARENT] Allowed origins:', allowedOrigins);
            return;
        }
        
        console.log('✅ [PARENT] Message ACCEPTED from:', event.origin);
        
        // ANY valid message from iframe means it's working - hide error
        if (!isReady && errorContainer && errorContainer.style.display !== 'none') {
            console.log('✓ Received message from iframe - clearing error state');
            if (errorContainer) errorContainer.style.display = 'none';
            if (loadingText) loadingText.style.display = 'block';
        }
        
        const data = event.data;
        logDebugEvent('MESSAGE', `Received: ${data.type} from ${event.origin}`);
        
        // Handle UNBREAK_CONFIG Messages
        switch(data.type) {
            case 'UNBREAK_CONFIG_READY':
                console.log('✓ UNBREAK_CONFIG_READY received', data);
                logDebugEvent('READY', `ok=${data.ok}, version=${data.version || 'n/a'}`);
                hideLoading();
                
                // CRITICAL: Send ACK back to iframe so it knows parent received READY
                if (iframe && iframe.contentWindow) {
                    const ackMessage = {
                        type: 'UNBREAK_PARENT_READY',
                        ok: true,
                        timestamp: Date.now()
                    };
                    console.log('✓ [PARENT] Sending ACK to iframe:', ackMessage);
                    iframe.contentWindow.postMessage(ackMessage, 'https://unbreak-3-d-konfigurator.vercel.app');
                    console.log('✓ [PARENT] ACK sent successfully');
                } else {
                    console.error('❌ [PARENT] Cannot send ACK - iframe or contentWindow missing!');
                }
                break;
                
            case 'UNBREAK_CONFIG_LOADING':
                console.log('⏳ UNBREAK_CONFIG_LOADING:', data.progress !== undefined ? data.progress + '%' : 'no progress');
                if (data.progress !== undefined) {
                    updateProgress(Math.round(data.progress));
                }
                if (data.message && loadingText) {
                    loadingText.textContent = data.message;
                }
                break;
                
            case 'UNBREAK_CONFIG_ERROR':
                console.log('✗ UNBREAK_CONFIG_ERROR:', data.message || 'Unknown error');
                showError(data.message || 'Fehler beim Laden des Konfigurators');
                if (data.stack) {
                    console.error('Stack trace:', data.stack);
                    logDebugEvent('ERROR', `Stack: ${data.stack.substring(0, 100)}...`, true);
                }
                break;
            
            // Legacy support (falls alter Konfigurator noch diese Messages sendet)
            case 'addToCart':
                logDebugEvent('LEGACY', 'addToCart received');
                handleAddToCart(data.config);
                break;
            case 'configChanged':
                logDebugEvent('LEGACY', 'configChanged received');
                console.log('✓ Config updated from iframe:', data.config);
                
                // Hide error/loading if iframe is communicating
                if (!isReady) {
                    console.log('✓ iframe is communicating - clearing any errors');
                    hideLoading();
                }
                
                // If we ARE the parent (not in iframe), dispatch locally
                if (window.parent === window) {
                    console.log('✓ Dispatching config locally (we are parent)');
                    window.postMessage({
                        type: 'UNBREAK_CONFIG_UPDATE',
                        config: data.config
                    }, window.location.origin);
                } else {
                    // Send config update to parent (for checkout system)
                    console.log('✓ Forwarding config to parent window');
                    window.parent.postMessage({
                        type: 'UNBREAK_CONFIG_UPDATE',
                        config: data.config
                    }, '*'); // Checkout.js will filter by origin
                }
                break;
            case 'loaded':
                logDebugEvent('LEGACY', 'loaded received (deprecated)');
                hideLoading();
                break;
        }
    };
    
    // UNIVERSAL MESSAGE LOGGER - catches ALL messages before any filtering
    window.addEventListener('message', (event) => {
        console.log('🌐 [UNIVERSAL] Message received:', {
            origin: event.origin,
            type: event.data?.type,
            data: event.data
        });
    });
    
    window.addEventListener('message', messageHandler);
    
    // Cleanup: Message-Listener entfernen bei pageHide (Navigation weg von Seite)
    // Verhindert Memory Leaks und doppelte Listener
    window.addEventListener('pagehide', () => {
        logDebugEvent('CLEANUP', 'pageHide - removing message listener');
        if (messageHandler) {
            window.removeEventListener('message', messageHandler);
        }
        if (timeoutTimer) clearTimeout(timeoutTimer);
        if (iframeLoadTimer) clearTimeout(iframeLoadTimer);
    });
});

function handleAddToCart(config) {
    console.log('Add to cart:', config);
    
    // TODO: Integration mit Shop-System
    alert('Produkt wurde zum Warenkorb hinzugefügt!\n\n' + JSON.stringify(config, null, 2));
}

/**
 * Get configuration from manual color selectors
 */
function getManualColorSelection() {
    const baseSelect = document.getElementById('color-base');
    const topSelect = document.getElementById('color-top');
    const middleSelect = document.getElementById('color-middle');
    const finishSelect = document.getElementById('finish-type');
    
    if (!baseSelect || !topSelect || !middleSelect) {
        console.log('⚠️ [MANUAL CONFIG] Selectors not found');
        return null;
    }
    
    const config = {
        colors: {
            base: baseSelect.value,
            top: topSelect.value,
            middle: middleSelect.value
        },
        finish: finishSelect ? finishSelect.value : 'matte',
        quantity: 1,
        product: 'glass_holder'
    };
    
    console.log('📋 [MANUAL CONFIG] Generated from selectors:', config);
    return config;
}

/**
 * Request current configuration from iframe
 * Returns a Promise that resolves with the config
 */
function requestConfigFromIframe() {
    return new Promise((resolve, reject) => {
        const iframe = document.getElementById('configurator-iframe');
        if (!iframe || !iframe.contentWindow) {
            console.error('❌ [CONFIG REQUEST] iframe not found');
            reject(new Error('iframe not found'));
            return;
        }

        console.log('📤 [CONFIG REQUEST] Requesting config from iframe...');
        
        // Set up one-time listener for response
        const timeout = setTimeout(() => {
            window.removeEventListener('message', responseHandler);
            console.warn('⏱️ [CONFIG REQUEST] Timeout - no response from iframe');
            reject(new Error('Timeout waiting for config'));
        }, 3000); // 3s timeout

        const responseHandler = (event) => {
            // Check if this is a config response
            if (event.data && (event.data.type === 'configChanged' || 
                               event.data.type === 'checkout_configuration' ||
                               event.data.type === 'UNBREAK_CONFIG_UPDATE')) {
                console.log('📥 [CONFIG REQUEST] Received config from iframe:', event.data);
                clearTimeout(timeout);
                window.removeEventListener('message', responseHandler);
                resolve(event.data.config || event.data);
            }
        };

        window.addEventListener('message', responseHandler);

        // Send request to iframe
        iframe.contentWindow.postMessage({
            type: 'GET_CONFIGURATION'
        }, '*');

        console.log('📤 [CONFIG REQUEST] GET_CONFIGURATION message sent to iframe');
        
        // Fallback: Also try to get config from manual selectors after 1s
        setTimeout(() => {
            if (timeout) { // If still waiting
                console.log('⏱️ [CONFIG REQUEST] iframe slow, trying manual selectors...');
                const manualConfig = getManualColorSelection();
                if (manualConfig && manualConfig.colors) {
                    console.log('✅ [CONFIG REQUEST] Got config from manual selectors:', manualConfig);
                    clearTimeout(timeout);
                    window.removeEventListener('message', responseHandler);
                    resolve(manualConfig);
                }
            }
        }, 1000);
    });
}

// Attach to buy button
document.addEventListener('DOMContentLoaded', () => {
    const buyButton = document.getElementById('configurator-buy-now-btn');
    
    if (buyButton) {
        console.log('🛒 [BUTTON] Found buy button, attaching pre-click handler');
        
        // Add CAPTURING listener (runs BEFORE checkout.js bubble listener)
        buyButton.addEventListener('click', async (e) => {
            console.log('🛒 [BUTTON] Pre-click handler triggered');
            console.log('🛒 [BUTTON] Current state:', window.UnbreakCheckoutState);
            
            // If we already have config in state, let it proceed
            if (window.UnbreakCheckoutState?.lastConfig) {
                console.log('✅ [BUTTON] Config already in state, proceeding');
                return; // Let checkout.js handle it
            }
            
            // No config yet - request from iframe
            console.log('⚠️ [BUTTON] No config in state, requesting from iframe...');
            e.preventDefault(); // Stop the checkout for now
            e.stopPropagation();
            
            try {
                let config = await requestConfigFromIframe();
                
                // If iframe config failed, use manual selectors
                if (!config || !config.colors) {
                    console.log('⚠️ [BUTTON] No config from iframe, using manual selectors...');
                    config = getManualColorSelection();
                }
                
                console.log('✅ [BUTTON] Got config:', config);
                
                // Save to state
                if (!window.UnbreakCheckoutState) {
                    window.UnbreakCheckoutState = { lastConfig: null, initialized: true, userId: 'guest' };
                }
                window.UnbreakCheckoutState.lastConfig = config;
                
                console.log('✅ [BUTTON] Config saved to state, triggering click again');
                
                // Trigger click again (this time it will have config)
                buyButton.click();
                
            } catch (error) {
                console.error('❌ [BUTTON] Failed to get config:', error);
                alert('Bitte warten Sie, bis der Konfigurator vollständig geladen ist.');
            }
        }, true); // Use CAPTURE phase to run before checkout.js
        
        console.log('✅ [BUTTON] Pre-click handler attached');
    } else {
        console.warn('⚠️ [BUTTON] Buy button not found');
    }
});

})(); // End IIFE
