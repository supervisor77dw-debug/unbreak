/**
 * ============================================================================
 * DEPRECATED – DO NOT RUN IN PRODUCTION
 * ============================================================================
 * This was a one-time hotfix reference from early 2026.
 * The fix has been integrated into the codebase.
 * ============================================================================
 */

/**
 * EMERGENCY HOTFIX - Deploy to Vercel IMMEDIATELY
 * 
 * Problem: Configurator sendet {color: "petrol"} statt {colors: {base, top, middle}}
 * Solution: API konvertiert single color zu colors object automatisch
 */

// In pages/api/checkout/create.js
// Replace the config handling after line 67 (after extracting from req.body)

// BEFORE:
// const { product_sku, config, customer } = req.body;

// AFTER:
const { product_sku, customer } = req.body;
let config = req.body.config;

// EMERGENCY FIX: Convert legacy single-color format to colors object
if (config && config.color && !config.colors) {
  console.log('[HOTFIX] Converting legacy color format to colors object', {
    trace_id,
    old_format: config.color
  });
  
  config = {
    ...config,
    colors: {
      base: config.color,
      top: config.color,
      middle: config.color
    }
  };
  
  console.log('[HOTFIX] Converted to:', config.colors);
}

// Log the actual config being used
console.log('[TRACE] CHECKOUT_CONFIG_RECEIVED', {
  trace_id,
  has_single_color: !!config?.color,
  has_colors_object: !!config?.colors,
  config_preview: {
    color: config?.color,
    colors: config?.colors,
    finish: config?.finish
  }
});
