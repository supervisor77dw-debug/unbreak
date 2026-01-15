/**
 * Migration: Fix missing order_number in simple_orders
 * 
 * PROBLEM:
 * - Older orders may not have order_number set
 * - Emails show UUID substring instead of proper order number
 * - Admin panel falls back to UUID
 * 
 * SOLUTION:
 * - Find all orders without order_number
 * - Generate sequential order numbers using DB function
 * - Update orders with proper order_number
 * 
 * USAGE:
 * node scripts/fix-missing-order-numbers.js
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function fixMissingOrderNumbers() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🔧 FIX MISSING ORDER NUMBERS');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  try {
    // 1. Find orders without order_number in simple_orders
    console.log('1️⃣  Checking simple_orders table...');
    const { data: ordersWithoutNumber, error: queryError } = await supabase
      .from('simple_orders')
      .select('id, created_at, customer_email, total_amount_cents')
      .is('order_number', null)
      .order('created_at', { ascending: true });

    if (queryError) {
      throw new Error(`Query failed: ${queryError.message}`);
    }

    if (!ordersWithoutNumber || ordersWithoutNumber.length === 0) {
      console.log('✅ All orders have order_number - nothing to fix!\n');
      return;
    }

    console.log(`📊 Found ${ordersWithoutNumber.length} orders without order_number\n`);

    // 2. Update each order with a generated order_number
    let successCount = 0;
    let errorCount = 0;

    for (const order of ordersWithoutNumber) {
      try {
        // Generate order number using DB function
        const { data: generatedNumber, error: genError } = await supabase
          .rpc('get_next_order_number');

        if (genError) {
          throw new Error(`Failed to generate order_number: ${genError.message}`);
        }

        console.log(`📝 Order ${order.id.substring(0, 8)}...`);
        console.log(`   → Generating order_number: ${generatedNumber}`);

        // Update order with generated number
        const { error: updateError } = await supabase
          .from('simple_orders')
          .update({ 
            order_number: generatedNumber,
            updated_at: new Date().toISOString()
          })
          .eq('id', order.id);

        if (updateError) {
          throw new Error(`Failed to update order: ${updateError.message}`);
        }

        console.log(`   ✅ Updated: ${order.id.substring(0, 8)} → ${generatedNumber}`);
        console.log(`   📧 Email: ${order.customer_email || '(no email)'}`);
        console.log(`   💰 Total: €${(order.total_amount_cents / 100).toFixed(2)}`);
        console.log();

        successCount++;

      } catch (orderError) {
        console.error(`   ❌ Error: ${orderError.message}\n`);
        errorCount++;
      }
    }

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 MIGRATION SUMMARY');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`✅ Successfully updated: ${successCount}`);
    console.log(`❌ Failed: ${errorCount}`);
    console.log(`📦 Total processed: ${ordersWithoutNumber.length}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    // 3. Verify migration
    console.log('3️⃣  Verifying migration...');
    const { data: remainingOrders, error: verifyError } = await supabase
      .from('simple_orders')
      .select('id')
      .is('order_number', null);

    if (verifyError) {
      throw new Error(`Verification failed: ${verifyError.message}`);
    }

    if (remainingOrders && remainingOrders.length > 0) {
      console.log(`⚠️  Warning: ${remainingOrders.length} orders still without order_number`);
      console.log('   (These may have failed during update)\n');
    } else {
      console.log('✅ Verification passed - all orders have order_number!\n');
    }

    // 4. Show sample of updated orders
    console.log('4️⃣  Sample of updated orders:');
    const { data: sampleOrders, error: sampleError } = await supabase
      .from('simple_orders')
      .select('id, order_number, customer_email, created_at')
      .order('created_at', { ascending: false })
      .limit(5);

    if (sampleError) {
      throw new Error(`Failed to fetch sample: ${sampleError.message}`);
    }

    if (sampleOrders && sampleOrders.length > 0) {
      console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      sampleOrders.forEach(order => {
        console.log(`${order.order_number} | ${order.customer_email || '(no email)'} | ${new Date(order.created_at).toLocaleDateString('de-DE')}`);
      });
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    }

  } catch (error) {
    console.error('\n❌ MIGRATION FAILED:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

// Run migration
fixMissingOrderNumbers()
  .then(() => {
    console.log('✅ Migration completed successfully!\n');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  });
