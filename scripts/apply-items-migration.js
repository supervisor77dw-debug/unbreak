import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function applyMigration() {
  console.log('\n🚀 MIGRATION: Add items column + backfill\n');
  console.log('⚠️  Run this SQL in Supabase SQL Editor:\n');
  console.log('='.repeat(80));
  console.log(`
-- 1. Add items column
ALTER TABLE simple_orders
ADD COLUMN IF NOT EXISTS items JSONB DEFAULT '[]'::jsonb;

-- 2. Backfill from existing data
UPDATE simple_orders
SET items = jsonb_build_array(
  jsonb_build_object(
    'sku', product_sku,
    'name', 'UNBREAK ONE Glass Holder',
    'quantity', quantity,
    'unit_price_cents', total_amount_cents / NULLIF(quantity, 0)
  )
)
WHERE product_sku IS NOT NULL AND (items IS NULL OR items = '[]'::jsonb);

-- 3. Verify
SELECT id, customer_email, items, config_json 
FROM simple_orders 
ORDER BY created_at DESC 
LIMIT 3;
  `);
  console.log('='.repeat(80));
  console.log('\n✅ Copy SQL above and run it in Supabase Dashboard\n');
  console.log('Then come back and verify...\n');
  
  // 3. Verify
  console.log('\n3️⃣ Verifying...\n');
  const { data, error: e3 } = await supabase
    .from('simple_orders')
    .select('id, customer_email, items, config_json, total_amount_cents')
    .order('created_at', { ascending: false })
    .limit(3);
  
  if (e3) {
    console.error('❌ Error verifying:', e3);
    return;
  }
  
  data.forEach((order, i) => {
    console.log(`${i + 1}. ${order.id.substring(0, 8)}...`);
    console.log(`   Email: ${order.customer_email}`);
    console.log(`   Items: ${JSON.stringify(order.items)}`);
    console.log(`   Config: ${order.config_json ? 'EXISTS' : 'NULL'}`);
    console.log('');
  });
  
  console.log('✅ MIGRATION COMPLETE!\n');
}

applyMigration().catch(console.error);
