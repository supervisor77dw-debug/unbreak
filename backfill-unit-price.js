require('dotenv').config({ path: '.env.local' });
require('dotenv').config({ path: '.env' });

const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function backfillUnitPrice() {
  console.log('🔄 Starting unit_price backfill for configured orders...\n');

  // Find all order items with pricing data but potentially wrong unit_price
  const { data: items, error } = await supabase
    .from('admin_order_items')
    .select('*')
    .not('pricing_version', 'is', null)
    .not('subtotal_cents', 'is', null);

  if (error) {
    throw new Error(`Failed to fetch items: ${error.message}`);
  }

  console.log(`📋 Found ${items.length} items with pricing data\n`);

  let updated = 0;
  let skipped = 0;

  for (const item of items) {
    const expectedUnitPrice = item.subtotal_cents;
    const currentUnitPrice = item.unit_price || 0;
    const expectedTotalPrice = expectedUnitPrice * (item.qty || 1);

    // Check if update needed (allow 1 cent tolerance)
    const needsUpdate = Math.abs(currentUnitPrice - expectedUnitPrice) > 1;

    if (needsUpdate) {
      console.log(`📝 Updating item ${item.id}:`);
      console.log(`   Order ID: ${item.order_id}`);
      console.log(`   Current: unit=${currentUnitPrice}¢ total=${item.total_price}¢`);
      console.log(`   Expected: unit=${expectedUnitPrice}¢ total=${expectedTotalPrice}¢`);

      const { error: updateError } = await supabase
        .from('admin_order_items')
        .update({
          unit_price: expectedUnitPrice,
          total_price: expectedTotalPrice,
        })
        .eq('id', item.id);

      if (updateError) {
        console.error(`   ❌ Failed: ${updateError.message}\n`);
      } else {
        console.log(`   ✅ Updated\n`);
        updated++;
      }
    } else {
      console.log(`✓ Item ${item.id} already correct (${currentUnitPrice}¢)`);
      skipped++;
    }
  }

  console.log('\n📊 Summary:');
  console.log(`   ✅ Updated: ${updated}`);
  console.log(`   ⏭️  Skipped: ${skipped}`);
  console.log(`   📋 Total: ${items.length}`);
}

backfillUnitPrice()
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  });
