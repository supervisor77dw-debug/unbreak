/**
 * DesignPayload v1 - Shop-Focused Schema
 * 
 * This schema is optimized for pricing and order conversion.
 * Differs from the generic contract by focusing on:
 * - SKU-based pricing (baseComponents)
 * - Premium addon pricing (premiumAddons)
 * - Customization fee tracking
 * - Direct mapping to shop products
 * 
 * Version: 1.0
 * Last Updated: 2026-01-03
 */

/**
 * @typedef {Object} DesignPayloadV1
 * @property {string} version - Always "1.0"
 * @property {string} designId - Stable UUID for design session
 * @property {string} configuratorVersion - Git SHA or semver
 * @property {string} productFamily - "GLASSHOLDER" | "BOTTLEHOLDER" | etc.
 * @property {BaseComponent[]} baseComponents - MUST be non-empty
 * @property {CustomizationConfig} customization - Customization fee info
 * @property {PremiumAddon[]} premiumAddons - Optional premium features
 * @property {BOM} bom - Production/fulfillment metadata
 * @property {SceneState} sceneState - Design reproducibility
 * @property {Previews} previews - Preview images/URLs
 * @property {Validation} validation - Validity status
 * @property {string} createdAt - ISO 8601 timestamp
 * @property {string} updatedAt - ISO 8601 timestamp
 */

/**
 * @typedef {Object} BaseComponent
 * @property {string} sku - MUST map to real shop SKU (REQUIRED, non-empty)
 * @property {string} [productKey] - Shop internal key (optional if sku sufficient)
 * @property {string} title - Human-readable component name
 * @property {number} qty - Quantity (integer expected)
 * @property {string} [variantId] - Optional shop variant mapping
 */

/**
 * @typedef {Object} CustomizationConfig
 * @property {boolean} enabled - True if user deviates from default
 * @property {string} feeKey - Host resolves via pricebook (e.g. "CUSTOMIZE_FEE_V1")
 * @property {string} [complexity] - "standard" | "advanced"
 * @property {string} [notes] - Additional customization notes
 */

/**
 * @typedef {Object} PremiumAddon
 * @property {string} addonId - e.g. "WOOD_INLAY", "METAL_RING"
 * @property {string} label - Human-readable label
 * @property {string} pricingKey - Host resolves via addon delta pricebook (REQUIRED)
 * @property {string} [materialId] - Material identifier
 * @property {ColorSpec} [color] - Color specification
 * @property {number} qty - Quantity (REQUIRED)
 * @property {string} [unit] - "pcs" | "cm" | "set" | etc.
 */

/**
 * @typedef {Object} ColorSpec
 * @property {string} system - "HEX" | "RAL" | "NAME" | custom
 * @property {string} code - Color code/value
 * @property {string} [label] - Human-readable color name
 */

/**
 * @typedef {Object} BOM
 * @property {BOMPart[]} parts - Production parts list
 */

/**
 * @typedef {Object} BOMPart
 * @property {string} partId - Part identifier
 * @property {string} label - Human-readable label
 * @property {string} [material] - Material type
 * @property {ColorSpec} [color] - Part color
 * @property {number} qty - Quantity
 * @property {string} [notes] - Additional notes
 */

/**
 * @typedef {Object} SceneState
 * @property {string} [presetId] - Preset template ID
 * @property {any} [camera] - Camera state
 * @property {any} [objects] - 3D objects state
 * @property {any} [params] - Additional parameters
 */

/**
 * @typedef {Object} Previews
 * @property {string} [heroPngUrl] - Main preview image URL
 * @property {string} [thumbPngUrl] - Thumbnail URL
 * @property {PreviewImage[]} [additional] - Additional preview images
 */

/**
 * @typedef {Object} PreviewImage
 * @property {string} label - Image label
 * @property {string} url - Image URL
 */

/**
 * @typedef {Object} Validation
 * @property {boolean} isValid - Overall validity
 * @property {string[]} errors - Validation error messages
 */

/**
 * Create empty DesignPayload v1
 * @param {string} productFamily - Product family identifier
 * @param {string} configuratorVersion - Version string
 * @returns {DesignPayloadV1}
 */
