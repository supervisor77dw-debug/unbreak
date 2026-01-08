/**
 * UNBREAK ONE - Pricing Engine
 * Berechnet konfigurierte Produktpreise mit Freeze Pricing
 */

import {
  PRICING_VERSION,
  BASE_PRICES,
  COLOR_UPCHARGES,
  FINISH_UPCHARGES,
  ARM_UPCHARGES,
  MODULE_UPCHARGES,
  PATTERN_UPCHARGES,
  PRODUCT_NAMES,
  PRODUCT_SKUS,
} from './pricingConfig.js';

/**
 * Calculate configured product price
 * @param {Object} params
 * @param {string} params.productType - 'glass_holder' | 'bottle_holder'
 * @param {Object} params.config - config_json with colors, finish, variant
 * @param {number} params.customFeeCents - optional custom fee (default 0)
 * @returns {Object} Pricing breakdown
 */
export function calcConfiguredPrice({ productType, config, customFeeCents = 0 }) {
  // Validation
  if (!productType || !['glass_holder', 'bottle_holder'].includes(productType)) {
    console.warn('[PRICING] Invalid productType:', productType, '- defaulting to glass_holder');
    productType = 'glass_holder';
  }

  if (!config || !config.colors) {
    console.warn('[PRICING] Missing config or colors - using base price only');
    return {
      pricing_version: PRICING_VERSION,
      base_price_cents: BASE_PRICES[productType] || BASE_PRICES.glass_holder,
      option_prices_cents: {
        base: 0,
        arm: 0,
        module: 0,
        pattern: 0,
        finish: 0,
      },
      custom_fee_cents: customFeeCents,
      subtotal_cents: (BASE_PRICES[productType] || BASE_PRICES.glass_holder) + customFeeCents,
      display_title: PRODUCT_NAMES[productType] || PRODUCT_NAMES.glass_holder,
      sku: PRODUCT_SKUS[productType] || PRODUCT_SKUS.glass_holder,
    };
  }

  // Base Price
  const basePriceCents = BASE_PRICES[productType] || BASE_PRICES.glass_holder;

  // Option Prices
  const colors = config.colors || {};
  const finish = config.finish || 'matte';

  const optionPrices = {
    base: getColorPrice('base', colors.base),
    arm: productType === 'glass_holder' ? getColorPrice('arm', colors.arm) : 0,
    module: productType === 'glass_holder' ? getColorPrice('module', colors.module) : 0,
    pattern: getColorPrice('pattern', colors.pattern),
    finish: getFinishPrice(finish),
  };

  // Calculate subtotal
  const optionsSum = Object.values(optionPrices).reduce((sum, price) => sum + price, 0);
  const subtotalCents = basePriceCents + optionsSum + customFeeCents;

  // Ensure no negative prices
  if (subtotalCents < 0) {
    console.error('[PRICING] Negative subtotal detected!', {
      basePriceCents,
      optionPrices,
      customFeeCents,
      subtotalCents,
    });
  }

  return {
    pricing_version: PRICING_VERSION,
    base_price_cents: basePriceCents,
    option_prices_cents: optionPrices,
    custom_fee_cents: customFeeCents,
    subtotal_cents: Math.max(0, subtotalCents), // Never negative
    display_title: PRODUCT_NAMES[productType] || PRODUCT_NAMES.glass_holder,
    sku: PRODUCT_SKUS[productType] || PRODUCT_SKUS.glass_holder,
  };
}

/**
 * Get color upcharge price
 * @param {string} part - 'base' | 'arm' | 'module' | 'pattern'
 * @param {string} colorId - color identifier
 * @returns {number} Price in cents
 */
function getColorPrice(part, colorId) {
  if (!colorId) return 0;
  
  const partPrices = COLOR_UPCHARGES[part];
  if (!partPrices) {
    console.warn(`[PRICING] Unknown color part: ${part}`);
    return 0;
  }

  const price = partPrices[colorId];
  if (price === undefined) {
    console.warn(`[PRICING] Unknown color ${colorId} for part ${part} - using 0`);
    return 0;
  }

  return price;
}

/**
 * Get finish upcharge price
 * @param {string} finish - 'matte' | 'glossy' | 'textured'
 * @returns {number} Price in cents
 */
function getFinishPrice(finish) {
  if (!finish) return 0;
  
  const price = FINISH_UPCHARGES[finish];
  if (price === undefined) {
    console.warn(`[PRICING] Unknown finish: ${finish} - using 0`);
    return 0;
  }

  return price;
}

/**
 * Format price breakdown for display
 * @param {Object} pricing - Result from calcConfiguredPrice
 * @returns {string} Human-readable breakdown
 */
export function formatPriceBreakdown(pricing) {
  const formatCents = (cents) => {
    return new Intl.NumberFormat('de-DE', {
      style: 'currency',
      currency: 'EUR',
    }).format(cents / 100);
  };

  const lines = [];
  lines.push(`Basispreis: ${formatCents(pricing.base_price_cents)}`);
  
  if (pricing.option_prices_cents) {
    const opts = pricing.option_prices_cents;
    if (opts.base > 0) lines.push(`  + Base-Farbe: ${formatCents(opts.base)}`);
    if (opts.arm > 0) lines.push(`  + Arm-Farbe: ${formatCents(opts.arm)}`);
    if (opts.module > 0) lines.push(`  + Modul-Farbe: ${formatCents(opts.module)}`);
    if (opts.pattern > 0) lines.push(`  + Pattern-Farbe: ${formatCents(opts.pattern)}`);
    if (opts.finish > 0) lines.push(`  + Finish: ${formatCents(opts.finish)}`);
  }
  
  if (pricing.custom_fee_cents > 0) {
    lines.push(`  + Custom Fee: ${formatCents(pricing.custom_fee_cents)}`);
  }
  
  lines.push(`= Gesamt: ${formatCents(pricing.subtotal_cents)}`);
  
  return lines.join('\n');
}
