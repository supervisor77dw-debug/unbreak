import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { calcConfiguredPrice } from './lib/pricing/calcConfiguredPrice.js';

dotenv.config({ path: '.env.local' });

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function fixMissingItems() {
  console.log('🔍 Finding orders without items...\n');
  
  // Get recent orders
  const { data: orders, error } = await supabase
    .from('admin_orders')
    .select('id, stripe_checkout_session_id, config_json')
    .order('created_at', { ascending: false })
    .limit(10);
  
  if (error) {
    console.error('❌ Error fetching orders:', error.message);
    return;
  }
  
  let fixed = 0;
  let skipped = 0;
  
  for (const order of orders || []) {
    // Check if items exist
    const { data: items, error: itemsError } = await supabase
      .from('admin_order_items')
      .select('id')
      .eq('order_id', order.id);
    
    if (itemsError) {
      console.error(`❌ Error checking items for ${order.id}:`, itemsError.message);
      continue;
    }
    
    if (items && items.length > 0) {
      skipped++;
      continue;
    }
    
    console.log(`\n🔧 Fixing order ${order.id.substring(0, 8)}...`);
    
    try {
      // Get session from Stripe
      const session = await stripe.checkout.sessions.retrieve(order.stripe_checkout_session_id, {
        expand: ['line_items']
      });
      
      if (!session.line_items?.data || session.line_items.data.length === 0) {
        console.log(`   ⚠️  No line items in Stripe session`);
        skipped++;
        continue;
      }
      
      // Parse config
      let configJson = null;
      try {
        configJson = order.config_json || (session.metadata?.config_json ? JSON.parse(session.metadata.config_json) : null);
      } catch (e) {
        console.log(`   ⚠️  Invalid config_json`);
      }
      
      // Create items
      for (const lineItem of session.line_items.data) {
        // Calculate pricing if configured product
        let pricingFields = {};
        if (configJson && configJson.colors) {
          const productType = configJson.variant === 'bottle_holder' ? 'bottle_holder' : 'glass_holder';
          const pricing = calcConfiguredPrice({
            productType,
            config: configJson,
            customFeeCents: 0,
          });
          
          pricingFields = {
            pricing_version: pricing.pricing_version,
            base_price_cents: pricing.base_price_cents,
            option_prices_cents: pricing.option_prices_cents,
            custom_fee_cents: pricing.custom_fee_cents,
            subtotal_cents: pricing.subtotal_cents,
            config: configJson,
          };
          
          console.log(`   💰 Pricing: ${pricing.subtotal_cents}¢`);
        }
        
        const { error: insertError } = await supabase
          .from('admin_order_items')
          .insert({
            order_id: order.id,
            sku: lineItem.price?.product || 'UNKNOWN',
            name: lineItem.description || 'Unnamed Item',
            variant: null,
            qty: lineItem.quantity,
            unit_price: lineItem.price?.unit_amount || 0,
            total_price: lineItem.amount_total,
            ...pricingFields,
          });
        
        if (insertError) {
          throw insertError;
        }
        
        console.log(`   ✅ Created item: ${lineItem.description}`);
      }
      
      fixed++;
    } catch (err) {
      console.error(`   ❌ Error:`, err.message);
    }
  }
  
  console.log(`\n📊 Summary:`);
  console.log(`   ✅ Fixed: ${fixed} orders`);
  console.log(`   ⏭️  Skipped: ${skipped} (already have items)`);
}

fixMissingItems().catch(console.error);
