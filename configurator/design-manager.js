/**
 * Design Manager - Central Design State Management
 * 
 * Provides getDesignPayloadV1() function that builds complete DesignPayload
 * from current configurator state.
 * 
 * This is the single source of truth for design state export.
 */

import { createEmptyPayloadV1, validatePayloadV1 } from './design-payload-v1-types.js';
import { getBaseComponent, getPremiumAddon, getCustomizationFeeKey } from './sku-mapping-config.js';

// Global design state (managed by configurator)
let currentDesignState = {
  productFamily: null,
  variantKey: null,
  quantity: 1,
  selectedAddons: [],
  customization: {
    enabled: false,
    complexity: 'standard'
  },
  sceneState: null,
  previews: null
};

/**
 * Initialize design manager with product family
 * @param {string} productFamily - GLASSHOLDER | BOTTLEHOLDER | WINEHOLDER | GASTRO
 * @param {string} [variantKey] - Optional variant key
 */
export function initDesignManager(productFamily, variantKey = null) {
  currentDesignState.productFamily = productFamily;
  currentDesignState.variantKey = variantKey;
  
  console.log('[DesignManager] Initialized:', { productFamily, variantKey });
}

/**
 * Update variant
 * @param {string} variantKey
 */
export function updateVariant(variantKey) {
  currentDesignState.variantKey = variantKey;
  console.log('[DesignManager] Variant updated:', variantKey);
}

/**
 * Update quantity
 * @param {number} qty
 */
export function updateQuantity(qty) {
  currentDesignState.quantity = Math.max(1, qty);
}

/**
 * Add premium addon
 * @param {string} addonId
 * @param {number} qty
 */
export function addPremiumAddon(addonId, qty = 1) {
  const addon = getPremiumAddon(addonId);
  if (!addon) {
    console.warn('[DesignManager] Unknown addon:', addonId);
    return;
  }
  
  // Check if already exists
  const existing = currentDesignState.selectedAddons.find(a => a.addonId === addonId);
  if (existing) {
    existing.qty = qty;
  } else {
    currentDesignState.selectedAddons.push({ addonId, qty });
  }
  
  console.log('[DesignManager] Addon added:', { addonId, qty });
}

/**
 * Remove premium addon
 * @param {string} addonId
 */
export function removePremiumAddon(addonId) {
  currentDesignState.selectedAddons = currentDesignState.selectedAddons.filter(
    a => a.addonId !== addonId
  );
  console.log('[DesignManager] Addon removed:', addonId);
}

/**
 * Enable/disable customization
 * @param {boolean} enabled
 * @param {string} [complexity] - "standard" | "advanced"
 */
export function setCustomization(enabled, complexity = 'standard') {
  currentDesignState.customization = { enabled, complexity };
  console.log('[DesignManager] Customization:', { enabled, complexity });
}

/**
 * Update scene state (camera, colors, materials, etc.)
 * @param {Object} sceneState
 */
export function updateSceneState(sceneState) {
  currentDesignState.sceneState = sceneState;
}

/**
 * Update previews
 * @param {Object} previews - { heroUrl, thumbUrl, heroPngBase64, thumbPngBase64 }
 */
export function updatePreviews(previews) {
  currentDesignState.previews = previews;
}

/**
 * Get current design state (for debugging)
 * @returns {Object}
 */
export function getCurrentDesignState() {
  return { ...currentDesignState };
}

/**
 * Reset to default state
 */
export function resetToDefault() {
  const { productFamily, variantKey } = currentDesignState;
  
  currentDesignState = {
    productFamily,
    variantKey,
    quantity: 1,
    selectedAddons: [],
    customization: {
      enabled: false,
      complexity: 'standard'
    },
    sceneState: null,
    previews: null
  };
  
  console.log('[DesignManager] Reset to default');
}

/**
 * Build DesignPayloadV1 from current state
 * This is the main export function.
 * 
 * @param {string} configuratorVersion
 * @returns {Object} DesignPayloadV1 object
 */
