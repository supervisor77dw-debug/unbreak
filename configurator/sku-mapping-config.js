/**
 * SKU Mapping Configuration
 * 
 * Maps configurator presets and addons to shop SKUs and pricing keys.
 * This is the single source of truth for product mapping.
 * 
 * Update this when:
 * - New products are added to shop
 * - SKUs change
 * - Pricing keys are updated
 * - New addons become available
 */

/**
 * Base component SKU mapping by product family
 */
export const BASE_COMPONENT_MAPPING = {
  GLASSHOLDER: {
    default: {
      sku: 'UNBREAK-GLAS-01',
      productKey: 'glass_holder_standard',
      title: 'Glashalter Standard',
      defaultQty: 1
    },
    variants: {
      single: {
        sku: 'UNBREAK-GLAS-01',
        productKey: 'glass_holder_single',
        title: 'Glashalter Einzeln',
        variantId: 'single'
      },
      set_2: {
        sku: 'UNBREAK-GLAS-SET-2',
        productKey: 'glass_holder_set_2',
        title: 'Glashalter 2er Set',
        variantId: 'set-2'
      },
      set_4: {
        sku: 'UNBREAK-GLAS-SET-4',
        productKey: 'glass_holder_set_4',
        title: 'Glashalter 4er Set',
        variantId: 'set-4'
      }
    }
  },
  
  BOTTLEHOLDER: {
    default: {
      sku: 'UNBREAK-FLASCHE-01',
      productKey: 'bottle_holder_standard',
      title: 'Flaschenhalter Standard',
      defaultQty: 1
    },
    variants: {
      single: {
        sku: 'UNBREAK-FLASCHE-01',
        productKey: 'bottle_holder_single',
        title: 'Flaschenhalter Einzeln',
        variantId: 'single'
      },
      set_2: {
        sku: 'UNBREAK-FLASCHE-SET-2',
        productKey: 'bottle_holder_set_2',
        title: 'Flaschenhalter 2er Set',
        variantId: 'set-2'
      }
    }
  },
  
  WINEHOLDER: {
    default: {
      sku: 'UNBREAK-WEIN-01',
      productKey: 'wine_glass_holder_standard',
      title: 'Weinglas-Halter Standard',
      defaultQty: 1
    },
    variants: {
      single: {
        sku: 'UNBREAK-WEIN-01',
        productKey: 'wine_glass_holder_single',
        title: 'Weinglas-Halter Einzeln',
        variantId: 'single'
      }
    }
  },
  
  GASTRO: {
    default: {
      sku: 'UNBREAK-GASTRO-01',
      productKey: 'gastro_edition',
      title: 'Gastro Edition',
      defaultQty: 1
    },
    variants: {
      set_6: {
        sku: 'UNBREAK-GASTRO-SET-6',
        productKey: 'gastro_set_6',
        title: 'Gastro Edition 6er Set',
        variantId: 'set-6'
      },
      set_12: {
        sku: 'UNBREAK-GASTRO-SET-12',
        productKey: 'gastro_set_12',
        title: 'Gastro Edition 12er Set',
        variantId: 'set-12'
      }
    }
  }
};

/**
 * Premium addon pricing key mapping
 */
