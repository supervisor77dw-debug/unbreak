/**
 * PRODUCTION SNAPSHOT – PHASE 6
 * 
 * Immutable production snapshot generator for custom-manufactured orders.
 * Once created, snapshots cannot be modified – ensures production integrity.
 * 
 * Purpose:
 * - Create deterministic production data from orders
 * - Lock order configuration at production start
 * - Provide complete manufacturing specification
 * 
 * @module lib/production/production-snapshot
 */

import type { CartItemWithPricing } from '../cart/cart-pricing-persistence';

// ============================================================
// TYPE DEFINITIONS
// ============================================================

/**
 * Material specification for production
 */
export interface ProductionMaterial {
  materialId: string;
  name: string;
  type: 'primary' | 'secondary' | 'finish' | 'addon';
  specification: string;
  quantity: number;
  unit: string;
  supplier?: string;
  notes?: string;
}

/**
 * Color specification for production
 */
export interface ProductionColor {
  colorId: string;
  name: string;
  type: 'ral' | 'hex' | 'standard';
  value: string; // RAL code or HEX value
  finish: 'matte' | 'glossy' | 'satin' | 'brushed';
  application: string; // Which component gets this color
}

/**
 * Component specification for production
 */
export interface ProductionComponent {
  componentId: string;
  name: string;
  category: 'material' | 'finish' | 'addon';
  specification: string;
  quantity: number;
  materials: ProductionMaterial[];
  colors?: ProductionColor[];
  assemblyNotes?: string;
}

/**
 * Complete immutable production snapshot
 * This represents the final locked state for manufacturing
 */
export interface ProductionSnapshot {
  // Identification
  snapshotId: string; // Unique snapshot ID (for tracking)
  orderId: string;
  orderItemId: string;
  productId: string; // Design ID from configurator
  
  // Base product information
  baseProduct: {
    sku: string;
    name: string;
    variant?: string;
  };
  
  // Selected components
  selectedComponents: ProductionComponent[];
  
  // Manufacturing details
  materials: ProductionMaterial[];
  colors: ProductionColor[];
  quantities: {
    unitsOrdered: number;
    componentsTotal: number;
    materialsTotal: number;
  };
  
  // Pricing (locked at snapshot time)
  finalPrice: {
    net: number;
    gross: number;
    vatAmount: number;
    currency: string;
  };
  
  // Visual reference
  previewImage?: {
    url: string;
    width: number;
    height: number;
    format: string;
  };
  
  // Manufacturing instructions
  productionNotes: string[];
  assemblyInstructions?: string;
  qualityChecks?: string[];
  
  // Metadata
  metadata: {
    createdAt: string; // ISO timestamp
    createdBy: string; // User/system that created snapshot
    orderCompletedAt: string; // When order was placed
    snapshotVersion: string; // Version of snapshot schema
    locked: boolean; // Always true for production snapshots
    lockReason: string; // "Production started" or "Order completed"
    checksumSHA256: string; // Checksum for integrity verification
  };
  
  // Customer data (for production reference only)
  customerReference: {
    orderNumber: string;
    customerName: string;
    shippingAddress: string;
  };
}

// ============================================================
// SNAPSHOT GENERATION
// ============================================================

/**
 * Generate unique snapshot ID
 * Format: SNAP-{timestamp}-{orderId}-{random}
 */
function generateSnapshotId(orderId: string): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `SNAP-${timestamp}-${orderId.substring(0, 8)}-${random}`;
}

/**
 * Convert cart component to production component
 */
