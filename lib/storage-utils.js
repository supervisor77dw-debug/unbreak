// Zentrale Storage URL Generierung
// Nutzt bestehenden product-images Bucket

// Hardcoded Supabase URL als Fallback (öffentlich, kein Security Risk)
const SUPABASE_URL = 'https://qnzsdytdghfukrqpscsg.supabase.co';

/**
 * Generiert Public URL für Produktbild
 * @param {string|null} imagePath - Storage path (z.B. "products/product-1234.jpg")
 * @param {string|null} fallbackUrl - Optional: legacy image_url als Fallback
 * @returns {string} Public URL oder Placeholder
 */
export function getProductImageUrl(imagePath, fallbackUrl = null) {
  // Fallback 1: imagePath vorhanden → Public URL generieren
  if (imagePath) {
    // Manuelle URL-Konstruktion (kein Client nötig für Public URLs)
    // Format: https://<project>.supabase.co/storage/v1/object/public/<bucket>/<path>
    return `${SUPABASE_URL}/storage/v1/object/public/product-images/${imagePath}`;
  }
  
  // Fallback 2: Legacy image_url nutzen
  if (fallbackUrl) {
    return fallbackUrl;
  }
  
  // Fallback 3: Placeholder (existierendes Bild)
  return '/images/product-weinglashalter.jpg';
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
