#!/usr/bin/env node

/**
 * Quick Start: Product Image Crop System
 * 
 * Führt alle notwendigen Checks und gibt klare Anweisungen
 */

const fs = require('fs');
const path = require('path');

console.log('🚀 Product Image Crop System - Quick Start\n');
console.log('═'.repeat(70) + '\n');

// Step 1: Check if migrations exist
console.log('1️⃣  Checking migrations...');
const supabaseMigration = 'supabase/migrations/005_add_image_focus.sql';
const prismaMigration = 'prisma/migrations/20260101120000_replace_image_fit_with_focus/migration.sql';

const supabaseExists = fs.existsSync(supabaseMigration);
const prismaExists = fs.existsSync(prismaMigration);

if (supabaseExists) {
  console.log('   ✅ Supabase migration found');
} else {
  console.log('   ❌ Supabase migration NOT found');
}

if (prismaExists) {
  console.log('   ✅ Prisma migration found');
} else {
  console.log('   ❌ Prisma migration NOT found');
}

console.log('');

// Step 2: Check ProductImage component
console.log('2️⃣  Checking ProductImage component...');
try {
  const ProductImage = require('./components/ProductImage');
  if (ProductImage.default) {
    console.log('   ✅ ProductImage component ready');
  } else {
    console.log('   ⚠️  ProductImage has no default export');
  }
} catch (err) {
  console.log('   ❌ ProductImage component error:', err.message);
}

console.log('');

// Step 3: Next Steps
console.log('3️⃣  Next Steps:\n');

if (!supabaseExists && !prismaExists) {
  console.log('   ⚠️  WARNING: No migrations found!');
  console.log('   Please check your repository.\n');
} else {
  console.log('   A) Run Migration:');
  console.log('   ──────────────────');
  console.log('   For Supabase (Production):');
  console.log('   1. Open Supabase Dashboard → SQL Editor');
  console.log('   2. Copy content from: supabase/migrations/005_add_image_focus.sql');
  console.log('   3. Execute SQL\n');
  
  console.log('   For Prisma (Local Dev):');
  console.log('   $ npx prisma migrate deploy\n');
  
  console.log('   B) Test Setup:');
  console.log('   ──────────────');
  console.log('   $ node test-product-image-setup.js\n');
  
  console.log('   C) Start Development:');
  console.log('   ────────────────────');
  console.log('   $ npm run dev\n');
  
  console.log('   D) Manual Testing:');
  console.log('   ─────────────────');
  console.log('   1. Admin Edit: http://localhost:3000/backend/products');
  console.log('      → Upload image');
  console.log('      → Use Zoom slider');
  console.log('      → Drag in preview');
  console.log('      → Click Reset');
  console.log('      → Save & Reload\n');
  
  console.log('   2. Shop: http://localhost:3000/shop');
  console.log('      → All images 4:5');
  console.log('      → Crop matches admin\n');
  
  console.log('   3. Admin List: http://localhost:3000/backend/products');
  console.log('      → Thumbnails 4:5\n');
}

// Step 4: Documentation
console.log('4️⃣  Documentation:\n');
console.log('   📄 PRODUCT-IMAGE-TRANSFORM-CROP.md  → Full technical guide');
console.log('   📄 PRODUCT-IMAGE-FINAL-SUMMARY.txt  → Visual summary');
console.log('');

console.log('═'.repeat(70));
console.log('✅ Ready to implement! Follow the steps above.\n');
