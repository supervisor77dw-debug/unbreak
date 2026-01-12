/**
 * Order Number Generator
 * 
 * Generates unique, sequential order numbers in format: UO-YYYY-NNNNNN
 * Example: UO-2026-000123
 * 
 * Uses PostgreSQL sequence for atomic incrementing
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

let supabase;
if (supabaseUrl && supabaseServiceKey) {
  supabase = createClient(supabaseUrl, supabaseServiceKey);
}

/**
 * Generate next order number
 * Format: UO-YYYY-NNNNNN (e.g., UO-2026-000123)
 * 
 * @returns {Promise<string>} Order number
 */
export async function generateOrderNumber() {
  if (!supabase) {
    throw new Error('Supabase not initialized - cannot generate order number');
  }

  try {
    // Call PostgreSQL function to get next order number
    const { data, error } = await supabase.rpc('get_next_order_number');

    if (error) {
      console.error('[ORDER_NUMBER] Failed to generate order number:', error);
      // Fallback: Use timestamp-based number
      return generateFallbackOrderNumber();
    }

    return data; // Returns formatted string like "UO-2026-000123"
  } catch (err) {
    console.error('[ORDER_NUMBER] Exception generating order number:', err);
    return generateFallbackOrderNumber();
  }
}

/**
 * Fallback order number generation (timestamp-based)
 * Used if sequence fails
 * 
 * @returns {string} Fallback order number
 */
function generateFallbackOrderNumber() {
  const now = new Date();
  const year = now.getFullYear();
  const timestamp = now.getTime().toString().slice(-6); // Last 6 digits of timestamp
  
  return `UO-${year}-T${timestamp}`;
}

/**
 * Generate public_id from UUID (first 8 chars)
 * 
 * @param {string} uuid - Full UUID
 * @returns {string} 8-character public ID
 */
export function generatePublicId(uuid) {
  return uuid.substring(0, 8);
}

/**
 * Validate order number format
 * 
 * @param {string} orderNumber - Order number to validate
 * @returns {boolean} True if valid
 */
export function isValidOrderNumber(orderNumber) {
  // Format: UO-YYYY-NNNNNN or UO-YYYY-TNNNNNN (fallback)
  const pattern = /^UO-\d{4}-(T)?\d{6}$/;
  return pattern.test(orderNumber);
}