export function createEmptyPayloadV1(productFamily, configuratorVersion = '1.0.0') {
  const now = new Date().toISOString();
  const designId = generateUUID();
  
  return {
    version: '1.0',
    designId,
    configuratorVersion,
    productFamily,
    
    baseComponents: [],
    
    customization: {
      enabled: false,
      feeKey: 'CUSTOMIZE_FEE_V1'
    },
    
    premiumAddons: [],
    
    bom: {
      parts: []
    },
    
    sceneState: {},
    
    previews: {},
    
    validation: {
      isValid: false,
      errors: ['No base components configured']
    },
    
    createdAt: now,
    updatedAt: now
  };
}

/**
 * Validate DesignPayload v1
 * @param {DesignPayloadV1} payload
 * @returns {{valid: boolean, errors: string[]}}
 */
export function validatePayloadV1(payload) {
  const errors = [];
  
  // Version check
  if (payload.version !== '1.0') {
    errors.push('version must be "1.0"');
  }
  
  // Required fields
  if (!payload.designId || typeof payload.designId !== 'string') {
    errors.push('designId must be a non-empty string');
  }
  
  if (!payload.configuratorVersion || typeof payload.configuratorVersion !== 'string') {
    errors.push('configuratorVersion must be a non-empty string');
  }
  
  if (!payload.productFamily || typeof payload.productFamily !== 'string') {
    errors.push('productFamily must be a non-empty string');
  }
  
  // baseComponents validation (CRITICAL)
  if (!Array.isArray(payload.baseComponents)) {
    errors.push('baseComponents must be an array');
  } else if (payload.baseComponents.length === 0) {
    errors.push('baseComponents MUST be non-empty');
  } else {
    payload.baseComponents.forEach((comp, idx) => {
      if (!comp.sku || typeof comp.sku !== 'string' || comp.sku.trim() === '') {
        errors.push(`baseComponents[${idx}].sku MUST be present and non-empty`);
      }
      if (!comp.title || typeof comp.title !== 'string') {
        errors.push(`baseComponents[${idx}].title must be a string`);
      }
      if (typeof comp.qty !== 'number' || comp.qty < 1) {
        errors.push(`baseComponents[${idx}].qty must be a positive number`);
      }
    });
  }
  
  // Customization validation
  if (!payload.customization || typeof payload.customization !== 'object') {
    errors.push('customization must be an object');
  } else {
    if (typeof payload.customization.enabled !== 'boolean') {
      errors.push('customization.enabled must be a boolean');
    }
    if (!payload.customization.feeKey || typeof payload.customization.feeKey !== 'string') {
      errors.push('customization.feeKey must be a non-empty string');
    }
  }
  
  // premiumAddons validation (if present)
  if (payload.premiumAddons && Array.isArray(payload.premiumAddons)) {
    payload.premiumAddons.forEach((addon, idx) => {
      if (!addon.pricingKey || typeof addon.pricingKey !== 'string') {
        errors.push(`premiumAddons[${idx}].pricingKey MUST be present and non-empty`);
      }
      if (typeof addon.qty !== 'number' || addon.qty < 1) {
        errors.push(`premiumAddons[${idx}].qty MUST be a positive number`);
      }
    });
  }
  
  // Timestamps
  if (!isValidISO8601(payload.createdAt)) {
    errors.push('createdAt must be valid ISO 8601');
  }
  if (!isValidISO8601(payload.updatedAt)) {
    errors.push('updatedAt must be valid ISO 8601');
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Generate UUID v4
 * @returns {string}
 */
function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

/**
 * Validate ISO 8601 timestamp
 * @param {string} str
 * @returns {boolean}
 */
function isValidISO8601(str) {
  if (typeof str !== 'string') return false;
  const date = new Date(str);
  return date.toISOString() === str;
}

/**
 * Calculate payload size
 * @param {DesignPayloadV1} payload
 * @returns {number} Size in bytes
 */
export function calculatePayloadSize(payload) {
  return new Blob([JSON.stringify(payload)]).size;
}

/**
 * Format payload size for display
 * @param {number} bytes
 * @returns {string}
 */
export function formatPayloadSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}
