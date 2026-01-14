/**
 * BUGFIX SCRIPT: Adapter-Farben in pricing_configs auf 5 reduzieren
 * 
 * PROBLEM:
 * - pricing_configs.color_prices.module hat 7 Farben (mint, purple, etc.)
 * - Adapter darf NUR 5 Farben haben (red, black, iceBlue, green, grey)
 * - Backend-UI zeigt alle DB-Farben → 7 Farben sichtbar (FALSCH!)
 * 
 * LÖSUNG:
 * - Entferne mint, purple, darkBlue aus module color_prices
 * - Behalte NUR: red, black, iceBlue, green, grey
 * - Setze grey auf 0 Cent (falls nicht vorhanden)
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// ADAPTER-ERLAUBTE FARBEN (EXAKT 5)
const ADAPTER_ALLOWED_COLORS = ['red', 'black', 'iceBlue', 'green', 'grey'];

// VERBOTENE FARBEN für Adapter
const ADAPTER_FORBIDDEN_COLORS = ['mint', 'purple', 'darkBlue', 'white', 'blue', 'yellow', 'orange'];

async function fixAdapterColors() {
  console.log('🔧 Starting adapter color fix...\n');

  try {
    // 1. Fetch all active pricing configs
    const { data: configs, error: fetchError } = await supabase
      .from('pricing_configs')
      .select('*')
      .eq('active', true);

    if (fetchError) throw fetchError;

    console.log(`📊 Found ${configs.length} active pricing configs\n`);

    for (const config of configs) {
      console.log(`\n🔍 Processing: ${config.variant} (ID: ${config.id})`);
      console.log(`   Version: ${config.version}`);

      if (!config.color_prices || !config.color_prices.module) {
        console.log('   ⚠️  No module colors found, skipping...');
        continue;
      }

      const moduleColors = config.color_prices.module;
      console.log(`   Current module colors: ${Object.keys(moduleColors).join(', ')}`);

      // 2. Build new module color object (only allowed colors)
      const newModuleColors = {};
      let changed = false;

      for (const color of ADAPTER_ALLOWED_COLORS) {
        if (moduleColors[color] !== undefined) {
          newModuleColors[color] = moduleColors[color];
        } else {
          // Add missing allowed color with 0 price
          newModuleColors[color] = 0;
          console.log(`   ✨ Adding missing color: ${color} = 0¢`);
          changed = true;
        }
      }

      // 3. Check for forbidden colors
      const forbiddenFound = [];
      for (const color of ADAPTER_FORBIDDEN_COLORS) {
        if (moduleColors[color] !== undefined) {
          forbiddenFound.push(color);
          changed = true;
        }
      }

      if (forbiddenFound.length > 0) {
        console.log(`   ❌ Removing forbidden colors: ${forbiddenFound.join(', ')}`);
      }

      if (!changed) {
        console.log('   ✅ Already correct, no changes needed');
        continue;
      }

      // 4. Update config with new module colors
      const updatedColorPrices = {
        ...config.color_prices,
        module: newModuleColors,
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

      console.log(`   ✅ Updated successfully!`);
      console.log(`   New module colors: ${Object.keys(newModuleColors).join(', ')}`);
      console.log(`   Color count: ${Object.keys(moduleColors).length} → ${Object.keys(newModuleColors).length}`);
    }

    console.log('\n\n✅ ALL DONE!\n');
    console.log('📋 SUMMARY:');
    console.log('   - Adapter colors reduced from 7 → 5');
    console.log('   - Allowed: red, black, iceBlue, green, grey');
    console.log('   - Removed: mint, purple, darkBlue (+ others if present)');
    console.log('\n🔄 Next: Reload /admin/pricing to see changes');

  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
    console.error(error);
    process.exit(1);
  }
}

// Run the fix
fixAdapterColors();
