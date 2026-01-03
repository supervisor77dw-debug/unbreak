/**
 * Fulfillment Export - Design to Production
 * 
 * Transforms order line items with DesignPayloadV1 into
 * production-ready data for manufacturing/assembly.
 * 
 * Output includes:
 * - Base components (SKUs + quantities)
 * - Premium addons (materials, colors, engraving)
 * - BOM (bill of materials)
 * - Scene state (for 3D reconstruction)
 * - Preview images
 * - Assembly instructions
 */

/**
 * Export design for fulfillment
 * 
 * @param {Object} orderLineItem - Order line item with design payload
 * @param {Object} order - Parent order object
 * @returns {Object} FulfillmentExport
 */
export function exportDesignForFulfillment(orderLineItem, order) {
  const { payload } = orderLineItem;
  
  if (!payload) {
    throw new Error('Order line item missing design payload');
  }
  
  const fulfillmentExport = {
    // Order metadata
    orderId: order.id,
    orderNumber: order.orderNumber,
    customerId: order.customerId,
    orderDate: order.createdAt,
    
    // Design metadata
    designId: payload.designId,
    productFamily: payload.productFamily,
    configuratorVersion: payload.configuratorVersion,
    
    // Base components (what to manufacture)
    baseComponents: extractBaseComponents(payload),
    
    // Customization & addons (modifications to base)
    customization: extractCustomization(payload),
    premiumAddons: extractPremiumAddons(payload),
    
    // Technical specifications
    bom: payload.bom || null,
    sceneState: payload.sceneState || null,
    
    // Visual references
    previews: {
      heroUrl: payload.previews?.heroUrl || null,
      thumbUrl: payload.previews?.thumbUrl || null
    },
    
    // Assembly/production notes
    productionNotes: generateProductionNotes(payload),
    
    // Quality control
    validation: payload.validation || { valid: true, errors: [] },
    
    // Export metadata
    exportedAt: new Date().toISOString(),
    exportVersion: '1.0'
  };
  
  return fulfillmentExport;
}

/**
 * Extract base components for manufacturing
 */
function extractBaseComponents(payload) {
  if (!payload.baseComponents) return [];
  
  return payload.baseComponents.map(component => ({
    sku: component.sku,
    qty: component.qty,
    variantId: component.variantId || null,
    productKey: component.productKey || null
  }));
}

/**
 * Extract customization details
 */
function extractCustomization(payload) {
  if (!payload.customization?.enabled) return null;
  
  return {
    enabled: true,
    feeKey: payload.customization.feeKey,
    complexity: payload.customization.feeKey?.includes('ADVANCED') ? 'advanced' : 'standard'
  };
}

/**
 * Extract premium addons for production
 */
function extractPremiumAddons(payload) {
  if (!payload.premiumAddons || payload.premiumAddons.length === 0) {
    return [];
  }
  
  return payload.premiumAddons.map(addon => ({
    pricingKey: addon.pricingKey,
    addonId: addon.addonId,
    label: addon.label,
    qty: addon.qty,
    
    // Production instructions
    instructions: getAddonInstructions(addon.addonId)
  }));
}

/**
 * Get production instructions for addon
 */
function getAddonInstructions(addonId) {
  const instructions = {
    ENGRAVING_STANDARD: 'Lasergravur gemäß Kunden-Text (max 20 Zeichen)',
    ENGRAVING_LOGO: 'Lasergravur mit hochgeladenem Logo (siehe Datei)',
    WOOD_INLAY: 'Walnuss-Einlage montieren',
    METAL_RING: 'Edelstahl-Ring anbringen',
    CUSTOM_COLOR_RAL: 'Pulverbeschichtung RAL-Farbe (siehe sceneState.colors)',
    CUSTOM_COLOR_HEX: 'Pulverbeschichtung individuelle Farbe (siehe sceneState.colors)',
    GIFT_BOX: 'In Premium-Geschenkbox verpacken',
    PREMIUM_PACKAGING: 'Premium-Verpackung verwenden'
  };
  
  return instructions[addonId] || 'Siehe Addon-Spezifikation';
}

/**
 * Generate production notes
 */
