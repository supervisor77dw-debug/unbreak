/**
 * DELIVERY ESTIMATION – PHASE 6
 * 
 * Calculate delivery estimates for custom-manufactured products.
 * Combines base delivery time with customization buffer and component complexity.
 * 
 * Purpose:
 * - Calculate realistic delivery estimates for custom products
 * - Add buffer time for customization complexity
 * - Provide delivery range for customer communication
 * - Store estimates for order tracking
 * 
 * @module lib/fulfillment/delivery-estimation
 */

import type { CartItemWithPricing } from '../cart/cart-pricing-persistence';

// ============================================================
// TYPE DEFINITIONS
// ============================================================

/**
 * Delivery time configuration
 */
export interface DeliveryTimeConfig {
  baseDeliveryDays: number;          // Base delivery time for standard product
  customizationBufferDays: number;   // Additional days for customization
  componentComplexityDays: Record<string, number>; // Days per component type
  productionLeadTimeDays: number;    // Days to start production
  shippingDays: number;              // Days for shipping
  bufferDays: number;                // Safety buffer
}

/**
 * Delivery estimate result
 */
export interface DeliveryEstimate {
  // Exact date (best estimate)
  estimatedDeliveryDate: string; // ISO date
  
  // Range for customer communication
  earliestDeliveryDate: string; // ISO date
  latestDeliveryDate: string;   // ISO date
  
  // Range in business days
  deliveryRangeDays: {
    min: number;
    max: number;
  };
  
  // Breakdown
  breakdown: {
    baseDeliveryDays: number;
    customizationDays: number;
    componentComplexityDays: number;
    productionLeadTimeDays: number;
    shippingDays: number;
    bufferDays: number;
    totalDays: number;
  };
  
  // Metadata
  calculatedAt: string;
  orderDate: string;
  locale?: string;
}

/**
 * Delivery communication message
 */
export interface DeliveryMessage {
  short: string;        // "3-5 Werktage"
  medium: string;       // "Lieferung voraussichtlich zwischen 15.01. und 17.01.2026"
  long: string;         // Full description with production notes
  estimateDate: string; // "15.01.2026"
}

// ============================================================
// CONFIGURATION
// ============================================================

/**
 * Default delivery time configuration
 */
const DEFAULT_CONFIG: DeliveryTimeConfig = {
  baseDeliveryDays: 2,              // 2 days for standard product
  customizationBufferDays: 3,       // +3 days for customization
  productionLeadTimeDays: 1,        // 1 day to start production
  shippingDays: 2,                  // 2 days shipping
  bufferDays: 1,                    // 1 day safety buffer
  
  // Component complexity (additional days per component)
  componentComplexityDays: {
    'MAT_STAINLESS_STEEL': 0,       // Standard material
    'MAT_WOOD_OAK': 1,              // Premium wood +1 day
    'MAT_WOOD_WALNUT': 1,           // Premium wood +1 day
    'MAT_METAL_RING': 0,            // Standard
    'FINISH_BRUSHED': 0,            // Standard finish
    'FINISH_POLISHED': 1,           // Polishing +1 day
    'FINISH_COLOR_RAL': 1,          // RAL coating +1 day
    'FINISH_COLOR_CUSTOM': 2,       // Custom color +2 days
    'FINISH_MATTE_BLACK': 1,        // Coating +1 day
    'ADDON_ENGRAVING_TEXT': 1,      // Engraving +1 day
    'ADDON_ENGRAVING_LOGO': 2,      // Logo engraving +2 days
    'ADDON_GIFT_BOX': 0,            // No time impact
    'ADDON_PREMIUM_PACKAGING': 0,   // No time impact
    'ADDON_FELT_PADS': 0,           // No time impact
    'ADDON_MOUNTING_KIT': 0,        // No time impact
  },
};

// ============================================================
// BUSINESS DAY CALCULATION
// ============================================================

/**
 * Check if date is weekend
 */
function isWeekend(date: Date): boolean {
  const day = date.getDay();
  return day === 0 || day === 6; // Sunday or Saturday
}

/**
 * Check if date is German public holiday (simplified)
 */
function isGermanHoliday(date: Date): boolean {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  
  // Fixed holidays
  const holidays = [
    { month: 1, day: 1 },   // New Year
    { month: 5, day: 1 },   // Labor Day
    { month: 10, day: 3 },  // German Unity Day
    { month: 12, day: 25 }, // Christmas Day
    { month: 12, day: 26 }, // Boxing Day
  ];
  
  return holidays.some(h => h.month === month && h.day === day);
}

/**
 * Check if date is business day
 */
function isBusinessDay(date: Date): boolean {
  return !isWeekend(date) && !isGermanHoliday(date);
}

/**
 * Add business days to date
 */
