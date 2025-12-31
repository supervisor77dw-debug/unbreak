// Product Image Upload API
// POST /api/admin/products/[id]/upload-image
// ADMIN-only endpoint for uploading product images to Supabase Storage

import { requireAuth } from '../../../../../lib/auth-helpers';
import prisma from '../../../../../lib/prisma';
import formidable from 'formidable';
import { promises as fs } from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import { uploadProductImage, getProductImageUrl, PRODUCT_IMAGES_BUCKET } from '../../../../../lib/storage-config';

// Disable Next.js body parsing (formidable handles it)
export const config = {
  api: {
    bodyParser: false,
  },
};

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

    // 3. Check SERVICE_ROLE_KEY
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      console.error('[upload-image] SUPABASE_SERVICE_ROLE_KEY not set!');
      return res.status(500).json({ 
        error: 'Server-Konfigurationsfehler: SUPABASE_SERVICE_ROLE_KEY fehlt' 
      });
    }

    // 4. Parse multipart form data
    const form = formidable({
      uploadDir: '/tmp',
      keepExtensions: true,
      maxFileSize: MAX_SIZE,
      filter: function ({ mimetype }) {
        return ALLOWED_TYPES.includes(mimetype);
      },
    });

    const [fields, files] = await new Promise((resolve, reject) => {
      form.parse(req, (err, fields, files) => {
        if (err) {
          console.error('[upload-image] Formidable error:', err);
          reject(err);
        }
        resolve([fields, files]);
      });
    });

    const uploadedFile = files.image?.[0] || files.image;
    if (!uploadedFile) {
      return res.status(400).json({ error: 'Keine Datei hochgeladen' });
    }

    console.log('[upload-image] File received:', uploadedFile.originalFilename, uploadedFile.mimetype);

    // 5. Initialize Supabase client with SERVICE ROLE KEY
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    console.log('[upload-image] Using SERVICE_ROLE_KEY for upload');

    // 6. Read file buffer
    const fileBuffer = await fs.readFile(uploadedFile.filepath);
    
    // 7. Generate filename: product-<timestamp>.<ext>
    const timestamp = Date.now();
    const ext = path.extname(uploadedFile.originalFilename || uploadedFile.newFilename);
    const filename = `product-${timestamp}${ext}`;

    console.log('[upload-image] Uploading to', PRODUCT_IMAGES_BUCKET, 'as', filename);
    console.log('[upload-image] Uploading to', PRODUCT_IMAGES_BUCKET, 'as', filename);

    // 8. Upload using shared storage config (same as working /api/products/upload)
    try {
      const { path: uploadedPath, url: publicUrl } = await uploadProductImage(
        supabase,
        fileBuffer,
        filename,
        uploadedFile.mimetype
      );

      console.log('[upload-image] Upload successful:');
      console.log('  - Path:', uploadedPath);
      console.log('  - Public URL:', publicUrl);

      // 9. Clean up temp file
      await fs.unlink(uploadedFile.filepath).catch(() => {});

      // 10. Update database (image_path + image_url)
      const updatedProduct = await prisma.product.update({
        where: { id: product.id },
        data: {
          imagePath: uploadedPath,
          imageUrl: publicUrl,
        },
        select: {
          id: true,
          sku: true,
          name: true,
          imagePath: true,
          imageUrl: true,
        },
      });

      console.log('[upload-image] Product updated in DB');

      // 11. Success response
      return res.status(200).json({
        success: true,
        message: 'Bild erfolgreich hochgeladen',
        product: updatedProduct,
        imageUrl: publicUrl,
        imagePath: uploadedPath,
      });

    } catch (uploadError) {
      // Clean up temp file on error
      await fs.unlink(uploadedFile.filepath).catch(() => {});
      
      console.error('[upload-image] Upload error:', {
        message: uploadError.message,
        code: uploadError.code,
        statusCode: uploadError.statusCode,
      });
      
      return res.status(500).json({ 
        error: 'Upload fehlgeschlagen', 
        details: uploadError.message,
      });
    }

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
