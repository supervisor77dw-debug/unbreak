// API Test endpoint: /api/test-pricing-data
// Direct DB query to check what's actually stored

import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  try {
    const { data: configs, error } = await supabase
      .from('pricing_configs')
      .select('*')
      .eq('active', true);

    if (error) throw error;

    // Build comprehensive report
    const report = {};
    
    for (const config of configs) {
      report[config.variant] = {
        id: config.id,
        version: config.version,
        base_price_cents: config.base_price_cents,
        color_prices_keys: Object.keys(config.color_prices || {}),
        color_prices_detail: {},
      };

      // Add detail for each part
      if (config.color_prices) {
        for (const [part, colors] of Object.entries(config.color_prices)) {
          report[config.variant].color_prices_detail[part] = {
            count: Object.keys(colors).length,
            colors: Object.keys(colors),
          };
        }
      }
      
      // Check for module specifically
      report[config.variant].has_module = !!config.color_prices?.module;
      report[config.variant].module_color_count = config.color_prices?.module 
        ? Object.keys(config.color_prices.module).length 
        : 0;
    }

    return res.status(200).json({
      timestamp: new Date().toISOString(),
      database_url: process.env.NEXT_PUBLIC_SUPABASE_URL,
      report,
    });

  } catch (error) {
    console.error('Test API Error:', error);
    return res.status(500).json({ 
      error: error.message,
      timestamp: new Date().toISOString(),
    });
  }
}
