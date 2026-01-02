/**
 * THUMBNAIL GENERATOR - Server-Side Image Crop & Resize
 * 
 * Generiert 4:5 Thumbnails mit exaktem Crop aus Original-Bild
 * 
 * POST /api/admin/products/generate-thumbnail
 * Body: { productId, imagePath, crop: {scale, x, y}, size: 'thumb' | 'shop' }
 * 
 * Returns: { thumbPath, url }
 */

import { createClient } from '@supabase/supabase-js';
import sharp from 'sharp';
import crypto from 'crypto';
import { computeCropRectOriginalPx } from '../../../../lib/crop-utils';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Thumbnail Sizes (4:5 aspect ratio)
const SIZES = {
  thumb: { width: 240, height: 300 },   // Admin List
  shop: { width: 900, height: 1125 },   // Shop Cards (hochauflösend für Retina)
};

/**
 * Generiert Hash aus Crop-State für Cache-Busting
 * WICHTIG: Inkludiert productId für Isolation zwischen Produkten
 */
function generateCropHash(productId, imagePath, crop) {
  const cropString = `${productId}_${imagePath}_${crop.scale}_${crop.x}_${crop.y}`;
  return crypto.createHash('md5').update(cropString).digest('hex').substring(0, 8);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { productId, imagePath, crop, size = 'thumb' } = req.body;

    if (!productId || !imagePath) {
      return res.status(400).json({ error: 'Missing productId or imagePath' });
    }

    if (!SIZES[size]) {
      return res.status(400).json({ error: 'Invalid size. Use: thumb, shop' });
    }

    console.log('\n🎨 [THUMBNAIL GEN] START:', {
      productId,
      imagePath,
      size,
      crop,
      timestamp: new Date().toISOString(),
    });

    // 1. Download Original von Supabase Storage
    console.log('[Thumbnail] Downloading original:', imagePath);
    const { data: fileData, error: downloadError } = await supabase
      .storage
      .from('product-images')
      .download(imagePath);

    if (downloadError || !fileData) {
      console.error('[Thumbnail] Download failed:', downloadError);
      return res.status(500).json({ error: 'Failed to download original image' });
    }

    // 2. Buffer zu Sharp
    const buffer = Buffer.from(await fileData.arrayBuffer());
    const image = sharp(buffer);
    const metadataBefore = await image.metadata();

    // ⚡ DEBUG: INPUT SOURCE (A)
    console.log('📥 [PIPELINE INPUT SOURCE]', {
      productId,
      source_path: imagePath,
      source_url: `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/product-images/${imagePath}`,
      format: metadataBefore.format,
      hasAlpha: metadataBefore.hasAlpha,
      density: metadataBefore.density,
      metadata_BEFORE_rotate: {
        width: metadataBefore.width,
        height: metadataBefore.height,
        orientation: metadataBefore.orientation,
      },
    });

    // 3. NORMALIZE: Rotate/Auto-Orient FIRST (respects EXIF for JPG, harmless for PNG)
    const normalizedImage = sharp(buffer).rotate(); // Auto-rotates based on EXIF
    const metadata = await normalizedImage.metadata();

    // ⚡ DEBUG: AFTER NORMALIZATION
    console.log('🔄 [PIPELINE AFTER NORMALIZE]', {
      productId,
      metadata_AFTER_rotate: {
        width: metadata.width,
        height: metadata.height,
        orientation: metadata.orientation, // Should be 1 or undefined after rotate()
      },
      note: 'All crop math now uses THESE dimensions (post-rotation)',
    });

    // 4. ONE CROP RECT TO RULE THEM ALL
    // Compute CropRect ONCE in original pixels - same for shop AND thumb!
    
    // 🔥 DB_CROP_STATE: Log what we read from DB
    const cropVersion = crop?.cropVersion || crop?.image_crop_version || 1;
    console.log('💾 DB_CROP_STATE', {
      productId,
      db: {
        cropVersion,
        scale: crop?.scale,
        nx: crop?.nx,  // v2
        ny: crop?.ny,  // v2
        x: crop?.x,    // v1 legacy
        y: crop?.y,    // v1 legacy
      },
      timestamp: new Date().toISOString(),
    });
    
    // 🔥 FAIL-FAST: If v2 but nx/ny missing, abort
    if (cropVersion === 2) {
      const hasNx = typeof crop?.nx === 'number' && !isNaN(crop.nx);
      const hasNy = typeof crop?.ny === 'number' && !isNaN(crop.ny);
      
      if (!hasNx || !hasNy) {
        console.error('❌ [CROP ERROR] cropVersion=2 but nx/ny missing or NaN!', {
          productId,
          nx: crop?.nx,
          ny: crop?.ny,
          hasNx,
          hasNy
        });
        throw new Error(`[CROP ERROR] Product ${productId}: cropVersion=2 requires valid nx/ny. Got nx=${crop?.nx}, ny=${crop?.ny}`);
      }
    }
    
    const cropRect = computeCropRectOriginalPx(
      metadata.width,
      metadata.height,
      0.8, // 4:5 aspect ratio (width/height = 0.8)
      crop?.scale || 1.0,
      crop?.nx || 0,   // v2: normalized offsets
      crop?.ny || 0,   // v2: normalized offsets
      cropVersion,
      crop?.x || 0,    // v1: legacy x (for migration)
      crop?.y || 0     // v1: legacy y (for migration)
    );

    // ═══════════════════════════════════════════════════════════════════
    // HARD ASSERTION: Verify scale is actually applied!
    // ═══════════════════════════════════════════════════════════════════
    
    // Calculate expected values manually
    const origAspect = metadata.width / metadata.height;
    const targetAspect = 0.8; // 4:5
    
    let baseWidth, baseHeight;
    if (origAspect > targetAspect) {
      baseHeight = metadata.height;
      baseWidth = baseHeight * targetAspect;
    } else {
      baseWidth = metadata.width;
      baseHeight = baseWidth / targetAspect;
    }
    
    const userScale = crop?.scale || 1.0;
    const expectedWidth = Math.round(baseWidth / userScale);
    const expectedHeight = Math.round(baseHeight / userScale);
    
    const widthMatches = cropRect.width === expectedWidth;
    const heightMatches = cropRect.height === expectedHeight;
    const scaleApplied = widthMatches && heightMatches;

    // ⚡ CRITICAL ASSERTION LOG
    console.log('🔥 [HARD ASSERTION - SCALE CHECK]', {
      productId,
      size,
      inputCrop: {
        scale: userScale,
        x: crop?.x || 0,
        y: crop?.y || 0,
      },
      baseRect: {
        baseW: Math.round(baseWidth),
        baseH: Math.round(baseHeight),
      },
      expectedCropRect: {
        expectedWidth,
        expectedHeight,
        calculation: `baseWidth(${Math.round(baseWidth)}) / scale(${userScale}) = ${expectedWidth}`,
      },
      actualCropRect: {
        left: cropRect.left,
        top: cropRect.top,
        width: cropRect.width,
        height: cropRect.height,
      },
      assertion: {
        widthMatches: widthMatches ? '✅' : `❌ Expected ${expectedWidth}, got ${cropRect.width}`,
        heightMatches: heightMatches ? '✅' : `❌ Expected ${expectedHeight}, got ${cropRect.height}`,
        SCALE_APPLIED: scaleApplied ? '✅ PASS' : '❌ FAIL - SCALE NOT APPLIED!',
      },
      cropRectHash: cropRect.debug.hash,
    });
    
    // 🔥 CROP_SERVER_PIPELINE: Single-line JSON log (as specified)
    console.log(`[CROP_SERVER_PIPELINE] productId=${productId} source=db cropVersion=${cropVersion}`, {
      origW: metadata.width,
      origH: metadata.height,
      baseW: Math.round(baseWidth),
      baseH: Math.round(baseHeight),
      scale: userScale,
      nx: crop?.nx || 0,
      ny: crop?.ny || 0,
      cropW: cropRect.width,
      cropH: cropRect.height,
      offsetX: cropRect.debug.offsetPixels,
      left: cropRect.left,
      top: cropRect.top,
      clampedLeft: cropRect.left,
      clampedTop: cropRect.top,
      wasClamped: cropRect.debug.wasClamped,
      offsetSource: cropRect.debug.offsetSource
    });
    
    // FAIL HARD if scale is not applied
    if (!scaleApplied && userScale !== 1.0) {
      console.error('❌❌❌ CRITICAL BUG: Scale param ignored in production pipeline! ❌❌❌');
      console.error('Expected:', { expectedWidth, expectedHeight });
      console.error('Got:', { width: cropRect.width, height: cropRect.height });
    }

    // ⚡ DEBUG: UI CROP INPUT
    console.log('🎨 [CROP INPUT]', {
      productId,
      crop_scale: crop?.scale || 1.0,
      crop_x: crop?.x || 0,
      crop_y: crop?.y || 0,
      note: 'User crop params (x/y in 900×1125 reference space)',
    });
    
    // ⚡ DEBUG: ONE CROP RECT (computed ONCE)
    console.log('✂️ [ONE CROP RECT - Original Pixels]', {
      productId,
      origSize: `${metadata.width}×${metadata.height}`,
      cropRect: {
        left: cropRect.left,
        top: cropRect.top,
        width: cropRect.width,
        height: cropRect.height,
      },
      cropRectHash: cropRect.debug.hash,
      debug: cropRect.debug,
      note: 'THIS rect is used for BOTH shop and thumb - NO re-computation!',
      SINGLE_SOURCE_OF_TRUTH: 'computeCropRectOriginalPx()',
    });

    // 5. Sharp Pipeline: Extract ONCE, then resize to target
    // CRITICAL: Extract happens BEFORE resize, using original pixels
    // This ensures shop and thumb have IDENTICAL composition
    const { width: targetW, height: targetH } = SIZES[size];

    const thumbnail = await normalizedImage
      .extract({
        left: cropRect.left,
        top: cropRect.top,
        width: cropRect.width,
        height: cropRect.height,
      })
      .resize(targetW, targetH, {
        fit: 'fill', // Should be exact since aspect is already 4:5
        kernel: 'lanczos3',
      })
      .webp({ quality: 85 })
      .toBuffer();

    console.log('📦 [PIPELINE OUTPUT]', {
      productId,
      size,
      targetSize: `${targetW}×${targetH}`,
      outputBytes: thumbnail.length,
      usedCropRectHash: cropRect.debug.hash,
      note: 'Extract from cropRect, then resize to target - composition LOCKED',
    });

    // 5. Upload zu Supabase Storage (mit Hash + Timestamp - absolute Uniqueness!)
    const cropHash = generateCropHash(productId, imagePath, crop);
    const timestamp = Date.now();
    const thumbPath = `derived/${productId}/${size}_${cropHash}_${timestamp}.webp`;
    
    const { error: uploadError } = await supabase
      .storage
      .from('product-images')
      .upload(thumbPath, thumbnail, {
        contentType: 'image/webp',
        upsert: true, // Überschreibe falls Hash identisch
      });

    if (uploadError) {
      console.error('[Thumbnail] Upload failed:', uploadError);
      return res.status(500).json({ error: 'Failed to upload thumbnail' });
    }

    // 6. Public URL generieren
    const { data: urlData } = supabase
      .storage
      .from('product-images')
      .getPublicUrl(thumbPath);

    const finalUrl = urlData.publicUrl;

    console.log('[Thumbnail] Success:', {
      thumbPath,
      url: finalUrl,
    });

    console.log('✅ [THUMBNAIL GEN] SUCCESS:', {
      productId,
      size,
      thumbPath,
      url: finalUrl,
      cropHash,
      timestamp,
    });

    // ⚡ DEBUG PIPELINE RESULT (D)
    console.log('🎉 [PIPELINE OUTPUT]', {
      productId,
      size,
      final_shop_out_w: size === 'shop' ? targetW : null,
      final_shop_out_h: size === 'shop' ? targetH : null,
      final_thumb_out_w: size === 'thumb' ? targetW : null,
      final_thumb_out_h: size === 'thumb' ? targetH : null,
      shop_path: size === 'shop' ? thumbPath : null,
      thumb_path: size === 'thumb' ? thumbPath : null,
      shop_url: size === 'shop' ? finalUrl : null,
      thumb_url: size === 'thumb' ? finalUrl : null,
      bufferSize: thumbnail.length,
      cropHash,
      timestamp,
      db_updated_at_will_be: new Date(timestamp).toISOString(),
    });

    return res.status(200).json({
      success: true,
      thumbPath,
      url: finalUrl,
      size: `${targetW}x${targetH}`,
    });

  } catch (error) {
    console.error('[Thumbnail] Generation failed:', error);
    return res.status(500).json({
      error: 'Thumbnail generation failed',
      details: error.message,
    });
  }
}
