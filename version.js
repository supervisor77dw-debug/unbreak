/**
 * UNBREAK ONE - Version & Cache Management
 * Ensures users always get the latest code, especially on mobile
 */

(function() {
  'use strict';

  // Version tracking
  const CURRENT_VERSION = '2.0.0'; // Update this on each deploy
  const VERSION_KEY = 'unbreakone_version';
  const CACHE_CLEARED_KEY = 'unbreakone_cache_cleared';

  /**
   * Check if this is a new version and clear cache if needed
   */
  function checkVersion() {
    const storedVersion = localStorage.getItem(VERSION_KEY);
    const cacheCleared = sessionStorage.getItem(CACHE_CLEARED_KEY);

    // New version detected or first visit
    if (storedVersion !== CURRENT_VERSION && !cacheCleared) {
      console.log(`🔄 Version update detected: ${storedVersion || 'none'} → ${CURRENT_VERSION}`);
      
      // Clear localStorage (except language preference)
      const lang = localStorage.getItem('unbreakone_lang');
      localStorage.clear();
      if (lang) {
        localStorage.setItem('unbreakone_lang', lang);
      }
      localStorage.setItem(VERSION_KEY, CURRENT_VERSION);
      
      // Mark cache as cleared for this session
      sessionStorage.setItem(CACHE_CLEARED_KEY, '1');
      
      // Force reload to get fresh assets
      if (storedVersion) {
        console.log('🔄 Reloading page to clear cache...');
        window.location.reload(true); // Hard reload
        return;
      }
    }

    // Store current version
    if (storedVersion !== CURRENT_VERSION) {
      localStorage.setItem(VERSION_KEY, CURRENT_VERSION);
    }
  }

  /**
   * Clean up any old debug elements that might be in the DOM
   * from cached scripts
   */
  function cleanupOldDebugElements() {
    // Remove any elements with debug-related classes
    const selectors = [
      '.i18n-debug-indicator',
      '.i18n-debug-badge',
      '.debug-badge',
      '.content-ok-badge',
      '[id*="debug-badge"]',
      '[class*="i18n-debug"]'
    ];

    selectors.forEach(selector => {
      try {
        const elements = document.querySelectorAll(selector);
        elements.forEach(el => {
          // Only remove if it's a debug element, not part of configurator
          if (!el.closest('#debug-log') && !el.id?.includes('debug-log')) {
            el.remove();
            console.log('🧹 Removed old debug element:', selector);
          }
        });
      } catch (e) {
        // Ignore errors from invalid selectors
      }
    });
  }

  /**
   * Detect production environment
   */
  function isProduction() {
    return window.location.hostname !== 'localhost' 
        && window.location.hostname !== '127.0.0.1'
        && !window.location.hostname.includes('local');
  }

  /**
   * Check if debug mode is explicitly enabled
   */
  function isDebugMode() {
    const urlParams = new URLSearchParams(window.location.search);
    const hasDebugParam = urlParams.has('debug');
    const hasDebugStorage = localStorage.getItem('U1_DEBUG') === '1';
    
    return hasDebugParam || hasDebugStorage;
  }

  /**
   * Initialize version check
   */
  function init() {
    // Log current version
    const env = isProduction() ? 'PRODUCTION' : 'DEVELOPMENT';
    const debug = isDebugMode() ? ' [DEBUG ENABLED]' : '';
    console.log(`🚀 UNBREAK ONE v${CURRENT_VERSION} (${env})${debug}`);

    // Check version and clear cache if needed
    checkVersion();

    // Clean up old debug elements
    if (isProduction() && !isDebugMode()) {
      cleanupOldDebugElements();
      
      // Re-check every 2 seconds for the first 10 seconds
      // to catch any elements added by cached scripts
      let checkCount = 0;
      const cleanupInterval = setInterval(() => {
        cleanupOldDebugElements();
        checkCount++;
        if (checkCount >= 5) {
          clearInterval(cleanupInterval);
        }
      }, 2000);
    }
  }

  // Run on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Expose version info globally
  window.UNBREAKONE_VERSION = CURRENT_VERSION;
  window.UNBREAKONE_IS_DEBUG = isDebugMode();
  window.UNBREAKONE_IS_PROD = isProduction();

})();
