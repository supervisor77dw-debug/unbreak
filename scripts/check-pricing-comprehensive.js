/**
 * COMPREHENSIVE PRICING DB CHECK
 * Zeigt ALLE relevanten Felder für beide Variants
 */
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function comprehensiveCheck() {
  console.log('\n🔍 COMPREHENSIVE PRICING CHECK\n');
  console.log(`📡 Supabase URL: ${process.env.NEXT_PUBLIC_SUPABASE_URL}\n`);

  const { data: configs, error } = await supabase
    .from('pricing_configs')
    .select('*')
    .eq('active', true);

  if (error) {
    console.error('❌ Error:', error);
    return;
  }

  for (const config of configs) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`🏷️  ${config.variant.toUpperCase()}`);
    console.log(`${'='.repeat(60)}\n`);
    
    console.log(`📦 Base Price: ${config.base_price_cents}¢`);
    console.log(`📌 Version: ${config.version}`);
    console.log(`🆔 ID: ${config.id}\n`);
    
    // Color Prices Detail
    console.log(`🎨 COLOR_PRICES:`);
    if (config.color_prices) {
      const parts = Object.keys(config.color_prices);
      console.log(`   Parts: ${parts.join(', ')}\n`);
      
      for (const part of ['base', 'arm', 'module', 'pattern']) {
        if (config.color_prices[part]) {
          const colors = Object.keys(config.color_prices[part]);
          console.log(`   ${part.toUpperCase()}:`);
          console.log(`      Count: ${colors.length} colors`);
          console.log(`      Colors: ${colors.join(', ')}`);
          
          if (part === 'module') {
            console.log(`      ⚠️  DETAIL:`);
            for (const [color, price] of Object.entries(config.color_prices[part])) {
              console.log(`         ${color.padEnd(10)} = ${price}¢`);
            }
          }
          console.log();
        }
      }
      
      // Check for missing module
      if (!config.color_prices.module) {
        console.log(`   ❌ MODULE IS MISSING!\n`);
      }
    }
    
    // Module Prices (structure types, not colors)
    if (config.module_prices) {
      console.log(`📦 MODULE_PRICES (Struktur-Typen):`);
      for (const [type, price] of Object.entries(config.module_prices)) {
        console.log(`   ${type}: ${price}¢`);
      }
      console.log();
    }
    
    // Finish Prices
    if (config.finish_prices) {
      console.log(`✨ FINISH_PRICES:`);
      for (const [finish, price] of Object.entries(config.finish_prices)) {
        console.log(`   ${finish}: ${price}¢`);
      }
      console.log();
    }
  }
  
  console.log(`\n${'='.repeat(60)}\n`);
  
  // Summary
  console.log(`📊 SUMMARY:\n`);
  for (const config of configs) {
    const hasModule = config.color_prices?.module ? '✅' : '❌';
    const moduleCount = config.color_prices?.module ? Object.keys(config.color_prices.module).length : 0;
    console.log(`${config.variant.padEnd(15)} ${hasModule} module colors: ${moduleCount}`);
  }
  console.log();
}

comprehensiveCheck();
