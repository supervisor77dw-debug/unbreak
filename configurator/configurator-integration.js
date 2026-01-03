/**
 * Configurator Integration - Usage Example
 * 
 * Shows how to integrate the DesignPayload v1 system into your configurator.
 * 
 * Quick Start:
 * 1. Initialize the design manager with product family
 * 2. Initialize the postMessage bridge with allowed origins
 * 3. Register callbacks for host messages
 * 4. Initialize debug panel (development only)
 * 5. Post CONFIG_READY event
 * 6. Post DESIGN_CHANGED whenever design state changes
 */

import { 
  initDesignManager, 
  updateVariant, 
  addPremiumAddon, 
  setCustomization,
  updateSceneState,
  getDesignPayloadV1,
  generatePreviews,
  resetToDefault
} from './design-manager.js';

import {
  initBridge,
  registerCallbacks,
  postConfigReady,
  postDesignChanged,
  postDesignSnapshot,
  postCurrentPayload,
  postPreviewsGenerated,
  MESSAGE_TYPES
} from './postmessage-bridge.js';

import { initDebugPanel, logMessage, showPanel } from './debug-panel-compact.js';

/**
 * Initialize configurator integration
 * Call this when your configurator loads
 */
export function initConfiguratorIntegration() {
  const productFamily = 'GLASSHOLDER'; // Get from URL params or config
  const isDevelopment = window.location.hostname === 'localhost';
  
  // 1. Initialize design manager
  initDesignManager(productFamily);
  console.log('[ConfigIntegration] Design manager initialized');
  
  // 2. Initialize postMessage bridge with allowed origins
  const allowedOrigins = isDevelopment 
    ? ['http://localhost:3000', 'http://localhost:3001']
    : ['https://unbreak.one', 'https://www.unbreak.one'];
  
  initBridge(allowedOrigins);
  console.log('[ConfigIntegration] PostMessage bridge initialized');
  
  // 3. Register callbacks for host messages
  registerCallbacks({
    onGetCurrentPayload: handleGetCurrentPayload,
    onGeneratePreviews: handleGeneratePreviews,
    onResetToDefault: handleResetToDefault,
    onUpdateVariant: handleUpdateVariant,
    onClose: handleClose
  });
  console.log('[ConfigIntegration] Callbacks registered');
  
  // 4. Initialize debug panel (development only)
  if (isDevelopment) {
    initDebugPanel();
    console.log('[ConfigIntegration] Debug panel initialized (Ctrl+Shift+D to toggle)');
  }
  
  // 5. Post CONFIG_READY event to host
  const capabilities = [
    'preview-generation',
    'sku-validation',
    'premium-addons',
    'customization-fees'
  ];
  postConfigReady(productFamily, capabilities);
  logMessage('sent', MESSAGE_TYPES.CONFIG_READY);
  
  console.log('[ConfigIntegration] ✅ Integration ready');
}

/**
 * Handler: Get current payload
 * Called when host requests current design state
 */
function handleGetCurrentPayload() {
  try {
    const payload = getDesignPayloadV1();
    postCurrentPayload(payload);
    logMessage('sent', MESSAGE_TYPES.CURRENT_PAYLOAD, payload);
  } catch (error) {
    console.error('[ConfigIntegration] Failed to get current payload:', error);
  }
}

/**
 * Handler: Generate previews
 * Called when host requests preview generation
 */
async function handleGeneratePreviews() {
  try {
    const previews = await generatePreviews();
    postPreviewsGenerated(previews);
    logMessage('sent', MESSAGE_TYPES.PREVIEWS_GENERATED, previews);
  } catch (error) {
    console.error('[ConfigIntegration] Failed to generate previews:', error);
  }
}

/**
 * Handler: Reset to default
 * Called when host requests reset
 */
function handleResetToDefault() {
  try {
    resetToDefault();
    
    // Send updated payload
    const payload = getDesignPayloadV1();
    postDesignChanged(payload);
    logMessage('sent', MESSAGE_TYPES.DESIGN_CHANGED, payload);
    
    console.log('[ConfigIntegration] Reset to default');
  } catch (error) {
    console.error('[ConfigIntegration] Failed to reset:', error);
  }
}

/**
 * Handler: Update variant
 * Called when host requests variant change
 */
function handleUpdateVariant(variantPayload) {
  try {
    const { variantKey } = variantPayload;
    updateVariant(variantKey);
    
    // Send updated payload
    const payload = getDesignPayloadV1();
    postDesignChanged(payload);
    logMessage('sent', MESSAGE_TYPES.DESIGN_CHANGED, payload);
    
    console.log('[ConfigIntegration] Variant updated:', variantKey);
  } catch (error) {
    console.error('[ConfigIntegration] Failed to update variant:', error);
  }
}

/**
 * Handler: Close configurator
 * Called when host requests close
 */
function handleClose() {
  console.log('[ConfigIntegration] Close requested by host');
  // Implement close logic (e.g., fade out, redirect, etc.)
}

/**
 * Notify host of design change
 * Call this whenever the design state changes (debounced automatically)
 */
export function notifyDesignChanged() {
  try {
    const payload = getDesignPayloadV1();
    postDesignChanged(payload); // Automatically debounced
    logMessage('sent', MESSAGE_TYPES.DESIGN_CHANGED, payload);
  } catch (error) {
    console.error('[ConfigIntegration] Failed to notify design change:', error);
  }
}

/**
 * Save design snapshot
 * Call this on explicit user action (e.g., "Save Design" button)
 */
export function saveDesignSnapshot() {
  try {
    const payload = getDesignPayloadV1();
    postDesignSnapshot(payload); // Not debounced
    logMessage('sent', MESSAGE_TYPES.DESIGN_SNAPSHOT, payload);
  } catch (error) {
    console.error('[ConfigIntegration] Failed to save snapshot:', error);
  }
}

/**
 * Example: User changes variant
 */
export function exampleChangeVariant(variantKey) {
  updateVariant(variantKey);
  notifyDesignChanged();
}

/**
 * Example: User adds premium addon
 */
export function exampleAddAddon(addonId, qty = 1) {
  addPremiumAddon(addonId, qty);
  notifyDesignChanged();
}

/**
 * Example: User enables customization
 */
export function exampleEnableCustomization() {
  setCustomization(true, 'standard');
  notifyDesignChanged();
}

/**
 * Example: 3D scene changes (camera, colors, etc.)
 */
export function exampleSceneChanged(sceneState) {
  updateSceneState(sceneState);
  notifyDesignChanged();
}

// Auto-initialize when module loads
// Comment this out if you want manual initialization
if (typeof window !== 'undefined') {
  // Wait for DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initConfiguratorIntegration);
  } else {
    initConfiguratorIntegration();
  }
}
