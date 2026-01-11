/**
 * Configurator Navigation Helper for Static HTML Pages
 * 
 * Single source-of-truth for configurator navigation in non-React pages
 * Usage: Include this script and call navigateToConfigurator()
 */

(function() {
  'use strict';

  const CONFIGURATOR_BASE_URL = 'https://unbreak-3-d-konfigurator.vercel.app';
  const DEFAULT_RETURN_URL = 'https://unbreak-one.vercel.app/shop';

  /**
   * Build configurator URL with language and return URL
   */
  function buildConfiguratorUrl(lang, returnUrl) {
    lang = lang || 'de';
    returnUrl = returnUrl || DEFAULT_RETURN_URL;
    const encodedReturn = encodeURIComponent(returnUrl);
    return `${CONFIGURATOR_BASE_URL}/?lang=${lang}&return=${encodedReturn}`;
  }

  /**
   * Get current language from i18n
   */
  function getCurrentLanguage() {
    if (window.i18n && window.i18n.getCurrentLanguage) {
      return window.i18n.getCurrentLanguage();
    }
    return 'de';
  }

  /**
   * Navigate to configurator in same tab
   */
  function navigateToConfigurator(lang, returnUrl) {
    const currentLang = lang || getCurrentLanguage();
    const configUrl = buildConfiguratorUrl(currentLang, returnUrl);
    
    // Debug logging (only in dev/preview)
    const isDev = window.location.hostname === 'localhost' || 
                  window.location.hostname.includes('vercel.app');
    
    if (isDev) {
      console.log('[NAV] Configurator click -> resolvedUrl=', configUrl);
      console.log('[NAV] external=true');
    }
    
    // Same-tab navigation (no new window)
    window.location.assign(configUrl);
  }

  /**
   * Handle configurator link click
   */
  function handleConfiguratorClick(e) {
    if (e) {
      e.preventDefault();
    }
    
    const returnUrl = window.location.origin + '/shop';
    navigateToConfigurator(null, returnUrl);
  }

  /**
   * Initialize all configurator links on the page
   */
  function initConfiguratorLinks() {
    // Find all links that should navigate to configurator
    const links = document.querySelectorAll('a[href*="configurator"]');
    
    links.forEach(link => {
      // Remove any existing click handlers
      const newLink = link.cloneNode(true);
      link.parentNode.replaceChild(newLink, link);
      
      // Add our click handler
      newLink.addEventListener('click', handleConfiguratorClick);
      
      // Update href to prevent accidental navigation
      const currentLang = getCurrentLanguage();
      const returnUrl = window.location.origin + '/shop';
      newLink.href = buildConfiguratorUrl(currentLang, returnUrl);
    });
  }

  // Export to global scope
  window.navigateToConfigurator = navigateToConfigurator;
  window.handleConfiguratorClick = handleConfiguratorClick;
  window.buildConfiguratorUrl = buildConfiguratorUrl;

  // Auto-initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initConfiguratorLinks);
  } else {
    initConfiguratorLinks();
  }

  // Re-initialize when language changes
  window.addEventListener('languageChanged', initConfiguratorLinks);

})();
