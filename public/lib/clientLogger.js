/**
 * Client-side production-safe logger
 * Only logs in development (localhost)
 * For use in public/ files (browser-only)
 */

const isLocalhost = typeof window !== 'undefined' && 
  (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

window.clientLogger = {
  log: (...args) => {
    if (isLocalhost) {
      console.log(...args);
    }
  },

  debug: (...args) => {
    if (isLocalhost) {
      console.debug(...args);
    }
  },

  info: (...args) => {
    if (isLocalhost) {
      console.info(...args);
    }
  },

  warn: (...args) => {
    if (isLocalhost) {
      console.warn(...args);
    }
  },

  error: (...args) => {
    // Always log errors
    console.error(...args);
  },
};
