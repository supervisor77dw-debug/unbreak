#!/usr/bin/env node
/**
 * ENV Validation Script
 * Run before npm run dev to verify all required ENV vars are set
 * 
 * Usage: node scripts/validate-env.js
 */

require('dotenv').config({ path: '.env.local' });

// Required ENV vars for full functionality
const REQUIRED_VARS = {
  // Stripe
  STRIPE_CHECKOUT_MODE: 'test oder live',
  STRIPE_SECRET_KEY_TEST: 'sk_test_... (für lokalen Test)',
  STRIPE_WEBHOOK_SECRETS: 'whsec_... (von stripe listen)',
  
  // Database
  SUPABASE_SERVICE_ROLE_KEY: 'eyJ... (Supabase Dashboard)',
  
  // Email
  RESEND_API_KEY: 're_... (Resend Dashboard)',
  EMAIL_FROM_ORDERS: 'orders@domain.com',
  ADMIN_ORDER_EMAIL: 'admin@example.com',
  
  // Auth
  NEXTAUTH_SECRET: '32+ Zeichen',
  NEXTAUTH_URL: 'http://localhost:3000',
};

// Optional but recommended
const OPTIONAL_VARS = {
  STRIPE_SECRET_KEY_LIVE: 'sk_live_... (für Production)',
  EMAIL_FROM_SUPPORT: 'support@domain.com',
  EMAIL_FROM_NO_REPLY: 'no-reply@domain.com',
  NEXT_PUBLIC_SUPABASE_URL: 'https://xxx.supabase.co',
  NEXT_PUBLIC_SUPABASE_ANON_KEY: 'eyJ...',
};

console.log('');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('🔍 UNBREAK ONE - ENV VALIDATION');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('');

let hasErrors = false;
let hasWarnings = false;

// Check required vars
console.log('📋 REQUIRED VARIABLES:');
console.log('');

for (const [name, description] of Object.entries(REQUIRED_VARS)) {
  const value = process.env[name];
  if (!value) {
    console.log(`   ❌ ${name}`);
    console.log(`      └─ ${description}`);
    hasErrors = true;
  } else {
    // Mask sensitive values
    let displayValue = value;
    if (name.includes('KEY') || name.includes('SECRET')) {
      displayValue = value.substring(0, 10) + '...' + value.substring(value.length - 4);
    } else if (name.includes('EMAIL') && value.includes('@')) {
      displayValue = value; // Show emails
    }
    console.log(`   ✅ ${name} = ${displayValue}`);
  }
}

console.log('');

// Validate STRIPE_CHECKOUT_MODE
const mode = process.env.STRIPE_CHECKOUT_MODE;
if (mode && mode !== 'test' && mode !== 'live') {
  console.log(`   ⚠️  STRIPE_CHECKOUT_MODE muss 'test' oder 'live' sein, ist: '${mode}'`);
  hasErrors = true;
}

// Check mode-specific key
if (mode === 'test' && !process.env.STRIPE_SECRET_KEY_TEST) {
  console.log(`   ❌ STRIPE_CHECKOUT_MODE=test aber STRIPE_SECRET_KEY_TEST fehlt!`);
  hasErrors = true;
}
if (mode === 'live' && !process.env.STRIPE_SECRET_KEY_LIVE) {
  console.log(`   ❌ STRIPE_CHECKOUT_MODE=live aber STRIPE_SECRET_KEY_LIVE fehlt!`);
  hasErrors = true;
}

console.log('');
console.log('📋 OPTIONAL VARIABLES:');
console.log('');

for (const [name, description] of Object.entries(OPTIONAL_VARS)) {
  const value = process.env[name];
  if (!value) {
    console.log(`   ⚠️  ${name} (nicht gesetzt)`);
    hasWarnings = true;
  } else {
    let displayValue = value;
    if (name.includes('KEY') || name.includes('SECRET')) {
      displayValue = value.substring(0, 10) + '...' + value.substring(value.length - 4);
    }
    console.log(`   ✅ ${name} = ${displayValue}`);
  }
}

console.log('');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

if (hasErrors) {
  console.log('');
  console.log('❌ VALIDATION FAILED');
  console.log('');
  console.log('Bitte setze die fehlenden Variablen in .env.local');
  console.log('Vorlage: .env.local.example');
  console.log('');
  process.exit(1);
} else if (hasWarnings) {
  console.log('');
  console.log('⚠️  VALIDATION PASSED (mit Warnungen)');
  console.log('');
  console.log('Optionale Variablen fehlen - manche Features funktionieren evtl. nicht.');
  console.log('');
  process.exit(0);
} else {
  console.log('');
  console.log('✅ VALIDATION PASSED');
  console.log('');
  console.log('Alle ENV-Variablen sind korrekt gesetzt.');
  console.log('');
  process.exit(0);
}
