/**
 * Cart Pricing Persistence Schema (Phase 5)
 * 
 * Data structure for storing pricing information in cart
 * Ensures UI and checkout prices are identical and auditable
 * 
 * @version 1.0.0
 * @date 2026-01-03
 */

import { PriceCalculationResult, SelectedComponent } from '@/lib/configurator/pricing-calculator';

/**
 * Cart Item with Pricing Data
 * Complete pricing information persisted in cart
 */
export interface CartItemWithPricing {
  /**
   * Cart item ID
   */
  cartItemId: string;

  /**
   * Product type
   */
  type: 'CONFIGURATOR_DESIGN' | 'STANDARD_PRODUCT';

  /**
   * Design ID (for configurator items)
   */
  designId?: string;

  /**
   * Base product information
   */
  baseProduct: {
    sku: string;
    name: string;
    priceNet: number;
    priceGross: number;
  };

  /**
   * Customization pricing
   */
  customization: {
    enabled: boolean;
    feeNet: number;
    feeGross: number;
  };

  /**
   * Selected components with pricing
   */
  selectedComponents: ComponentPricingData[];

  /**
   * Component price sum
   */
  componentPriceSum: {
    net: number;
    gross: number;
  };

  /**
   * Final price
   */
  finalPrice: {
    net: number;
    gross: number;
    vatAmount: number;
    currency: string;
  };

  /**
   * Pricing metadata
   */
  pricingMetadata: {
    calculatedAt: string;
    pricebookVersion: string;
    priceSignature: string; // Hash for validation
  };

  /**
   * Quantity
   */
  quantity: number;

  /**
   * Added to cart timestamp
   */
  addedAt: string;
}

/**
 * Component Pricing Data
 * Pricing information for individual components
 */
export interface ComponentPricingData {
  componentId: string;
  label: string;
  category: 'material' | 'finish' | 'addon';
  priceDelta: number; // Net price delta
  isPremium: boolean;
  quantity: number;
  
  // Pricing breakdown
  pricing: {
    unitPriceNet: number;
    unitPriceGross: number;
    totalNet: number;
    totalGross: number;
  };
}

/**
 * Create Cart Item from Price Calculation
 * Converts price calculation result to cart item format
 */
