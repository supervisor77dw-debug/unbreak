import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkOrder() {
  const orderId = '56d87d4d'; // Latest order
  
  const { data: order, error: orderError } = await supabase
    .from('admin_orders')
    .select('id, email, amount_total')
    .like('id', orderId + '%')
    .single();
  
  if (orderError || !order) {
    console.log('❌ Order not found:', orderError?.message);
    return;
  }
  
  console.log('✅ Order found:', order.email);
  console.log('   Amount:', order.amount_total, 'cents');
  
  const { data: items, error: itemsError } = await supabase
    .from('admin_order_items')
    .select('*')
    .eq('order_id', orderId);
  
  if (itemsError || !items || items.length === 0) {
    console.log('❌ No items found:', itemsError?.message);
    return;
  }
  
  console.log('   Items:', items.length);
  
  items.forEach((item, idx) => {
    console.log(`\n${idx + 1}. ${item.name}`);
    console.log('   SKU:', item.sku);
    console.log('   Unit Price:', item.unit_price, 'cents');
    console.log('   Total Price:', item.total_price, 'cents');
    console.log('\n   💰 PRICING FIELDS:');
    console.log('   - pricing_version:', item.pricing_version || '❌ NULL');
    console.log('   - base_price_cents:', item.base_price_cents || '❌ NULL');
    console.log('   - option_prices_cents:', item.option_prices_cents ? '✅ Present' : '❌ NULL');
    if (item.option_prices_cents) {
      console.log('      ', JSON.stringify(item.option_prices_cents, null, 2));
    }
    console.log('   - custom_fee_cents:', item.custom_fee_cents ?? '❌ NULL');
    console.log('   - subtotal_cents:', item.subtotal_cents || '❌ NULL');
    console.log('   - config:', item.config ? '✅ Present' : '❌ NULL');
    if (item.config) {
      console.log('      Colors:', item.config.colors);
      console.log('      Finish:', item.config.finish);
    }
    
    // Calculation check
    if (item.option_prices_cents && item.base_price_cents) {
      const opts = item.option_prices_cents;
      const expected = item.base_price_cents + 
        (opts.base || 0) + 
        (opts.arm || 0) + 
        (opts.module || 0) + 
        (opts.pattern || 0) + 
        (opts.finish || 0) + 
        (item.custom_fee_cents || 0);
      
      console.log('\n   🧮 CALCULATION:');
      console.log('      Base:', item.base_price_cents);
      console.log('      + base color:', opts.base || 0);
      console.log('      + arm color:', opts.arm || 0);
      console.log('      + module color:', opts.module || 0);
      console.log('      + pattern color:', opts.pattern || 0);
      console.log('      + finish:', opts.finish || 0);
      console.log('      = Expected:', expected);
      console.log('      = Stored:', item.subtotal_cents);
      console.log('      Match:', expected === item.subtotal_cents ? '✅' : '❌');
    }
  });
}

checkOrder().catch(console.error);
