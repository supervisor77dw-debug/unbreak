/**
 * Production-safe logger
 * Logs are only output in development mode
 * In production, all logs are suppressed except console.error
 */

const isDevelopment = process.env.NODE_ENV !== 'production';

export const logger = {
  log: (...args) => {
    if (isDevelopment) {
      console.log(...args);
    }
  },

  debug: (...args) => {
    if (isDevelopment) {
      console.debug(...args);
    }
  },

  info: (...args) => {
    if (isDevelopment) {
      console.info(...args);
    }
  },

  warn: (...args) => {
    if (isDevelopment) {
      console.warn(...args);
    }
  },

  error: (...args) => {
    // Always log errors, even in production
    console.error(...args);
  },
};

// Client-side logger (for public/ files without process.env)
export const clientLogger = {
  log: (...args) => {
    if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
      console.log(...args);
    }
  },

  debug: (...args) => {
    if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
      console.debug(...args);
    }
  },

  info: (...args) => {
    if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
      console.info(...args);
    }
  },

  warn: (...args) => {
    if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
      console.warn(...args);
    }
  },

  error: (...args) => {
    // Always log errors
    console.error(...args);
  },
};

export default logger;
