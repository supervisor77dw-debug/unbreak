/**
 * Pricebook Configuration
 * 
 * Central pricing data for:
 * - Customization fees (feeKey → price)
 * - Premium addon deltas (pricingKey → price)
 * 
 * Version tracking for audit/signature validation.
 * 
 * IMPORTANT: This is in-memory config for MVP.
 * Production should use database tables:
 * - pricing_customization_fees (fee_key, amount, currency, active, description)
 * - pricing_addon_deltas (pricing_key, amount, currency, unit, active, description)
 */

// Current pricebook version (increment on any price change)
export const PRICEBOOK_VERSION = 'v1.2024-01-03';

// Default currency
export const DEFAULT_CURRENCY = 'EUR';

/**
 * Customization fees
 * feeKey → { amount, currency, description }
 */
export const CUSTOMIZATION_FEES = {
  CUSTOMIZE_FEE_V1: {
    amount: 15.00,
    currency: 'EUR',
    description: 'Standard Individualisierung',
    active: true
  },
  
  CUSTOMIZE_FEE_ADVANCED_V1: {
    amount: 35.00,
    currency: 'EUR',
    description: 'Erweiterte Individualisierung',
    active: true
  }
};

/**
 * Premium addon price deltas
 * pricingKey → { amount, currency, unit, description }
 */
export const ADDON_DELTAS = {
  // Engraving
  ADDON_ENGRAVING_STANDARD: {
    amount: 12.00,
    currency: 'EUR',
    unit: 'pcs',
    description: 'Lasergravur Standard (bis 20 Zeichen)',
    active: true
  },
  
  ADDON_ENGRAVING_LOGO: {
    amount: 25.00,
    currency: 'EUR',
    unit: 'pcs',
    description: 'Lasergravur mit Logo',
    active: true
  },
  
  // Material upgrades
  ADDON_WOOD_INLAY: {
    amount: 18.00,
    currency: 'EUR',
    unit: 'pcs',
    description: 'Holz-Einlage (Walnuss)',
    active: true
  },
  
  ADDON_METAL_RING: {
    amount: 22.00,
    currency: 'EUR',
    unit: 'pcs',
    description: 'Edelstahl-Ring',
    active: true
  },
  
  // Color options
  ADDON_CUSTOM_COLOR_RAL: {
    amount: 20.00,
    currency: 'EUR',
    unit: 'set',
    description: 'Pulverbeschichtung RAL-Wunschfarbe',
    active: true
  },
  
  ADDON_CUSTOM_COLOR_HEX: {
    amount: 30.00,
    currency: 'EUR',
    unit: 'set',
    description: 'Pulverbeschichtung individuelle Farbe',
    active: true
  },
  
  // Packaging
  ADDON_GIFT_BOX: {
    amount: 8.00,
    currency: 'EUR',
    unit: 'pcs',
    description: 'Geschenkbox Premium',
    active: true
  },
  
  ADDON_PREMIUM_PACKAGING: {
    amount: 15.00,
    currency: 'EUR',
    unit: 'set',
    description: 'Premium Verpackung',
    active: true
  }
};

/**
 * Get customization fee
 * @param {string} feeKey
 * @returns {Object|null} { amount, currency, description }
 */
export function getCustomizationFee(feeKey) {
  const fee = CUSTOMIZATION_FEES[feeKey];
  if (!fee || !fee.active) return null;
  return fee;
}

/**
 * Get addon delta
 * @param {string} pricingKey
 * @returns {Object|null} { amount, currency, unit, description }
 */
export function getAddonDelta(pricingKey) {
  const addon = ADDON_DELTAS[pricingKey];
  if (!addon || !addon.active) return null;
  return addon;
}

/**
 * Get all active customization fees
 * @returns {Object}
 */
export function getAllCustomizationFees() {
  return Object.entries(CUSTOMIZATION_FEES)
    .filter(([_, fee]) => fee.active)
    .reduce((acc, [key, fee]) => {
      acc[key] = fee;
      return acc;
    }, {});
}

/**
 * Get all active addon deltas
 * @returns {Object}
 */
export function getAllAddonDeltas() {
  return Object.entries(ADDON_DELTAS)
    .filter(([_, addon]) => addon.active)
    .reduce((acc, [key, addon]) => {
      acc[key] = addon;
      return acc;
    }, {});
}

/**
 * Validate pricebook consistency
 * Checks that all required keys are present and valid
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validatePricebook() {
  const errors = [];
  
  // Check fees
  for (const [key, fee] of Object.entries(CUSTOMIZATION_FEES)) {
    if (typeof fee.amount !== 'number' || fee.amount < 0) {
      errors.push(`Invalid fee amount for ${key}: ${fee.amount}`);
    }
    if (!fee.currency) {
      errors.push(`Missing currency for ${key}`);
    }
  }
  
  // Check addons
  for (const [key, addon] of Object.entries(ADDON_DELTAS)) {
    if (typeof addon.amount !== 'number' || addon.amount < 0) {
      errors.push(`Invalid addon amount for ${key}: ${addon.amount}`);
    }
    if (!addon.currency) {
      errors.push(`Missing currency for ${key}`);
    }
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}
