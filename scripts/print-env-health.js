#!/usr/bin/env node

/**
 * ENV Health Check
 * 
 * Checks if all required environment variables are set
 * WITHOUT leaking any secrets
 * 
 * Usage: node scripts/print-env-health.js
 */

require('dotenv').config({ path: '.env.local' });

// Required environment variables
const REQUIRED_VARS = {
  // Supabase
  'NEXT_PUBLIC_SUPABASE_URL': { prefix: 'https://', public: true },
  'NEXT_PUBLIC_SUPABASE_ANON_KEY': { prefix: 'sb_publishable_', public: true },
  'SUPABASE_URL': { prefix: 'https://', public: false },
  'SUPABASE_SERVICE_ROLE_KEY': { prefix: 'sb_secret_', public: false },
  
  // Stripe
  'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY': { prefix: 'pk_test_', public: true },
  'STRIPE_SECRET_KEY': { prefix: 'sk_test_', public: false },
  'STRIPE_WEBHOOK_SECRET': { prefix: 'whsec_', public: false },
  
  // Auth
  'NEXTAUTH_SECRET': { prefix: null, public: false },
  'NEXTAUTH_URL': { prefix: 'http', public: false },
  
  // Database
  'DATABASE_URL': { prefix: 'postgresql://', public: false },
  'DIRECT_URL': { prefix: 'postgresql://', public: false },
  
  // Email
  'RESEND_API_KEY': { prefix: 're_', public: false },
  'RESEND_FROM': { prefix: null, public: false },
  'SHOP_OWNER_EMAIL': { prefix: null, public: false },
  
  // Admin
  'ADMIN_SEED_EMAIL': { prefix: null, public: false },
  'ADMIN_SEED_PASSWORD': { prefix: null, public: false }
};

function maskValue(value) {
  if (!value) return 'MISSING';
  if (value.length <= 10) return value.substring(0, 3) + '***';
  return value.substring(0, 6) + '***' + value.substring(value.length - 3);
}

function checkEnvHealth() {
  console.log('🔍 Environment Variables Health Check\n');
  console.log('Loading from: .env.local\n');
  
  let allOk = true;
  let missingCount = 0;
  let prefixIssues = 0;
  
  const categories = {
    'Supabase': ['NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY', 'SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'],
    'Stripe': ['NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY', 'STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET'],
    'Auth': ['NEXTAUTH_SECRET', 'NEXTAUTH_URL'],
    'Database': ['DATABASE_URL', 'DIRECT_URL'],
    'Email': ['RESEND_API_KEY', 'RESEND_FROM', 'SHOP_OWNER_EMAIL'],
    'Admin': ['ADMIN_SEED_EMAIL', 'ADMIN_SEED_PASSWORD']
  };
  
  for (const [category, vars] of Object.entries(categories)) {
    console.log(`\n📦 ${category}:`);
    
    for (const varName of vars) {
      const config = REQUIRED_VARS[varName];
      const value = process.env[varName];
      
      let status = '✅';
      let message = 'OK';
      let details = '';
      
      if (!value) {
        status = '❌';
        message = 'MISSING';
        allOk = false;
        missingCount++;
      } else if (config.prefix && !value.startsWith(config.prefix)) {
        status = '⚠️ ';
        message = 'WRONG PREFIX';
        details = `Expected: ${config.prefix}***, Got: ${maskValue(value)}`;
        allOk = false;
        prefixIssues++;
      } else {
        if (config.prefix) {
          details = `(${config.prefix}***)`;
        } else {
          details = `(${maskValue(value)})`;
        }
      }
      
      const visibility = config.public ? '🌍 PUBLIC' : '🔒 SECRET';
      console.log(`  ${status} ${varName}`);
      console.log(`     Status: ${message} ${details}`);
      console.log(`     Scope: ${visibility}`);
    }
  }
  
  // Security Warnings
  console.log('\n\n🔐 Security Check:');
  
  const secretInPublic = Object.keys(REQUIRED_VARS)
    .filter(key => key.startsWith('NEXT_PUBLIC_'))
    .some(key => {
      const value = process.env[key];
      return value && (
        value.startsWith('sb_secret_') ||
        value.startsWith('sk_test_') ||
        value.startsWith('sk_live_') ||
        value.includes('secret')
      );
    });
  
  if (secretInPublic) {
    console.log('  ❌ CRITICAL: Secret key in NEXT_PUBLIC_* variable!');
    console.log('     This will leak secrets to the browser!');
    allOk = false;
  } else {
    console.log('  ✅ No secrets in NEXT_PUBLIC_* variables');
  }
  
  // Supabase Key Format Check
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  console.log('\n📋 Supabase Key Format:');
  
  if (anonKey) {
    if (anonKey.startsWith('sb_publishable_')) {
      console.log('  ✅ Anon key: sb_publishable_* (NEW FORMAT)');
    } else if (anonKey.startsWith('eyJ')) {
      console.log('  ⚠️  Anon key: eyJ* (LEGACY JWT - update recommended)');
    } else {
      console.log('  ❌ Anon key: UNKNOWN FORMAT');
      allOk = false;
    }
  }
  
  if (serviceKey) {
    if (serviceKey.startsWith('sb_secret_')) {
      console.log('  ✅ Service key: sb_secret_* (NEW FORMAT)');
    } else if (serviceKey.startsWith('eyJ')) {
      console.log('  ⚠️  Service key: eyJ* (LEGACY JWT - update recommended)');
    } else {
      console.log('  ❌ Service key: UNKNOWN FORMAT');
      allOk = false;
    }
  }
  
  // Summary
  console.log('\n\n📊 Summary:');
  console.log(`  Total variables: ${Object.keys(REQUIRED_VARS).length}`);
  console.log(`  Missing: ${missingCount}`);
  console.log(`  Prefix issues: ${prefixIssues}`);
  
  if (allOk) {
    console.log('\n✅ All environment variables are configured correctly!');
    console.log('\nNext steps:');
    console.log('  1. node scripts/test-supabase-connection.js');
    console.log('  2. node scripts/backfill-customers.js');
    return 0;
  } else {
    console.log('\n❌ Environment configuration has issues!');
    console.log('\nFix by:');
    console.log('  1. Copy missing values from Vercel Dashboard → Environment Variables');
    console.log('  2. Paste into .env.local');
    console.log('  3. Ensure Supabase keys use sb_publishable_* and sb_secret_* format');
    console.log('  4. Run this script again');
    return 1;
  }
}

const exitCode = checkEnvHealth();
process.exit(exitCode);
