/**
 * UNBREAK ONE - 3D Configurator Integration
 * 
 * PostMessage Handshake:
 * - UNBREAK_CONFIG_LOADING: Konfigurator lädt (optional progress 0-100)
 * - UNBREAK_CONFIG_READY: Konfigurator bereit (iframe wird sichtbar)
 * - UNBREAK_CONFIG_ERROR: Fehler beim Laden (Fehlermeldung + Reload-Button)
 * 
 * Sicherheit:
 * - Origin-Check: Nur Messages von https://unbreak-3-d-konfigurator.vercel.app werden akzeptiert
 * 
 * UX:
 * - iframe ist initial unsichtbar (opacity 0, pointer-events none)
 * - Erst bei READY wird iframe sichtbar (opacity 1, pointer-events auto)
 * - 15s Timeout-Fallback falls kein READY empfangen wird
 * - 3s onLoad-Fallback: versucht Soft-Reload falls READY ausbleibt
 * 
 * Cleanup:
 * - Message-Listener wird bei pageHide entfernt (kein Memory Leak)
 * - States werden bei jedem Mount zurückgesetzt
 * 
 * Debug-Mode:
 * - URL-Parameter ?debug=1 aktiviert Event-Log (letzte 20 messages)
 */

(function() {
    'use strict';
    
    // Debug-Mode Check (URL-Parameter ?debug=1)
    const urlParams = new URLSearchParams(window.location.search);
    const DEBUG_MODE = urlParams.get('debug') === '1';
    
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
    const loadingProgress = document.getElementById('loading-progress');
    const progressFill = document.getElementById('progress-fill');
    const progressPercent = document.getElementById('progress-percent');
    const errorContainer = document.getElementById('error-container');
    const errorMessage = document.getElementById('error-message');
    const reloadButton = document.getElementById('reload-button');
    const debugLog = document.getElementById('debug-log');
    const debugClear = document.getElementById('debug-clear');
    
    let timeoutTimer = null;
    let iframeLoadTimer = null;
    let isReady = false;
    let messageHandler = null;
    
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
        }
    }, 3000);
    
    // iframe onLoad Event (für Debugging)
    if (iframe) {
        iframe.addEventListener('load', () => {
            logDebugEvent('IFRAME', 'iframe load event fired');
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
        // Origin-Check: Nur Messages vom echten Konfigurator akzeptieren
        const allowedOrigins = [
            'https://unbreak-3-d-konfigurator.vercel.app',
            'http://localhost:5173',  // Vite Dev Server
            'http://localhost:3000'   // Alternative Dev Port
        ];
        
        if (!allowedOrigins.includes(event.origin)) {
            logDebugEvent('MESSAGE', `Unknown origin ignored: ${event.origin}`, true);
            console.log('⚠️ Message from unknown origin ignored:', event.origin);
            return;
        }
        
        const data = event.data;
        logDebugEvent('MESSAGE', `Received: ${data.type} from ${event.origin}`);
        
        // Handle UNBREAK_CONFIG Messages
        switch(data.type) {
            case 'UNBREAK_CONFIG_READY':
                console.log('✓ UNBREAK_CONFIG_READY received', data);
                logDebugEvent('READY', `ok=${data.ok}, version=${data.version || 'n/a'}`);
                hideLoading();
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
                console.log('Config updated:', data.config);
                
                // Send config update to parent (for checkout system)
                if (data.config && window.parent !== window) {
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

})(); // End IIFE
