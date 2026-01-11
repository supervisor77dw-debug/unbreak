// Global Error Handler für Extension-Konflikte
// Füge dies in configurator.html VOR allen anderen Scripts ein

(function() {
  'use strict';
  
  // Suppress Chrome Extension async response errors
  const originalError = console.error;
  console.error = function(...args) {
    const errorMsg = args[0]?.toString() || '';
    
    // Filter bekannte Extension-Fehler
    if (errorMsg.includes('message channel closed') ||
        errorMsg.includes('asynchronous response')) {
      // In Debug Mode anzeigen, sonst unterdrücken
      if (window.__UNBREAK_BRIDGE_DEBUG__) {
        console.warn('[FILTERED] Extension error:', ...args);
      }
      return;
    }
    
    // Alle anderen Fehler normal loggen
    originalError.apply(console, args);
  };
  
  // Unhandled Promise Rejection Handler
  window.addEventListener('unhandledrejection', function(event) {
    const reason = event.reason?.toString() || '';
    
    if (reason.includes('message channel closed') ||
        reason.includes('asynchronous response')) {
      // Extension-Fehler: Unterdrücken in Production
      if (!window.__UNBREAK_BRIDGE_DEBUG__) {
        event.preventDefault();
      } else {
        console.warn('[FILTERED] Extension promise rejection:', event.reason);
      }
    }
  });
  
  console.log('[ERROR_FILTER] Chrome Extension error filter initialized');
})();
