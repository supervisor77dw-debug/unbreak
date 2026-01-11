/**
 * Shared Session Store for Config Session API
 * 
 * In-memory storage shared across all API routes
 * PRODUCTION: Replace with Vercel KV, Upstash Redis, or Database
 */

// Singleton session store
const sessionStore = new Map();
const TTL_MS = 45 * 60 * 1000; // 45 minutes

// Cleanup expired sessions every 10 minutes
const cleanupInterval = setInterval(() => {
  const now = Date.now();
  let cleaned = 0;
  
  for (const [cfgId, session] of sessionStore.entries()) {
    if (now > session.expiresAt) {
      sessionStore.delete(cfgId);
      cleaned++;
    }
  }
  
  if (cleaned > 0 && process.env.NODE_ENV !== 'production') {
    console.log('[SESSION_STORE] Cleaned up', cleaned, 'expired sessions');
  }
}, 10 * 60 * 1000);

// Prevent cleanup interval from keeping process alive
if (cleanupInterval.unref) {
  cleanupInterval.unref();
}

/**
 * Get session store instance
 */
export function getSessionStore() {
  return sessionStore;
}

/**
 * Get TTL in milliseconds
 */
export function getTTL() {
  return TTL_MS;
}

/**
 * Get store stats (for debugging)
 */
export function getStoreStats() {
  const now = Date.now();
  let active = 0;
  let expired = 0;
  
  for (const session of sessionStore.values()) {
    if (now > session.expiresAt) {
      expired++;
    } else {
      active++;
    }
  }
  
  return {
    total: sessionStore.size,
    active,
    expired,
  };
}
