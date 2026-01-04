/**
 * DIAGNOSE: Order Items & Config Data
 * Checks what data is stored in orders for items + config
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function diagnoseOrderData() {
  console.log('\n🔍 ORDER DATA DIAGNOSIS\n');
  console.log('='.repeat(80));

  // Get recent orders
  const { data: orders, error } = await supabase
    .from('simple_orders')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(3);

  if (error) {
    console.error('❌ Error:', error);
    return;
  }

  console.log(`\nFound ${orders.length} recent orders:\n`);

  orders.forEach((order, i) => {
    console.log(`\n${'='.repeat(80)}`);
    console.log(`ORDER ${i + 1}: ${order.id.substring(0, 8)}...`);
    console.log('='.repeat(80));
    
    console.log('\n📋 BASIC INFO:');
    console.log(`  Email: ${order.customer_email || 'NULL'}`);
    console.log(`  Name: ${order.customer_name || 'NULL'}`);
    console.log(`  Phone: ${order.customer_phone || 'NULL'}`);
    console.log(`  Status: ${order.status}`);
    console.log(`  Total: €${(order.total_amount_cents || 0) / 100}`);
    console.log(`  Currency: ${order.currency || 'NULL'}`);
    console.log(`  Created: ${order.created_at}`);
    
    console.log('\n🔗 STRIPE DATA:');
    console.log(`  Session ID: ${order.stripe_checkout_session_id || 'NULL'}`);
    console.log(`  Payment Intent: ${order.stripe_payment_intent_id || 'NULL'}`);
    console.log(`  Customer ID: ${order.stripe_customer_id || 'NULL'}`);
    console.log(`  Paid At: ${order.paid_at || 'NULL'}`);
    
    console.log('\n📦 ITEMS DATA:');
    if (order.items_json) {
      console.log('  items_json:', JSON.stringify(order.items_json, null, 2));
    } else {
      console.log('  items_json: NULL ❌');
    }
    
    if (order.product_name) {
      console.log(`  product_name: ${order.product_name}`);
    }
    
    if (order.product_sku) {
      console.log(`  product_sku: ${order.product_sku}`);
    }
    
    if (order.quantity) {
      console.log(`  quantity: ${order.quantity}`);
    }
    
    if (order.unit_price_cents) {
      console.log(`  unit_price_cents: ${order.unit_price_cents}`);
    }
    
    console.log('\n🎨 CONFIG DATA:');
    if (order.config_json) {
      console.log('  config_json:', JSON.stringify(order.config_json, null, 2));
      
      // Analyze config structure
      const config = order.config_json;
      console.log('\n  Config Analysis:');
      console.log(`    - Has colors object: ${!!config.colors}`);
      console.log(`    - Has color field: ${!!config.color}`);
      console.log(`    - Has finish: ${!!config.finish}`);
      console.log(`    - Has product: ${!!config.product || !!config.productSku}`);
      console.log(`    - Has quantity: ${!!config.quantity}`);
      
      if (config.colors) {
        console.log('    - Color areas:', Object.keys(config.colors).join(', '));
      }
    } else {
      console.log('  config_json: NULL ❌');
    }
    
    console.log('\n🖼️ PREVIEW:');
    if (order.preview_image_url) {
      console.log(`  preview_image_url: ${order.preview_image_url}`);
    } else {
      console.log('  preview_image_url: NULL');
    }
    
    console.log('\n📍 ADDRESSES:');
    if (order.shipping_address) {
      console.log('  shipping_address:', JSON.stringify(order.shipping_address, null, 2));
    } else {
      console.log('  shipping_address: NULL');
    }
    
    if (order.billing_address) {
      console.log('  billing_address:', JSON.stringify(order.billing_address, null, 2));
    } else {
      console.log('  billing_address: NULL');
    }
  });

  console.log('\n\n' + '='.repeat(80));
  console.log('SUMMARY');
  console.log('='.repeat(80));
  
  const hasItems = orders.filter(o => o.items_json).length;
  const hasConfig = orders.filter(o => o.config_json).length;
  const hasPreview = orders.filter(o => o.preview_image_url).length;
  const hasColors = orders.filter(o => o.config_json?.colors).length;
  
  console.log(`\n  Orders with items_json: ${hasItems}/${orders.length}`);
  console.log(`  Orders with config_json: ${hasConfig}/${orders.length}`);
  console.log(`  Orders with preview: ${hasPreview}/${orders.length}`);
  console.log(`  Orders with colors in config: ${hasColors}/${orders.length}`);
  
  console.log('\n✅ Diagnosis complete!\n');
}

diagnoseOrderData().catch(console.error);
