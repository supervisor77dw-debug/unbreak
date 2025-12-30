import formidable from 'formidable';
import { createClient } from '@supabase/supabase-js';
import { promises as fs } from 'fs';
import path from 'path';
import { uploadProductImage, listProductImages } from '../../../lib/storage-config';

// Disable body parser for file uploads
export const config = {
  api: {
    bodyParser: false,
  },
};

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Parse multipart form data to /tmp (only writable dir on Vercel)
    const form = formidable({
      uploadDir: '/tmp',
      keepExtensions: true,
      maxFileSize: MAX_FILE_SIZE,
      filter: function ({ mimetype }) {
        return ALLOWED_TYPES.includes(mimetype);
      },
    });

    const [fields, files] = await new Promise((resolve, reject) => {
      form.parse(req, (err, fields, files) => {
        if (err) reject(err);
        resolve([fields, files]);
      });
    });

    const file = files.image?.[0] || files.image;

    if (!file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    // Initialize Supabase client with SERVICE ROLE KEY (required for storage)
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      console.error('❌ SUPABASE_SERVICE_ROLE_KEY not set!');
      return res.status(500).json({ 
        error: 'Server-Konfigurationsfehler: SUPABASE_SERVICE_ROLE_KEY fehlt in Vercel Environment Variables' 
      });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    console.log('🔑 Using SERVICE_ROLE_KEY for upload (required for storage bypass RLS)');

    // Read file from /tmp
    const fileBuffer = await fs.readFile(file.filepath);
    
    // Generate unique filename
    const timestamp = Date.now();
    const ext = path.extname(file.originalFilename || file.newFilename);
    const filename = `product-${timestamp}${ext}`;

    // Upload using shared storage config
    try {
      const { path: uploadedPath, url: publicUrl } = await uploadProductImage(
        supabase,
        fileBuffer,
        filename,
        file.mimetype
      );

      // Clean up temp file
      await fs.unlink(file.filepath).catch(() => {});

      // VERIFY: List files in bucket to confirm upload
      const files = await listProductImages(supabase);
      const uploadedFile = files.find(f => f.name === filename);

      console.log('✅ Upload successful:');
      console.log('  - File path:', uploadedPath);
      console.log('  - Filename:', filename);
      console.log('  - Public URL:', publicUrl);
      console.log('  - File verified in bucket:', !!uploadedFile);
      console.log('  - File size:', uploadedFile?.metadata?.size || 'unknown');

      if (!uploadedFile) {
        console.warn('⚠️ File uploaded but not found in bucket list - may take a moment to appear');
      }

      res.status(200).json({ imageUrl: publicUrl });

    } catch (uploadError) {
      // Clean up temp file even on error
      await fs.unlink(file.filepath).catch(() => {});

      console.error('❌ Upload error:', uploadError);

      // Specific error messages
      if (uploadError.message?.includes('Bucket not found')) {
        return res.status(500).json({ 
          error: 'Storage Bucket existiert nicht. Bitte EXECUTE-NOW.sql in Supabase ausführen!' 
        });
      }
      if (uploadError.message?.includes('new row violates row-level security')) {
        return res.status(500).json({ 
          error: 'Storage Policies fehlen. Bitte EXECUTE-NOW.sql ausführen!' 
        });
      }
      
      throw uploadError;
    }
  } catch (error) {
    console.error('Upload error:', error);
    
    if (error.message?.includes('maxFileSize')) {
      return res.status(400).json({ error: 'File too large. Max 5MB allowed.' });
    }
    
    if (error.message?.includes('filter')) {
      return res.status(400).json({ error: 'Invalid file type. Only JPEG, PNG, WebP allowed.' });
    }

    res.status(500).json({ error: 'Upload failed: ' + error.message });
  }
}
