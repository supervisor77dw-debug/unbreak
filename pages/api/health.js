/**
 * Health Check API
 * GET /api/health
 * 
 * Returns server health status and version info
 */

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const healthInfo = {
      ok: true,
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: process.env.VERCEL_GIT_COMMIT_SHA?.substring(0, 7) || 'dev',
      commit: process.env.VERCEL_GIT_COMMIT_SHA || 'unknown',
      branch: process.env.VERCEL_GIT_COMMIT_REF || 'unknown',
      env: process.env.VERCEL_ENV || process.env.NODE_ENV || 'development',
      region: process.env.VERCEL_REGION || 'local',
    };

    // Log health check (minimal)
    console.log('[HEALTH] Check OK', {
      env: healthInfo.env,
      version: healthInfo.version,
    });

    return res.status(200).json(healthInfo);

  } catch (error) {
    console.error('[HEALTH] Error:', error);
    return res.status(500).json({
      ok: false,
      status: 'error',
      error: error.message,
    });
  }
}
