/**
 * Single source-of-truth for building configurator URLs
 * 
 * All configurator links in the app should use this function
 * to ensure consistent URL building and routing.
 */

const CONFIGURATOR_BASE_URL = 
  process.env.NEXT_PUBLIC_CONFIGURATOR_DOMAIN || 
  'https://unbreak-3-d-konfigurator.vercel.app';

const DEFAULT_RETURN_URL = 
  process.env.NEXT_PUBLIC_SHOP_URL || 
  'https://unbreak-one.vercel.app/shop';

/**
 * Build configurator URL with language and return URL
 * 
 * @param {string} lang - Language code (de, en)
 * @param {string} [returnUrl] - Optional return URL (defaults to /shop)
 * @returns {string} Full configurator URL with query params
 */
export function buildConfiguratorUrl(lang = 'de', returnUrl = null) {
  const finalReturnUrl = returnUrl || DEFAULT_RETURN_URL;
  const encodedReturn = encodeURIComponent(finalReturnUrl);
  
  return `${CONFIGURATOR_BASE_URL}/?lang=${lang}&return=${encodedReturn}`;
}

/**
 * Get current language from i18n
 * Falls back to 'de' if i18n is not available
 * 
 * @returns {string} Current language code
 */
export function getCurrentLanguage() {
  if (typeof window === 'undefined') return 'de';
  
  // Try to get from i18n
  if (window.i18n?.getCurrentLanguage) {
    return window.i18n.getCurrentLanguage();
  }
  
  // Fallback to 'de'
  return 'de';
}

/**
 * Navigate to configurator in same tab
 * 
 * @param {string} [lang] - Optional language override
 * @param {string} [returnUrl] - Optional return URL override
 */
export function navigateToConfigurator(lang = null, returnUrl = null) {
  // Only run in browser
  if (typeof window === 'undefined') return;
  
  const currentLang = lang || getCurrentLanguage();
  const configUrl = buildConfiguratorUrl(currentLang, returnUrl);
  
  // Debug logging (only in dev/preview)
  const isDev = process.env.NODE_ENV === 'development' || 
                window.location.hostname.includes('vercel.app');
  
  if (isDev) {
    console.log('[NAV] Configurator click -> resolvedUrl=', configUrl);
    console.log('[NAV] external=true');
  }
  
  // Same-tab navigation
  window.location.assign(configUrl);
}

/**
 * Create click handler for configurator links
 * Use this in onClick handlers
 * 
 * @param {string} [lang] - Optional language override
 * @param {string} [returnUrl] - Optional return URL override
 * @returns {Function} Click handler function
 */
export function createConfiguratorClickHandler(lang = null, returnUrl = null) {
  return (e) => {
    e.preventDefault();
    navigateToConfigurator(lang, returnUrl);
  };
}

// For backward compatibility
export default {
  buildConfiguratorUrl,
  getCurrentLanguage,
  navigateToConfigurator,
  createConfiguratorClickHandler,
};