function addBusinessDays(startDate: Date, businessDays: number): Date {
  const result = new Date(startDate);
  let daysAdded = 0;
  
  while (daysAdded < businessDays) {
    result.setDate(result.getDate() + 1);
    if (isBusinessDay(result)) {
      daysAdded++;
    }
  }
  
  return result;
}

// ============================================================
// DELIVERY ESTIMATION
// ============================================================

/**
 * Calculate component complexity days
 */
function calculateComponentComplexityDays(
  selectedComponents: Array<{ componentId: string }>,
  config: DeliveryTimeConfig
): number {
  let totalDays = 0;
  
  for (const component of selectedComponents) {
    const complexityDays = config.componentComplexityDays[component.componentId] || 0;
    totalDays += complexityDays;
  }
  
  return totalDays;
}

/**
 * Calculate total delivery days
 */
function calculateTotalDeliveryDays(
  cartItem: CartItemWithPricing,
  config: DeliveryTimeConfig
): DeliveryEstimate['breakdown'] {
  const isCustomProduct = cartItem.type === 'CONFIGURATOR_DESIGN';
  
  // Base delivery time
  const baseDeliveryDays = config.baseDeliveryDays;
  
  // Customization buffer (only for custom products)
  const customizationDays = isCustomProduct ? config.customizationBufferDays : 0;
  
  // Component complexity
  const componentComplexityDays = isCustomProduct
    ? calculateComponentComplexityDays(cartItem.selectedComponents, config)
    : 0;
  
  // Production lead time
  const productionLeadTimeDays = isCustomProduct ? config.productionLeadTimeDays : 0;
  
  // Shipping time
  const shippingDays = config.shippingDays;
  
  // Buffer
  const bufferDays = isCustomProduct ? config.bufferDays : 0;
  
  // Total
  const totalDays = 
    baseDeliveryDays +
    customizationDays +
    componentComplexityDays +
    productionLeadTimeDays +
    shippingDays +
    bufferDays;
  
  return {
    baseDeliveryDays,
    customizationDays,
    componentComplexityDays,
    productionLeadTimeDays,
    shippingDays,
    bufferDays,
    totalDays,
  };
}

/**
 * Calculate delivery estimate for cart item
 */
export function calculateDeliveryEstimate(
  cartItem: CartItemWithPricing,
  orderDate: Date = new Date(),
  config: DeliveryTimeConfig = DEFAULT_CONFIG
): DeliveryEstimate {
  const breakdown = calculateTotalDeliveryDays(cartItem, config);
  
  // Calculate estimated delivery date (exact)
  const estimatedDeliveryDate = addBusinessDays(orderDate, breakdown.totalDays);
  
  // Calculate range (±1 business day)
  const earliestDeliveryDate = addBusinessDays(orderDate, breakdown.totalDays - 1);
  const latestDeliveryDate = addBusinessDays(orderDate, breakdown.totalDays + 1);
  
  return {
    estimatedDeliveryDate: estimatedDeliveryDate.toISOString().split('T')[0],
    earliestDeliveryDate: earliestDeliveryDate.toISOString().split('T')[0],
    latestDeliveryDate: latestDeliveryDate.toISOString().split('T')[0],
    deliveryRangeDays: {
      min: breakdown.totalDays - 1,
      max: breakdown.totalDays + 1,
    },
    breakdown,
    calculatedAt: new Date().toISOString(),
    orderDate: orderDate.toISOString().split('T')[0],
  };
}

/**
 * Calculate delivery estimate for entire order
 */
export function calculateOrderDeliveryEstimate(
  cartItems: CartItemWithPricing[],
  orderDate: Date = new Date(),
  config: DeliveryTimeConfig = DEFAULT_CONFIG
): DeliveryEstimate {
  // Calculate estimate for each item
  const estimates = cartItems.map(item => 
    calculateDeliveryEstimate(item, orderDate, config)
  );
  
  // Use the longest delivery time
  const longestEstimate = estimates.reduce((longest, current) => {
    return current.breakdown.totalDays > longest.breakdown.totalDays
      ? current
      : longest;
  });
  
  return longestEstimate;
}

// ============================================================
// DELIVERY MESSAGING
// ============================================================

/**
 * Format date for display (German locale)
 */
function formatDate(dateStr: string, locale: string = 'de-DE'): string {
  const date = new Date(dateStr);
  return new Intl.DateTimeFormat(locale, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date);
}

/**
 * Format date short (without year if current year)
 */
function formatDateShort(dateStr: string, locale: string = 'de-DE'): string {
  const date = new Date(dateStr);
  const currentYear = new Date().getFullYear();
  const dateYear = date.getFullYear();
  
  if (dateYear === currentYear) {
    return new Intl.DateTimeFormat(locale, {
      day: '2-digit',
      month: '2-digit',
    }).format(date);
  } else {
    return formatDate(dateStr, locale);
  }
}

