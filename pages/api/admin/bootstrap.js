/**
 * API Route: Bootstrap Database
 * POST /api/admin/bootstrap
 * 
 * Runs migrations and seeds admin user
 * Only accessible with valid service role key
 */

import { bootstrapDatabase, checkTablesExist, seedAdminUser } from '../../../lib/supabase-bootstrap';
import { secretMatches, isProductionDeployment } from '../../../lib/security/secretCompare';

export default async function handler(req, res) {
  // Only POST allowed
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Check auth header for security
  // Disabled on production unless explicitly enabled; dedicated secret only
  // (never fall back to the Supabase service role key).
  if (isProductionDeployment() && process.env.BOOTSTRAP_ENABLED !== 'true') {
    return res.status(404).json({ error: 'Not found' });
  }
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';

  if (!secretMatches(token, process.env.BOOTSTRAP_SECRET)) {
    return res.status(401).json({ error: 'Unauthorized - invalid token' });
  }

  try {
    const action = req.query.action || 'full';

    switch (action) {
      case 'check':
        const tableStatus = await checkTablesExist();
        return res.status(200).json({ tables: tableStatus });

      case 'seed':
        const seedResult = await seedAdminUser();
        return res.status(200).json(seedResult);

      case 'full':
      default:
        const result = await bootstrapDatabase();
        return res.status(200).json(result);
    }
  } catch (error) {
    console.error('Bootstrap error:', error);
    return res.status(500).json({ 
      error: 'Bootstrap failed', 
      message: error.message 
    });
  }
}
