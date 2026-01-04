#!/usr/bin/env node

/**
 * Test Supabase Connection
 * Verifies that Supabase credentials are valid
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

console.log('🔍 Testing Supabase Connection...\n');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

console.log('Environment Check:');
console.log(`  SUPABASE_URL: ${supabaseUrl ? '✅ Set' : '❌ Missing'}`);
console.log(`  SUPABASE_SERVICE_ROLE_KEY: ${supabaseKey ? '✅ Set' : '❌ Missing'}`);
console.log(`  STRIPE_SECRET_KEY: ${process.env.STRIPE_SECRET_KEY ? '✅ Set' : '❌ Missing'}`);

if (!supabaseUrl || !supabaseKey) {
  console.error('\n❌ Missing required environment variables');
  console.error('Required: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (sb_secret_...)');
  process.exit(1);
}

console.log('\n🔑 Key Validation:');
console.log(`  URL: ${supabaseUrl}`);
console.log(`  Service Key: ${supabaseKey.substring(0, 15)}***`);

// SB KEY SYSTEM ONLY: sb_secret_*
if (supabaseKey.startsWith('sb_secret_')) {
  console.log('  ✅ Format: sb_secret_* (correct)');
} else if (supabaseKey.startsWith('eyJ')) {
  console.log('  ⚠️  Format: eyJ* (legacy JWT - please update to sb_secret_*)');
  console.log('  Get new keys from: Supabase Dashboard → Settings → API');
} else {
  console.error('  ❌ Format: UNKNOWN (not sb_secret_*)');
  console.error('  Expected: sb_secret_...');
  console.error('  Get keys from: Supabase Dashboard → Settings → API');
}

console.log('\nAttempting connection...');

const supabase = createClient(supabaseUrl, supabaseKey);

async function testConnection() {
  try {
    // Try a simple query
    const { data, error } = await supabase
      .from('simple_orders')
      .select('id')
      .limit(1);

    if (error) {
      console.error('\n❌ Connection failed:', error.message);
      console.error('   Code:', error.code);
      console.error('   Details:', error.details);
      
      if (error.message.includes('JWT')) {
        console.error('\n💡 This suggests your SUPABASE_SERVICE_ROLE_KEY is invalid');
        console.error('   Get the correct key from: Supabase Dashboard → Settings → API');
      }
      
      process.exit(1);
    }

    console.log('✅ Connection successful!');
    console.log(`   Found ${data ? data.length : 0} sample order(s)`);
    
    // Check if customer_id column exists (try-catch for connection issues)
    try {
      const { data: testData, error: testError } = await supabase
        .from('simple_orders')
        .select('customer_id')
        .limit(1);
      
      if (testError) {
        if (testError.message && testError.message.includes('customer_id')) {
          console.log('\n⚠️  customer_id column does not exist');
          console.log('   Run the migration first:');
          console.log('   database/RUN-THIS-NOW-complete-simple-orders-fix.sql');
        } else {
          console.warn('\n⚠️  Schema check encountered an error:', testError.message || 'Unknown error');
          console.log('   But basic connection works - you can try running migrations');
        }
      } else {
        console.log('✅ customer_id column exists');
        console.log('   Ready to run backfill!');
      }
    } catch (schemaCheckErr) {
      console.warn('\n⚠️  Could not verify customer_id column (connection issue)');
      console.log('   But basic connection works - you can try:');
      console.log('   1. Run migration: database/RUN-THIS-NOW-complete-simple-orders-fix.sql');
      console.log('   2. Then run: node scripts/backfill-customers.js');
    }

  } catch (err) {
    console.error('\n❌ Unexpected error:', err.message);
    console.error('   Stack:', err.stack);
    process.exit(1);
  }
}

testConnection();