export const PREMIUM_ADDON_MAPPING = {
  // Engraving
  ENGRAVING_STANDARD: {
    addonId: 'ENGRAVING_STANDARD',
    label: 'Standardgravur',
    pricingKey: 'ADDON_ENGRAVING_STANDARD',
    unit: 'pcs',
    description: 'Lasergravur bis 20 Zeichen'
  },
  
  ENGRAVING_LOGO: {
    addonId: 'ENGRAVING_LOGO',
    label: 'Logo-Gravur',
    pricingKey: 'ADDON_ENGRAVING_LOGO',
    unit: 'pcs',
    description: 'Lasergravur mit hochgeladenem Logo'
  },
  
  // Material upgrades
  WOOD_INLAY: {
    addonId: 'WOOD_INLAY',
    label: 'Holz-Einlage',
    pricingKey: 'ADDON_WOOD_INLAY',
    unit: 'pcs',
    description: 'Dekorative Holzeinlage'
  },
  
  METAL_RING: {
    addonId: 'METAL_RING',
    label: 'Metallring',
    pricingKey: 'ADDON_METAL_RING',
    unit: 'pcs',
    description: 'Dekorativer Metallring'
  },
  
  // Color options
  CUSTOM_COLOR_RAL: {
    addonId: 'CUSTOM_COLOR_RAL',
    label: 'RAL Wunschfarbe',
    pricingKey: 'ADDON_CUSTOM_COLOR_RAL',
    unit: 'set',
    description: 'Pulverbeschichtung in RAL-Wunschfarbe'
  },
  
  CUSTOM_COLOR_HEX: {
    addonId: 'CUSTOM_COLOR_HEX',
    label: 'Individuelle Farbe',
    pricingKey: 'ADDON_CUSTOM_COLOR_HEX',
    unit: 'set',
    description: 'Pulverbeschichtung in individueller Farbe'
  },
  
  // Packaging
  GIFT_BOX: {
    addonId: 'GIFT_BOX',
    label: 'Geschenkbox',
    pricingKey: 'ADDON_GIFT_BOX',
    unit: 'pcs',
    description: 'Hochwertige Geschenkverpackung'
  },
  
  PREMIUM_PACKAGING: {
    addonId: 'PREMIUM_PACKAGING',
    label: 'Premium Verpackung',
    pricingKey: 'ADDON_PREMIUM_PACKAGING',
    unit: 'set',
    description: 'Exklusive Premium-Verpackung'
  }
};

/**
 * Customization fee keys
 */
/**
 * Customization Fee (Single, Global)
 * 
 * Business Rule:
 * - ONE global customization fee for ANY non-default design
 * - Applied when customization.enabled = true
 */
export const CUSTOMIZATION_FEES = {
  STANDARD: {
    feeKey: 'CUSTOM_DESIGN_FEE',
    label: 'Individualisierung',
    description: 'Aufpreis für individuelles Design'
  }
};

/**
 * Standard RAL colors available
 */
export const STANDARD_RAL_COLORS = {
  'RAL 9005': { code: 'RAL 9005', label: 'Tiefschwarz', hex: '#0A0A0A' },
  'RAL 7016': { code: 'RAL 7016', label: 'Anthrazitgrau', hex: '#293133' },
  'RAL 9010': { code: 'RAL 9010', label: 'Reinweiß', hex: '#F1F0EA' },
  'RAL 3000': { code: 'RAL 3000', label: 'Feuerrot', hex: '#A72920' },
  'RAL 5015': { code: 'RAL 5015', label: 'Himmelblau', hex: '#007CB0' },
  'RAL 6018': { code: 'RAL 6018', label: 'Gelbgrün', hex: '#57A639' }
};

/**
 * Helper: Get base component for product family and variant
 * @param {string} productFamily
 * @param {string} [variantKey] - Optional variant key
 * @returns {Object|null}
 */
export function getBaseComponent(productFamily, variantKey = null) {
  const family = BASE_COMPONENT_MAPPING[productFamily];
  if (!family) return null;
  
  if (variantKey && family.variants && family.variants[variantKey]) {
    return family.variants[variantKey];
  }
  
  return family.default;
}

/**
 * Helper: Get premium addon info
 * @param {string} addonId
 * @returns {Object|null}
 */
export function getPremiumAddon(addonId) {
  return PREMIUM_ADDON_MAPPING[addonId] || null;
}

/**
 * Helper: Get customization fee key
 * @param {string} complexity - Ignored (legacy parameter)
 * @returns {string}
 */
export function getCustomizationFeeKey(complexity = 'standard') {
  // Business Rule: Always return single global customization fee
  return CUSTOMIZATION_FEES.STANDARD.feeKey;
}

/**
 * Helper: Validate SKU exists in mapping
 * @param {string} sku
 * @returns {boolean}
 */
export function isValidSKU(sku) {
  for (const family of Object.values(BASE_COMPONENT_MAPPING)) {
    if (family.default.sku === sku) return true;
    if (family.variants) {
      for (const variant of Object.values(family.variants)) {
        if (variant.sku === sku) return true;
      }
    }
  }
  return false;
}

/**
 * Helper: Validate pricing key exists
 * @param {string} pricingKey
 * @returns {boolean}
 */
export function isValidPricingKey(pricingKey) {
  for (const addon of Object.values(PREMIUM_ADDON_MAPPING)) {
    if (addon.pricingKey === pricingKey) return true;
  }
  
  for (const fee of Object.values(CUSTOMIZATION_FEES)) {
    if (fee.feeKey === pricingKey) return true;
  }
  
  return false;
}
