/**
 * CORS Configuration for Config Session API
 * 
 * Handles cross-origin requests from configurator app
 * with proper preflight support and origin whitelisting.
 */

// Origin whitelist for configurator access
const ALLOWED_ORIGINS = [
  'https://unbreak-3-d-konfigurator.vercel.app',
  'https://config.unbreak-one.com', // Custom domain (when configured)
  'http://localhost:3001', // Local configurator dev
  'http://localhost:3000', // Local shop dev (for testing)
];

// Pattern for Vercel preview deployments (any branch/PR of configurator)
const PREVIEW_PATTERN = /^https:\/\/unbreak-.*-konfigurator.*\.vercel\.app$/;

/**
 * Check if origin is allowed
 */
function isOriginAllowed(origin) {
  if (!origin) return false;
  
  // Exact match from whitelist
  if (ALLOWED_ORIGINS.includes(origin)) {
    return true;
  }
  
  // ALWAYS allow Vercel preview deployments (not just in dev)
  // This is safe because we control the pattern
  if (PREVIEW_PATTERN.test(origin)) {
    return true;
  }
  
  return false;
}

/**
 * Apply CORS headers to response
 * @param {Object} req - Next.js request object
 * @param {Object} res - Next.js response object
 * @param {Object} options - CORS options
 */
export function applyCorsHeaders(req, res, options = {}) {
  const origin = req.headers.origin || req.headers.referer;
  
  // Always log CORS checks for debugging
  console.log('[CORS]', {
    method: req.method,
    origin: origin,
    allowed: isOriginAllowed(origin),
    path: req.url,
  });
  
  // Set CORS headers if origin is allowed
  if (isOriginAllowed(origin)) {
    // CRITICAL: Use exact origin, NOT wildcard (for credentials support)
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Vary', 'Origin'); // Cache control for proxies
  } else {
    // Log rejected origins for debugging
    console.warn('[CORS] Origin not allowed:', origin);
    res.setHeader('Access-Control-Allow-Origin', 'null');
  }
  
  // Standard CORS headers
  res.setHeader(
    'Access-Control-Allow-Methods',
    options.methods || 'GET, POST, DELETE, OPTIONS'
  );
  
  res.setHeader(
    'Access-Control-Allow-Headers',
    options.headers || 'Content-Type, Authorization, X-Requested-With'
  );
  
  // Cache preflight for 1 hour (3600 seconds)
  res.setHeader('Access-Control-Max-Age', '3600');
}

/**
 * Handle OPTIONS preflight request
 * @param {Object} req - Next.js request object
 * @param {Object} res - Next.js response object
 * @returns {boolean} - True if preflight was handled
 */
export function handlePreflight(req, res) {
  if (req.method === 'OPTIONS') {
    applyCorsHeaders(req, res);
    res.status(204).end(); // No content for preflight
    return true;
  }
  return false;
}

/**
 * Complete CORS middleware for API routes
 * Usage: if (handleCors(req, res)) return;
 */
export function handleCors(req, res, options = {}) {
  applyCorsHeaders(req, res, options);
  return handlePreflight(req, res);
}
