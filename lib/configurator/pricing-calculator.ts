/**
 * Configurator Pricing Calculator (Phase 5)
 * 
 * Live price calculation for configurator with component pricing
 * Formula: totalPrice = baseProductPrice + customizationFee + sum(componentUpcharges)
 * 
 * @version 1.0.0
 * @date 2026-01-03
 */

/**
 * Price Calculation Input
 */
export interface PriceCalculationInput {
  /**
   * Base product SKU (from shop catalog)
   */
  baseProductSku: string;

  /**
   * Selected components with pricing
   */
  selectedComponents: SelectedComponent[];

  /**
   * Force customization fee (optional, defaults to true for configurator)
   */
  forceCustomizationFee?: boolean;
}

/**
 * Selected Component
 */
export interface SelectedComponent {
  componentId: string;
  label: string;
  category: 'material' | 'finish' | 'addon';
  priceDelta: number; // Net price delta (can be 0)
  isPremium: boolean;
  quantity?: number; // Default: 1
}

/**
 * Price Calculation Result
 */
export interface PriceCalculationResult {
  /**
   * Base product price (net)
   */
  baseProductPrice: number;

  /**
   * Customization fee (net)
   */
  customizationFee: number;

  /**
   * Sum of all component price deltas (net)
   */
  componentPriceSum: number;

  /**
   * Final price (net) = base + customization + components
   */
  finalPriceNet: number;

  /**
   * Final price (gross, with VAT)
   */
  finalPriceGross: number;

  /**
   * VAT amount
   */
  vatAmount: number;

  /**
   * Currency
   */
  currency: string;

  /**
   * Detailed breakdown for UI display
   */
  breakdown: PriceBreakdownLine[];

  /**
   * Premium components (for upsell display)
   */
  premiumComponents: SelectedComponent[];

  /**
   * Calculation metadata
   */
  metadata: {
    calculatedAt: string;
    pricebookVersion: string;
    baseProductSku: string;
    componentCount: number;
    premiumCount: number;
  };
}

/**
 * Price Breakdown Line (for UI display)
 */
export interface PriceBreakdownLine {
  type: 'base' | 'customization' | 'component';
  label: string;
  subtitle?: string;
  priceNet: number;
  quantity?: number;
  isPremium?: boolean;
}

/**
 * Base Product Pricing
 * In production, fetch from shop catalog API
 */
const BASE_PRODUCT_PRICES: Record<string, number> = {
  'UNBREAK-GLAS-SET-2': 89.00,
  'UNBREAK-GLAS-SET-4': 149.00,
  'UNBREAK-GLAS-SINGLE': 49.00
};

/**
 * Customization Fee (from Phase 3)
 */
const CUSTOMIZATION_FEE_NET = 19.00;

/**
 * VAT Rate (German standard)
 */
const VAT_RATE = 0.19;

/**
 * Currency
 */
const CURRENCY = 'EUR';

/**
 * Pricebook Version
 */
const PRICEBOOK_VERSION = 'v1.2026-01-03';

/**
 * Calculate Total Price
 * Main pricing calculation function
 */
export function calculatePrice(input: PriceCalculationInput): PriceCalculationResult {
  // 1. Get base product price
  const baseProductPrice = getBaseProductPrice(input.baseProductSku);

  // 2. Get customization fee (always applied for configurator)
  const customizationFee = input.forceCustomizationFee !== false 
    ? CUSTOMIZATION_FEE_NET 
    : 0;

  // 3. Calculate component price sum
  const componentPriceSum = calculateComponentSum(input.selectedComponents);

  // 4. Calculate final price (net)
  const finalPriceNet = baseProductPrice + customizationFee + componentPriceSum;

  // 5. Calculate VAT and gross price
  const vatAmount = finalPriceNet * VAT_RATE;
  const finalPriceGross = finalPriceNet + vatAmount;

  // 6. Build breakdown
  const breakdown = buildPriceBreakdown(
    baseProductPrice,
    input.baseProductSku,
    customizationFee,
    input.selectedComponents
  );

  // 7. Extract premium components
  const premiumComponents = input.selectedComponents.filter(c => c.isPremium);

  return {
    baseProductPrice,
    customizationFee,
    componentPriceSum,
    finalPriceNet,
    finalPriceGross,
    vatAmount,
    currency: CURRENCY,
    breakdown,
    premiumComponents,
    metadata: {
      calculatedAt: new Date().toISOString(),
      pricebookVersion: PRICEBOOK_VERSION,
      baseProductSku: input.baseProductSku,
      componentCount: input.selectedComponents.length,
      premiumCount: premiumComponents.length
    }
  };
}

