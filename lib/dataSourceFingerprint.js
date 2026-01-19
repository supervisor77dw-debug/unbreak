/**
 * Data Source Fingerprint Logger
 * Logs which data sources are being used - WITHOUT exposing secrets
 * 
 * Purpose: Debug/verify that all routes use the same DB/Supabase instance
 */

/**
 * Extract host from URL string
 */
function extractHost(urlString) {
  if (!urlString) return '(not set)';
  try {
    const url = new URL(urlString);
    return url.host;
  } catch {
    // Maybe it's just a host without protocol
    return urlString.split('/')[0] || '(invalid)';
  }
}

/**
 * Extract DB host and name from DATABASE_URL
 * Format: postgresql://user:pass@host:port/dbname?...
 */
function extractDbInfo(dbUrl) {
  if (!dbUrl) return { host: '(not set)', name: '(not set)' };
  try {
    // Remove protocol
    const withoutProtocol = dbUrl.replace(/^[^:]+:\/\//, '');
    // Split by @ to get host part
    const parts = withoutProtocol.split('@');
    if (parts.length < 2) return { host: '(invalid)', name: '(invalid)' };
    
    const hostPart = parts[1];
    // Extract host (before /) and dbname (after /)
    const [hostWithPort, rest] = hostPart.split('/');
    const host = hostWithPort.split(':')[0]; // Remove port
    const dbName = rest ? rest.split('?')[0] : '(none)';
    
    return { host, name: dbName };
  } catch {
    return { host: '(error)', name: '(error)' };
  }
}

/**
 * Get first N characters of a string (for key prefixes)
 */
function getPrefix(str, length = 8) {
  if (!str) return '(not set)';
  return str.substring(0, length);
}

/**
 * Determine Stripe mode from keys
 */
function getStripeMode() {
  const checkoutMode = process.env.STRIPE_CHECKOUT_MODE;
  if (checkoutMode) return checkoutMode;
  
  // Fallback: detect from key prefix
  const secretKey = process.env.STRIPE_SECRET_KEY || 
                    process.env.STRIPE_SECRET_KEY_LIVE || 
                    process.env.STRIPE_SECRET_KEY_TEST;
  if (secretKey?.startsWith('sk_live')) return 'live';
  if (secretKey?.startsWith('sk_test')) return 'test';
  return '(unknown)';
}

/**
 * Log data source fingerprint
 * @param {string} context - Identifier for the calling context (e.g., "webhook_stripe")
 * @param {object} options - Configuration options
 * @param {string[]} options.readTables - Tables being read
 * @param {string[]} options.writeTables - Tables being written
 * @param {object} options.extra - Additional context-specific data
 */
export function logDataSourceFingerprint(context, options = {}) {
  const { readTables = [], writeTables = [], extra = {} } = options;

  const dbInfo = extractDbInfo(process.env.DATABASE_URL);

  const fingerprint = {
    fp: 'datasource',
    ctx: context,
    ts: new Date().toISOString(),
    node_env: process.env.NODE_ENV || '(not set)',
    vercel_env: process.env.VERCEL_ENV || '(not set)',
    nextauth_host: extractHost(process.env.NEXTAUTH_URL),
    supabase_host: extractHost(process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL),
    anon_prefix: getPrefix(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
    service_prefix: getPrefix(process.env.SUPABASE_SERVICE_ROLE_KEY),
    db_host: dbInfo.host,
    db_name: dbInfo.name,
    stripe_mode: getStripeMode(),
    read_tables: readTables,
    write_tables: writeTables,
    ...extra,
  };

  // Log as single JSON line for easy filtering
  console.log(`[FINGERPRINT] ${JSON.stringify(fingerprint)}`);

  return fingerprint;
}

/**
 * Middleware-style fingerprint logger for API routes
 * Returns the fingerprint for potential inclusion in response headers
 */
export function fingerprintMiddleware(context, options = {}) {
  return logDataSourceFingerprint(context, options);
}

export default logDataSourceFingerprint;
