/**
 * ADD MODULE COLORS TO pricing_configs
 * 
 * PROBLEM:
 * - pricing_configs hat color_prices.base und color_prices.arm
 * - ABER: color_prices.module fehlt! (Adapter-Farben)
 * - UI zeigt daher keine module-Farb-Aufschläge
 * 
 * LÖSUNG:
 * - Füge color_prices.module hinzu mit 5 Adapter-Farben
 * - red, black, iceBlue, green, grey (je 0¢ initial)
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// ADAPTER-FARBEN (EXAKT 5)
const MODULE_COLOR_DEFAULTS = {
  red: 0,
  black: 0,
  iceBlue: 0,
  green: 0,
  grey: 0,
};

async function addModuleColors() {
  console.log('🎨 Adding module colors to pricing_configs...\n');

  try {
    const { data: configs, error: fetchError } = await supabase
      .from('pricing_configs')
      .select('*')
      .eq('active', true);

    if (fetchError) throw fetchError;

    console.log(`📊 Found ${configs.length} active configs\n`);

    for (const config of configs) {
      console.log(`\n🔍 Processing: ${config.variant}`);

      if (!config.color_prices) {
        console.log('   ⚠️  No color_prices object, skipping');
        continue;
      }

      // Check if module already exists
      if (config.color_prices.module) {
        console.log('   ℹ️  module already exists:');
        console.log(`      Current: ${Object.keys(config.color_prices.module).join(', ')}`);
        console.log('   ❌ Skipping (already has module colors)');
        continue;
      }

      // Add module colors
      const updatedColorPrices = {
        ...config.color_prices,
        module: MODULE_COLOR_DEFAULTS,
      };

      const { error: updateError } = await supabase
        .from('pricing_configs')
        .update({
          color_prices: updatedColorPrices,
        })
        .eq('id', config.id);

      if (updateError) {
        console.error(`   ❌ Update failed:`, updateError.message);
        continue;
      }

      console.log('   ✅ Added module colors:');
      console.log(`      → ${Object.keys(MODULE_COLOR_DEFAULTS).join(', ')}`);
      console.log(`      All set to 0¢ (customizable in /admin/pricing)`);
    }

    console.log('\n\n✅ DONE!\n');
    console.log('📋 NEXT STEPS:');
    console.log('   1. Open /admin/pricing');
    console.log('   2. Select Glashalter');
    console.log('   3. Scroll to "module" section');
    console.log('   4. Should now show 5 colors (not 7!)');
    console.log('   5. Set prices as needed and save');

  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
    console.error(error);
    process.exit(1);
  }
}

addModuleColors();
