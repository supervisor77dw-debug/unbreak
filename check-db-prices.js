import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkPrices() {
  console.log('🔍 Checking product prices in DB...\n');
  
  const { data: products, error } = await supabase
    .from('products')
    .select('id, sku, name, base_price_cents, active')
    .order('created_at');
  
  if (error) {
    console.error('❌ Error:', error);
    return;
  }
  
  console.log('Products found:', products.length);
  console.log('='.repeat(80));
  
  products.forEach(p => {
    const priceEur = (p.base_price_cents / 100).toFixed(2);
    const status = p.active ? '✅ ACTIVE' : '❌ INACTIVE';
    console.log(`${status} | ${p.sku.padEnd(25)} | €${priceEur.padStart(6)} | ${p.name}`);
  });
  
  console.log('='.repeat(80));
  
  // Check for duplicates or pricing issues
  const activePrices = products.filter(p => p.active);
  console.log(`\n📊 Active products: ${activePrices.length}`);
  console.log(`💰 Price range: €${Math.min(...activePrices.map(p => p.base_price_cents)) / 100} - €${Math.max(...activePrices.map(p => p.base_price_cents)) / 100}`);
}

checkPrices()
  .catch(console.error)
  .finally(() => process.exit(0));
