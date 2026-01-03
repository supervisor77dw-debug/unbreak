/**
 * CONFIGURATOR EVENTS – PHASE 7
 * 
 * Track configurator interactions for conversion analysis and business intelligence.
 * Privacy-compliant: No personal data, only anonymous session tracking.
 * 
 * Purpose:
 * - Track user journey through configurator
 * - Identify conversion bottlenecks
 * - Measure premium component attach rates
 * - Optimize pricing based on user behavior
 * 
 * @module lib/analytics/configurator-events
 */

// ============================================================
// TYPE DEFINITIONS
// ============================================================

/**
 * Configurator event types
 */
export type ConfiguratorEventType =
  | 'configurator_opened'           // User opens configurator
  | 'component_selected'            // User selects any component
  | 'premium_component_selected'    // User selects premium component
  | 'price_changed'                 // Price recalculation
  | 'design_saved'                  // User saves design
  | 'added_to_cart'                 // User adds to cart
  | 'checkout_started'              // User proceeds to checkout
  | 'checkout_completed'            // Order confirmed
  | 'checkout_abandoned';           // User leaves checkout

/**
 * Base event data (included in all events)
 */
export interface ConfiguratorEventData {
  // Session identification (anonymous)
  sessionId: string;                // Unique session ID (not user ID)
  
  // Product context
  productId: string;                // Design ID or base product SKU
  baseProductSku?: string;          // Base product SKU
  
  // Pricing context
  currentPrice: {
    net: number;
    gross: number;
    currency: string;
  };
  
  // Component context
  selectedComponentCount: number;   // Total components selected
  hasPremiumComponents: boolean;    // Has any premium component
  premiumComponentCount?: number;   // Count of premium components
  
  // Timestamps
  timestamp: string;                // ISO timestamp
  
  // Optional context
  metadata?: Record<string, any>;   // Additional event-specific data
}

/**
 * Component selection event
 */
export interface ComponentSelectedEvent extends ConfiguratorEventData {
  eventType: 'component_selected' | 'premium_component_selected';
  componentId: string;
  componentName: string;
  componentCategory: 'material' | 'finish' | 'addon';
  isPremium: boolean;
  priceDelta: number;               // Price change from this component
}

/**
 * Price changed event
 */
export interface PriceChangedEvent extends ConfiguratorEventData {
  eventType: 'price_changed';
  previousPrice: {
    net: number;
    gross: number;
  };
  priceIncrease: number;            // Delta (can be negative)
  priceIncreasePercent: number;     // Percentage change
  triggerAction: string;            // What caused price change
}

/**
 * Design saved event
 */
export interface DesignSavedEvent extends ConfiguratorEventData {
  eventType: 'design_saved';
  designId: string;
  componentIds: string[];
  totalComponents: number;
  saveMethod: 'auto' | 'manual' | 'share';
}

/**
 * Add to cart event
 */
export interface AddToCartEvent extends ConfiguratorEventData {
  eventType: 'added_to_cart';
  designId: string;
  quantity: number;
  timeInConfigurator: number;       // Seconds spent in configurator
}

/**
 * Checkout event
 */
export interface CheckoutEvent extends ConfiguratorEventData {
  eventType: 'checkout_started' | 'checkout_completed' | 'checkout_abandoned';
  orderId?: string;                 // Only for completed
  orderValue?: number;              // Only for completed
  abandonmentReason?: string;       // Only for abandoned
  checkoutDuration?: number;        // Seconds in checkout
}

/**
 * Abandonment data (exit without completion)
 */
export interface AbandonmentData {
  sessionId: string;
  lastAction: ConfiguratorEventType;
  lastActionTimestamp: string;
  priceAtExit: number;
  timeInConfigurator: number;       // Seconds
  selectedComponentCount: number;
  hasPremiumComponents: boolean;
  exitPath: string;                 // Where user went (if known)
}

/**
 * Union type for all events
 */
export type ConfiguratorEvent =
  | ConfiguratorEventData
  | ComponentSelectedEvent
  | PriceChangedEvent
  | DesignSavedEvent
  | AddToCartEvent
  | CheckoutEvent;

// ============================================================
// EVENT BUILDERS
// ============================================================

/**
 * Create configurator opened event
 */
export function createConfiguratorOpenedEvent(
  sessionId: string,
  productId: string,
  baseProductSku?: string
): ConfiguratorEventData {
  return {
    sessionId,
    productId,
    baseProductSku,
    currentPrice: {
      net: 0,
      gross: 0,
      currency: 'EUR',
    },
    selectedComponentCount: 0,
    hasPremiumComponents: false,
    timestamp: new Date().toISOString(),
    metadata: {
      eventType: 'configurator_opened',
    },
  };
}

/**
 * Create component selected event
 */
