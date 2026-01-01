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
import { computeCoverTransform } from '../../../../lib/crop-utils';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Thumbnail Sizes (4:5 aspect ratio)
const SIZES = {
  thumb: { width: 240, height: 300 },   // Admin List
  shop: { width: 800, height: 1000 },   // Shop Cards
};

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
    const metadata = await image.metadata();

    console.log('[Thumbnail] Original metadata:', {
      width: metadata.width,
      height: metadata.height,
      format: metadata.format,
    });

    // 3. Berechne Crop-Transform (SINGLE SOURCE OF TRUTH!)
    const { baseScale, effectiveScale, debug } = computeCoverTransform({
      imgW: metadata.width,
      imgH: metadata.height,
      frameW: targetW,
      frameH: targetH,
      scale: crop?.scale || 1.0,
      x: crop?.x || 0,
      y: crop?.y || 0,
    });

    console.log('[Thumbnail] Transform debug:', debug);

    // 4. Sharp: Resize + Crop
    // Strategie: Resize auf effectiveScale, dann extract target area
    const scaledW = Math.round(metadata.width * effectiveScale);
    const scaledH = Math.round(metadata.height * effectiveScale);

    // Crop-Position: Center + Offsets
    const offsetX = crop?.x || 0;
    const offsetY = crop?.y || 0;
    
    // Extract-Region (centered mit offset)
    const left = Math.max(0, Math.round((scaledW - targetW) / 2 + offsetX));
    const top = Math.max(0, Math.round((scaledH - targetH) / 2 + offsetY));

    const thumbnail = await image
      .resize(scaledW, scaledH, {
        fit: 'fill',
        kernel: 'lanczos3',
      })
      .extract({
        left: Math.min(left, scaledW - targetW),
        top: Math.min(top, scaledH - targetH),
        width: targetW,
        height: targetH,
      })
      .webp({ quality: 85 })
      .toBuffer();

    console.log('[Thumbnail] Generated:', {
      size: thumbnail.length,
      dimensions: `${targetW}x${targetH}`,
    });

    // 5. Upload zu Supabase Storage
    const thumbPath = `derived/${productId}/${size}.webp`;
    const { error: uploadError } = await supabase
      .storage
      .from('product-images')
      .upload(thumbPath, thumbnail, {
        contentType: 'image/webp',
        upsert: true, // Überschreibe falls existiert
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

    console.log('[Thumbnail] Success:', {
      thumbPath,
      url: urlData.publicUrl,
    });

    return res.status(200).json({
      success: true,
      thumbPath,
      url: urlData.publicUrl,
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
