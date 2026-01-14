/**
 * UNBREAK ONE - Debug Utilities
 * Central debug mode detection and logging
 * 
 * Usage:
 *   import { debugLog, debugWarn, IS_DEBUG_MODE } from '../lib/debugUtils';
 *   debugLog('shop', 'Cart initialized:', cart);
 *   if (IS_DEBUG_MODE) { ... }
 */

/**
 * Check if debug mode is enabled
 * Sources:
 * - URL param: ?debug=1
 * - Env var: NEXT_PUBLIC_DEBUG_UI=1
 * - LocalStorage: U1_DEBUG=1
 * - NODE_ENV !== production
 */
export const IS_DEBUG_MODE = (() => {
  if (typeof window === 'undefined') {
    // Server-side: check env only
    return process.env.NODE_ENV !== 'production' || process.env.NEXT_PUBLIC_DEBUG_UI === '1';
  }
  
  // Client-side: check all sources
  const urlParams = new URLSearchParams(window.location.search);
  const hasDebugParam = urlParams.get('debug') === '1';
  const hasDebugStorage = localStorage.getItem('U1_DEBUG') === '1';
  const hasDebugEnv = process.env.NEXT_PUBLIC_DEBUG_UI === '1';
  const isDev = process.env.NODE_ENV !== 'production';
  
  return hasDebugParam || hasDebugStorage || hasDebugEnv || isDev;
})();

/**
 * Debug log (only in debug mode)
 * @param {string} context - Context/module name (e.g., 'shop', 'cart', 'pricing')
 * @param {...any} args - Log arguments
 */
export function debugLog(context, ...args) {
  if (IS_DEBUG_MODE && typeof console !== 'undefined') {
    console.log(`[${context.toUpperCase()}]`, ...args);
  }
}

/**
 * Debug warn (only in debug mode)
 * @param {string} context - Context/module name
 * @param {...any} args - Log arguments
 */
export function debugWarn(context, ...args) {
  if (IS_DEBUG_MODE && typeof console !== 'undefined') {
    console.warn(`[${context.toUpperCase()}]`, ...args);
  }
}

/**
 * Debug info (only in debug mode)
 * @param {string} context - Context/module name
 * @param {...any} args - Log arguments
 */
export function debugInfo(context, ...args) {
  if (IS_DEBUG_MODE && typeof console !== 'undefined') {
    console.info(`[${context.toUpperCase()}]`, ...args);
  }
}

/**
 * Error log (ALWAYS shown, even in production)
 * Use for critical errors that need attention
 * @param {string} context - Context/module name
 * @param {...any} args - Log arguments
 */
export function errorLog(context, ...args) {
  if (typeof console !== 'undefined') {
    console.error(`[${context.toUpperCase()}]`, ...args);
  }
}

/**
 * Get debug status string for UI display
 */
export function getDebugStatus() {
  if (typeof window === 'undefined') return 'SSR';
  
  const sources = [];
  const urlParams = new URLSearchParams(window.location.search);
  
  if (urlParams.get('debug') === '1') sources.push('URL');
  if (localStorage.getItem('U1_DEBUG') === '1') sources.push('Storage');
  if (process.env.NEXT_PUBLIC_DEBUG_UI === '1') sources.push('Env');
  if (process.env.NODE_ENV !== 'production') sources.push('Dev');
  
  return sources.length > 0 ? `Debug: ${sources.join('+')}` : 'Production';
}

/**
 * Enable debug mode (stores in localStorage)
 */
export function enableDebugMode() {
  if (typeof window !== 'undefined') {
    localStorage.setItem('U1_DEBUG', '1');
    console.log('🔍 Debug mode ENABLED. Reload page to activate.');
  }
}

/**
 * Disable debug mode
 */
export function disableDebugMode() {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('U1_DEBUG');
    console.log('Debug mode disabled. Reload page to deactivate.');
  }
}
