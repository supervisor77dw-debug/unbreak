import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]';
import { createClient } from '@supabase/supabase-js';
import { logDataSourceFingerprint } from '../../../lib/dataSourceFingerprint';

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

export default async function handler(req, res) {
  // Log SSOT fingerprint
  logDataSourceFingerprint('admin_pricing', {
    readTables: req.method === 'GET' ? ['pricing_configs (Supabase)'] : [],
    writeTables: req.method === 'PUT' ? ['pricing_configs (Supabase)'] : [],
    note: 'SSOT: pricing_configs table via Supabase Client',
  });

  const session = await getServerSession(req, res, authOptions);

  console.log('[API][Pricing] Session check:', {
    hasSession: !!session,
    user: session?.user?.email || 'none',
    role: session?.user?.role || 'none',
    method: req.method,
  });

  if (!session || session.user.role !== 'ADMIN') {
    console.error('[API][Pricing] 401 - No valid admin session');
    return res.status(401).json({ error: 'Unauthorized - Admin session required' });
  }

  // GET: Fetch active pricing configs
  if (req.method === 'GET') {
    try {
      const { data: configs, error } = await supabase
        .from('pricing_configs')
        .select('*')
        .eq('active', true);

      if (error) throw error;

      // Format as object with variant keys
      const result = {
        glass_holder: configs.find(c => c.variant === 'glass_holder') || null,
        bottle_holder: configs.find(c => c.variant === 'bottle_holder') || null,
      };

      return res.status(200).json(result);
    } catch (error) {
      console.error('Error fetching pricing configs:', error);
      return res.status(500).json({ error: 'Failed to fetch pricing configs' });
    }
  }

  // PUT: Update pricing config
  if (req.method === 'PUT') {
    const { variant, config } = req.body;

    if (!variant || !config) {
      return res.status(400).json({ error: 'Missing variant or config' });
    }

    try {
      // Deactivate current active config for this variant
      await supabase
        .from('pricing_configs')
        .update({ active: false })
        .eq('variant', variant)
        .eq('active', true);

      // Create new active config
      const { data: newConfig, error: insertError } = await supabase
        .from('pricing_configs')
        .insert({
          variant: variant,
          base_price_cents: config.base_price_cents,
          color_prices: config.color_prices,
          finish_prices: config.finish_prices,
          arm_prices: config.arm_prices,
          module_prices: config.module_prices,
          pattern_prices: config.pattern_prices,
          active: true,
          version: config.version || '2026-01-v1',
        })
        .select()
        .single();

      if (insertError) throw insertError;

      // Clear pricing cache in calcConfiguredPriceDB
      try {
        const { clearPricingCache } = await import('../../../lib/pricing/calcConfiguredPriceDB.js');
        clearPricingCache();
      } catch (e) {
        console.warn('Could not clear pricing cache:', e.message);
      }

      return res.status(200).json(newConfig);
    } catch (error) {
      console.error('Error updating pricing config:', error);
      return res.status(500).json({ error: 'Failed to update pricing config' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
