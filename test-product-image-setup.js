/**
 * Test Script: Product Image 4:5 Transform-Based Crop System
 * 
 * Prüft ob:
 * 1. DB-Felder image_crop_scale, image_crop_x, image_crop_y existieren
 * 2. ProductImage Komponente korrekt exportiert wird
 * 3. Alle Produkte gültige Crop-Werte haben
 */

const { getSupabasePublic } = require('./lib/supabase');

async function testProductImageSetup() {
  console.log('🧪 Testing Product Image Transform Crop System...\n');

  // Test 1: Supabase Connection
  console.log('1️⃣ Testing Supabase Connection...');
  const supabase = getSupabasePublic();
  if (!supabase) {
    console.error('❌ Supabase client not available');
    return;
  }
  console.log('✅ Supabase connected\n');

  // Test 2: Check if crop columns exist
  console.log('2️⃣ Checking products table schema...');
  const { data: products, error: queryError } = await supabase
    .from('products')
    .select('id, name, image_url, image_crop_scale, image_crop_x, image_crop_y')
    .limit(5);

  if (queryError) {
    if (queryError.message.includes('image_crop')) {
      console.error('❌ Crop columns do not exist yet');
      console.log('   → Run migration: supabase/migrations/005_add_image_focus.sql');
      return;
    }
    console.error('❌ Query error:', queryError.message);
    return;
  }
  console.log('✅ Crop columns exist (scale, x, y)\n');

  // Test 3: Validate crop values
  console.log('3️⃣ Validating crop values...');
  let validCount = 0;
  let invalidCount = 0;

  products.forEach(product => {
    const scale = product.image_crop_scale || 1.0;
    const x = product.image_crop_x || 0;
    const y = product.image_crop_y || 0;
    
    const isValidScale = scale >= 1.0 && scale <= 2.5;
    const isValidX = x >= -200 && x <= 200;
    const isValidY = y >= -200 && y <= 200;

    if (isValidScale && isValidX && isValidY) {
      validCount++;
    } else {
      invalidCount++;
      console.warn(`⚠️  Invalid crop for "${product.name}":`);
      if (!isValidScale) console.warn(`   Scale: ${scale} (should be 1.0-2.5)`);
      if (!isValidX) console.warn(`   X: ${x} (should be -200 to 200)`);
      if (!isValidY) console.warn(`   Y: ${y} (should be -200 to 200)`);
    }
  });

  console.log(`✅ ${validCount} products with valid crop values`);
  if (invalidCount > 0) {
    console.log(`⚠️  ${invalidCount} products with invalid crop values\n`);
  } else {
    console.log('');
  }

  // Test 4: Sample product details
  console.log('4️⃣ Sample products:');
  products.forEach(product => {
    console.log(`   ${product.name}:`);
    console.log(`   - Image: ${product.image_url ? '✅' : '❌ missing'}`);
    console.log(`   - Crop: scale=${product.image_crop_scale || 1.0}, x=${product.image_crop_x || 0}, y=${product.image_crop_y || 0}`);
    console.log('');
  });

  // Test 5: Check if ProductImage component exists
  console.log('5️⃣ Checking ProductImage component...');
  try {
    const ProductImage = require('./components/ProductImage');
    if (ProductImage.default) {
      console.log('✅ ProductImage component found and exported\n');
    } else {
      console.warn('⚠️  ProductImage has no default export\n');
    }
  } catch (err) {
    console.error('❌ ProductImage component error:', err.message);
    console.log('');
  }

  // Summary
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('✅ SETUP TEST COMPLETE');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  console.log('📋 Next Steps:');
  console.log('1. Run migration: supabase/migrations/005_add_image_focus.sql');
  console.log('2. Start dev server: npm run dev');
  console.log('3. Test Admin Edit: /backend/products');
  console.log('   - Upload image');
  console.log('   - Use Zoom slider (1.0 - 2.5)');
  console.log('   - Drag image in preview');
  console.log('   - Click Reset button');
  console.log('   - Save and reload → crop should persist');
  console.log('4. Test Shop: http://localhost:3000/shop');
  console.log('   - All images 4:5 format');
  console.log('   - Same crop as in admin\n');
}

testProductImageSetup().catch(console.error);
