#!/usr/bin/env node

/**
 * Verify Simple Orders Schema
 * Checks which columns exist in the simple_orders table
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials');
  console.log('Required: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (sb_secret_...)');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function verifySchema() {
  console.log('🔍 Verifying simple_orders schema...\n');

  // Required columns from migrations 008, 012, 013
  const requiredColumns = [
    // Migration 008 - Customer basics
    'customer_id',
    'stripe_customer_id',
    'customer_name',
    'customer_phone',
    
    // Migration 012 - Customer addresses
    'shipping_address',
    'billing_address',
    
    // Migration 013 - Config data
    'items',
    'config_json',
    'preview_image_url',
    'bom_json',
    'price_breakdown_json',
    'metadata',
    'stripe_checkout_session_id'
  ];

  try {
    // Query information_schema to get actual columns
    const { data, error } = await supabase.rpc('exec_sql', {
      sql: `
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'simple_orders'
        ORDER BY ordinal_position;
      `
    });

    if (error) {
      // Fallback: Try to query the table and check columns
      const { data: sample, error: sampleError } = await supabase
        .from('simple_orders')
        .select('*')
        .limit(1);
      
      if (sampleError) {
        console.error('❌ Error querying schema:', sampleError.message);
        return;
      }

      // Extract column names from the returned object
      const existingColumns = sample.length > 0 ? Object.keys(sample[0]) : [];
      
      console.log('📊 Schema Check (via sample query):\n');
      
      requiredColumns.forEach(col => {
        const exists = existingColumns.includes(col);
        console.log(`${exists ? '✅' : '❌'} ${col}`);
      });

      const missing = requiredColumns.filter(col => !existingColumns.includes(col));
      const present = requiredColumns.filter(col => existingColumns.includes(col));

      console.log(`\n📈 Summary:`);
      console.log(`   Present: ${present.length}/13`);
      console.log(`   Missing: ${missing.length}/13`);

      if (missing.length > 0) {
        console.log(`\n⚠️  Missing columns:`);
        missing.forEach(col => console.log(`   - ${col}`));
        console.log(`\n📝 Action Required:`);
        console.log(`   Run: database/RUN-THIS-NOW-complete-simple-orders-fix.sql`);
      } else {
        console.log(`\n✅ All required columns exist!`);
        console.log(`   Ready to run: node scripts/backfill-customers.js`);
      }

      return;
    }

    // If we got here, we have schema data
    const existingColumns = data.map(row => row.column_name);
    
    console.log('📊 Column Status:\n');
    
    requiredColumns.forEach(col => {
      const exists = existingColumns.includes(col);
      console.log(`${exists ? '✅' : '❌'} ${col}`);
    });

    const missing = requiredColumns.filter(col => !existingColumns.includes(col));
    const present = requiredColumns.filter(col => existingColumns.includes(col));

    console.log(`\n📈 Summary:`);
    console.log(`   Present: ${present.length}/13`);
    console.log(`   Missing: ${missing.length}/13`);

    if (missing.length > 0) {
      console.log(`\n⚠️  Missing columns:`);
      missing.forEach(col => console.log(`   - ${col}`));
      console.log(`\n📝 Action Required:`);
      console.log(`   1. Open Supabase Dashboard → SQL Editor`);
      console.log(`   2. Copy contents of: database/RUN-THIS-NOW-complete-simple-orders-fix.sql`);
      console.log(`   3. Click RUN`);
      console.log(`   4. Verify all columns added`);
      console.log(`   5. Run: node scripts/backfill-customers.js`);
    } else {
      console.log(`\n✅ All required columns exist!`);
      console.log(`\n📝 Next Steps:`);
      console.log(`   1. Run: node scripts/backfill-customers.js`);
      console.log(`   2. Verify customers in admin panel`);
    }

  } catch (err) {
    console.error('❌ Unexpected error:', err.message);
  }
}

verifySchema();
