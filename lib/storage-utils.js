// Zentrale Storage URL Generierung
// Nutzt bestehenden product-images Bucket

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

/**
 * Generiert Public URL für Produktbild
 * @param {string|null} imagePath - Storage path (z.B. "products/product-1234.jpg")
 * @param {string|null} fallbackUrl - Optional: legacy image_url als Fallback
 * @returns {string} Public URL oder Placeholder
 */
export function getProductImageUrl(imagePath, fallbackUrl = null) {
  // Fallback 1: imagePath vorhanden → Public URL generieren
  if (imagePath) {
    const { data } = supabase.storage
      .from('product-images')
      .getPublicUrl(imagePath);
    return data.publicUrl;
  }
  
  // Fallback 2: Legacy image_url nutzen
  if (fallbackUrl) {
    return fallbackUrl;
  }
  
  // Fallback 3: Placeholder
  return '/images/placeholder-product.jpg';
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
