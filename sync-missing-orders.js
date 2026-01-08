import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { calcConfiguredPrice } from './lib/pricing/calcConfiguredPrice.js';

dotenv.config({ path: '.env.local' });

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function syncMissingOrders() {
  console.log('🔄 Starting manual order sync...\n');
  
  // Get recent checkout sessions from Stripe
  const sessions = await stripe.checkout.sessions.list({
    limit: 10,
    expand: ['data.line_items']
  });
  
  console.log(`Found ${sessions.data.length} recent sessions\n`);
  
  let synced = 0;
  let skipped = 0;
  let errors = 0;
  
  for (const session of sessions.data) {
    if (session.status !== 'complete' || session.payment_status !== 'paid') {
      console.log(`⏭️  Skipping ${session.id} - not completed/paid`);
      skipped++;
      continue;
    }
    
    const orderId = session.metadata?.order_id;
    if (!orderId) {
      console.log(`⚠️  Skipping ${session.id} - no order_id in metadata`);
      skipped++;
      continue;
    }
    
    // Check if already exists in DB
    const { data: existing } = await supabase
      .from('admin_orders')
      .select('id')
      .eq('id', orderId)
      .single();
    
    if (existing) {
      console.log(`✅ ${orderId.substring(0, 8)} - already in DB`);
      skipped++;
      continue;
    }
    
    console.log(`\n🔄 Syncing ${orderId.substring(0, 8)}...`);
    
    try {
      // Parse config_json
      let configJson = null;
      try {
        configJson = session.metadata?.config_json 
          ? JSON.parse(session.metadata.config_json) 
          : null;
      } catch (e) {
        console.log(`   ⚠️  Invalid config_json:`, e.message);
      }
      
      // Create Order
      const now = new Date().toISOString();
      const { data: order, error: orderError } = await supabase
        .from('admin_orders')
        .insert({
          id: orderId,
          stripe_checkout_session_id: session.id,
          stripe_payment_intent_id: session.payment_intent,
          email: session.customer_email || session.customer_details?.email,
          customer_id: session.customer || 'guest',
          amount_total: session.amount_total,
          amount_shipping: 0,
          amount_tax: 0,
          currency: session.currency,
          status_payment: session.payment_status === 'paid' ? 'PAID' : 'PENDING',
          status_fulfillment: 'NEW',
          config_json: configJson,
          created_at: now,
          updated_at: now,
          paid_at: session.payment_status === 'paid' ? now : null,
        })
        .select()
        .single();
      
      if (orderError) {
        throw orderError;
      }
      
      console.log(`   ✅ Order created`);
      
      // Create OrderItems
      if (session.line_items?.data) {
        for (const item of session.line_items.data) {
          // Calculate pricing fields if configured product
          let pricingFields = {};
          if (configJson && configJson.colors) {
            const productType = configJson.variant === 'bottle_holder' 
              ? 'bottle_holder' : 'glass_holder';
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
            
            console.log(`   💰 Pricing: ${pricing.subtotal_cents}¢ (base: ${pricing.base_price_cents}¢)`);
          }
          
          const { error: itemError } = await supabase
            .from('admin_order_items')
            .insert({
              order_id: order.id,
              sku: item.price?.product || 'UNKNOWN',
              name: item.description || 'Unnamed Item',
              variant: null,
              qty: item.quantity,
              unit_price: item.price?.unit_amount || 0,
              total_price: item.amount_total,
              ...pricingFields,
            });
          
          if (itemError) {
            throw itemError;
          }
          
          console.log(`   ✅ OrderItem created: ${item.description}`);
        }
      }
      
      synced++;
    } catch (error) {
      console.error(`   ❌ Error syncing ${orderId}:`, error.message);
      errors++;
    }
  }
  
  console.log(`\n📊 Summary:`);
  console.log(`   ✅ Synced: ${synced}`);
  console.log(`   ⏭️  Skipped: ${skipped}`);
  console.log(`   ❌ Errors: ${errors}`);
}

syncMissingOrders().catch(console.error);
