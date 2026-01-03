/**
 * Component Catalog with Pricing (Phase 5)
 * 
 * Defines all available configurator components with pricing deltas
 * Each component has: ID, label, category, price delta, premium flag
 * 
 * @version 1.0.0
 * @date 2026-01-03
 */

import type { SelectedComponent } from './pricing-calculator';

/**
 * Component Definition
 */
export interface ComponentDefinition extends SelectedComponent {
  /**
   * Component description (for tooltip)
   */
  description?: string;

  /**
   * Upsell text (for premium components)
   */
  upsellText?: string;

  /**
   * Available for base products (SKU filter)
   */
  availableFor?: string[];

  /**
   * Requires other components
   */
  requires?: string[];

  /**
   * Conflicts with other components
   */
  conflictsWith?: string[];

  /**
   * Visual preview image URL
   */
  previewUrl?: string;

  /**
   * Sort order
   */
  sortOrder?: number;
}

/**
 * Component Catalog
 * Centralized component definitions with pricing
 */
export const COMPONENT_CATALOG: Record<string, ComponentDefinition> = {
  // ──────────────────────────────────────────
  // MATERIALS
  // ──────────────────────────────────────────
  
  'MAT_STAINLESS_STEEL': {
    componentId: 'MAT_STAINLESS_STEEL',
    label: 'Edelstahl (Standard)',
    category: 'material',
    priceDelta: 0, // Included in base price
    isPremium: false,
    description: 'Gebürsteter Edelstahl, rostfrei',
    sortOrder: 1
  },

  'MAT_WOOD_OAK': {
    componentId: 'MAT_WOOD_OAK',
    label: 'Eiche massiv',
    category: 'material',
    priceDelta: 24.00, // From Phase 3: ADDON_WOOD_INLAY
    isPremium: true,
    description: 'Massivholz-Sockel aus deutscher Eiche',
    upsellText: 'Beliebte Premium-Option',
    sortOrder: 2
  },

  'MAT_WOOD_WALNUT': {
    componentId: 'MAT_WOOD_WALNUT',
    label: 'Nussbaum massiv',
    category: 'material',
    priceDelta: 32.00,
    isPremium: true,
    description: 'Edles Nussbaumholz mit charakteristischer Maserung',
    upsellText: 'Exklusives Material',
    sortOrder: 3
  },

  'MAT_METAL_RING': {
    componentId: 'MAT_METAL_RING',
    label: 'Metallring (Messing)',
    category: 'material',
    priceDelta: 18.00, // From Phase 3: ADDON_METAL_RING
    isPremium: true,
    description: 'Hochwertiger Messingring als Akzent',
    upsellText: 'Premium-Veredelung',
    sortOrder: 4
  },

  // ──────────────────────────────────────────
  // FINISHES / COATINGS
  // ──────────────────────────────────────────

  'FINISH_BRUSHED': {
    componentId: 'FINISH_BRUSHED',
    label: 'Gebürstet (Standard)',
    category: 'finish',
    priceDelta: 0, // Included
    isPremium: false,
    description: 'Gebürstete Oberfläche',
    sortOrder: 10
  },

  'FINISH_POLISHED': {
    componentId: 'FINISH_POLISHED',
    label: 'Hochglanzpoliert',
    category: 'finish',
    priceDelta: 14.00,
    isPremium: true,
    description: 'Spiegelglänzende Politur',
    upsellText: 'Premium-Finish',
    sortOrder: 11
  },

  'FINISH_COLOR_RAL': {
    componentId: 'FINISH_COLOR_RAL',
    label: 'RAL-Farbe',
    category: 'finish',
    priceDelta: 29.00, // From Phase 3: ADDON_CUSTOM_COLOR_RAL
    isPremium: true,
    description: 'Pulverbeschichtung in Wunsch-RAL-Farbe',
    upsellText: 'Farbliche Individualisierung',
    sortOrder: 12
  },

  'FINISH_COLOR_CUSTOM': {
    componentId: 'FINISH_COLOR_CUSTOM',
    label: 'Individuelle Farbe (HEX)',
    category: 'finish',
    priceDelta: 39.00, // From Phase 3: ADDON_CUSTOM_COLOR_HEX
    isPremium: true,
    description: 'Exakte Farbanpassung nach HEX-Code',
    upsellText: 'Perfektes Farbmatching',
    sortOrder: 13
  },

  'FINISH_MATTE_BLACK': {
    componentId: 'FINISH_MATTE_BLACK',
    label: 'Matt-Schwarz',
    category: 'finish',
    priceDelta: 19.00,
    isPremium: true,
    description: 'Edle matte schwarze Beschichtung',
    upsellText: 'Zeitlos elegant',
    sortOrder: 14
  },

  // ──────────────────────────────────────────
  // ADDONS
  // ──────────────────────────────────────────

  'ADDON_ENGRAVING_TEXT': {
    componentId: 'ADDON_ENGRAVING_TEXT',
    label: 'Textgravur',
    category: 'addon',
    priceDelta: 14.00, // From Phase 3: ADDON_ENGRAVING_TEXT
    isPremium: true,
    description: 'Persönliche Gravur mit individuellem Text (max. 50 Zeichen)',
    upsellText: 'Persönliche Note',
    sortOrder: 20
  },

  'ADDON_ENGRAVING_LOGO': {
    componentId: 'ADDON_ENGRAVING_LOGO',
    label: 'Logo-Gravur',
    category: 'addon',
    priceDelta: 32.00, // From Phase 3: ADDON_ENGRAVING_LOGO
    isPremium: true,
    description: 'Gravur Ihres Firmenlogos oder Wappens',
    upsellText: 'Corporate Branding',
    sortOrder: 21
  },

  'ADDON_GIFT_BOX': {
    componentId: 'ADDON_GIFT_BOX',
    label: 'Geschenkbox',
    category: 'addon',
    priceDelta: 12.00, // From Phase 3: ADDON_GIFT_BOX
    isPremium: false,
    description: 'Hochwertige Geschenkverpackung',
    sortOrder: 22
  },

  'ADDON_PREMIUM_PACKAGING': {
    componentId: 'ADDON_PREMIUM_PACKAGING',
    label: 'Premium-Verpackung',
    category: 'addon',
    priceDelta: 19.00, // From Phase 3: ADDON_PREMIUM_PACKAGING
    isPremium: true,
    description: 'Edle Holzbox mit Samteinlage',
    upsellText: 'Luxuriöse Präsentation',
    sortOrder: 23,
    conflictsWith: ['ADDON_GIFT_BOX'] // Cannot combine with standard gift box
  },

  'ADDON_ANTI_SLIP_PADS': {
    componentId: 'ADDON_ANTI_SLIP_PADS',
    label: 'Rutschfeste Pads',
    category: 'addon',
    priceDelta: 0, // Free add-on
    isPremium: false,
    description: 'Gummi-Pads für sicheren Stand',
    sortOrder: 24
  },

  'ADDON_MOUNTING_KIT': {
    componentId: 'ADDON_MOUNTING_KIT',
    label: 'Montageset',
    category: 'addon',
    priceDelta: 8.00,
    isPremium: false,
    description: 'Schrauben und Dübel für Wandmontage',
    sortOrder: 25
  }
};

