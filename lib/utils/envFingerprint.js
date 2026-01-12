/**
 * Environment Fingerprinting Utility
 * 
 * Extracts environment metadata to diagnose database/env mismatches
 * within Vercel deployments (checkout vs webhook vs admin).
 * 
 * Usage:
 *   const fingerprint = getEnvFingerprint();
 *   console.log(JSON.stringify(fingerprint));
 *   // Store in order.source
 */

/**
 * Extract host from URL (without secrets)
 * @param {string} url - Full URL
 * @returns {string} Host only (e.g., "xyz.supabase.co")
 */
function extractHost(url) {
  if (!url) return 'NOT_SET';
  try {
    const parsed = new URL(url);
    return parsed.host;
  } catch {
    return 'INVALID_URL';
  }
}

/**
 * Extract DB host/name from DATABASE_URL (without credentials)
 * @param {string} databaseUrl - PostgreSQL connection string
 * @returns {object} { host, database }
 */
function extractDbInfo(databaseUrl) {
  if (!databaseUrl) return { host: 'NOT_SET', database: 'NOT_SET' };
  
  try {
    // Format: postgresql://user:pass@host:port/database?params
    const match = databaseUrl.match(/postgresql:\/\/[^@]+@([^:/]+)(?::(\d+))?\/([^?]+)/);
    if (match) {
      return {
        host: match[1],
        port: match[2] || '5432',
        database: match[3],
      };
    }
    return { host: 'PARSE_ERROR', database: 'PARSE_ERROR' };
  } catch {
    return { host: 'PARSE_ERROR', database: 'PARSE_ERROR' };
  }
}

/**
 * Get comprehensive environment fingerprint
 * Safe to log (no secrets)
 * 
 * @returns {object} Environment fingerprint
 */
export function getEnvFingerprint() {
  const vercelEnv = process.env.VERCEL_ENV || 'development';
  const nodeEnv = process.env.NODE_ENV || 'development';
  const vercelUrl = process.env.VERCEL_URL;
  const vercelGitCommitSha = process.env.VERCEL_GIT_COMMIT_SHA;
  const vercelGitCommitRef = process.env.VERCEL_GIT_COMMIT_REF;
  
  const supabaseUrl = process.env.SUPABASE_URL;
  const databaseUrl = process.env.DATABASE_URL;
  
  const dbInfo = extractDbInfo(databaseUrl);
  
  return {
    // Vercel environment
    vercel_env: vercelEnv, // 'production' | 'preview' | 'development'
    node_env: nodeEnv,
    vercel_url: vercelUrl || 'NOT_SET',
    
    // Git info (for deployment tracking)
    git_commit_sha: vercelGitCommitSha?.substring(0, 7) || 'NOT_SET',
    git_branch: vercelGitCommitRef || 'NOT_SET',
    
    // Database fingerprints (NO SECRETS)
    supabase_host: extractHost(supabaseUrl),
    db_host: dbInfo.host,
    db_port: dbInfo.port,
    db_name: dbInfo.database,
    
    // Schema (usually 'public')
    schema: 'public', // TODO: Make configurable if using custom schemas
    
    // Timestamp
    generated_at: new Date().toISOString(),
  };
}

/**
 * Format fingerprint for logging (compact)
 * @param {object} fingerprint - From getEnvFingerprint()
 * @returns {string} Compact log string
 */
export function formatFingerprintLog(fingerprint) {
  return `env=${fingerprint.vercel_env} commit=${fingerprint.git_commit_sha} supabase=${fingerprint.supabase_host} db=${fingerprint.db_host}/${fingerprint.db_name}`;
}

/**
 * Compare two fingerprints for mismatches
 * @param {object} fp1 - First fingerprint
 * @param {object} fp2 - Second fingerprint
 * @returns {object} { matches: boolean, diffs: string[] }
 */
export function compareFingerprints(fp1, fp2) {
  const diffs = [];
  
  const criticalFields = [
    'vercel_env',
    'supabase_host',
    'db_host',
    'db_name',
    'schema',
  ];
  
  for (const field of criticalFields) {
    if (fp1[field] !== fp2[field]) {
      diffs.push(`${field}: ${fp1[field]} !== ${fp2[field]}`);
    }
  }
  
  return {
    matches: diffs.length === 0,
    diffs,
  };
}
