/**
 * Pricing Configuration v1 (Authoritative)
 * 
 * Centralized pricing matrix for configurator designs.
 * 
 * IMPORTANT:
 * - Base product prices are resolved from shop catalog (single source of truth)
 * - This config defines ONLY: customization fee + premium addon deltas
 * - All prices are net (exclude VAT)
 * - Version must be incremented on ANY price change
 */

export const PRICING_CONFIG = {
  version: 'v1.2026-01-03',
  currency: 'EUR',
  vatRate: 0.19, // 19% German VAT
  
  /**
   * Customization Fee (Mandatory if customized)
   * 
   * Applied when: customization.enabled = true
   * Quantity: Always 1
   * Covers: Design effort, handling, production setup
   */
  customizationFee: {
    key: 'CUSTOM_DESIGN_FEE',
    label: 'Individualisierung',
    description: 'Aufpreis für individuelles Design',
    priceNet: 19.00,
    quantity: 1,
    taxable: true
  },
  
  /**
   * Premium Component Addons (Delta Pricing)
   * 
   * Business Rule: Addons are ADDITIVE ONLY (not replacement)
   * Each addon adds to base + customization
   */
  premiumAddons: {
    
    // Material Upgrades
    WOOD_BASE: {
      key: 'ADDON_WOOD_INLAY',
      label: 'Holzsockel',
      description: 'Hochwertiger Sockel aus Walnussholz',
      priceNet: 24.00,
      unit: 'pcs',
      taxable: true,
      category: 'materials'
    },
    
    METAL_RING: {
      key: 'ADDON_METAL_RING',
      label: 'Metallring',
      description: 'Dekorativer Edelstahl-Ring',
      priceNet: 18.00,
      unit: 'pcs',
      taxable: true,
      category: 'materials'
    },
    
    // Coating & Colors
    SPECIAL_COATING_RAL: {
      key: 'ADDON_CUSTOM_COLOR_RAL',
      label: 'Wunschfarbe (RAL)',
      description: 'Pulverbeschichtung in RAL-Wunschfarbe',
      priceNet: 29.00,
      unit: 'set',
      taxable: true,
      category: 'coating'
    },
    
    SPECIAL_COATING_CUSTOM: {
      key: 'ADDON_CUSTOM_COLOR_HEX',
      label: 'Individuelle Farbe',
      description: 'Pulverbeschichtung in individueller Farbe',
      priceNet: 39.00,
      unit: 'set',
      taxable: true,
      category: 'coating'
    },
    
    // Engraving
    ENGRAVING_TEXT: {
      key: 'ADDON_ENGRAVING_STANDARD',
      label: 'Gravur',
      description: 'Lasergravur (bis 20 Zeichen)',
      priceNet: 14.00,
      unit: 'pcs',
      taxable: true,
      category: 'engraving'
    },
    
    ENGRAVING_LOGO: {
      key: 'ADDON_ENGRAVING_LOGO',
      label: 'Logo-Gravur',
      description: 'Lasergravur mit hochgeladenem Logo',
      priceNet: 32.00,
      unit: 'pcs',
      taxable: true,
      category: 'engraving'
    },
    
    // Packaging
    GIFT_BOX: {
      key: 'ADDON_GIFT_BOX',
      label: 'Geschenkbox',
      description: 'Hochwertige Premium-Geschenkverpackung',
      priceNet: 12.00,
      unit: 'pcs',
      taxable: true,
      category: 'packaging'
    },
    
    PREMIUM_PACKAGING: {
      key: 'ADDON_PREMIUM_PACKAGING',
      label: 'Premium-Verpackung',
      description: 'Exklusive Verpackung mit Zertifikat',
      priceNet: 19.00,
      unit: 'set',
      taxable: true,
      category: 'packaging'
    }
  }
} as const;

/**
 * Calculate gross price (including VAT)
 */
export function calculateGross(net: number, vatRate: number = PRICING_CONFIG.vatRate): number {
  return Math.round((net * (1 + vatRate)) * 100) / 100;
}

/**
 * Format price for display (German locale)
 */
export function formatPrice(amount: number, currency: string = PRICING_CONFIG.currency): string {
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency
  }).format(amount);
}

/**
 * Get customization fee
 */
export function getCustomizationFee() {
  return PRICING_CONFIG.customizationFee;
}

/**
 * Get premium addon by key
 */
export function getPremiumAddon(key: keyof typeof PRICING_CONFIG.premiumAddons) {
  return PRICING_CONFIG.premiumAddons[key];
}

/**
 * Validate pricebook version
 */
export function validatePricebookVersion(clientVersion: string): boolean {
  return clientVersion === PRICING_CONFIG.version;
}

/**
 * Export type definitions for TypeScript
 */
export type PricingConfig = typeof PRICING_CONFIG;
export type PremiumAddonKey = keyof typeof PRICING_CONFIG.premiumAddons;