/**
 * Get Components by Category
 */
export function getComponentsByCategory(category: 'material' | 'finish' | 'addon'): ComponentDefinition[] {
  return Object.values(COMPONENT_CATALOG)
    .filter(c => c.category === category)
    .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
}

/**
 * Get Premium Components
 */
export function getPremiumComponents(): ComponentDefinition[] {
  return Object.values(COMPONENT_CATALOG)
    .filter(c => c.isPremium)
    .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
}

/**
 * Get Component by ID
 */
export function getComponent(componentId: string): ComponentDefinition | undefined {
  return COMPONENT_CATALOG[componentId];
}

/**
 * Validate Component Selection
 * Checks conflicts and requirements
 */
export function validateComponentSelection(
  selectedComponents: SelectedComponent[]
): {
  valid: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];
  const selectedIds = selectedComponents.map(c => c.componentId);

  for (const component of selectedComponents) {
    const definition = getComponent(component.componentId);
    
    if (!definition) {
      errors.push(`Unknown component: ${component.componentId}`);
      continue;
    }

    // Check conflicts
    if (definition.conflictsWith) {
      const conflicts = definition.conflictsWith.filter(id => selectedIds.includes(id));
      if (conflicts.length > 0) {
        const conflictNames = conflicts
          .map(id => getComponent(id)?.label || id)
          .join(', ');
        errors.push(
          `${definition.label} kann nicht mit ${conflictNames} kombiniert werden`
        );
      }
    }

    // Check requirements
    if (definition.requires) {
      const missing = definition.requires.filter(id => !selectedIds.includes(id));
      if (missing.length > 0) {
        const missingNames = missing
          .map(id => getComponent(id)?.label || id)
          .join(', ');
        errors.push(
          `${definition.label} benötigt: ${missingNames}`
        );
      }
    }
  }

  // Warn if no premium components selected (upsell opportunity)
  const hasPremium = selectedComponents.some(c => c.isPremium);
  if (!hasPremium) {
    warnings.push('Keine Premium-Komponenten ausgewählt');
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Get Recommended Upsells
 * Suggests premium components based on current selection
 */
export function getRecommendedUpsells(
  selectedComponents: SelectedComponent[]
): ComponentDefinition[] {
  const selectedIds = new Set(selectedComponents.map(c => c.componentId));
  const recommendations: ComponentDefinition[] = [];

  // Material upsells
  if (!selectedIds.has('MAT_WOOD_OAK') && !selectedIds.has('MAT_WOOD_WALNUT')) {
    const oak = getComponent('MAT_WOOD_OAK');
    if (oak) recommendations.push(oak);
  }

  // Finish upsells
  if (selectedIds.has('FINISH_BRUSHED')) {
    const polished = getComponent('FINISH_POLISHED');
    if (polished) recommendations.push(polished);
  }

  // Engraving upsells (if no engraving selected)
  if (!selectedIds.has('ADDON_ENGRAVING_TEXT') && !selectedIds.has('ADDON_ENGRAVING_LOGO')) {
    const textEngraving = getComponent('ADDON_ENGRAVING_TEXT');
    if (textEngraving) recommendations.push(textEngraving);
  }

  // Packaging upsells
  if (!selectedIds.has('ADDON_GIFT_BOX') && !selectedIds.has('ADDON_PREMIUM_PACKAGING')) {
    const premiumPackaging = getComponent('ADDON_PREMIUM_PACKAGING');
    if (premiumPackaging) recommendations.push(premiumPackaging);
  }

  return recommendations.slice(0, 3); // Max 3 recommendations
}

/**
 * Component Statistics
 */
export function getComponentStats() {
  const all = Object.values(COMPONENT_CATALOG);
  
  return {
    total: all.length,
    premium: all.filter(c => c.isPremium).length,
    free: all.filter(c => c.priceDelta === 0).length,
    categories: {
      material: all.filter(c => c.category === 'material').length,
      finish: all.filter(c => c.category === 'finish').length,
      addon: all.filter(c => c.category === 'addon').length
    },
    priceRange: {
      min: Math.min(...all.map(c => c.priceDelta)),
      max: Math.max(...all.map(c => c.priceDelta)),
      avg: all.reduce((sum, c) => sum + c.priceDelta, 0) / all.length
    }
  };
}

/**
 * Example Usage:
 * 
 * ```ts
 * // Get all materials
 * const materials = getComponentsByCategory('material');
 * 
 * // Select component
 * const selectedComponents: SelectedComponent[] = [
 *   {
 *     componentId: 'MAT_WOOD_OAK',
 *     label: 'Eiche massiv',
 *     category: 'material',
 *     priceDelta: 24.00,
 *     isPremium: true
 *   }
 * ];
 * 
 * // Validate selection
 * const validation = validateComponentSelection(selectedComponents);
 * if (!validation.valid) {
 *   console.error(validation.errors);
 * }
 * 
 * // Get recommendations
 * const upsells = getRecommendedUpsells(selectedComponents);
 * ```
 */
