/**
 * UNBREAK ONE - Pricing Engine (Database-Backed)
 * Berechnet konfigurierte Produktpreise mit DB-Pricing Config
 */

import { createClient } from '@supabase/supabase-js';

// Supabase client singleton
let supabaseClient = null;

function getSupabaseClient() {
  if (!supabaseClient) {
    supabaseClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
  }
  return supabaseClient;
}

// Cache for pricing configs (avoid DB query on every calculation)
const pricingCache = new Map();
const CACHE_TTL = 60000; // 1 minute

/**
 * Fetch active pricing config from database
 * @param {string} variant - 'glass_holder' | 'bottle_holder'
 * @returns {Promise<Object>} Pricing config
 */
async function getPricingConfig(variant) {
  const cacheKey = variant;
  const cached = pricingCache.get(cacheKey);
  
  // Return cached if still fresh
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.config;
  }

  const supabase = getSupabaseClient();
  
  const { data, error } = await supabase
    .from('pricing_configs')
    .select('*')
    .eq('variant', variant)
    .eq('active', true)
    .single();

  if (error) {
    console.error('[PRICING DB] Error fetching config:', error.message);
    // Fallback to default prices with 7 colors
    const { DEFAULT_COLOR_PRICES } = await import('../constants/colors.js');
    return {
      variant,
      base_price_cents: 4990,
      color_prices: {
        base: { ...DEFAULT_COLOR_PRICES },
        arm: { ...DEFAULT_COLOR_PRICES },
        module: { ...DEFAULT_COLOR_PRICES },
        pattern: { ...DEFAULT_COLOR_PRICES },
      },
      finish_prices: { matte: 0, glossy: 0, textured: 0, goldEdition: 0 },
      version: '2026-01-v1',
    };
  }

  // Ensure all 7 colors are present (backward compatibility)
  const { DEFAULT_COLOR_PRICES } = await import('../constants/colors.js');
  ['base', 'arm', 'module', 'pattern'].forEach(part => {
    if (!data.color_prices[part]) {
      data.color_prices[part] = { ...DEFAULT_COLOR_PRICES };
    } else {
      // Merge missing colors with 0 price
      data.color_prices[part] = {
        ...DEFAULT_COLOR_PRICES,
        ...data.color_prices[part],
      };
    }
  });

  // Cache the result
  pricingCache.set(cacheKey, {
    config: data,
    timestamp: Date.now(),
  });

  return data;
}

/**
 * Get color price from config
 * @param {Object} colorPrices - Color pricing structure from DB
 * @param {string} part - 'base' | 'arm' | 'module' | 'pattern'
 * @param {string} colorId - Color identifier
 * @returns {number} Price in cents
 */
function getColorPrice(colorPrices, part, colorId) {
  if (!colorId || !colorPrices[part]) return 0;
  const price = colorPrices[part][colorId];
  if (price === undefined) {
    console.warn(`[PRICING] Unknown color "${colorId}" for part "${part}" - defaulting to 0`);
    return 0;
  }
  return price;
}

/**
 * Get finish price from config
 * @param {Object} finishPrices - Finish pricing from DB
 * @param {string} finish - Finish identifier
 * @returns {number} Price in cents
 */
function getFinishPrice(finishPrices, finish) {
  if (!finish) return 0;
  const price = finishPrices[finish];
  if (price === undefined) {
    console.warn(`[PRICING] Unknown finish "${finish}" - defaulting to 0`);
    return 0;
  }
  return price;
}

/**
 * Calculate configured product price (ASYNC - reads from DB)
 * @param {Object} params
 * @param {string} params.productType - 'glass_holder' | 'bottle_holder'
 * @param {Object} params.config - config_json with colors, finish, variant
 * @param {number} params.customFeeCents - optional custom fee (default 0)
 * @returns {Promise<Object>} Pricing breakdown
 */
export async function calcConfiguredPrice({ productType, config, customFeeCents = 0 }) {
  // Validation
  if (!productType || !['glass_holder', 'bottle_holder'].includes(productType)) {
    console.warn('[PRICING] Invalid productType:', productType, '- defaulting to glass_holder');
    productType = 'glass_holder';
  }

  // Fetch pricing config from DB
  const pricingConfig = await getPricingConfig(productType);

  if (!config || !config.colors) {
    console.warn('[PRICING] Missing config or colors - using base price only');
    return {
      pricing_version: pricingConfig.version,
      base_price_cents: pricingConfig.base_price_cents,
      option_prices_cents: {
        base: 0,
        arm: 0,
        module: 0,
        pattern: 0,
        finish: 0,
      },
      custom_fee_cents: customFeeCents,
      subtotal_cents: pricingConfig.base_price_cents + customFeeCents,
      display_title: productType === 'bottle_holder' ? 'Flaschenhalter (konfiguriert)' : 'Glashalter (konfiguriert)',
      sku: productType === 'bottle_holder' ? 'UNBREAK-BOTTLE-CONFIG' : 'UNBREAK-GLAS-CONFIG',
    };
  }

  // Calculate option prices
  const basePriceCents = pricingConfig.base_price_cents;
  const colors = config.colors || {};
  const finish = config.finish || 'matte';

  // FLASCHENHALTER: Grundplatte (Basispreis) + Muster (Aufschlag)
  if (productType === 'bottle_holder') {
    const patternPrice = getColorPrice(pricingConfig.color_prices, 'pattern', colors.pattern);
    
    return {
      pricing_version: pricingConfig.version,
      base_price_cents: basePriceCents,
      option_prices_cents: {
        base: 0,
        arm: 0,
        module: 0,
        pattern: patternPrice,
        finish: 0,
      },
      custom_fee_cents: customFeeCents,
      subtotal_cents: basePriceCents + patternPrice + customFeeCents,
      display_title: 'Flaschenhalter (konfiguriert)',
      sku: 'UNBREAK-BOTTLE-CONFIG',
    };
  }

  // GLASHALTER: Full pricing mit allen Farbaufschlägen
  const optionPrices = {
    base: getColorPrice(pricingConfig.color_prices, 'base', colors.base),
    arm: getColorPrice(pricingConfig.color_prices, 'arm', colors.arm),
    module: getColorPrice(pricingConfig.color_prices, 'module', colors.module),
    pattern: getColorPrice(pricingConfig.color_prices, 'pattern', colors.pattern),
    finish: 0, // Finish vorerst deaktiviert (später: getFinishPrice)
  };

  const totalOptionsPriceCents = Object.values(optionPrices).reduce((sum, price) => sum + price, 0);
  const subtotalCents = basePriceCents + totalOptionsPriceCents + customFeeCents;

  return {
    pricing_version: pricingConfig.version,
    base_price_cents: basePriceCents,
    option_prices_cents: optionPrices,
    custom_fee_cents: customFeeCents,
    subtotal_cents: Math.max(0, subtotalCents), // Never negative
    display_title: productType === 'bottle_holder' ? 'Flaschenhalter (konfiguriert)' : 'Glashalter (konfiguriert)',
    sku: productType === 'bottle_holder' ? 'UNBREAK-BOTTLE-CONFIG' : 'UNBREAK-GLAS-CONFIG',
  };
}

/**
 * Clear pricing cache (use when pricing config is updated)
 */
export function clearPricingCache() {
  pricingCache.clear();
  console.log('[PRICING] Cache cleared');
}
