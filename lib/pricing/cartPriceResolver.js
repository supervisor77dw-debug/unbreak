/**
 * CENTRAL PRICE RESOLVER (Frontend)
 * Single Source of Truth for Cart UI Price Display
 * 
 * Purpose:
 * - Resolve unit_price_cents for Cart Line Items AND Totals
 * - NO separate price sources/fallbacks in UI
 * - Same resolver for: Line Item display + Subtotal + Checkout payload
 * 
 * Usage:
 *   const unitPriceCents = resolveCartItemPrice(item, pricingConfig, productsIndex);
 */

/**
 * Resolve unit price in cents for a cart item (CLIENT-SIDE)
 * 
 * @param {object} item - Cart item from localStorage
 * @param {object} pricingConfig - Admin pricing configuration (optional)
 * @param {object} productsIndex - Products lookup by SKU (optional)
 * @returns {number} unit_price_cents (always integer >= 0)
 */
export function resolveCartItemPrice(item, pricingConfig = null, productsIndex = null) {
  const DEBUG = typeof window !== 'undefined' && 
    (window.location?.search?.includes('debugCart=1') || 
     window.location?.search?.includes('debugPricing=1'));

  // =================================================================
  // CASE 1: CONFIGURATOR ITEM
  // =================================================================
  if (item.configured || item.product_id === 'glass_configurator' || item.sku === 'UNBREAK-GLAS-CONFIG') {
    if (DEBUG) {
      console.log('[PRICE_RESOLVER][CONFIGURATOR]', {
        sku: item.sku,
        source: 'configurator',
        has_config: !!item.config,
        price_cents_in_item: item.price_cents || item.price,
      });
    }

    // Configurator items: Use item.price_cents (set by configurator)
    // Server will recalculate during checkout
    const price = item.price_cents || item.price || 0;
    
    if (price <= 0) {
      console.warn('[PRICE_RESOLVER][CONFIGURATOR] Invalid price:', {
        sku: item.sku,
        price_cents: item.price_cents,
        price: item.price,
      });
      // Don't fail - server will calculate
      return 0;
    }
    
    return Number(price);
  }

  // =================================================================
  // CASE 2: STANDARD PRODUCT
  // =================================================================
  if (DEBUG) {
    console.log('[PRICE_RESOLVER][STANDARD]', {
      sku: item.sku,
      source: 'standard_product',
      has_pricingConfig: !!pricingConfig,
      has_productsIndex: !!productsIndex,
      price_fields_in_item: {
        price_cents: item.price_cents,
        price: item.price,
        base_price_cents: item.base_price_cents,
        unit_amount: item.unit_amount,
      },
    });
  }

  // Priority 1: pricingConfig (Admin Pricing - most authoritative)
  if (pricingConfig && item.sku && pricingConfig[item.sku]) {
    const basePrice = pricingConfig[item.sku].basePrice;
    if (basePrice && basePrice > 0) {
      if (DEBUG) {
        console.log('[PRICE_RESOLVER][STANDARD] Using pricingConfig:', {
          sku: item.sku,
          basePrice,
        });
      }
      return basePrice;
    }
  }

  // Priority 2: productsIndex (DB lookup by SKU)
  if (productsIndex && item.sku && productsIndex[item.sku]) {
    const product = productsIndex[item.sku];
    const basePrice = product.base_price_cents;
    if (basePrice && basePrice > 0) {
      if (DEBUG) {
        console.log('[PRICE_RESOLVER][STANDARD] Using productsIndex:', {
          sku: item.sku,
          base_price_cents: basePrice,
        });
      }
      return basePrice;
    }
  }

  // Priority 3: Item itself (saved during addToCart)
  const itemPrice = item.price_cents || item.base_price_cents || item.price || item.unit_amount;
  if (itemPrice && itemPrice > 0) {
    if (DEBUG) {
      console.log('[PRICE_RESOLVER][STANDARD] Using item fields:', {
        sku: item.sku,
        resolved_from: item.price_cents ? 'price_cents' : 
                       item.base_price_cents ? 'base_price_cents' :
                       item.price ? 'price' : 'unit_amount',
        value: itemPrice,
      });
    }
    return Number(itemPrice);
  }

  // =================================================================
  // CASE 3: PRICE NOT FOUND (HARD FAIL)
  // =================================================================
  console.error('[PRICE_RESOLVER][MISSING]', {
    sku: item.sku,
    product_id: item.product_id,
    item_fields: {
      price_cents: item.price_cents,
      price: item.price,
      base_price_cents: item.base_price_cents,
      unit_amount: item.unit_amount,
    },
    pricingConfig_available: !!pricingConfig,
    productsIndex_available: !!productsIndex,
    ERROR: 'PRICE_NOT_FOUND',
  });

  // Return 0 instead of throwing (UI should show "Price not available")
  return 0;
}

/**
 * Calculate cart total using central resolver
 * 
 * @param {array} items - Cart items
 * @param {object} pricingConfig - Admin pricing configuration (optional)
 * @param {object} productsIndex - Products lookup (optional)
 * @returns {{subtotal_cents: number, items_with_prices: array}}
 */
export function calculateCartTotal(items, pricingConfig = null, productsIndex = null) {
  const DEBUG = typeof window !== 'undefined' && 
    (window.location?.search?.includes('debugCart=1') || 
     window.location?.search?.includes('debugPricing=1'));

  let subtotal_cents = 0;
  const items_with_prices = [];

  for (const item of items) {
    const unit_price_cents = resolveCartItemPrice(item, pricingConfig, productsIndex);
    const line_total_cents = unit_price_cents * item.quantity;
    
    subtotal_cents += line_total_cents;
    
    items_with_prices.push({
      ...item,
      resolved_unit_price_cents: unit_price_cents,
      line_total_cents,
    });
  }

  if (DEBUG) {
    console.log('[CART_TOTAL]', {
      items_count: items.length,
      subtotal_cents,
      items_breakdown: items_with_prices.map(i => ({
        sku: i.sku,
        quantity: i.quantity,
        unit_price_cents: i.resolved_unit_price_cents,
        line_total_cents: i.line_total_cents,
      })),
    });
  }

  return {
    subtotal_cents,
    items_with_prices,
  };
}

/**
 * Validate cart item price
 * Returns error message if price invalid, null if OK
 * 
 * @param {object} item - Cart item
 * @param {number} resolvedPrice - Price from resolver
 * @returns {string|null} error message or null
 */
export function validateCartItemPrice(item, resolvedPrice) {
  // Configurator items can have price 0 (server calculates)
  if (item.configured || item.product_id === 'glass_configurator') {
    return null; // OK
  }

  // Standard products MUST have price > 0
  if (!resolvedPrice || resolvedPrice <= 0) {
    return `Preis nicht verfügbar für ${item.sku}`;
  }

  return null; // OK
}
