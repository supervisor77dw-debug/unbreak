import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkPricing() {
  const orderId = '73c410ee-97ad-4339-8c10-cf3f45d1783d';

  console.log('🔍 Checking order with pricing fields...\n');

  // Check order
  const { data: order, error: orderError } = await supabase
    .from('admin_orders')
    .select('id, email, config_json, amount_total, status_payment')
    .eq('id', orderId)
    .single();

  if (orderError || !order) {
    console.log('❌ Order not found:', orderError?.message);
    return;
  }

  console.log('✅ Order found:');
  console.log('   ID:', order.id.substring(0, 8));
  console.log('   Email:', order.email);
  console.log('   Amount:', order.amount_total, 'cents');
  console.log('   Status:', order.status_payment);
  console.log('   Has config_json:', !!order.config_json);

  // Check order items with pricing fields
  const { data: items, error: itemsError } = await supabase
    .from('admin_order_items')
    .select('*')
    .eq('order_id', orderId);

  if (itemsError || !items || items.length === 0) {
    console.log('\n❌ No items found:', itemsError?.message);
    return;
  }

  console.log('\n📦 Order Items (' + items.length + '):');
  items.forEach((item, idx) => {
    console.log(`\n${idx + 1}. ${item.name}`);
    console.log('   SKU:', item.sku);
    console.log('   Quantity:', item.qty);
    console.log('   Unit Price:', item.unit_price, 'cents');
    console.log('   Total Price:', item.total_price, 'cents');
    console.log('\n   🎨 PRICING FIELDS:');
    console.log('   - pricing_version:', item.pricing_version || '❌ NULL');
    console.log('   - base_price_cents:', item.base_price_cents || '❌ NULL');
    console.log('   - option_prices_cents:', item.option_prices_cents ? '✅' : '❌ NULL');
    if (item.option_prices_cents) {
      console.log('     ', JSON.stringify(item.option_prices_cents, null, 2));
    }
    console.log('   - custom_fee_cents:', item.custom_fee_cents ?? '❌ NULL');
    console.log('   - subtotal_cents:', item.subtotal_cents || '❌ NULL');
    console.log('   - config:', item.config ? '✅' : '❌ NULL');
    if (item.config) {
      console.log('      Colors:', item.config.colors);
      console.log('      Finish:', item.config.finish);
    }
  });

  // Calculate expected subtotal
  if (items[0]?.option_prices_cents && items[0]?.base_price_cents) {
    const opts = items[0].option_prices_cents;
    const expected = items[0].base_price_cents + 
      (opts.base || 0) + 
      (opts.arm || 0) + 
      (opts.module || 0) + 
      (opts.pattern || 0) + 
      (opts.finish || 0) + 
      (items[0].custom_fee_cents || 0);
    
    console.log('\n💰 CALCULATION CHECK:');
    console.log('   Base:', items[0].base_price_cents, 'cents');
    console.log('   + Base color:', opts.base || 0);
    console.log('   + Arm color:', opts.arm || 0);
    console.log('   + Module color:', opts.module || 0);
    console.log('   + Pattern color:', opts.pattern || 0);
    console.log('   + Finish:', opts.finish || 0);
    console.log('   + Custom fee:', items[0].custom_fee_cents || 0);
    console.log('   = Expected:', expected, 'cents');
    console.log('   = Stored:', items[0].subtotal_cents, 'cents');
    console.log('   Match:', expected === items[0].subtotal_cents ? '✅' : '❌');
  }
}

checkPricing().catch(console.error);