export function createComponentSelectedEvent(
  sessionId: string,
  productId: string,
  componentId: string,
  componentName: string,
  componentCategory: 'material' | 'finish' | 'addon',
  isPremium: boolean,
  priceDelta: number,
  currentPrice: { net: number; gross: number; currency: string },
  selectedComponentCount: number,
  hasPremiumComponents: boolean
): ComponentSelectedEvent {
  return {
    eventType: isPremium ? 'premium_component_selected' : 'component_selected',
    sessionId,
    productId,
    componentId,
    componentName,
    componentCategory,
    isPremium,
    priceDelta,
    currentPrice,
    selectedComponentCount,
    hasPremiumComponents,
    premiumComponentCount: hasPremiumComponents ? 1 : 0,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Create price changed event
 */
export function createPriceChangedEvent(
  sessionId: string,
  productId: string,
  previousPrice: { net: number; gross: number },
  currentPrice: { net: number; gross: number; currency: string },
  selectedComponentCount: number,
  hasPremiumComponents: boolean,
  triggerAction: string
): PriceChangedEvent {
  const priceIncrease = currentPrice.net - previousPrice.net;
  const priceIncreasePercent = previousPrice.net > 0
    ? (priceIncrease / previousPrice.net) * 100
    : 0;
  
  return {
    eventType: 'price_changed',
    sessionId,
    productId,
    previousPrice,
    currentPrice,
    priceIncrease,
    priceIncreasePercent,
    triggerAction,
    selectedComponentCount,
    hasPremiumComponents,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Create design saved event
 */
export function createDesignSavedEvent(
  sessionId: string,
  productId: string,
  designId: string,
  componentIds: string[],
  currentPrice: { net: number; gross: number; currency: string },
  hasPremiumComponents: boolean,
  saveMethod: 'auto' | 'manual' | 'share' = 'manual'
): DesignSavedEvent {
  return {
    eventType: 'design_saved',
    sessionId,
    productId,
    designId,
    componentIds,
    totalComponents: componentIds.length,
    saveMethod,
    currentPrice,
    selectedComponentCount: componentIds.length,
    hasPremiumComponents,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Create add to cart event
 */
export function createAddToCartEvent(
  sessionId: string,
  productId: string,
  designId: string,
  quantity: number,
  currentPrice: { net: number; gross: number; currency: string },
  selectedComponentCount: number,
  hasPremiumComponents: boolean,
  timeInConfigurator: number
): AddToCartEvent {
  return {
    eventType: 'added_to_cart',
    sessionId,
    productId,
    designId,
    quantity,
    currentPrice,
    selectedComponentCount,
    hasPremiumComponents,
    timeInConfigurator,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Create checkout started event
 */
export function createCheckoutStartedEvent(
  sessionId: string,
  productId: string,
  currentPrice: { net: number; gross: number; currency: string },
  selectedComponentCount: number,
  hasPremiumComponents: boolean
): CheckoutEvent {
  return {
    eventType: 'checkout_started',
    sessionId,
    productId,
    currentPrice,
    selectedComponentCount,
    hasPremiumComponents,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Create checkout completed event
 */
export function createCheckoutCompletedEvent(
  sessionId: string,
  productId: string,
  orderId: string,
  orderValue: number,
  currentPrice: { net: number; gross: number; currency: string },
  selectedComponentCount: number,
  hasPremiumComponents: boolean,
  checkoutDuration?: number
): CheckoutEvent {
  return {
    eventType: 'checkout_completed',
    sessionId,
    productId,
    orderId,
    orderValue,
    currentPrice,
    selectedComponentCount,
    hasPremiumComponents,
    checkoutDuration,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Create checkout abandoned event
 */
export function createCheckoutAbandonedEvent(
  sessionId: string,
  productId: string,
  currentPrice: { net: number; gross: number; currency: string },
  selectedComponentCount: number,
  hasPremiumComponents: boolean,
  abandonmentReason?: string,
  checkoutDuration?: number
): CheckoutEvent {
  return {
    eventType: 'checkout_abandoned',
    sessionId,
    productId,
    currentPrice,
    selectedComponentCount,
    hasPremiumComponents,
    abandonmentReason,
    checkoutDuration,
    timestamp: new Date().toISOString(),
  };
}

// ============================================================
// EVENT VALIDATION
// ============================================================

/**
 * Validate event data
 */
export function validateEvent(event: ConfiguratorEvent): boolean {
  // Required fields
  if (!event.sessionId || !event.productId || !event.timestamp) {
    console.warn('Event missing required fields:', event);
    return false;
  }
  
  // Price validation
  if (!event.currentPrice || typeof event.currentPrice.net !== 'number') {
    console.warn('Event has invalid price:', event);
    return false;
  }
  
  // Component count validation
  if (typeof event.selectedComponentCount !== 'number' || event.selectedComponentCount < 0) {
    console.warn('Event has invalid component count:', event);
    return false;
  }
  
  return true;
}

/**
 * Sanitize event data (remove any personal info)
 */
export function sanitizeEvent(event: ConfiguratorEvent): ConfiguratorEvent {
  // Remove any potentially personal metadata
  const sanitized = { ...event };
  
  if (sanitized.metadata) {
    const { email, name, phone, address, ...safeMeta } = sanitized.metadata as any;
    sanitized.metadata = safeMeta;
  }
  
  return sanitized;
}

// ============================================================
// EVENT AGGREGATION
// ============================================================

/**
 * Calculate session metrics from events
 */
export interface SessionMetrics {
  sessionId: string;
  totalEvents: number;
  duration: number;                 // Seconds
  startTime: string;
  endTime: string;
  
  // Funnel progression
  openedConfigurator: boolean;
  selectedComponents: boolean;
  selectedPremium: boolean;
  savedDesign: boolean;
  addedToCart: boolean;
  startedCheckout: boolean;
  completedCheckout: boolean;
  abandoned: boolean;
  
  // Component stats
  totalComponentSelections: number;
  premiumComponentSelections: number;
  premiumAttachRate: number;        // Percentage
  
  // Pricing stats
  startPrice: number;
  endPrice: number;
  maxPrice: number;
  priceIncrease: number;
  
  // Outcome
  converted: boolean;
  orderId?: string;
  orderValue?: number;
  abandonmentStage?: ConfiguratorEventType;
}

/**
 * Aggregate events into session metrics
 */
export function aggregateSessionMetrics(events: ConfiguratorEvent[]): SessionMetrics | null {
  if (events.length === 0) return null;
  
  const sessionId = events[0].sessionId;
  const sortedEvents = [...events].sort((a, b) => 
    new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );
  
  const startTime = sortedEvents[0].timestamp;
  const endTime = sortedEvents[sortedEvents.length - 1].timestamp;
  const duration = Math.floor(
    (new Date(endTime).getTime() - new Date(startTime).getTime()) / 1000
  );
  
  // Funnel progression
  const eventTypes = new Set(
    sortedEvents.map(e => (e as any).eventType || e.metadata?.eventType)
  );
  
  // Component stats
  const componentEvents = sortedEvents.filter(e => 
    (e as any).eventType === 'component_selected' || 
    (e as any).eventType === 'premium_component_selected'
  ) as ComponentSelectedEvent[];
  
  const totalComponentSelections = componentEvents.length;
  const premiumComponentSelections = componentEvents.filter(e => e.isPremium).length;
  const premiumAttachRate = totalComponentSelections > 0
    ? (premiumComponentSelections / totalComponentSelections) * 100
    : 0;
  
  // Pricing stats
  const prices = sortedEvents.map(e => e.currentPrice.net);
  const startPrice = prices[0] || 0;
  const endPrice = prices[prices.length - 1] || 0;
  const maxPrice = Math.max(...prices);
  const priceIncrease = endPrice - startPrice;
  
  // Conversion
  const checkoutCompleted = sortedEvents.find(e => 
    (e as any).eventType === 'checkout_completed'
  ) as CheckoutEvent | undefined;
  
  const abandoned = sortedEvents.find(e => 
    (e as any).eventType === 'checkout_abandoned'
  );
  
  // Last event before abandonment
  let abandonmentStage: ConfiguratorEventType | undefined;
  if (abandoned && !checkoutCompleted) {
    const lastEvent = sortedEvents[sortedEvents.length - 2]; // Event before abandonment
    abandonmentStage = (lastEvent as any).eventType || lastEvent.metadata?.eventType;
  }
  
  return {
    sessionId,
    totalEvents: events.length,
    duration,
    startTime,
    endTime,
    
    openedConfigurator: eventTypes.has('configurator_opened'),
    selectedComponents: eventTypes.has('component_selected') || eventTypes.has('premium_component_selected'),
    selectedPremium: eventTypes.has('premium_component_selected'),
    savedDesign: eventTypes.has('design_saved'),
    addedToCart: eventTypes.has('added_to_cart'),
    startedCheckout: eventTypes.has('checkout_started'),
    completedCheckout: eventTypes.has('checkout_completed'),
    abandoned: !!abandoned,
    
    totalComponentSelections,
    premiumComponentSelections,
    premiumAttachRate,
    
    startPrice,
    endPrice,
    maxPrice,
    priceIncrease,
    
    converted: !!checkoutCompleted,
    orderId: checkoutCompleted?.orderId,
    orderValue: checkoutCompleted?.orderValue,
    abandonmentStage,
  };
}

// ============================================================
// EXPORTS
// ============================================================

export type {
  ConfiguratorEvent,
  ConfiguratorEventData,
  ComponentSelectedEvent,
  PriceChangedEvent,
  DesignSavedEvent,
  AddToCartEvent,
  CheckoutEvent,
  AbandonmentData,
  SessionMetrics,
};