/**
 * Generate delivery communication messages
 */
export function generateDeliveryMessage(
  estimate: DeliveryEstimate,
  locale: string = 'de-DE'
): DeliveryMessage {
  const { earliestDeliveryDate, latestDeliveryDate, estimatedDeliveryDate, breakdown } = estimate;
  
  // German messages
  if (locale === 'de-DE') {
    const rangeDays = `${breakdown.totalDays - 1}-${breakdown.totalDays + 1}`;
    const earliestFormatted = formatDateShort(earliestDeliveryDate, locale);
    const latestFormatted = formatDateShort(latestDeliveryDate, locale);
    const estimateFormatted = formatDateShort(estimatedDeliveryDate, locale);
    
    const isCustom = breakdown.customizationDays > 0;
    
    return {
      short: `${rangeDays} Werktage`,
      medium: `Lieferung voraussichtlich zwischen ${earliestFormatted} und ${latestFormatted}`,
      long: isCustom
        ? `Ihre individuell gefertigte Bestellung wird voraussichtlich zwischen dem ${earliestFormatted} und ${latestFormatted} geliefert. ` +
          `Die Produktion dauert ca. ${breakdown.customizationDays + breakdown.componentComplexityDays} Werktage, ` +
          `anschließend erfolgt der Versand in ${breakdown.shippingDays} Werktagen.`
        : `Lieferung voraussichtlich zwischen dem ${earliestFormatted} und ${latestFormatted}.`,
      estimateDate: estimateFormatted,
    };
  }
  
  // English messages
  const rangeDays = `${breakdown.totalDays - 1}-${breakdown.totalDays + 1}`;
  const earliestFormatted = formatDateShort(earliestDeliveryDate, 'en-US');
  const latestFormatted = formatDateShort(latestDeliveryDate, 'en-US');
  const estimateFormatted = formatDateShort(estimatedDeliveryDate, 'en-US');
  
  const isCustom = breakdown.customizationDays > 0;
  
  return {
    short: `${rangeDays} business days`,
    medium: `Estimated delivery between ${earliestFormatted} and ${latestFormatted}`,
    long: isCustom
      ? `Your custom-made order will be delivered between ${earliestFormatted} and ${latestFormatted}. ` +
        `Production takes approximately ${breakdown.customizationDays + breakdown.componentComplexityDays} business days, ` +
        `followed by ${breakdown.shippingDays} business days for shipping.`
      : `Estimated delivery between ${earliestFormatted} and ${latestFormatted}.`,
    estimateDate: estimateFormatted,
  };
}

// ============================================================
// DELIVERY DATA PERSISTENCE
// ============================================================

/**
 * Delivery data to store with order
 */
export interface StoredDeliveryData {
  estimatedDeliveryDate: string;
  earliestDeliveryDate: string;
  latestDeliveryDate: string;
  communicatedDeliveryRange: string; // "3-5 Werktage" or "15.01. - 17.01."
  deliveryMessage: DeliveryMessage;
  breakdown: DeliveryEstimate['breakdown'];
  calculatedAt: string;
  orderDate: string;
}

/**
 * Prepare delivery data for storage
 */
export function prepareDeliveryDataForStorage(
  estimate: DeliveryEstimate,
  locale: string = 'de-DE'
): StoredDeliveryData {
  const message = generateDeliveryMessage(estimate, locale);
  
  return {
    estimatedDeliveryDate: estimate.estimatedDeliveryDate,
    earliestDeliveryDate: estimate.earliestDeliveryDate,
    latestDeliveryDate: estimate.latestDeliveryDate,
    communicatedDeliveryRange: message.medium,
    deliveryMessage: message,
    breakdown: estimate.breakdown,
    calculatedAt: estimate.calculatedAt,
    orderDate: estimate.orderDate,
  };
}

/**
 * Update delivery estimate (recalculate if needed)
 */
export function updateDeliveryEstimate(
  storedData: StoredDeliveryData,
  currentDate: Date = new Date()
): StoredDeliveryData | null {
  const orderDate = new Date(storedData.orderDate);
  const estimatedDate = new Date(storedData.estimatedDeliveryDate);
  
  // If estimated date has passed, return null (needs manual review)
  if (estimatedDate < currentDate) {
    return null;
  }
  
  // If order date is more than 7 days ago, don't auto-update
  const daysSinceOrder = Math.floor(
    (currentDate.getTime() - orderDate.getTime()) / (1000 * 60 * 60 * 24)
  );
  if (daysSinceOrder > 7) {
    return null;
  }
  
  // Return stored data (no update needed)
  return storedData;
}

export { DEFAULT_CONFIG as DEFAULT_DELIVERY_CONFIG };