export function createCartItemFromPriceCalculation(
  designId: string,
  baseProductSku: string,
  baseProductName: string,
  priceResult: PriceCalculationResult,
  selectedComponents: SelectedComponent[]
): CartItemWithPricing {
  const VAT_RATE = 0.19;
  const cartItemId = `cart_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  // Calculate component pricing data
  const componentPricingData: ComponentPricingData[] = selectedComponents.map(component => {
    const unitPriceNet = component.priceDelta;
    const unitPriceGross = unitPriceNet * (1 + VAT_RATE);
    const qty = component.quantity || 1;

    return {
      componentId: component.componentId,
      label: component.label,
      category: component.category,
      priceDelta: component.priceDelta,
      isPremium: component.isPremium,
      quantity: qty,
      pricing: {
        unitPriceNet,
        unitPriceGross,
        totalNet: unitPriceNet * qty,
        totalGross: unitPriceGross * qty
      }
    };
  });

  // Generate price signature for validation
  const priceSignature = generatePriceSignature(priceResult);

  return {
    cartItemId,
    type: 'CONFIGURATOR_DESIGN',
    designId,
    baseProduct: {
      sku: baseProductSku,
      name: baseProductName,
      priceNet: priceResult.baseProductPrice,
      priceGross: priceResult.baseProductPrice * (1 + VAT_RATE)
    },
    customization: {
      enabled: priceResult.customizationFee > 0,
      feeNet: priceResult.customizationFee,
      feeGross: priceResult.customizationFee * (1 + VAT_RATE)
    },
    selectedComponents: componentPricingData,
    componentPriceSum: {
      net: priceResult.componentPriceSum,
      gross: priceResult.componentPriceSum * (1 + VAT_RATE)
    },
    finalPrice: {
      net: priceResult.finalPriceNet,
      gross: priceResult.finalPriceGross,
      vatAmount: priceResult.vatAmount,
      currency: priceResult.currency
    },
    pricingMetadata: {
      calculatedAt: priceResult.metadata.calculatedAt,
      pricebookVersion: priceResult.metadata.pricebookVersion,
      priceSignature
    },
    quantity: 1,
    addedAt: new Date().toISOString()
  };
}

/**
 * Generate Price Signature
 * Creates hash for price validation
 */
function generatePriceSignature(priceResult: PriceCalculationResult): string {
  const data = JSON.stringify({
    base: priceResult.baseProductPrice,
    customization: priceResult.customizationFee,
    components: priceResult.componentPriceSum,
    total: priceResult.finalPriceNet,
    version: priceResult.metadata.pricebookVersion
  });

  // Simple hash (in production: use crypto.subtle or similar)
  let hash = 0;
  for (let i = 0; i < data.length; i++) {
    const char = data.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }

  return Math.abs(hash).toString(36);
}

/**
 * Validate Cart Item Pricing
 * Ensures cart item pricing is still valid
 */
export function validateCartItemPricing(
  cartItem: CartItemWithPricing,
  currentPriceResult: PriceCalculationResult
): {
  valid: boolean;
  errors: string[];
  priceChanged: boolean;
  priceDifference?: number;
} {
  const errors: string[] = [];
  let priceChanged = false;
  let priceDifference = 0;

  // 1. Check pricebook version
  if (cartItem.pricingMetadata.pricebookVersion !== currentPriceResult.metadata.pricebookVersion) {
    errors.push('Pricebook version has changed');
    priceChanged = true;
  }

  // 2. Check final price
  const cartPrice = cartItem.finalPrice.net;
  const currentPrice = currentPriceResult.finalPriceNet;
  priceDifference = currentPrice - cartPrice;

  if (Math.abs(priceDifference) > 0.01) {
    errors.push(`Price changed: cart=${cartPrice}, current=${currentPrice}`);
    priceChanged = true;
  }

  // 3. Check base product price
  if (cartItem.baseProduct.priceNet !== currentPriceResult.baseProductPrice) {
    errors.push('Base product price changed');
  }

  // 4. Check customization fee
  if (cartItem.customization.feeNet !== currentPriceResult.customizationFee) {
    errors.push('Customization fee changed');
  }

  // 5. Check component sum
  if (Math.abs(cartItem.componentPriceSum.net - currentPriceResult.componentPriceSum) > 0.01) {
    errors.push('Component pricing changed');
  }

  return {
    valid: errors.length === 0,
    errors,
    priceChanged,
    priceDifference: priceChanged ? priceDifference : undefined
  };
}

/**
 * Cart Summary
 * Aggregates pricing across all cart items
 */
export interface CartSummary {
  items: CartItemWithPricing[];
  totals: {
    subtotalNet: number;
    subtotalGross: number;
    vatAmount: number;
    totalGross: number;
    currency: string;
  };
  breakdown: {
    baseProductsTotal: number;
    customizationFeesTotal: number;
    componentsTotal: number;
  };
  itemCount: number;
  hasCustomProducts: boolean;
}

/**
 * Calculate Cart Summary
 */
export function calculateCartSummary(cartItems: CartItemWithPricing[]): CartSummary {
  const totals = cartItems.reduce(
    (acc, item) => {
      const itemNet = item.finalPrice.net * item.quantity;
      const itemGross = item.finalPrice.gross * item.quantity;
      const itemVat = item.finalPrice.vatAmount * item.quantity;

      return {
        subtotalNet: acc.subtotalNet + itemNet,
        subtotalGross: acc.subtotalGross + itemGross,
        vatAmount: acc.vatAmount + itemVat,
        baseProductsTotal: acc.baseProductsTotal + (item.baseProduct.priceNet * item.quantity),
        customizationFeesTotal: acc.customizationFeesTotal + (item.customization.feeNet * item.quantity),
        componentsTotal: acc.componentsTotal + (item.componentPriceSum.net * item.quantity)
      };
    },
    {
      subtotalNet: 0,
      subtotalGross: 0,
      vatAmount: 0,
      baseProductsTotal: 0,
      customizationFeesTotal: 0,
      componentsTotal: 0
    }
  );

  return {
    items: cartItems,
    totals: {
      subtotalNet: totals.subtotalNet,
      subtotalGross: totals.subtotalGross,
      vatAmount: totals.vatAmount,
      totalGross: totals.subtotalGross,
      currency: cartItems[0]?.finalPrice.currency || 'EUR'
    },
    breakdown: {
      baseProductsTotal: totals.baseProductsTotal,
      customizationFeesTotal: totals.customizationFeesTotal,
      componentsTotal: totals.componentsTotal
    },
    itemCount: cartItems.reduce((sum, item) => sum + item.quantity, 0),
    hasCustomProducts: cartItems.some(item => item.type === 'CONFIGURATOR_DESIGN')
  };
}

/**
 * Export Cart for Checkout
 * Prepares cart data for order submission
 */
export function exportCartForCheckout(cartSummary: CartSummary) {
  return {
    items: cartSummary.items.map(item => ({
      cartItemId: item.cartItemId,
      type: item.type,
      designId: item.designId,
      baseProductSku: item.baseProduct.sku,
      selectedComponents: item.selectedComponents,
      pricing: item.finalPrice,
      quantity: item.quantity,
      pricingMetadata: item.pricingMetadata
    })),
    totals: cartSummary.totals,
    breakdown: cartSummary.breakdown,
    metadata: {
      exportedAt: new Date().toISOString(),
      itemCount: cartSummary.itemCount,
      hasCustomProducts: cartSummary.hasCustomProducts
    }
  };
}

/**
 * Example Usage:
 * 
 * ```tsx
 * import { createCartItemFromPriceCalculation } from '@/lib/cart/cart-pricing-persistence';
 * 
 * // After configurator completion
 * const priceResult = calculatePrice({
 *   baseProductSku: 'UNBREAK-GLAS-SET-2',
 *   selectedComponents: [...]
 * });
 * 
 * const cartItem = createCartItemFromPriceCalculation(
 *   designId,
 *   'UNBREAK-GLAS-SET-2',
 *   'Glashalter 2er Set',
 *   priceResult,
 *   selectedComponents
 * );
 * 
 * // Add to cart
 * addToCart(cartItem);
 * 
 * // Validate pricing before checkout
 * const validation = validateCartItemPricing(cartItem, currentPriceResult);
 * if (!validation.valid) {
 *   alert('Pricing has changed. Please review your cart.');
 * }
 * ```
 */
