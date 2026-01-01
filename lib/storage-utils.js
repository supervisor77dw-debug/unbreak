// Zentrale Storage URL Generierung
// Single Source of Truth für Produktbilder

// Hardcoded Supabase URL (öffentlich, kein Security Risk)
const SUPABASE_URL = 'https://qnzsdytdghfukrqpscsg.supabase.co';
const PRODUCT_IMAGES_BUCKET = 'product-images';
const PLACEHOLDER_IMAGE = '/images/product-weinglashalter.jpg';

/**
 * SINGLE SOURCE OF TRUTH für Produktbild URLs
 * 
 * Regeln (in Priorität):
 * 1. image_url existiert + ist vollständige https:// URL → nutze direkt
 * 2. image_path existiert → baue Supabase Public URL
 * 3. Fallback → Placeholder
 * 
 * CACHE-BUSTING: Optional imageUpdatedAt für Versionierung
 * 
 * @param {string|null} imagePath - Storage path (z.B. "products/product-1234.jpg")
 * @param {string|null} imageUrl - Optional: vollständige Public URL
 * @param {string|Date|null} imageUpdatedAt - Optional: Timestamp für Cache-Busting
 * @returns {string} Gültige Bild-URL (niemals null/undefined)
 */
export function getProductImageUrl(imagePath, imageUrl = null, imageUpdatedAt = null) {
  // Debug logging (nur in Development)
  const isDebug = typeof window !== 'undefined' && window.location?.hostname === 'localhost';
  
  // Cache-Buster Parameter
  const cacheBuster = imageUpdatedAt 
    ? `?v=${new Date(imageUpdatedAt).getTime()}`
    : '';
  
  // Regel 1: imageUrl ist vollständige URL
  if (imageUrl && (imageUrl.startsWith('https://') || imageUrl.startsWith('http://'))) {
    if (isDebug) console.log('[ProductImage] Using imageUrl:', imageUrl);
    return imageUrl + cacheBuster;
  }
  
  // Regel 2: imagePath → baue Public URL
  if (imagePath) {
    // Format: https://<project>.supabase.co/storage/v1/object/public/<bucket>/<path>
    const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/${PRODUCT_IMAGES_BUCKET}/${imagePath}`;
    if (isDebug) console.log('[ProductImage] Built from imagePath:', publicUrl + cacheBuster);
    return publicUrl + cacheBuster;
  }
  
  // Regel 3: Fallback Placeholder
  if (isDebug) console.log('[ProductImage] Using placeholder (no image_path/image_url)');
  return PLACEHOLDER_IMAGE;
}

/**
 * Generiert Storage Path für neues Produktbild
 * @param {string} sku - Product SKU
 * @returns {string} Path im Format "products/product-<timestamp>.<ext>"
 */
export function generateProductImagePath(ext = '.jpg') {
  const timestamp = Date.now();
  return `products/product-${timestamp}${ext}`;
}