/**
 * Get Base Product Price
 * In production: fetch from shop catalog API
 */
function getBaseProductPrice(sku: string): number {
  const price = BASE_PRODUCT_PRICES[sku];
  
  if (price === undefined) {
    throw new Error(`Unknown base product SKU: ${sku}`);
  }

  return price;
}

/**
 * Calculate Component Price Sum
 */
function calculateComponentSum(components: SelectedComponent[]): number {
  return components.reduce((sum, component) => {
    const qty = component.quantity || 1;
    return sum + (component.priceDelta * qty);
  }, 0);
}

/**
 * Build Price Breakdown for UI Display
 */
function buildPriceBreakdown(
  baseProductPrice: number,
  baseProductSku: string,
  customizationFee: number,
  components: SelectedComponent[]
): PriceBreakdownLine[] {
  const breakdown: PriceBreakdownLine[] = [];

  // 1. Base product
  breakdown.push({
    type: 'base',
    label: 'Basisprodukt',
    subtitle: getProductName(baseProductSku),
    priceNet: baseProductPrice,
    quantity: 1
  });

  // 2. Customization fee
  if (customizationFee > 0) {
    breakdown.push({
      type: 'customization',
      label: 'Individualisierung',
      subtitle: 'Individuelle Fertigung nach Ihren Vorgaben',
      priceNet: customizationFee,
      quantity: 1
    });
  }

  // 3. Components (only those with price delta > 0)
  components
    .filter(c => c.priceDelta > 0)
    .forEach(component => {
      breakdown.push({
        type: 'component',
        label: component.label,
        subtitle: getCategoryLabel(component.category),
        priceNet: component.priceDelta,
        quantity: component.quantity || 1,
        isPremium: component.isPremium
      });
    });

  return breakdown;
}

/**
 * Get Product Name from SKU
 * In production: fetch from catalog
 */
function getProductName(sku: string): string {
  const names: Record<string, string> = {
    'UNBREAK-GLAS-SET-2': 'Glashalter 2er Set',
    'UNBREAK-GLAS-SET-4': 'Glashalter 4er Set',
    'UNBREAK-GLAS-SINGLE': 'Glashalter Einzeln'
  };
  return names[sku] || sku;
}

/**
 * Get Category Label (German)
 */
function getCategoryLabel(category: string): string {
  const labels: Record<string, string> = {
    material: 'Material-Upgrade',
    finish: 'Oberflächen-Veredelung',
    addon: 'Zusatzkomponente'
  };
  return labels[category] || category;
}

/**
 * Format Price (German Locale)
 */
export function formatPrice(amount: number, currency: string = CURRENCY): string {
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: currency
  }).format(amount);
}

/**
 * Format Price Delta (with +/- prefix)
 */
export function formatPriceDelta(delta: number, currency: string = CURRENCY): string {
  const formatted = formatPrice(Math.abs(delta), currency);
  return delta >= 0 ? `+${formatted}` : `-${formatted}`;
}

/**
 * Validate Price Calculation
 * Ensures UI and backend prices match
 */
