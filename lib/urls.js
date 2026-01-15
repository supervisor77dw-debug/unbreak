/**
 * URL Configuration - Single Source of Truth
 * 
 * All URLs should be generated from environment variables
 * NO hardcoded URLs (especially no vercel.app)
 */

/**
 * Get base site URL (shop/homepage)
 * @returns {string} Base URL
 */
export function getSiteUrl() {
  // Server-side: use ENV
  if (typeof window === 'undefined') {
    return process.env.NEXT_PUBLIC_SITE_URL || 'https://unbreak-one.com';
  }
  
  // Client-side: build from current hostname
  const protocol = window.location.protocol;
  const hostname = window.location.hostname;
  const port = window.location.port;
  
  // Production domain
  if (hostname === 'unbreak-one.com' || hostname === 'www.unbreak-one.com') {
    return 'https://unbreak-one.com';
  }
  
  // Preview/staging deployments
  if (hostname.includes('vercel.app')) {
    return `${protocol}//${hostname}`;
  }
  
  // Local development
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return port ? `${protocol}//${hostname}:${port}` : `${protocol}//${hostname}`;
  }
  
  // Fallback
  return process.env.NEXT_PUBLIC_SITE_URL || `${protocol}//${hostname}`;
}

/**
 * Get configurator URL
 * @returns {string} Configurator base URL
 */
export function getConfiguratorUrl() {
  return process.env.NEXT_PUBLIC_CONFIGURATOR_DOMAIN || 
         process.env.NEXT_PUBLIC_CONFIGURATOR_URL ||
         'https://unbreak-3-d-konfigurator.vercel.app';
}

/**
 * Get shop URL (for configurator return)
 * @returns {string} Shop URL
 */
export function getShopUrl() {
  return `${getSiteUrl()}/shop`;
}

/**
 * Get cart URL
 * @returns {string} Cart URL
 */
export function getCartUrl() {
  return `${getSiteUrl()}/cart`;
}

/**
 * Get admin URL
 * @returns {string} Admin base URL
 */
export function getAdminUrl() {
  return `${getSiteUrl()}/admin`;
}

/**
 * Build full URL with path
 * @param {string} path - Path (e.g., '/shop', '/cart')
 * @returns {string} Full URL
 */
export function buildUrl(path) {
  const base = getSiteUrl();
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${base}${cleanPath}`;
}

/**
 * Build configurator URL with params
 * @param {string} lang - Language (de, en)
 * @param {string} [returnUrl] - Optional return URL
 * @returns {string} Configurator URL with params
 */
export function buildConfiguratorUrl(lang = 'de', returnUrl = null) {
  const configBase = getConfiguratorUrl();
  const finalReturn = returnUrl || getShopUrl();
  const encoded = encodeURIComponent(finalReturn);
  
  return `${configBase}/?lang=${lang}&return=${encoded}`;
}

/**
 * Check if we're in preview/development mode
 * @returns {boolean}
 */
export function isPreviewMode() {
  if (typeof window === 'undefined') {
    return process.env.NODE_ENV !== 'production';
  }
  
  return window.location.hostname.includes('vercel.app') ||
         window.location.hostname === 'localhost' ||
         window.location.hostname === '127.0.0.1';
}

/**
 * Check if we're in production
 * @returns {boolean}
 */
export function isProduction() {
  if (typeof window === 'undefined') {
    return process.env.NODE_ENV === 'production';
  }
  
  return window.location.hostname === 'unbreak-one.com' ||
         window.location.hostname === 'www.unbreak-one.com';
}
