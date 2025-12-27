/**
 * UNBREAK ONE - Production Readiness Test Script
 * Run this to verify all systems are operational
 */

const { createClient } = require('@supabase/supabase-js');
const Stripe = require('stripe');
require('dotenv').config({ path: '.env.local' });

// Colors for terminal output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

async function runTests() {
  log('\n=== UNBREAK ONE - PRODUCTION READINESS TEST ===\n', 'cyan');
  
  const results = {
    passed: 0,
    failed: 0,
    warnings: 0,
  };

  // Test 1: Environment Variables
  log('TEST 1: Environment Variables', 'cyan');
  const requiredEnvVars = [
    'SUPABASE_URL',
    'SUPABASE_SERVICE_ROLE_KEY',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    'STRIPE_SECRET_KEY',
    'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY',
  ];

  const optionalEnvVars = [
    'STRIPE_WEBHOOK_SECRET',
  ];

  requiredEnvVars.forEach(varName => {
    if (process.env[varName]) {
      log(`  ✓ ${varName}`, 'green');
      results.passed++;
    } else {
      log(`  ✗ ${varName} (FEHLT!)`, 'red');
      results.failed++;
    }
  });

  optionalEnvVars.forEach(varName => {
    if (process.env[varName]) {
      log(`  ✓ ${varName}`, 'green');
      results.passed++;
    } else {
      log(`  ⚠ ${varName} (optional, für Webhook benötigt)`, 'yellow');
      results.warnings++;
    }
  });

  // Test 2: Supabase Connection
  log('\nTEST 2: Supabase Connection', 'cyan');
  try {
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const { data, error } = await supabase.from('products').select('count');
    
    if (error) throw error;
    
    log(`  ✓ Verbindung erfolgreich`, 'green');
    results.passed++;
  } catch (error) {
    log(`  ✗ Fehler: ${error.message}`, 'red');
    results.failed++;
  }

  // Test 3: Database Tables
  log('\nTEST 3: Database Tables', 'cyan');
  const tables = [
    'products',
    'product_options',
    'configurations',
    'customers',
    'orders',
    'payments',
    'production_jobs',
  ];

  try {
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    for (const table of tables) {
      const { error } = await supabase.from(table).select('id').limit(1);
      
      if (error) {
        log(`  ✗ ${table}: ${error.message}`, 'red');
        results.failed++;
      } else {
        log(`  ✓ ${table}`, 'green');
        results.passed++;
      }
    }
  } catch (error) {
    log(`  ✗ Fehler: ${error.message}`, 'red');
    results.failed++;
  }

  // Test 4: Products Seeded
  log('\nTEST 4: Products in Database', 'cyan');
  try {
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const { data: products, error } = await supabase
      .from('products')
      .select('sku, name, base_price_cents')
      .eq('active', true);

    if (error) throw error;

    if (products && products.length > 0) {
      log(`  ✓ ${products.length} Produkte gefunden`, 'green');
      products.forEach(p => {
        log(`    - ${p.sku}: ${p.name} (€${(p.base_price_cents / 100).toFixed(2)})`, 'green');
      });
      results.passed++;
    } else {
      log(`  ⚠ Keine Produkte gefunden - bitte Seed-Daten einfügen`, 'yellow');
      results.warnings++;
    }
  } catch (error) {
    log(`  ✗ Fehler: ${error.message}`, 'red');
    results.failed++;
  }

  // Test 5: Stripe Connection
  log('\nTEST 5: Stripe Connection', 'cyan');
  try {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    const balance = await stripe.balance.retrieve();
    
    log(`  ✓ Stripe API erreichbar`, 'green');
    log(`    Mode: ${process.env.STRIPE_SECRET_KEY.startsWith('sk_test') ? 'TEST' : 'LIVE'}`, 'yellow');
    results.passed++;
  } catch (error) {
    log(`  ✗ Fehler: ${error.message}`, 'red');
    results.failed++;
  }

  // Test 6: API Files Exist
  log('\nTEST 6: API Endpoints', 'cyan');
  const fs = require('fs');
  const apiFiles = [
    'pages/api/checkout/create.js',
    'pages/api/stripe/webhook.js',
  ];

  apiFiles.forEach(file => {
    if (fs.existsSync(file)) {
      log(`  ✓ ${file}`, 'green');
      results.passed++;
    } else {
      log(`  ✗ ${file} (FEHLT!)`, 'red');
      results.failed++;
    }
  });

  // Test 7: Frontend Files
  log('\nTEST 7: Frontend Files', 'cyan');
  const frontendFiles = [
    'public/success.html',
    'public/cancel.html',
    'public/checkout.js',
  ];

  frontendFiles.forEach(file => {
    if (fs.existsSync(file)) {
      log(`  ✓ ${file}`, 'green');
      results.passed++;
    } else {
      log(`  ✗ ${file} (FEHLT!)`, 'red');
      results.failed++;
    }
  });

  // Summary
  log('\n=== TEST SUMMARY ===', 'cyan');
  log(`Passed:   ${results.passed}`, 'green');
  log(`Failed:   ${results.failed}`, results.failed > 0 ? 'red' : 'green');
  log(`Warnings: ${results.warnings}`, 'yellow');

  if (results.failed === 0) {
    log('\n✅ SYSTEM LAUNCH READY!', 'green');
    log('\nNächste Schritte:', 'cyan');
    log('1. Webhook lokal testen: stripe listen --forward-to localhost:3000/api/stripe/webhook');
    log('2. Test-Zahlung durchführen (4242 4242 4242 4242)');
    log('3. Supabase Orders prüfen');
    log('4. Production ENV vorbereiten');
    log('\nSiehe LAUNCH-GUIDE.md für Details.', 'yellow');
  } else {
    log('\n❌ FEHLER GEFUNDEN - Bitte beheben vor Launch!', 'red');
  }

  process.exit(results.failed > 0 ? 1 : 0);
}

// Run tests
runTests().catch(error => {
  log(`\n❌ Test-Script Fehler: ${error.message}`, 'red');
  process.exit(1);
});
