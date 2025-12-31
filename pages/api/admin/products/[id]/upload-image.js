// Product Image Upload API
// POST /api/admin/products/[id]/upload-image
// ADMIN-only endpoint for uploading product images to Supabase Storage

import { requireAuth } from '../../../../../lib/auth-helpers';
import prisma from '../../../../../lib/prisma';
import formidable from 'formidable';
import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

// Disable Next.js body parsing (formidable handles it)
export const config = {
  api: {
    bodyParser: false,
  },
};

// Supabase Storage Client (Service Role for uploads)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY // Server-only, never exposed to browser
);

const ALLOWED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
const MAX_SIZE = 5 * 1024 * 1024; // 5MB

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  console.log('[upload-image] Request received');

  try {
    // 1. Authenticate & authorize
    const authData = await requireAuth(req, res);
    if (!authData) {
      console.log('[upload-image] Auth failed');
      return;
    }

    if (authData.user.role !== 'ADMIN') {
      console.log('[upload-image] Access denied - not ADMIN');
      return res.status(403).json({ error: 'Zugriff verweigert. Nur Administratoren können Bilder hochladen.' });
    }

    const { id } = req.query; // Product ID (UUID)
    console.log('[upload-image] Product ID:', id);

    // 2. Verify product exists
    const product = await prisma.product.findUnique({
      where: { id },
      select: { id: true, sku: true },
    });

    if (!product) {
      console.log('[upload-image] Product not found:', id);
      return res.status(404).json({ error: 'Produkt nicht gefunden' });
    }

    console.log('[upload-image] Product found:', product.sku);

    // 3. Parse multipart form data
    const form = formidable({
      maxFileSize: MAX_SIZE,
      allowEmptyFiles: false,
    });

    const [fields, files] = await new Promise((resolve, reject) => {
      form.parse(req, (err, fields, files) => {
        if (err) reject(err);
        else resolve([fields, files]);
      });
    });

    const uploadedFile = files.image?.[0] || files.file?.[0];
    if (!uploadedFile) {
      return res.status(400).json({ error: 'Keine Datei hochgeladen' });
    }

    // 4. Validate file type
    if (!ALLOWED_TYPES.includes(uploadedFile.mimetype)) {
      return res.status(400).json({ 
        error: `Ungültiges Dateiformat. Erlaubt: ${ALLOWED_TYPES.join(', ')}` 
      });
    }

    // 5. Read file buffer
    const fileBuffer = fs.readFileSync(uploadedFile.filepath);
    
    // 6. Generate storage path: products/product-<timestamp>.<ext> (historisches Pattern)
    const ext = path.extname(uploadedFile.originalFilename || uploadedFile.newFilename);
    const timestamp = Date.now();
    const storagePath = `products/product-${timestamp}${ext}`;

    console.log('[upload-image] Uploading to product-images bucket:', storagePath);

    // 7. Upload to Supabase Storage (product-images bucket, upsert = replace)
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('product-images')
      .upload(storagePath, fileBuffer, {
        contentType: uploadedFile.mimetype,
        upsert: true,
      });

    if (uploadError) {
      console.error('[upload-image] Supabase error:', {
        message: uploadError.message,
        statusCode: uploadError.statusCode,
        error: uploadError.error,
        bucket: 'product-images',
        path: storagePath,
      });
      return res.status(500).json({ 
        error: 'Upload fehlgeschlagen', 
        details: uploadError.message,
        bucket: 'product-images',
        path: storagePath,
      });
    }

    console.log('[upload-image] Upload success:', uploadData);

    // 8. Get public URL
    const { data: urlData } = supabase.storage
      .from('product-images')
      .getPublicUrl(storagePath);

    const publicUrl = urlData.publicUrl;

    console.log('[upload-image] Public URL:', publicUrl);

    // 9. Update database (image_path + image_url)
    const updatedProduct = await prisma.product.update({
      where: { id: product.id },
      data: {
        image_path: storagePath,
        image_url: publicUrl,
      },
      select: {
        id: true,
        sku: true,
        name: true,
        image_path: true,
        image_url: true,
      },
    });

    // 10. Cleanup temp file
    fs.unlinkSync(uploadedFile.filepath);

    // 11. Success response
    return res.status(200).json({
      success: true,
      message: 'Bild erfolgreich hochgeladen',
      product: updatedProduct,
      imageUrl: publicUrl,
      imagePath: storagePath,
    });

  } catch (error) {
    console.error('[upload-image] Unhandled error:', {
      message: error.message,
      stack: error.stack,
      name: error.name,
    });
    return res.status(500).json({ 
      error: 'Interner Serverfehler', 
      message: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    });
  }
}
