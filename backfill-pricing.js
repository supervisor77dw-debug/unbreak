import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { calcConfiguredPrice } from './lib/pricing/calcConfiguredPrice.js';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function backfillPricing() {
  console.log('🔄 Backfilling pricing fields for existing orders...\n');
  
  // Get all orders with config_json
  const { data: orders, error: ordersError } = await supabase
    .from('admin_orders')
    .select('id, config_json')
    .not('config_json', 'is', null);
  
  if (ordersError) {
    console.error('❌ Error fetching orders:', ordersError.message);
    return;
  }
  
  console.log(`Found ${orders?.length || 0} orders with config_json\n`);
  
  let updated = 0;
  let errors = 0;
  let skipped = 0;
  
  for (const order of orders || []) {
    try {
      const config = order.config_json;
      
      // Check if it has colors (configured product)
      if (!config || !config.colors) {
        skipped++;
        continue;
      }
      
      // Get order items for this order
      const { data: items, error: itemsError } = await supabase
        .from('admin_order_items')
        .select('id, pricing_version')
        .eq('order_id', order.id);
      
      if (itemsError) {
        throw itemsError;
      }
      
      if (!items || items.length === 0) {
        console.log(`⚠️  Order ${order.id.substring(0, 8)} has no items`);
        skipped++;
        continue;
      }
      
      // Determine product type
      const productType = config.variant === 'bottle_holder' 
        ? 'bottle_holder' : 'glass_holder';
      
      // Calculate pricing
      const pricing = calcConfiguredPrice({
        productType,
        config,
        customFeeCents: 0,
      });
      
      // Update all items for this order
      for (const item of items) {
        const { error: updateError } = await supabase
          .from('admin_order_items')
          .update({
            pricing_version: pricing.pricing_version,
            base_price_cents: pricing.base_price_cents,
            option_prices_cents: pricing.option_prices_cents,
            custom_fee_cents: pricing.custom_fee_cents,
            subtotal_cents: pricing.subtotal_cents,
            config: config, // Store config on item level too
          })
          .eq('id', item.id);
        
        if (updateError) {
          throw updateError;
        }
      }
      
      console.log(`✅ ${order.id.substring(0, 8)} - ${items.length} item(s) - ${pricing.subtotal_cents}¢`);
      updated++;
    } catch (err) {
      console.error(`❌ Error updating order ${order.id}:`, err.message);
      errors++;
    }
  }
  
  console.log(`\n📊 Summary:`);
  console.log(`   ✅ Updated: ${updated} orders`);
  console.log(`   ⏭️  Skipped: ${skipped} (no colors)`);
  console.log(`   ❌ Errors: ${errors}`);
}

backfillPricing().catch(console.error);