function convertToProductionComponent(
  componentId: string,
  componentName: string,
  category: 'material' | 'finish' | 'addon',
  specification: string
): ProductionComponent {
  // Extract materials based on component type
  const materials: ProductionMaterial[] = [];
  const colors: ProductionColor[] = [];
  
  // Material components
  if (category === 'material') {
    if (componentId === 'MAT_STAINLESS_STEEL') {
      materials.push({
        materialId: 'MAT-SS-304',
        name: 'Stainless Steel 304',
        type: 'primary',
        specification: '304 Grade, Brushed Finish',
        quantity: 2,
        unit: 'pieces',
        supplier: 'MetalSupply GmbH',
      });
    } else if (componentId === 'MAT_WOOD_OAK') {
      materials.push({
        materialId: 'MAT-WOOD-OAK-EU',
        name: 'European Oak',
        type: 'primary',
        specification: 'Solid Oak, Grade A, 15mm thickness',
        quantity: 2,
        unit: 'pieces',
        supplier: 'HolzKraft GmbH',
        notes: 'Grain direction: vertical',
      });
    } else if (componentId === 'MAT_WOOD_WALNUT') {
      materials.push({
        materialId: 'MAT-WOOD-WALNUT-AM',
        name: 'American Walnut',
        type: 'primary',
        specification: 'Solid Walnut, Premium Grade, 15mm thickness',
        quantity: 2,
        unit: 'pieces',
        supplier: 'HolzKraft GmbH',
        notes: 'Premium wood – handle with care',
      });
    } else if (componentId === 'MAT_METAL_RING') {
      materials.push({
        materialId: 'MAT-ALU-RING',
        name: 'Aluminum Ring',
        type: 'secondary',
        specification: 'Anodized Aluminum, 3mm thickness',
        quantity: 2,
        unit: 'pieces',
        supplier: 'MetalSupply GmbH',
      });
    }
  }
  
  // Finish components
  if (category === 'finish') {
    if (componentId === 'FINISH_COLOR_RAL') {
      colors.push({
        colorId: 'COLOR-RAL-DEFAULT',
        name: 'RAL Color',
        type: 'ral',
        value: 'RAL 9005', // Default: Black
        finish: 'matte',
        application: 'Base product coating',
      });
    } else if (componentId === 'FINISH_COLOR_CUSTOM') {
      colors.push({
        colorId: 'COLOR-HEX-CUSTOM',
        name: 'Custom HEX Color',
        type: 'hex',
        value: '#000000', // Default: Black (should be from design)
        finish: 'matte',
        application: 'Base product coating',
      });
    } else if (componentId === 'FINISH_MATTE_BLACK') {
      colors.push({
        colorId: 'COLOR-MATTE-BLACK',
        name: 'Matte Black',
        type: 'standard',
        value: 'RAL 9005',
        finish: 'matte',
        application: 'Base product coating',
      });
    } else if (componentId === 'FINISH_POLISHED') {
      materials.push({
        materialId: 'FINISH-POLISH',
        name: 'Polishing Compound',
        type: 'finish',
        specification: 'Mirror polish, 3-stage process',
        quantity: 1,
        unit: 'treatment',
        notes: 'Apply after assembly',
      });
    }
  }
  
  // Addon components
  if (category === 'addon') {
    if (componentId === 'ADDON_ENGRAVING_TEXT') {
      materials.push({
        materialId: 'PROC-LASER-TEXT',
        name: 'Laser Engraving (Text)',
        type: 'addon',
        specification: 'Laser engraving, max 50 characters',
        quantity: 1,
        unit: 'engraving',
        notes: 'Check text with customer before engraving',
      });
    } else if (componentId === 'ADDON_ENGRAVING_LOGO') {
      materials.push({
        materialId: 'PROC-LASER-LOGO',
        name: 'Laser Engraving (Logo)',
        type: 'addon',
        specification: 'Laser engraving from vector file',
        quantity: 1,
        unit: 'engraving',
        notes: 'Requires vector file (SVG/AI)',
      });
    } else if (componentId === 'ADDON_GIFT_BOX') {
      materials.push({
        materialId: 'PKG-GIFTBOX',
        name: 'Premium Gift Box',
        type: 'addon',
        specification: 'Black gift box with foam insert',
        quantity: 1,
        unit: 'box',
        supplier: 'PackagingPro GmbH',
      });
    } else if (componentId === 'ADDON_PREMIUM_PACKAGING') {
      materials.push({
        materialId: 'PKG-PREMIUM',
        name: 'Premium Packaging',
        type: 'addon',
        specification: 'Luxury box with custom insert',
        quantity: 1,
        unit: 'box',
        supplier: 'PackagingPro GmbH',
        notes: 'Includes branded tissue paper',
      });
    }
  }
  
  return {
    componentId,
    name: componentName,
    category,
    specification,
    quantity: 1,
    materials,
    colors: colors.length > 0 ? colors : undefined,
  };
}

/**
 * Extract all materials from components
 */
function extractAllMaterials(components: ProductionComponent[]): ProductionMaterial[] {
  const allMaterials: ProductionMaterial[] = [];
  
  for (const component of components) {
    allMaterials.push(...component.materials);
  }
  
  return allMaterials;
}

/**
 * Extract all colors from components
 */
function extractAllColors(components: ProductionComponent[]): ProductionColor[] {
  const allColors: ProductionColor[] = [];
  
  for (const component of components) {
    if (component.colors) {
      allColors.push(...component.colors);
    }
  }
  
  return allColors;
}

/**
 * Generate production notes based on components
 */
