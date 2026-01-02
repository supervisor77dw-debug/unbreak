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
import { computeCoverTransform } from '../../../../lib/crop-utils';

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

    const { width: targetW, height: targetH } = SIZES[size];

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

    // 4. Berechne Crop-Transform (SINGLE SOURCE OF TRUTH!)
    const { baseScale, effectiveScale, debug } = computeCoverTransform({
      imgW: metadata.width,
      imgH: metadata.height,
      frameW: targetW,
      frameH: targetH,
      scale: crop?.scale || 1.0,
      x: crop?.x || 0,
      y: crop?.y || 0,
    });

    // ⚡ DEBUG: UI CROP INPUT (B)
    console.log('🎨 [PIPELINE UI CROP INPUT]', {
      productId,
      crop_scale: crop?.scale || 1.0,
      crop_x: crop?.x || 0,
      crop_y: crop?.y || 0,
      CROP_BASE: { width: targetW, height: targetH },
      note: 'Client-sent crop params (frame-relative)',
    });

    console.log('[Thumbnail] Transform debug:', debug);
    
    // ⚡ DEBUG PIPELINE START
    console.log('🚀 [PIPELINE START]', {
      productId,
      sourceUsed: imagePath,
      sourceW: metadata.width,
      sourceH: metadata.height,
      cropScale: crop?.scale || 1.0,
      cropX: crop?.x || 0,
      cropY: crop?.y || 0,
      baseW: targetW,
      baseH: targetH,
      baseScale: baseScale.toFixed(4),
      effectiveScale: effectiveScale.toFixed(4),
      targetSize: size,
    });

    // ⚡ DEBUG: PIPELINE MATH (C)
    console.log('📊 [PIPELINE MATH]', {
      productId,
      baseScale: baseScale.toFixed(4),
      effectiveScale: effectiveScale.toFixed(4),
      note: 'baseScale = min scale to cover 4:5, effectiveScale = baseScale * userScale',
    });
    
    // DEBUG: Verify DERIVE_REFERENCE = UI_REFERENCE
    console.log('🔍 [DERIVE SOURCE CHECK]', {
      productId,
      cropParams: { 
        scale: crop?.scale || 1.0, 
        x: crop?.x || 0, 
        y: crop?.y || 0 
      },
      sourceUsed: imagePath,
      sourceW: metadata.width,
      sourceH: metadata.height,
      baseW: targetW,
      baseH: targetH,
      baseScale: baseScale.toFixed(4),
      effectiveScale: effectiveScale.toFixed(4),
      resultW: targetW,
      resultH: targetH,
      DERIVE_REFERENCE_EQ_UI_REFERENCE: true, // Both use computeCoverTransform with same params
    });

    // 4. Sharp: Resize + Crop
    // Strategie: Resize auf effectiveScale, dann extract target area
    const scaledW = Math.round(metadata.width * effectiveScale);
    const scaledH = Math.round(metadata.height * effectiveScale);

    // ⚡ DEBUG PIPELINE RESIZE
    console.log('📐 [PIPELINE RESIZE]', {
      productId,
      resizedW: scaledW,
      resizedH: scaledH,
      resizeScale: effectiveScale.toFixed(4),
    });

    // Crop-Position: Center + Offsets
    const offsetX = crop?.x || 0;
    const offsetY = crop?.y || 0;
    
    // Extract-Region (centered mit offset)
    const left = Math.max(0, Math.round((scaledW - targetW) / 2 + offsetX));
    const top = Math.max(0, Math.round((scaledH - targetH) / 2 + offsetY));

    // Clamp to ensure we don't exceed bounds
    const clampedLeft = Math.min(left, scaledW - targetW);
    const clampedTop = Math.min(top, scaledH - targetH);

    // ⚡ DEBUG PIPELINE EXTRACT
    console.log('✂️ [PIPELINE EXTRACT]', {
      productId,
      extractLeft: left,
      extractTop: top,
      extractW: targetW,
      extractH: targetH,
      offsetX,
      offsetY,
      centerBeforeOffset: {
        x: Math.round((scaledW - targetW) / 2),
        y: Math.round((scaledH - targetH) / 2),
      },
      clampResult: {
        clampedLeft,
        clampedTop,
        wasClamped: clampedLeft !== left || clampedTop !== top,
      },
    });

    const thumbnail = await normalizedImage
      .resize(scaledW, scaledH, {
        fit: 'fill',
        kernel: 'lanczos3',
      })
      .extract({
        left: clampedLeft,
        top: clampedTop,
        width: targetW,
        height: targetH,
      })
      .webp({ quality: 85 })
      .toBuffer();

    console.log('[Thumbnail] Generated:', {
      size: thumbnail.length,
      dimensions: `${targetW}x${targetH}`,
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
