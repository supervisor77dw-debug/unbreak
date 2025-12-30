import formidable from 'formidable';
import { promises as fs } from 'fs';
import path from 'path';

// Disable body parser for file uploads
export const config = {
  api: {
    bodyParser: false,
  },
};

const UPLOAD_DIR = path.join(process.cwd(), 'public', 'uploads', 'products');
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Ensure upload directory exists
    await fs.mkdir(UPLOAD_DIR, { recursive: true });

    const form = formidable({
      uploadDir: UPLOAD_DIR,
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

    // Generate unique filename
    const timestamp = Date.now();
    const ext = path.extname(file.originalFilename || file.newFilename);
    const filename = `product-${timestamp}${ext}`;
    const newPath = path.join(UPLOAD_DIR, filename);

    // Rename file to unique name
    await fs.rename(file.filepath, newPath);

    // Return relative URL
    const imageUrl = `/uploads/products/${filename}`;

    res.status(200).json({ imageUrl });
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
