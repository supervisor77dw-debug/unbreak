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

// Validation
if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ Missing Supabase environment variables!');
  console.error('Required:');
  console.error('  - NEXT_PUBLIC_SUPABASE_URL');
  console.error('  - NEXT_PUBLIC_SUPABASE_ANON_KEY');
  console.error('\nMake sure .env.local exists with these variables.');
  process.exit(1);
}

console.log('🔧 Injecting Supabase credentials...\n');

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
