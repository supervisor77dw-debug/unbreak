/**
 * UNBREAK ONE - Pricing Configuration
 * 
 * ⚠️ DEPRECATED - Diese Datei ist nur noch FALLBACK!
 * 
 * SSOT (Single Source of Truth): pricing_configs Tabelle in Supabase
 * Diese Hardcodes werden nur verwendet wenn DB nicht erreichbar ist.
 * 
 * Siehe: lib/pricing/calcConfiguredPriceDB.js für DB-Lookup
 * Admin: /admin/settings → Preiskonfiguration
 * 
 * Version: 2026-01-v1
 */

export const PRICING_VERSION = '2026-01-v1';

// ============================================
// ⚠️ FALLBACK BASE PRICES (nur wenn DB nicht erreichbar)
// SSOT: SELECT base_price_cents FROM pricing_configs WHERE variant = '...'
// ============================================
export const BASE_PRICES = {
  glass_holder: 4990,  // €49.90 - FALLBACK, DB hat 1990!
  bottle_holder: 4990, // €49.90 - FALLBACK, DB hat 2490!
};

// ============================================
// COLOR UPCHARGES (Farbaufschläge in Cents)
// ============================================
export const COLOR_UPCHARGES = {
  // Base Colors (Grundfarben)
  base: {
    green: 0,
    black: 0,
    purple: 200,     // €2.00
    iceBlue: 200,    // €2.00
    mint: 0,
    red: 150,        // €1.50
    white: 0,
    blue: 150,
    yellow: 100,
    orange: 100,
  },
  
  // Arm Colors (nur für glass_holder - 3-Part System)
  arm: {
    black: 0,
    white: 0,
    green: 0,
    purple: 200,     // €2.00
    blue: 150,
    red: 150,
    mint: 0,
    iceBlue: 200,
  },
  
  // Module Colors (Adapter - NUR 5 Farben!)
  // KRITISCH: Adapter hat anderes Material als base/arm/pattern
  // ERLAUBT: red, black, ice_blue, green, grey (5 Farben)
  // VERBOTEN: mint, purple, dark_blue (andere Material-Farben)
  module: {
    red: 150,        // €1.50
    black: 0,
    iceBlue: 200,    // €2.00 (Eisblau)
    green: 0,
    grey: 0,         // Adapter-exklusiv
  },
  
  // Pattern Colors (Muster - alle Systeme)
  pattern: {
    red: 0,
    mint: 0,
    black: 0,
    white: 0,
    blue: 100,
    purple: 100,
    iceBlue: 150,
    green: 0,
  },
};

// ============================================
// FINISH UPCHARGES (Oberflächenaufschläge)
// ============================================
export const FINISH_UPCHARGES = {
  matte: 0,         // Standard, kein Aufpreis
  glossy: 200,      // €2.00
  textured: 300,    // €3.00
  goldEdition: 1000, // €10.00 - Premium Edition
};

// ============================================
// ARMS (Armtypen - nur glass_holder)
// ============================================
export const ARM_UPCHARGES = {
  standardArm: 0,      // Standard
  premiumArm: 450,     // €4.50
};

// ============================================
// MODULES (Modultypen - nur glass_holder)
// ============================================
export const MODULE_UPCHARGES = {
  singleModule: 0,     // Standard
  doubleModule: 250,   // €2.50
  proModule: 600,      // €6.00
};

// ============================================
// PATTERNS (Mustertypen)
// ============================================
export const PATTERN_UPCHARGES = {
  standardPattern: 0,   // Standard
  specialPattern: 300,  // €3.00
};

// ============================================
// PRODUCT METADATA
// ============================================
export const PRODUCT_NAMES = {
  glass_holder: 'Glashalter (konfiguriert)',
  bottle_holder: 'Flaschenhalter (konfiguriert)',
};

export const PRODUCT_SKUS = {
  glass_holder: 'GLASS_HOLDER_CONFIG',
  bottle_holder: 'BOTTLE_HOLDER_CONFIG',
};
