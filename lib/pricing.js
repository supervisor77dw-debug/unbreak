/**
 * Pricing Logic
 * Server-side price calculation - NEVER trust frontend prices
 */

import { getSupabaseAdmin } from './supabase';

/**
 * Calculate final price based on product + configuration
 * @param {string} productSku - Product SKU
 * @param {object} config - Configuration object {color, finish, engraving, ...}
 * @returns {Promise<{product, price_cents, breakdown}>}
 */
export async function calculatePrice(productSku, config) {
  const supabaseAdmin = getSupabaseAdmin();
  
  // 1) Fetch product
  const { data: product, error: productError } = await supabaseAdmin
    .from('products')
    .select('*')
    .eq('sku', productSku)
    .eq('active', true)
    .single();

  if (productError || !product) {
    throw new Error(`Product not found: ${productSku}`);
  }

  let totalCents = product.base_price_cents;
  const breakdown = {
    base: product.base_price_cents,
    options: {},
  };

  // 2) Fetch applicable options
  const { data: options } = await supabaseAdmin
    .from('product_options')
    .select('*')
    .eq('product_id', product.id)
    .eq('active', true);

  if (!options || options.length === 0) {
    // No configurable options - just return base price
    return {
      product,
      price_cents: totalCents,
      breakdown,
    };
  }

  // 3) Apply option price deltas
  for (const [optionType, optionKey] of Object.entries(config)) {
    // Skip non-option fields (modelData, previewImage, etc.)
    if (typeof optionKey !== 'string') continue;

    const matchingOption = options.find(
      (opt) => opt.option_type === optionType && opt.option_key === optionKey
    );

    if (matchingOption && matchingOption.price_delta_cents !== 0) {
      totalCents += matchingOption.price_delta_cents;
      breakdown.options[optionType] = {
        key: optionKey,
        label: matchingOption.option_label,
        delta_cents: matchingOption.price_delta_cents,
      };
    }
  }

  breakdown.total = totalCents;

  return {
    product,
    price_cents: totalCents,
    breakdown,
  };
}

/**
 * Format price for display
 * @param {number} cents - Price in cents
 * @param {string} currency - Currency code (EUR, USD)
 * @returns {string} Formatted price (59,90 €)
 */
export function formatPrice(cents, currency = 'EUR') {
  const euros = cents / 100;
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: currency,
  }).format(euros);
}

/**
 * Calculate shipping cost (v1 - simple flat rate)
 * TODO: Implement zone-based shipping
 * @param {string} countryCode - ISO country code
 * @returns {number} Shipping cost in cents
 */
export function calculateShipping(countryCode = 'DE') {
  const shippingRates = {
    DE: 590, // 5,90 EUR domestic
    AT: 990,
    CH: 1490,
    EU: 1290,
    WORLD: 2490,
  };

  // EU countries (simplified)
  const euCountries = [
    'AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR',
    'DE', 'GR', 'HU', 'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL',
    'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE',
  ];

  if (shippingRates[countryCode]) {
    return shippingRates[countryCode];
  } else if (euCountries.includes(countryCode)) {
    return shippingRates.EU;
  } else {
    return shippingRates.WORLD;
  }
}

/**
 * Calculate tax (VAT) - v1 simplified
 * TODO: Implement proper tax calculation per country
 * @param {number} subtotalCents - Subtotal before tax
 * @param {string} countryCode - ISO country code
 * @returns {number} Tax in cents
 */
export function calculateTax(subtotalCents, countryCode = 'DE') {
  const taxRates = {
    DE: 0.19, // 19% MwSt
    AT: 0.20,
    CH: 0.077, // Swiss VAT
    // EU countries vary (15-27%), simplified here
  };

  const rate = taxRates[countryCode] || 0.19;
  return Math.round(subtotalCents * rate);
}
