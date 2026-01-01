/**
 * BACKFILL SCRIPT: Generate missing shop_image_path and thumb_path
 * 
 * Run this once to regenerate thumbnails for all products that are missing them.
 * 
 * Usage:
 *   node scripts/backfill-thumbnails.js
 * 
 * What it does:
 * 1. Finds all products with image_path but missing shop_image_path OR thumb_path
 * 2. For each product:
 *    - Uses existing crop_state (or default centered 4:5)
 *    - Calls generate-thumbnail API for 'shop' and 'thumb'
 *    - Updates DB with new paths
 * 3. Reports results
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env.local') });

const { createClient } = require('@supabase/supabase-js');

// Verify environment variables
if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
  console.error('❌ Missing NEXT_PUBLIC_SUPABASE_URL in environment');
  process.exit(1);
}
if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Missing SUPABASE_SERVICE_ROLE_KEY in environment');
  process.exit(1);
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const BASE_URL = process.env.NEXTAUTH_URL || 'http://localhost:3000';

async function backfillThumbnails() {
  console.log('🔍 [BACKFILL] Starting thumbnail backfill...\n');

  try {
    // 1. Find products with image_path but missing shop_image_path OR thumb_path
    const { data: products, error: fetchError } = await supabase
      .from('products')
      .select('id, sku, name, image_path, image_crop_scale, image_crop_x, image_crop_y, shop_image_path, thumb_path')
      .not('image_path', 'is', null)
      .or('shop_image_path.is.null,thumb_path.is.null');

    if (fetchError) {
      console.error('❌ Failed to fetch products:', fetchError);
      process.exit(1);
    }

    if (!products || products.length === 0) {
      console.log('✅ All products have thumbnails! Nothing to backfill.');
      return;
    }

    console.log(`📋 Found ${products.length} products needing thumbnails:\n`);
    
    products.forEach(p => {
      console.log(`  - ${p.sku || p.id.substring(0, 8)}: ${p.name}`);
      console.log(`    ├─ shop_image_path: ${p.shop_image_path ? '✓' : '✗ MISSING'}`);
      console.log(`    └─ thumb_path: ${p.thumb_path ? '✓' : '✗ MISSING'}\n`);
    });

    console.log('🚀 Starting regeneration...\n');

    // 2. Process each product
    const results = {
      success: [],
      failed: [],
    };

    for (const product of products) {
      console.log(`\n🔧 Processing: ${product.sku || product.id.substring(0, 8)} - ${product.name}`);

      const crop = {
        scale: product.image_crop_scale || 1.0,
        x: product.image_crop_x || 0,
        y: product.image_crop_y || 0,
      };

      console.log(`   Crop: scale=${crop.scale}, x=${crop.x}, y=${crop.y}`);

      const thumbUpdates = {};
      let productSuccess = true;

      // Generate both sizes
      for (const size of ['thumb', 'shop']) {
        // Skip if already exists
        if (size === 'shop' && product.shop_image_path) {
          console.log(`   ✓ shop_image_path already exists - skipping`);
          continue;
        }
        if (size === 'thumb' && product.thumb_path) {
          console.log(`   ✓ thumb_path already exists - skipping`);
          continue;
        }

        try {
          const response = await fetch(`${BASE_URL}/api/admin/products/generate-thumbnail`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              productId: product.id,
              imagePath: product.image_path,
              crop,
              size,
            }),
          });

          if (!response.ok) {
            const error = await response.json();
            console.error(`   ❌ ${size} generation failed:`, error);
            productSuccess = false;
            continue;
          }

          const thumbData = await response.json();
          console.log(`   ✅ ${size} generated:`, thumbData.thumbPath);

          if (size === 'thumb') thumbUpdates.thumb_path = thumbData.thumbPath;
          if (size === 'shop') thumbUpdates.shop_image_path = thumbData.thumbPath;

        } catch (err) {
          console.error(`   ❌ ${size} error:`, err.message);
          productSuccess = false;
        }
      }

      // 3. Update DB with new paths
      if (Object.keys(thumbUpdates).length > 0) {
        try {
          const { error: updateError } = await supabase
            .from('products')
            .update(thumbUpdates)
            .eq('id', product.id);

          if (updateError) {
            console.error(`   ❌ DB update failed:`, updateError);
            productSuccess = false;
          } else {
            console.log(`   ✅ DB updated with:`, thumbUpdates);
          }
        } catch (err) {
          console.error(`   ❌ DB update error:`, err.message);
          productSuccess = false;
        }
      }

      if (productSuccess) {
        results.success.push(product);
      } else {
        results.failed.push(product);
      }
    }

    // 4. Report results
    console.log('\n\n' + '='.repeat(60));
    console.log('📊 BACKFILL RESULTS');
    console.log('='.repeat(60));
    console.log(`✅ Success: ${results.success.length}/${products.length}`);
    console.log(`❌ Failed: ${results.failed.length}/${products.length}`);

    if (results.success.length > 0) {
      console.log('\n✅ Successfully backfilled:');
      results.success.forEach(p => {
        console.log(`   - ${p.sku || p.id.substring(0, 8)}: ${p.name}`);
      });
    }

    if (results.failed.length > 0) {
      console.log('\n❌ Failed to backfill:');
      results.failed.forEach(p => {
        console.log(`   - ${p.sku || p.id.substring(0, 8)}: ${p.name}`);
      });
    }

    console.log('\n' + '='.repeat(60));
    console.log('✅ Backfill complete!');
    console.log('='.repeat(60) + '\n');

  } catch (error) {
    console.error('\n❌ Backfill failed:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  backfillThumbnails()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}

module.exports = { backfillThumbnails };
