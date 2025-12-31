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

  try {
    // 1. Authenticate & authorize
    const authData = await requireAuth(req, res);
    if (!authData) return;

    if (authData.user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Zugriff verweigert. Nur Administratoren können Bilder hochladen.' });
    }

    const { id } = req.query; // Product ID

    // 2. Verify product exists
    const product = await prisma.product.findUnique({
      where: { id: parseInt(id) },
      select: { id: true, sku: true },
    });

    if (!product) {
      return res.status(404).json({ error: 'Produkt nicht gefunden' });
    }

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
    
    // 6. Generate storage path: products/<SKU>/main.<ext>
    const ext = path.extname(uploadedFile.originalFilename || uploadedFile.newFilename);
    const storagePath = `products/${product.sku}/main${ext}`;

    // 7. Upload to Supabase Storage (upsert = replace if exists)
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('products')
      .upload(storagePath, fileBuffer, {
        contentType: uploadedFile.mimetype,
        upsert: true, // Replace existing file
      });

    if (uploadError) {
      console.error('Supabase upload error:', uploadError);
      return res.status(500).json({ 
        error: 'Upload fehlgeschlagen', 
        details: uploadError.message 
      });
    }

    // 8. Get public URL
    const { data: urlData } = supabase.storage
      .from('products')
      .getPublicUrl(storagePath);

    const publicUrl = urlData.publicUrl;

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
    console.error('Upload API error:', error);
    return res.status(500).json({ 
      error: 'Interner Serverfehler', 
      message: error.message 
    });
  }
}
