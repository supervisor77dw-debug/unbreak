/**
 * UNBREAK ONE - Canonical Color Validation
 * Single source of truth for configurator color IDs
 * 
 * STANDARD 7 FARBEN (Grundplatte, Arm, Muster - OHNE GRAU!):
 * - mint: #a2d9ce
 * - green: #145a32
 * - purple: #4a235a
 * - iceBlue: #5499c7
 * - darkBlue: #1b2631
 * - red: #b03a2e
 * - black: #121212
 * 
 * GRAU existiert NUR für Adapter (siehe ADAPTER_ALLOWED_COLOR_IDS)
 */

// Canonical color IDs (7 colors for base, arm, pattern - NO grey!)
export const CANONICAL_COLOR_IDS = [
  'mint',
  'green', 
  'purple',
  'iceBlue',
  'darkBlue',
  'red',
  'black'
];

// BASE/ARM/PATTERN ALLOWED COLORS (same as CANONICAL - 7 colors, NO grey)
export const BASE_ALLOWED_COLOR_IDS = CANONICAL_COLOR_IDS;

// ADAPTER ALLOWED COLORS (5 only - physical manufacturing constraint)
// WICHTIG: ice_blue + grey - NUR für Adapter!
export const ADAPTER_ALLOWED_COLOR_IDS = [
  'red',       // Rot
  'black',     // Schwarz
  'iceBlue',   // Eisblau
  'green',     // Grün
  'grey'       // Grau (NUR Adapter! Nicht base/arm/pattern!)
];

/**
 * Check if a value is a valid canonical color ID (for base/arm/pattern)
 * Does NOT include grey!
 */
export function isCanonicalColorId(value) {
  return typeof value === 'string' && CANONICAL_COLOR_IDS.includes(value);
}

/**
 * Check if a color is valid for adapter/module part
 * Includes grey!
 */
export function isAdapterColorAllowed(colorId) {
  return ADAPTER_ALLOWED_COLOR_IDS.includes(colorId);
}

/**
 * Check if color is allowed for specific part
 * KRITISCH: Grey nur für Adapter!
 * @param {string} part - Part name ('base', 'arm', 'module', 'pattern')
 * @param {string} colorId - Color ID
 * @returns {boolean}
 */
export function isColorAllowedForPart(part, colorId) {
  if (part === 'module') {
    return ADAPTER_ALLOWED_COLOR_IDS.includes(colorId);
  }
  // base, arm, pattern: NO grey!
  return CANONICAL_COLOR_IDS.includes(colorId);
}

/**
 * Validate configurator config structure
 * 
 * @param {object} config - Config from configurator iframe
 * @param {string} traceId - Trace ID for logging
 * @returns {object} Validated config
 * @throws {Error} If validation fails
 */
export function validateConfiguratorConfig(config, traceId = 'unknown') {
  const errors = [];
  
  // Check config is an object
  if (!config || typeof config !== 'object') {
    throw new Error(`[${traceId}] Config must be an object, got: ${typeof config}`);
  }
  
  // Check colors object exists
  if (!config.colors || typeof config.colors !== 'object') {
    throw new Error(`[${traceId}] Config.colors must be an object`);
  }
  
  // Get variant (default to glass_holder)
  const variant = config.variant || 'glass_holder';
  
  if (!['glass_holder', 'bottle_holder'].includes(variant)) {
    errors.push(`Invalid variant: ${variant} (expected glass_holder or bottle_holder)`);
  }
  
  // For glass_holder: require all 4 parts
  // For bottle_holder: only pattern is configurable, others default to black
  const requiredParts = variant === 'glass_holder' 
    ? ['base', 'arm', 'module', 'pattern']
    : ['pattern'];
  
  // Validate required parts
  for (const part of requiredParts) {
    const colorId = config.colors[part];
    
    if (!colorId) {
      errors.push(`Missing required color: ${part}`);
      continue;
    }
    
    // PART-SPECIFIC COLOR VALIDATION
    // Module/Adapter: Check against ADAPTER_ALLOWED (includes grey)
    // Others: Check against CANONICAL (NO grey!)
    if (part === 'module') {
      // Adapter: 5 colors (red, black, iceBlue, green, grey)
      if (!isAdapterColorAllowed(colorId)) {
        // Migration: Legacy adapter with mint -> convert to grey
        if (colorId === 'mint') {
          console.warn(`[${traceId}] Migrating legacy adapter color 'mint' -> 'grey'`);
          config.colors.module = 'grey';
        } else {
          // Other invalid colors -> fallback to black
          console.warn(`[${traceId}] Invalid adapter color "${colorId}" - falling back to black (allowed: ${ADAPTER_ALLOWED_COLOR_IDS.join(', ')})`);
          config.colors.module = 'black';
        }
      }
    } else {
      // Base, Arm, Pattern: 7 colors (NO grey!)
      if (!isCanonicalColorId(colorId)) {
        // KRITISCH: Wenn grey auf base/arm/pattern -> FEHLER!
        if (colorId === 'grey') {
          console.error(`[${traceId}] INVALID: grey not allowed for ${part}. Falling back to black.`);
          config.colors[part] = 'black';
        } else {
          errors.push(`Invalid color ID for ${part}: "${colorId}" (must be one of: ${CANONICAL_COLOR_IDS.join(', ')})`);
        }
      }
    }
  }
  
  // For bottle_holder, ensure non-configurable parts are black
  if (variant === 'bottle_holder') {
    if (!config.colors.base) config.colors.base = 'black';
    if (!config.colors.arm) config.colors.arm = 'black';
    if (!config.colors.module) config.colors.module = 'black';
  }
  
  // Validate finish (optional)
  if (config.finish && !['matte', 'glossy'].includes(config.finish)) {
    errors.push(`Invalid finish: ${config.finish} (expected matte or glossy)`);
  }
  
  // If errors found, throw with details
  if (errors.length > 0) {
    const errorMsg = `[${traceId}] Config validation failed:\n${errors.map(e => `  - ${e}`).join('\n')}`;
    throw new Error(errorMsg);
  }
  
  // Return validated config with defaults
  return {
    variant: variant,
    colors: {
      base: config.colors.base,
      arm: config.colors.arm,
      module: config.colors.module,
      pattern: config.colors.pattern
    },
    finish: config.finish || 'matte',
    quantity: config.quantity || 1,
    source: 'configurator_iframe',
    config_version: '1.0.0'
  };
}

/**
 * Get hex color code for a canonical color ID
 * Includes grey for adapter rendering (but validation prevents grey on other parts)
 */
export function getColorHex(colorId) {
  const COLOR_HEX_MAP = {
    mint: '#a2d9ce',
    green: '#145a32',
    purple: '#4a235a',
    iceBlue: '#5499c7',
    darkBlue: '#1b2631',
    red: '#b03a2e',
    black: '#121212',
    grey: '#888888'  // Only for adapter/module - validation prevents on base/arm/pattern
  };
  
  return COLOR_HEX_MAP[colorId] || '#cccccc';
}

/**
 * Get display name for a canonical color ID
 */
export function getColorDisplayName(colorId) {
  const DISPLAY_NAMES = {
    mint: 'Mint',
    green: 'Grün',
    purple: 'Lila',
    iceBlue: 'Eisblau',
    darkBlue: 'Dunkelblau',
    red: 'Rot',
    black: 'Schwarz'
  };
  
  return DISPLAY_NAMES[colorId] || colorId;
}

// For Node.js environments
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    CANONICAL_COLOR_IDS,
    isCanonicalColorId,
    validateConfiguratorConfig,
    getColorHex,
    getColorDisplayName
  };
}