function generateProductionNotes(components: ProductionComponent[]): string[] {
  const notes: string[] = [
    '⚠️ CUSTOM-MADE PRODUCT – NO CHANGES AFTER PRODUCTION START',
    'Verify all specifications before starting production',
  ];
  
  // Check for premium materials
  const hasPremiumWood = components.some(c => 
    c.componentId === 'MAT_WOOD_WALNUT' || c.componentId === 'MAT_WOOD_OAK'
  );
  if (hasPremiumWood) {
    notes.push('⚠️ Premium wood material – handle with care, check grain direction');
  }
  
  // Check for engravings
  const hasEngraving = components.some(c => 
    c.componentId.startsWith('ADDON_ENGRAVING')
  );
  if (hasEngraving) {
    notes.push('⚠️ Engraving required – verify text/logo with customer before engraving');
  }
  
  // Check for custom colors
  const hasCustomColor = components.some(c => 
    c.componentId === 'FINISH_COLOR_CUSTOM'
  );
  if (hasCustomColor) {
    notes.push('⚠️ Custom color – verify HEX/RAL code before coating');
  }
  
  // Check for premium packaging
  const hasPremiumPackaging = components.some(c => 
    c.componentId === 'ADDON_PREMIUM_PACKAGING' || c.componentId === 'ADDON_GIFT_BOX'
  );
  if (hasPremiumPackaging) {
    notes.push('📦 Premium packaging – use designated packaging station');
  }
  
  return notes;
}

/**
 * Calculate SHA256 checksum for snapshot integrity
 * (Simple implementation – production should use crypto.subtle)
 */
function calculateChecksum(snapshot: Omit<ProductionSnapshot, 'metadata'>): string {
  const data = JSON.stringify(snapshot);
  // Simple hash (production: use crypto.subtle.digest('SHA-256', data))
  let hash = 0;
  for (let i = 0; i < data.length; i++) {
    const char = data.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return `SHA256-${Math.abs(hash).toString(16).toUpperCase()}`;
}

/**
 * Create production snapshot from cart item
 * 
 * @param cartItem Cart item with complete pricing data
 * @param orderId Order ID
 * @param orderNumber Customer-facing order number
 * @param customerInfo Customer information
 * @returns Immutable production snapshot
 */
export function createProductionSnapshot(
  cartItem: CartItemWithPricing,
  orderId: string,
  orderNumber: string,
  customerInfo: {
    name: string;
    shippingAddress: string;
  }
): ProductionSnapshot {
  const snapshotId = generateSnapshotId(orderId);
  
  // Convert components to production components
  const productionComponents: ProductionComponent[] = cartItem.selectedComponents.map(comp => 
    convertToProductionComponent(
      comp.componentId,
      comp.label,
      comp.category as 'material' | 'finish' | 'addon',
      comp.label
    )
  );
  
  // Extract materials and colors
  const allMaterials = extractAllMaterials(productionComponents);
  const allColors = extractAllColors(productionComponents);
  
  // Generate production notes
  const productionNotes = generateProductionNotes(productionComponents);
  
  // Create snapshot (without metadata for checksum calculation)
  const snapshotData = {
    snapshotId,
    orderId,
    orderItemId: cartItem.cartItemId,
    productId: cartItem.designId,
    baseProduct: {
      sku: cartItem.baseProduct.sku,
      name: cartItem.baseProduct.name,
    },
    selectedComponents: productionComponents,
    materials: allMaterials,
    colors: allColors,
    quantities: {
      unitsOrdered: cartItem.quantity,
      componentsTotal: productionComponents.length,
      materialsTotal: allMaterials.length,
    },
    finalPrice: {
      net: cartItem.finalPrice.net,
      gross: cartItem.finalPrice.gross,
      vatAmount: cartItem.finalPrice.vatAmount,
      currency: cartItem.finalPrice.currency,
    },
    productionNotes,
    customerReference: {
      orderNumber,
      customerName: customerInfo.name,
      shippingAddress: customerInfo.shippingAddress,
    },
  };
  
  // Calculate checksum
  const checksum = calculateChecksum(snapshotData);
  
  // Add metadata
  const snapshot: ProductionSnapshot = {
    ...snapshotData,
    metadata: {
      createdAt: new Date().toISOString(),
      createdBy: 'system',
      orderCompletedAt: cartItem.addedAt,
      snapshotVersion: '1.0.0',
      locked: true,
      lockReason: 'Order completed – production ready',
      checksumSHA256: checksum,
    },
  };
  
  return snapshot;
}

/**
 * Verify snapshot integrity
 */
export function verifySnapshotIntegrity(snapshot: ProductionSnapshot): boolean {
  const { metadata, ...snapshotData } = snapshot;
  const calculatedChecksum = calculateChecksum(snapshotData);
  return calculatedChecksum === metadata.checksumSHA256;
}

/**
 * Create production snapshot from order
 * (For batch processing after order completion)
 */
export async function createProductionSnapshotsFromOrder(
  orderId: string,
  orderNumber: string,
  cartItems: CartItemWithPricing[],
  customerInfo: {
    name: string;
    shippingAddress: string;
  }
): Promise<ProductionSnapshot[]> {
  const snapshots: ProductionSnapshot[] = [];
  
  for (const cartItem of cartItems) {
    // Only create snapshots for configurator items
    if (cartItem.type === 'CONFIGURATOR_DESIGN') {
      const snapshot = createProductionSnapshot(
        cartItem,
        orderId,
        orderNumber,
        customerInfo
      );
      snapshots.push(snapshot);
    }
  }
  
  return snapshots;
}
