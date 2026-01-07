/**
 * UNBREAK ONE - Pricing Configuration
 * Single Source of Truth für Konfigurator-Preise
 * Version: 2026-01-v1
 */

export const PRICING_VERSION = '2026-01-v1';

// Base Prices (in cents)
export const BASE_PRICES = {
  glass_holder: 4990,  // €49.90
  bottle_holder: 4990, // €49.90
};

// Color Upcharges (in cents)
export const COLOR_UPCHARGES = {
  // Base colors
  base: {
    green: 0,
    black: 0,
    purple: 200,   // €2.00
    white: 0,
    blue: 200,
    red: 200,
    yellow: 100,
    orange: 100,
  },
  
  // Arm colors (glass_holder only)
  arm: {
    black: 0,
    white: 0,
    green: 0,
    purple: 200,
    blue: 200,
    red: 200,
  },
  
  // Module colors (glass_holder only)
  module: {
    mint: 0,
    iceBlue: 200,   // €2.00
    black: 0,
    white: 0,
    purple: 200,
  },
  
  // Pattern colors
  pattern: {
    red: 0,
    mint: 0,
    black: 0,
    white: 0,
    blue: 100,
    purple: 100,
  },
};

// Finish Upcharges (in cents)
export const FINISH_UPCHARGES = {
  matte: 0,
  glossy: 200,    // €2.00
  textured: 300,  // €3.00
};

// Product Display Names
export const PRODUCT_NAMES = {
  glass_holder: 'Glashalter (konfiguriert)',
  bottle_holder: 'Flaschenhalter (konfiguriert)',
};

// Product SKUs
export const PRODUCT_SKUS = {
  glass_holder: 'GLASS_HOLDER_CONFIG',
  bottle_holder: 'BOTTLE_HOLDER_CONFIG',
};
