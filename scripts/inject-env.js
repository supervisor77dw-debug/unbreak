#!/usr/bin/env node

/**
 * UNBREAK ONE - Inject Supabase Environment Variables
 * ====================================================
 * Purpose: Replace placeholders in HTML files with actual Supabase credentials
 * Usage: node scripts/inject-env.js
 * When: Before build or deployment
 */

const fs = require('fs');
const path = require('path');

// Files to process
const files = [
  'public/login.html',
  'public/account.html',
  'public/ops.html',
  'public/admin.html',
  'public/components/header.js'
];

// Get environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Detect environment
const isVercel = process.env.VERCEL === '1';
const isCI = process.env.CI === 'true' || process.env.CI === '1';
const environment = isVercel ? 'Vercel' : isCI ? 'CI' : 'Local';

// Validation
if (!supabaseUrl || !supabaseAnonKey) {
  console.error('\n' + '='.repeat(70));
  console.error('❌ MISSING SUPABASE ENVIRONMENT VARIABLES');
  console.error('='.repeat(70));
  console.error('\nRequired variables:');
  console.error('  • NEXT_PUBLIC_SUPABASE_URL');
  console.error('  • NEXT_PUBLIC_SUPABASE_ANON_KEY');
  
  console.error('\n📍 Current environment:', environment);
  
  if (isVercel) {
    console.error('\n🚀 VERCEL DEPLOYMENT - ACTION REQUIRED:');
    console.error('   1. Go to: Vercel Dashboard → Your Project → Settings');
    console.error('   2. Click: Environment Variables');
    console.error('   3. Add the following variables for ALL ENVIRONMENTS:');
    console.error('      (Production, Preview, Development)');
    console.error('');
    console.error('      Variable Name                     Value');
    console.error('      ─────────────────────────────────────────────────────');
    console.error('      NEXT_PUBLIC_SUPABASE_URL          https://xxx.supabase.co');
    console.error('      NEXT_PUBLIC_SUPABASE_ANON_KEY     eyJhbGciOiJIUzI1NiIs...');
    console.error('');
    console.error('   4. Get values from: https://app.supabase.com/project/YOUR_PROJECT/settings/api');
    console.error('   5. Redeploy after saving');
    console.error('');
    console.error('   📖 Full guide: https://vercel.com/docs/concepts/projects/environment-variables');
  } else if (isCI) {
    console.error('\n🔧 CI ENVIRONMENT - ACTION REQUIRED:');
    console.error('   Configure environment variables in your CI/CD settings.');
  } else {
    console.error('\n💻 LOCAL DEVELOPMENT - ACTION REQUIRED:');
    console.error('   1. Copy .env.example to .env.local:');
    console.error('      cp .env.example .env.local');
    console.error('');
    console.error('   2. Edit .env.local and add your Supabase credentials:');
    console.error('      NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co');
    console.error('      NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIs...');
    console.error('');
    console.error('   3. Get values from: https://app.supabase.com/project/YOUR_PROJECT/settings/api');
  }
  
  console.error('\n' + '='.repeat(70));
  console.error('Build cannot continue without these variables.');
  console.error('='.repeat(70) + '\n');
  process.exit(1);
}

console.log('🔧 Injecting Supabase credentials...');
console.log(`📍 Environment: ${environment}`);
console.log(`🔗 Supabase URL: ${supabaseUrl.substring(0, 30)}...`);
console.log('');

let successCount = 0;
let errorCount = 0;

// Process each file
files.forEach(file => {
  const filePath = path.join(process.cwd(), file);

  try {
    // Check if file exists
    if (!fs.existsSync(filePath)) {
      console.warn(`⚠️  File not found: ${file} (skipping)`);
      return;
    }

    // Read file content
    let content = fs.readFileSync(filePath, 'utf8');

    // Check if placeholders exist
    const hasUrlPlaceholder = content.includes('YOUR_SUPABASE_URL');
    const hasKeyPlaceholder = content.includes('YOUR_SUPABASE_ANON_KEY');

    if (!hasUrlPlaceholder && !hasKeyPlaceholder) {
      console.log(`⏭️  ${file} - No placeholders found (already processed?)`);
      return;
    }

    // Replace placeholders
    content = content.replace(/YOUR_SUPABASE_URL/g, supabaseUrl);
    content = content.replace(/YOUR_SUPABASE_ANON_KEY/g, supabaseAnonKey);

    // Write back
    fs.writeFileSync(filePath, content, 'utf8');

    console.log(`✅ ${file}`);
    successCount++;

  } catch (error) {
    console.error(`❌ ${file} - Error: ${error.message}`);
    errorCount++;
  }
});

// Summary
console.log('\n' + '='.repeat(50));
console.log(`✓ ${successCount} files processed`);
if (errorCount > 0) {
  console.log(`✗ ${errorCount} files failed`);
}
console.log('='.repeat(50));

if (errorCount > 0) {
  process.exit(1);
}

console.log('\n✨ Environment injection complete!\n');