function generateProductionNotes(payload) {
  const notes = [];
  
  // Customization note
  if (payload.customization?.enabled) {
    notes.push('⚠️ INDIVIDUALISIERT - Sonderanfertigung');
  }
  
  // Color note
  if (payload.sceneState?.colors?.primary) {
    notes.push(`Farbe: ${payload.sceneState.colors.primary}`);
  }
  
  // Material note
  if (payload.sceneState?.materials?.base) {
    notes.push(`Material: ${payload.sceneState.materials.base}`);
  }
  
  // Engraving note
  const engravingAddon = payload.premiumAddons?.find(a => 
    a.addonId?.includes('ENGRAVING')
  );
  if (engravingAddon) {
    notes.push('⚠️ GRAVUR erforderlich');
  }
  
  // Assembly complexity
  if (payload.bom?.assembly?.complexity === 'custom') {
    notes.push('⚠️ Individuelle Montage erforderlich');
  }
  
  return notes;
}

/**
 * Export multiple designs from order
 * 
 * @param {Object} order - Complete order object
 * @returns {Object[]} Array of fulfillment exports
 */
export function exportOrderForFulfillment(order) {
  const exports = [];
  
  for (const lineItem of order.lineItems || []) {
    if (lineItem.type === 'CONFIGURATOR_DESIGN') {
      exports.push(exportDesignForFulfillment(lineItem, order));
    }
  }
  
  return exports;
}

/**
 * Format fulfillment export as JSON for download
 * 
 * @param {Object} fulfillmentExport
 * @returns {string} JSON string
 */
export function formatFulfillmentJSON(fulfillmentExport) {
  return JSON.stringify(fulfillmentExport, null, 2);
}

/**
 * Format fulfillment export as CSV for production systems
 * 
 * @param {Object[]} fulfillmentExports
 * @returns {string} CSV string
 */
export function formatFulfillmentCSV(fulfillmentExports) {
  const headers = [
    'Order ID',
    'Order Number',
    'Design ID',
    'Product Family',
    'SKU',
    'Qty',
    'Customization',
    'Addons',
    'Production Notes'
  ];
  
  const rows = fulfillmentExports.map(exp => {
    const baseSKUs = exp.baseComponents.map(c => `${c.sku} (${c.qty}x)`).join('; ');
    const addons = exp.premiumAddons.map(a => a.label).join('; ');
    
    return [
      exp.orderId,
      exp.orderNumber,
      exp.designId,
      exp.productFamily,
      baseSKUs,
      exp.baseComponents.reduce((sum, c) => sum + c.qty, 0),
      exp.customization ? 'Ja' : 'Nein',
      addons || '-',
      exp.productionNotes.join(' | ')
    ];
  });
  
  const csvLines = [
    headers.join(','),
    ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
  ];
  
  return csvLines.join('\n');
}

/**
 * Generate pick list for warehouse
 * 
 * @param {Object[]} fulfillmentExports
 * @returns {Object} Pick list grouped by SKU
 */
export function generatePickList(fulfillmentExports) {
  const pickList = {};
  
  for (const exp of fulfillmentExports) {
    for (const component of exp.baseComponents) {
      const { sku, qty } = component;
      
      if (!pickList[sku]) {
        pickList[sku] = {
          sku,
          totalQty: 0,
          orders: []
        };
      }
      
      pickList[sku].totalQty += qty;
      pickList[sku].orders.push({
        orderId: exp.orderId,
        orderNumber: exp.orderNumber,
        designId: exp.designId,
        qty
      });
    }
  }
  
  return Object.values(pickList).sort((a, b) => b.totalQty - a.totalQty);
}

/**
 * Validate fulfillment export completeness
 * 
 * @param {Object} fulfillmentExport
 * @returns {{ valid: boolean, warnings: string[] }}
 */
export function validateFulfillmentExport(fulfillmentExport) {
  const warnings = [];
  
  // Check base components
  if (!fulfillmentExport.baseComponents || fulfillmentExport.baseComponents.length === 0) {
    warnings.push('No base components');
  }
  
  // Check previews
  if (!fulfillmentExport.previews?.heroUrl) {
    warnings.push('Missing hero preview');
  }
  
  // Check BOM for customized items
  if (fulfillmentExport.customization?.enabled && !fulfillmentExport.bom) {
    warnings.push('Customized design missing BOM');
  }
  
  // Check scene state for color/material
  if (fulfillmentExport.premiumAddons?.some(a => a.addonId?.includes('COLOR'))) {
    if (!fulfillmentExport.sceneState?.colors) {
      warnings.push('Color addon without scene state colors');
    }
  }
  
  return {
    valid: warnings.length === 0,
    warnings
  };
}
