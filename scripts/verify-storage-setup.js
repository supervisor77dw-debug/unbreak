/**
 * Diagnostic Tool: Verify Storage Bucket Setup
 * 
 * Run this to check if storage is correctly configured
 * 
 * Usage:
 *   node scripts/verify-storage-setup.js
 */

const { createClient } = require('@supabase/supabase-js');
const { config } = require('dotenv');

config({ path: '.env.local' });

const PRODUCT_IMAGES_BUCKET = 'product-images';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function verifySetup() {
  console.log('🔍 Verifying Storage Setup...\n');

  // 1. Check if bucket exists
  console.log('1️⃣ Checking bucket existence...');
  try {
    const { data: buckets, error } = await supabase.storage.listBuckets();
    
    if (error) {
      console.error('❌ Error listing buckets:', error.message);
      return false;
    }

    const bucket = buckets.find(b => b.id === PRODUCT_IMAGES_BUCKET);
    if (!bucket) {
      console.error(`❌ Bucket '${PRODUCT_IMAGES_BUCKET}' NOT FOUND`);
      console.log('📝 Run database/EXECUTE-NOW.sql in Supabase Dashboard');
      return false;
    }

    console.log(`✅ Bucket '${PRODUCT_IMAGES_BUCKET}' exists`);
    console.log(`   - Public: ${bucket.public}`);
    console.log(`   - Created: ${bucket.created_at}\n`);

  } catch (err) {
    console.error('❌ Failed to check buckets:', err.message);
    return false;
  }

  // 2. List files in bucket
  console.log('2️⃣ Listing files in bucket...');
  try {
    const { data: files, error } = await supabase.storage
      .from(PRODUCT_IMAGES_BUCKET)
      .list('products');
    
    if (error) throw error;
    
    console.log(`✅ Found ${files.length} files in products/ folder`);
    
    if (files.length > 0) {
      console.log('\n   Recent uploads:');
      files.slice(0, 5).forEach(f => {
        console.log(`   - ${f.name} (${(f.metadata.size / 1024).toFixed(1)} KB)`);
      });
    } else {
      console.log('   ℹ️  No files uploaded yet');
    }
    console.log('');

  } catch (err) {
    console.error('❌ Failed to list files:', err.message);
    return false;
  }

  // 3. Check database products
  console.log('3️⃣ Checking products in database...');
  try {
    const { data: products, error } = await supabase
      .from('products')
      .select('id, name, sku, image_url')
      .not('image_url', 'is', null)
      .order('created_at', { ascending: false })
      .limit(10);

    if (error) {
      console.error('❌ Error querying products:', error.message);
      return false;
    }

    console.log(`✅ Found ${products.length} products with images\n`);

    if (products.length > 0) {
      console.log('   Image URLs:');
      products.forEach(p => {
        const isCorrect = p.image_url.includes('/product-images/');
        const status = isCorrect ? '✅' : '❌';
        console.log(`   ${status} ${p.sku}: ${p.image_url.substring(0, 80)}...`);
      });

      const wrongUrls = products.filter(p => !p.image_url.includes('/product-images/'));
      if (wrongUrls.length > 0) {
        console.log(`\n   ⚠️  ${wrongUrls.length} products have wrong bucket name`);
        console.log('   📝 Run database/fix-image-urls.sql to fix');
      }
    }
    console.log('');

  } catch (err) {
    console.error('❌ Failed to check products:', err.message);
    return false;
  }

  // 4. Test public URL generation
  console.log('4️⃣ Testing public URL generation...');
  try {
    const testPath = 'products/test-product-123.jpg';
    const { data } = supabase.storage
      .from(PRODUCT_IMAGES_BUCKET)
      .getPublicUrl(testPath);

    console.log('✅ Public URL generation works');
    console.log(`   Example: ${data.publicUrl}\n`);

  } catch (err) {
    console.error('❌ Failed to generate public URL:', err.message);
    return false;
  }

  // Summary
  console.log('═'.repeat(50));
  console.log('✅ Storage setup verification PASSED');
  console.log('═'.repeat(50));
  console.log('\nNext steps:');
  console.log('1. Ensure SUPABASE_SERVICE_ROLE_KEY is set in Vercel');
  console.log('2. If any products have wrong URLs, run database/fix-image-urls.sql');
  console.log('3. Test upload at /backend/products');
  
  return true;
}

verifySetup()
  .then(success => {
    process.exit(success ? 0 : 1);
  })
  .catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
  });
