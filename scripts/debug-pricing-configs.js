/**
 * DEBUG: Check actual pricing_configs in database
 */
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkPricingConfigs() {
  const { data: configs, error } = await supabase
    .from('pricing_configs')
    .select('*')
    .eq('active', true);

  if (error) {
    console.error('Error:', error);
    return;
  }

  console.log('\n📊 ACTIVE PRICING CONFIGS:\n');
  
  for (const config of configs) {
    console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`🏷️  VARIANT: ${config.variant}`);
    console.log(`📌 ID: ${config.id}`);
    console.log(`📦 Version: ${config.version}`);
    console.log(`💰 Base Price: ${config.base_price_cents}¢ (€${(config.base_price_cents/100).toFixed(2)})`);
    
    console.log(`\n🎨 COLOR PRICES:`);
    if (config.color_prices) {
      for (const [part, colors] of Object.entries(config.color_prices)) {
        const colorList = Object.keys(colors);
        console.log(`   ${part}: ${colorList.length} colors`);
        console.log(`      → ${colorList.join(', ')}`);
        
        if (part === 'module') {
          console.log(`\n   ⚠️  MODULE COLOR DETAIL:`);
          for (const [color, price] of Object.entries(colors)) {
            console.log(`      ${color}: ${price}¢`);
          }
        }
      }
    } else {
      console.log('   (none)');
    }
    
    console.log(`\n📦 SEPARATE PRICING FIELDS:`);
    if (config.module_prices) {
      const moduleColors = Object.keys(config.module_prices);
      console.log(`   module_prices: ${moduleColors.length} colors`);
      console.log(`      → ${moduleColors.join(', ')}`);
      console.log(`\n   ⚠️  MODULE_PRICES DETAIL:`);
      for (const [color, price] of Object.entries(config.module_prices)) {
        console.log(`      ${color}: ${price}¢`);
      }
    } else {
      console.log(`   module_prices: (none)`);
    }
    if (config.arm_prices) {
      console.log(`   arm_prices: ${Object.keys(config.arm_prices).length} entries`);
    } else {
      console.log(`   arm_prices: (none)`);
    }
    if (config.pattern_prices) {
      console.log(`   pattern_prices: ${Object.keys(config.pattern_prices).length} entries`);
    } else {
      console.log(`   pattern_prices: (none)`);
    }
  }
  
  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
}

checkPricingConfigs();
