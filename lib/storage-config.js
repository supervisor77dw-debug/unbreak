/**
 * Supabase Storage Configuration
 * Centralized constants for storage bucket names and paths
 */

// Storage bucket name for product images
export const PRODUCT_IMAGES_BUCKET = 'product-images';

// Storage folder structure
export const STORAGE_FOLDERS = {
  PRODUCTS: 'products',
};

/**
 * Get public URL for a file in storage
 * @param {Object} supabase - Supabase client instance
 * @param {string} filePath - File path within bucket (e.g., 'products/product-123.jpg')
 * @returns {string} Public URL
 */
export function getProductImageUrl(supabase, filePath) {
  const { data } = supabase.storage
    .from(PRODUCT_IMAGES_BUCKET)
    .getPublicUrl(filePath);
  
  return data.publicUrl;
}

/**
 * Upload a product image to storage
 * @param {Object} supabase - Supabase client instance
 * @param {Buffer} fileBuffer - File buffer
 * @param {string} filename - Unique filename
 * @param {string} contentType - MIME type
 * @returns {Promise<{path: string, url: string}>}
 */
export async function uploadProductImage(supabase, fileBuffer, filename, contentType) {
  const filePath = `${STORAGE_FOLDERS.PRODUCTS}/${filename}`;
  
  const { data, error } = await supabase.storage
    .from(PRODUCT_IMAGES_BUCKET)
    .upload(filePath, fileBuffer, {
      contentType,
      cacheControl: '3600',
      upsert: false,
    });

  if (error) throw error;

  const publicUrl = getProductImageUrl(supabase, filePath);
  
  return {
    path: data.path,
    url: publicUrl,
  };
}

/**
 * Delete a product image from storage
 * @param {Object} supabase - Supabase client instance
 * @param {string} filePath - File path within bucket
 * @returns {Promise<void>}
 */
export async function deleteProductImage(supabase, filePath) {
  const { error } = await supabase.storage
    .from(PRODUCT_IMAGES_BUCKET)
    .remove([filePath]);

  if (error) throw error;
}

/**
 * List files in product images bucket
 * @param {Object} supabase - Supabase client instance
 * @param {string} folder - Folder path (default: 'products')
 * @returns {Promise<Array>}
 */
export async function listProductImages(supabase, folder = STORAGE_FOLDERS.PRODUCTS) {
  const { data, error } = await supabase.storage
    .from(PRODUCT_IMAGES_BUCKET)
    .list(folder);

  if (error) throw error;
  return data;
}