export function getDesignPayloadV1(configuratorVersion = '1.0.0') {
  const { productFamily, variantKey, quantity, selectedAddons, customization, sceneState, previews } = currentDesignState;
  
  if (!productFamily) {
    throw new Error('Product family not set. Call initDesignManager() first.');
  }
  
  // Create empty payload
  const payload = createEmptyPayloadV1(productFamily, configuratorVersion);
  
  // Build base components
  const baseComponent = getBaseComponent(productFamily, variantKey);
  if (!baseComponent) {
    throw new Error(`No base component found for ${productFamily} / ${variantKey}`);
  }
  
  payload.baseComponents = [{
    sku: baseComponent.sku,
    qty: quantity,
    variantId: baseComponent.variantId || null,
    productKey: baseComponent.productKey || null
  }];
  
  // Build customization
  if (customization.enabled) {
    payload.customization = {
      enabled: true,
      feeKey: getCustomizationFeeKey(customization.complexity)
    };
  }
  
  // Build premium addons
  if (selectedAddons.length > 0) {
    payload.premiumAddons = selectedAddons.map(({ addonId, qty }) => {
      const addonInfo = getPremiumAddon(addonId);
      if (!addonInfo) {
        console.warn('[DesignManager] Unknown addon in state:', addonId);
        return null;
      }
      
      return {
        pricingKey: addonInfo.pricingKey,
        qty,
        addonId,
        label: addonInfo.label
      };
    }).filter(Boolean); // Remove nulls
  }
  
  // Build BOM (bill of materials)
  // This would typically be built from 3D scene data
  if (sceneState) {
    payload.bom = buildBOMFromScene(sceneState, productFamily);
  }
  
  // Add scene state
  if (sceneState) {
    payload.sceneState = {
      camera: sceneState.camera || null,
      colors: sceneState.colors || {},
      materials: sceneState.materials || {},
      dimensions: sceneState.dimensions || null
    };
  }
  
  // Add previews
  if (previews) {
    payload.previews = {
      heroUrl: previews.heroUrl || null,
      thumbUrl: previews.thumbUrl || null,
      heroPngBase64: previews.heroPngBase64 || null,
      thumbPngBase64: previews.thumbPngBase64 || null
    };
  }
  
  // Validate before returning
  const validation = validatePayloadV1(payload);
  if (!validation.valid) {
    console.error('[DesignManager] Invalid payload:', validation.errors);
    throw new Error('Generated payload is invalid: ' + validation.errors.join(', '));
  }
  
  console.log('[DesignManager] Generated payload:', payload);
  return payload;
}

/**
 * Build BOM from 3D scene state
 * @param {Object} sceneState
 * @param {string} productFamily
 * @returns {Object} BOM object
 */
function buildBOMFromScene(sceneState, productFamily) {
  const bom = {
    parts: [],
    materials: {},
    assembly: {
      complexity: 'simple',
      steps: []
    }
  };
  
  // Example: Extract parts from scene
  // This would be customized based on your 3D configurator structure
  
  if (productFamily === 'GLASSHOLDER') {
    bom.parts.push({
      partId: 'BASE_MOUNT',
      partName: 'Basis-Halterung',
      qty: 1,
      material: sceneState.materials?.base || 'STAINLESS_STEEL',
      dimensions: sceneState.dimensions || null
    });
    
    if (sceneState.colors?.primary) {
      bom.materials.coating = {
        type: 'POWDER_COATING',
        color: sceneState.colors.primary,
        finish: sceneState.materials?.finish || 'MATTE'
      };
    }
  }
  
  // Add assembly complexity based on customization
  if (sceneState.customized) {
    bom.assembly.complexity = 'custom';
  }
  
  return bom;
}

/**
 * Generate preview images from current scene
 * This is a placeholder - implement actual preview generation
 * @returns {Promise<Object>} { heroUrl, thumbUrl, heroPngBase64, thumbPngBase64 }
 */
export async function generatePreviews() {
  console.log('[DesignManager] Generating previews...');
  
  // TODO: Implement actual preview generation
  // This would typically:
  // 1. Render current 3D scene to canvas
  // 2. Convert canvas to PNG base64
  // 3. Upload to storage and get URLs
  // 4. Return URLs + base64
  
  const previews = {
    heroUrl: null,
    thumbUrl: null,
    heroPngBase64: null,
    thumbPngBase64: null
  };
  
  updatePreviews(previews);
  return previews;
}
