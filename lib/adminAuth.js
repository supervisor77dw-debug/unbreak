/**
 * Admin API Authentication Helper
 * 
 * Simple header-based auth for admin API routes
 * Uses x-admin-key header compared against ADMIN_API_KEY env var
 */

export function requireAdmin(req, res) {
  const key = req.headers['x-admin-key'];
  
  if (!process.env.ADMIN_API_KEY) {
    console.error('❌ [ADMIN AUTH] ADMIN_API_KEY not configured in environment');
    return res.status(500).json({ 
      error: 'Server misconfiguration',
      message: 'ADMIN_API_KEY missing in environment'
    });
  }
  
  if (!key) {
    console.warn('⚠️ [ADMIN AUTH] Request missing x-admin-key header');
    return res.status(401).json({ 
      error: 'Unauthorized',
      message: 'Missing x-admin-key header'
    });
  }
  
  if (key !== process.env.ADMIN_API_KEY) {
    console.warn('⚠️ [ADMIN AUTH] Invalid x-admin-key provided');
    return res.status(401).json({ 
      error: 'Unauthorized',
      message: 'Invalid x-admin-key'
    });
  }
  
  return true;
}