export function validatePriceCalculation(
  clientResult: PriceCalculationResult,
  serverResult: PriceCalculationResult
): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  // 1. Check final price (net)
  if (Math.abs(clientResult.finalPriceNet - serverResult.finalPriceNet) > 0.01) {
    errors.push(
      `Price mismatch: client=${clientResult.finalPriceNet}, server=${serverResult.finalPriceNet}`
    );
  }

  // 2. Check base product price
  if (clientResult.baseProductPrice !== serverResult.baseProductPrice) {
    errors.push(
      `Base product price mismatch: client=${clientResult.baseProductPrice}, server=${serverResult.baseProductPrice}`
    );
  }

  // 3. Check customization fee
  if (clientResult.customizationFee !== serverResult.customizationFee) {
    errors.push(
      `Customization fee mismatch: client=${clientResult.customizationFee}, server=${serverResult.customizationFee}`
    );
  }

  // 4. Check component sum
  if (Math.abs(clientResult.componentPriceSum - serverResult.componentPriceSum) > 0.01) {
    errors.push(
      `Component sum mismatch: client=${clientResult.componentPriceSum}, server=${serverResult.componentPriceSum}`
    );
  }

  // 5. Check pricebook version
  if (clientResult.metadata.pricebookVersion !== serverResult.metadata.pricebookVersion) {
    errors.push(
      `Pricebook version mismatch: client=${clientResult.metadata.pricebookVersion}, server=${serverResult.metadata.pricebookVersion}`
    );
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * React Hook for Live Price Calculation
 * Updates price whenever configuration changes
 */
export function usePriceCalculation(
  baseProductSku: string,
  selectedComponents: SelectedComponent[]
) {
  const [priceResult, setPriceResult] = React.useState<PriceCalculationResult | null>(null);
  const [isCalculating, setIsCalculating] = React.useState(false);

  React.useEffect(() => {
    setIsCalculating(true);

    try {
      const result = calculatePrice({
        baseProductSku,
        selectedComponents
      });

      setPriceResult(result);
    } catch (error) {
      console.error('Price calculation failed:', error);
      setPriceResult(null);
    } finally {
      setIsCalculating(false);
    }
  }, [baseProductSku, selectedComponents]);

  return {
    priceResult,
    isCalculating,
    formatPrice,
    formatPriceDelta
  };
}

/**
 * Vanilla JS Price Calculator (for non-React configurator)
 */
export class PriceCalculator {
  private baseProductSku: string;
  private selectedComponents: SelectedComponent[];
  private listeners: Array<(result: PriceCalculationResult) => void> = [];

  constructor(baseProductSku: string) {
    this.baseProductSku = baseProductSku;
    this.selectedComponents = [];
  }

  /**
   * Set selected components
   */
  setComponents(components: SelectedComponent[]): void {
    this.selectedComponents = components;
    this.recalculate();
  }

  /**
   * Add component
   */
  addComponent(component: SelectedComponent): void {
    this.selectedComponents.push(component);
    this.recalculate();
  }

  /**
   * Remove component
   */
  removeComponent(componentId: string): void {
    this.selectedComponents = this.selectedComponents.filter(
      c => c.componentId !== componentId
    );
    this.recalculate();
  }

  /**
   * Get current price result
   */
  getCurrentPrice(): PriceCalculationResult {
    return calculatePrice({
      baseProductSku: this.baseProductSku,
      selectedComponents: this.selectedComponents
    });
  }

  /**
   * Subscribe to price changes
   */
  onChange(callback: (result: PriceCalculationResult) => void): () => void {
    this.listeners.push(callback);
    
    // Return unsubscribe function
    return () => {
      this.listeners = this.listeners.filter(l => l !== callback);
    };
  }

  /**
   * Recalculate and notify listeners
   */
  private recalculate(): void {
    const result = this.getCurrentPrice();
    this.listeners.forEach(listener => listener(result));
  }
}

/**
 * Example Usage:
 * 
 * React:
 * ```tsx
 * const { priceResult, isCalculating } = usePriceCalculation(
 *   'UNBREAK-GLAS-SET-2',
 *   selectedComponents
 * );
 * 
 * if (isCalculating) return <Spinner />;
 * 
 * return (
 *   <div>
 *     <h2>Total: {formatPrice(priceResult.finalPriceGross)}</h2>
 *     <PriceBreakdown breakdown={priceResult.breakdown} />
 *   </div>
 * );
 * ```
 * 
 * Vanilla JS:
 * ```js
 * const calculator = new PriceCalculator('UNBREAK-GLAS-SET-2');
 * 
 * calculator.onChange((result) => {
 *   document.getElementById('total-price').textContent = 
 *     formatPrice(result.finalPriceGross);
 * });
 * 
 * calculator.addComponent({
 *   componentId: 'wood_oak',
 *   label: 'Eiche massiv',
 *   category: 'material',
 *   priceDelta: 29.00,
 *   isPremium: true
 * });
 * ```
 */

// React import for hook
import * as React from 'react';
