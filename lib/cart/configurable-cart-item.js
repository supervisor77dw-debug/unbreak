/**
 * Configurable Cart Item
 * 
 * Represents a customized design from the configurator as a cart item.
 * 
 * Structure:
 * - Single line item with embedded design payload
 * - Full pricing breakdown for transparency
 * - Preview images
 * - Pricing signature for server validation
 * 
 * Business Rules:
 * - 1 design = 1 cart item, qty fixed at 1
 * - To order multiple, user must duplicate design (creates new designId)
 * - Pricing signature ensures integrity
 */

import { priceDesign, getPricingSummary } from '../pricing/design-pricing.js';

/**
 * Create configurable cart item from design payload
 * 
 * @param {Object} designPayload - DesignPayloadV1 object
 * @param {Object} [options] - { title?, quantity? }
 * @returns {Object} ConfigurableCartItem
 */
export function createConfigurableCartItem(designPayload, options = {}) {
  // Price the design
  const pricing = priceDesign(designPayload);
  
  if (!pricing.valid) {
    throw new Error(`Cannot create cart item: Pricing errors: ${pricing.errors.join(', ')}`);
  }
  
  // Generate title from payload
  const title = options.title || generateTitle(designPayload);
  
  // Quantity is always 1 per design (business rule)
  const quantity = 1;
  
  const cartItem = {
    type: 'CONFIGURATOR_DESIGN',
    cartItemId: generateCartItemId(),
    designId: designPayload.designId,
    title,
    quantity,
    
    // Pricing
    pricing: {
      currency: pricing.currency,
      unitPrice: pricing.total,
      total: pricing.total * quantity,
      breakdownLines: pricing.breakdownLines,
      pricebookVersion: pricing.pricebookVersion,
      pricingSignature: pricing.pricingSignature,
      calculatedAt: pricing.calculatedAt
    },
    
    // Preview images
    previews: {
      heroUrl: designPayload.previews?.heroUrl || null,
      thumbUrl: designPayload.previews?.thumbUrl || null
    },
    
    // Full payload (for order creation and fulfillment)
    payload: designPayload,
    
    // Metadata
    addedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  
  return cartItem;
}

/**
 * Generate cart item ID
 * @returns {string}
 */
function generateCartItemId() {
  return `cart_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Generate title from design payload
 * @param {Object} payload
 * @returns {string}
 */
function generateTitle(payload) {
  const familyNames = {
    GLASSHOLDER: 'Glashalter',
    BOTTLEHOLDER: 'Flaschenhalter',
    WINEHOLDER: 'Weinglas-Halter',
    GASTRO: 'Gastro Edition'
  };
  
  const baseName = familyNames[payload.productFamily] || 'Produkt';
  
  // Add variant if present
  if (payload.baseComponents?.[0]?.variantId) {
    const variantId = payload.baseComponents[0].variantId;
    if (variantId.includes('set')) {
      return `${baseName} ${variantId.replace('-', ' ')}`;
    }
  }
  
  // Add "individuelles Design" if customized
  if (payload.customization?.enabled) {
    return `${baseName} – individuelles Design`;
  }
  
  return baseName;
}

/**
 * Validate cart item
 * @param {Object} cartItem
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateCartItem(cartItem) {
  const errors = [];
  
  if (cartItem.type !== 'CONFIGURATOR_DESIGN') {
    errors.push('Invalid cart item type');
  }
  
  if (!cartItem.designId) {
    errors.push('Missing designId');
  }
  
  if (!cartItem.payload) {
    errors.push('Missing design payload');
  }
  
  if (!cartItem.pricing) {
    errors.push('Missing pricing data');
  }
  
  if (!cartItem.pricing?.pricingSignature) {
    errors.push('Missing pricing signature');
  }
  
  if (cartItem.quantity !== 1) {
    errors.push('Configurable items must have quantity = 1');
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Update cart item quantity
 * Note: For configurable items, this is NOT allowed per business rules.
 * User must duplicate the design instead.
 * 
 * @param {Object} cartItem
 * @param {number} quantity
 * @returns {Object} Updated cart item
 */
export function updateCartItemQuantity(cartItem, quantity) {
  // Business rule: qty must be 1 for configurable items
  if (cartItem.type === 'CONFIGURATOR_DESIGN' && quantity !== 1) {
    throw new Error('Configurable cart items cannot change quantity. Duplicate the design instead.');
  }
  
  return {
    ...cartItem,
    quantity,
    pricing: {
      ...cartItem.pricing,
      total: cartItem.pricing.unitPrice * quantity
    },
    updatedAt: new Date().toISOString()
  };
}

/**
 * Duplicate cart item (creates new design instance)
 * Used when user wants multiple of the same design
 * 
 * @param {Object} cartItem
 * @returns {Object} New cart item with new IDs
 */
export function duplicateCartItem(cartItem) {
  const newPayload = {
    ...cartItem.payload,
    designId: generateDesignId(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  
  return createConfigurableCartItem(newPayload, {
    title: cartItem.title
  });
}

/**
 * Generate design ID
 * @returns {string}
 */
function generateDesignId() {
  return `design_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Get cart item summary (for UI display)
 * @param {Object} cartItem
 * @returns {Object}
 */
export function getCartItemSummary(cartItem) {
  const pricing = getPricingSummary(cartItem.pricing);
  
  return {
    title: cartItem.title,
    quantity: cartItem.quantity,
    thumbUrl: cartItem.previews.thumbUrl,
    pricing,
    hasCustomization: cartItem.payload.customization?.enabled || false,
    addonsCount: cartItem.payload.premiumAddons?.length || 0,
    designId: cartItem.designId
  };
}

/**
 * Get cart totals
 * @param {Object[]} cartItems
 * @returns {Object}
 */
export function getCartTotals(cartItems) {
  const configurableItems = cartItems.filter(item => item.type === 'CONFIGURATOR_DESIGN');
  
  let subtotal = 0;
  let customizationFees = 0;
  let addons = 0;
  
  for (const item of configurableItems) {
    const breakdown = item.pricing.breakdownLines;
    
    for (const line of breakdown) {
      if (line.type === 'base') {
        subtotal += line.lineTotal;
      } else if (line.type === 'customization') {
        customizationFees += line.lineTotal;
      } else if (line.type === 'addon') {
        addons += line.lineTotal;
      }
    }
  }
  
  const total = subtotal + customizationFees + addons;
  
  return {
    subtotal,
    customizationFees,
    addons,
    total,
    itemCount: configurableItems.length,
    currency: configurableItems[0]?.pricing.currency || 'EUR'
  };
}

/**
 * Serialize cart for storage (localStorage, session)
 * @param {Object[]} cartItems
 * @returns {string} JSON string
 */
export function serializeCart(cartItems) {
  return JSON.stringify(cartItems);
}

/**
 * Deserialize cart from storage
 * @param {string} cartJson
 * @returns {Object[]}
 */
export function deserializeCart(cartJson) {
  try {
    const items = JSON.parse(cartJson);
    return Array.isArray(items) ? items : [];
  } catch (error) {
    console.error('[Cart] Failed to deserialize:', error);
    return [];
  }
}
