/**
 * UNBREAK ONE - iFrame Language Bridge
 * Communicates language changes from homepage to 3D configurator iframe
 */

(function() {
  'use strict';

  // Configuration
  const CONFIGURATOR_IFRAME_ID = 'configurator-iframe';
  const CONFIGURATOR_ORIGIN = 'https://unbreak-3-d-konfigurator.vercel.app';
  
  let iframe = null;
  let currentLang = 'de';

  /**
   * Get current language from i18n system
   */
  function getCurrentLanguage() {
    if (window.i18n && typeof window.i18n.getCurrentLanguage === 'function') {
      return window.i18n.getCurrentLanguage();
    }
    // Fallback to localStorage
    return localStorage.getItem('preferredLanguage') || 'de';
  }

  /**
   * Send language to iframe via postMessage
   */
  function sendLanguageToIframe(lang) {
    if (!iframe || !iframe.contentWindow) {
      console.warn('[iFrame Bridge] iframe not ready');
      return;
    }

    const message = {
      type: 'SET_LOCALE',
      locale: lang,
      timestamp: Date.now()
    };

    console.log('[iFrame Bridge] Sending language to iframe:', lang);
    iframe.contentWindow.postMessage(message, CONFIGURATOR_ORIGIN);
    currentLang = lang;
  }

  /**
   * Update iframe src with language parameter
   */
  function updateIframeSrc(lang) {
    if (!iframe) return;

    const currentSrc = iframe.src || CONFIGURATOR_ORIGIN;
    const url = new URL(currentSrc);
    
    // Update or add lang parameter
    url.searchParams.set('lang', lang);
    
    // Only update if changed
    if (iframe.src !== url.toString()) {
      console.log('[iFrame Bridge] Updating iframe src with lang:', lang);
      iframe.src = url.toString();
    }
  }

  /**
   * Initialize iframe with current language
   */
  function initializeIframe() {
    iframe = document.getElementById(CONFIGURATOR_IFRAME_ID);
    
    if (!iframe) {
      console.warn('[iFrame Bridge] Configurator iframe not found, retrying...');
      setTimeout(initializeIframe, 500);
      return;
    }

    currentLang = getCurrentLanguage();
    console.log('[iFrame Bridge] Initializing with language:', currentLang);

    // Update src with language parameter
    updateIframeSrc(currentLang);

    // Send language when iframe loads
    iframe.addEventListener('load', function() {
      console.log('[iFrame Bridge] iframe loaded, sending language');
      setTimeout(() => sendLanguageToIframe(currentLang), 100);
    });

    // Listen for language changes from i18n system
    window.addEventListener('i18nLanguageChanged', function(e) {
      const newLang = e.detail?.lang || getCurrentLanguage();
      console.log('[iFrame Bridge] Language changed to:', newLang);
      sendLanguageToIframe(newLang);
    });

    // Listen for custom events (fallback)
    document.addEventListener('languageChanged', function(e) {
      const newLang = e.detail?.language || e.detail?.lang || getCurrentLanguage();
      console.log('[iFrame Bridge] Language changed (custom event):', newLang);
      sendLanguageToIframe(newLang);
    });

    // Listen for ACK from iframe (optional)
    window.addEventListener('message', function(event) {
      if (event.origin !== CONFIGURATOR_ORIGIN) return;
      
      if (event.data && event.data.type === 'LOCALE_ACK') {
        console.log('[iFrame Bridge] Received ACK from iframe:', event.data.locale);
      }
    });

    // Send initial language after short delay (ensure iframe is ready)
    setTimeout(() => sendLanguageToIframe(currentLang), 500);
  }

  /**
   * Initialize when DOM is ready
   */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeIframe);
  } else {
    initializeIframe();
  }

  // Expose API for manual triggering
  window.iframeBridge = {
    setLanguage: sendLanguageToIframe,
    getCurrentLanguage: () => currentLang
  };

})();
