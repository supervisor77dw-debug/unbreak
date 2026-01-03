/**
 * FULFILLMENT STATUS MANAGER – PHASE 6
 * 
 * Manage production and fulfillment status flags for custom orders.
 * Ensures orders are locked at production start and tracked through fulfillment.
 * 
 * Purpose:
 * - Set production status (pending → in-production → completed)
 * - Lock orders to prevent changes after production start
 * - Track fulfillment type (custom vs standard)
 * - Manage order lifecycle states
 * 
 * @module lib/fulfillment/fulfillment-manager
 */

// ============================================================
// TYPE DEFINITIONS
// ============================================================

/**
 * Production status lifecycle
 */
export type ProductionStatus = 
  | 'pending'           // Order confirmed, waiting for production start
  | 'in-production'     // Production has started
  | 'quality-check'     // Production complete, in quality control
  | 'completed'         // Production complete and approved
  | 'shipped'           // Shipped to customer
  | 'delivered'         // Delivered to customer
  | 'cancelled';        // Order cancelled

/**
 * Fulfillment type
 */
export type FulfillmentType = 
  | 'custom'            // Custom-manufactured (configurator)
  | 'standard'          // Standard product (catalog)
  | 'mixed';            // Mixed (some custom, some standard)

/**
 * Change lock status
 */
export interface ChangeLockStatus {
  locked: boolean;
  lockedAt?: string;        // ISO timestamp when locked
  lockedBy?: string;        // User/system that locked
  lockReason?: string;      // Reason for lock
  allowedChanges?: string[]; // Which fields can still be changed (if any)
}

/**
 * Order fulfillment status
 */
export interface OrderFulfillmentStatus {
  orderId: string;
  orderNumber: string;
  
  // Production status
  productionStatus: ProductionStatus;
  productionStartedAt?: string;
  productionCompletedAt?: string;
  
  // Fulfillment type
  fulfillmentType: FulfillmentType;
  
  // Change lock
  changeLock: ChangeLockStatus;
  
  // Timestamps
  createdAt: string;
  updatedAt: string;
  
  // Additional metadata
  metadata?: {
    productionNotes?: string[];
    qualityCheckStatus?: 'pending' | 'passed' | 'failed';
    shippingProvider?: string;
    trackingNumber?: string;
  };
}

/**
 * Status transition event
 */
export interface StatusTransitionEvent {
  orderId: string;
  fromStatus: ProductionStatus;
  toStatus: ProductionStatus;
  timestamp: string;
  triggeredBy: string;
  reason?: string;
  metadata?: Record<string, any>;
}

// ============================================================
// STATUS TRANSITIONS
// ============================================================

/**
 * Valid production status transitions
 */
const VALID_TRANSITIONS: Record<ProductionStatus, ProductionStatus[]> = {
  'pending': ['in-production', 'cancelled'],
  'in-production': ['quality-check', 'cancelled'],
  'quality-check': ['completed', 'in-production'], // Can go back if quality fails
  'completed': ['shipped'],
  'shipped': ['delivered'],
  'delivered': [], // Terminal state
  'cancelled': [], // Terminal state
};

/**
 * Check if status transition is valid
 */
export function isValidTransition(
  fromStatus: ProductionStatus,
  toStatus: ProductionStatus
): boolean {
  const allowedTransitions = VALID_TRANSITIONS[fromStatus];
  return allowedTransitions.includes(toStatus);
}

/**
 * Get next allowed statuses
 */
export function getNextAllowedStatuses(
  currentStatus: ProductionStatus
): ProductionStatus[] {
  return VALID_TRANSITIONS[currentStatus] || [];
}

// ============================================================
// FULFILLMENT MANAGER CLASS
// ============================================================

export class FulfillmentManager {
  /**
   * Create initial fulfillment status for new order
   */
  static createInitialStatus(
    orderId: string,
    orderNumber: string,
    fulfillmentType: FulfillmentType
  ): OrderFulfillmentStatus {
    const now = new Date().toISOString();
    
    return {
      orderId,
      orderNumber,
      productionStatus: 'pending',
      fulfillmentType,
      changeLock: {
        locked: false,
      },
      createdAt: now,
      updatedAt: now,
    };
  }
  
  /**
   * Start production (locks the order)
   */
  static startProduction(
    status: OrderFulfillmentStatus,
    triggeredBy: string = 'system'
  ): {
    status: OrderFulfillmentStatus;
    event: StatusTransitionEvent;
  } {
    // Validate transition
    if (!isValidTransition(status.productionStatus, 'in-production')) {
      throw new Error(
        `Cannot start production: invalid transition from ${status.productionStatus} to in-production`
      );
    }
    
    // Check if already locked
    if (status.changeLock.locked) {
      throw new Error('Order is already locked – production may have started');
    }
    
    const now = new Date().toISOString();
    
    // Create transition event
    const event: StatusTransitionEvent = {
      orderId: status.orderId,
      fromStatus: status.productionStatus,
      toStatus: 'in-production',
      timestamp: now,
      triggeredBy,
      reason: 'Production started',
    };
    
    // Update status
    const updatedStatus: OrderFulfillmentStatus = {
      ...status,
      productionStatus: 'in-production',
      productionStartedAt: now,
      changeLock: {
        locked: true,
        lockedAt: now,
        lockedBy: triggeredBy,
        lockReason: 'Production started – no changes allowed',
        allowedChanges: [], // No changes allowed
      },
      updatedAt: now,
    };
    
    return { status: updatedStatus, event };
  }
  
  /**
   * Complete production
   */
  static completeProduction(
    status: OrderFulfillmentStatus,
    triggeredBy: string = 'system'
  ): {
    status: OrderFulfillmentStatus;
    event: StatusTransitionEvent;
  } {
    // Validate transition (in-production → quality-check)
    if (!isValidTransition(status.productionStatus, 'quality-check')) {
      throw new Error(
        `Cannot complete production: invalid transition from ${status.productionStatus}`
      );
    }
    
    const now = new Date().toISOString();
    
    const event: StatusTransitionEvent = {
      orderId: status.orderId,
      fromStatus: status.productionStatus,
      toStatus: 'quality-check',
      timestamp: now,
      triggeredBy,
      reason: 'Production completed – entering quality check',
    };
    
    const updatedStatus: OrderFulfillmentStatus = {
      ...status,
      productionStatus: 'quality-check',
      productionCompletedAt: now,
      updatedAt: now,
      metadata: {
        ...status.metadata,
        qualityCheckStatus: 'pending',
      },
    };
    
    return { status: updatedStatus, event };
  }
  
  /**
   * Approve quality check
   */
  static approveQualityCheck(
    status: OrderFulfillmentStatus,
    triggeredBy: string = 'system'
  ): {
    status: OrderFulfillmentStatus;
    event: StatusTransitionEvent;
  } {
    // Validate transition (quality-check → completed)
    if (!isValidTransition(status.productionStatus, 'completed')) {
      throw new Error(
        `Cannot approve quality: invalid transition from ${status.productionStatus}`
      );
    }
    
    const now = new Date().toISOString();
    
    const event: StatusTransitionEvent = {
      orderId: status.orderId,
      fromStatus: status.productionStatus,
      toStatus: 'completed',
      timestamp: now,
      triggeredBy,
      reason: 'Quality check passed',
    };
    
    const updatedStatus: OrderFulfillmentStatus = {
      ...status,
      productionStatus: 'completed',
      updatedAt: now,
      metadata: {
        ...status.metadata,
        qualityCheckStatus: 'passed',
      },
    };
    
    return { status: updatedStatus, event };
  }
  
  /**
   * Fail quality check (send back to production)
   */
  static failQualityCheck(
    status: OrderFulfillmentStatus,
    triggeredBy: string,
    reason: string
  ): {
    status: OrderFulfillmentStatus;
    event: StatusTransitionEvent;
  } {
    // Validate transition (quality-check → in-production)
    if (!isValidTransition(status.productionStatus, 'in-production')) {
      throw new Error(
        `Cannot fail quality: invalid transition from ${status.productionStatus}`
      );
    }
    
    const now = new Date().toISOString();
    
    const event: StatusTransitionEvent = {
      orderId: status.orderId,
      fromStatus: status.productionStatus,
      toStatus: 'in-production',
      timestamp: now,
      triggeredBy,
      reason: `Quality check failed: ${reason}`,
    };
    
    const updatedStatus: OrderFulfillmentStatus = {
      ...status,
      productionStatus: 'in-production',
      productionCompletedAt: undefined, // Reset completion time
      updatedAt: now,
      metadata: {
        ...status.metadata,
        qualityCheckStatus: 'failed',
        productionNotes: [
          ...(status.metadata?.productionNotes || []),
          `Quality check failed: ${reason}`,
        ],
      },
    };
    
    return { status: updatedStatus, event };
  }
  
  /**
   * Mark as shipped
   */
  static markAsShipped(
    status: OrderFulfillmentStatus,
    shippingProvider: string,
    trackingNumber: string,
    triggeredBy: string = 'system'
  ): {
    status: OrderFulfillmentStatus;
    event: StatusTransitionEvent;
  } {
    // Validate transition (completed → shipped)
    if (!isValidTransition(status.productionStatus, 'shipped')) {
      throw new Error(
        `Cannot mark as shipped: invalid transition from ${status.productionStatus}`
      );
    }
    
    const now = new Date().toISOString();
    
    const event: StatusTransitionEvent = {
      orderId: status.orderId,
      fromStatus: status.productionStatus,
      toStatus: 'shipped',
      timestamp: now,
      triggeredBy,
      reason: 'Order shipped',
      metadata: {
        shippingProvider,
        trackingNumber,
      },
    };
    
    const updatedStatus: OrderFulfillmentStatus = {
      ...status,
      productionStatus: 'shipped',
      updatedAt: now,
      metadata: {
        ...status.metadata,
        shippingProvider,
        trackingNumber,
      },
    };
    
    return { status: updatedStatus, event };
  }
  
  /**
   * Mark as delivered
   */
  static markAsDelivered(
    status: OrderFulfillmentStatus,
    triggeredBy: string = 'system'
  ): {
    status: OrderFulfillmentStatus;
    event: StatusTransitionEvent;
  } {
    // Validate transition (shipped → delivered)
    if (!isValidTransition(status.productionStatus, 'delivered')) {
      throw new Error(
        `Cannot mark as delivered: invalid transition from ${status.productionStatus}`
      );
    }
    
    const now = new Date().toISOString();
    
    const event: StatusTransitionEvent = {
      orderId: status.orderId,
      fromStatus: status.productionStatus,
      toStatus: 'delivered',
      timestamp: now,
      triggeredBy,
      reason: 'Order delivered',
    };
    
    const updatedStatus: OrderFulfillmentStatus = {
      ...status,
      productionStatus: 'delivered',
      updatedAt: now,
    };
    
    return { status: updatedStatus, event };
  }
  
  /**
   * Cancel order
   */
  static cancelOrder(
    status: OrderFulfillmentStatus,
    triggeredBy: string,
    reason: string
  ): {
    status: OrderFulfillmentStatus;
    event: StatusTransitionEvent;
  } {
    // Check if cancellation is allowed
    if (status.changeLock.locked && status.productionStatus !== 'pending') {
      throw new Error(
        'Cannot cancel order: production has started and order is locked'
      );
    }
    
    const now = new Date().toISOString();
    
    const event: StatusTransitionEvent = {
      orderId: status.orderId,
      fromStatus: status.productionStatus,
      toStatus: 'cancelled',
      timestamp: now,
      triggeredBy,
      reason,
    };
    
    const updatedStatus: OrderFulfillmentStatus = {
      ...status,
      productionStatus: 'cancelled',
      updatedAt: now,
    };
    
    return { status: updatedStatus, event };
  }
  
  /**
   * Check if order can be modified
   */
  static canModifyOrder(status: OrderFulfillmentStatus): boolean {
    return !status.changeLock.locked;
  }
  
  /**
   * Check if specific field can be changed
   */
  static canChangeField(
    status: OrderFulfillmentStatus,
    fieldName: string
  ): boolean {
    if (!status.changeLock.locked) {
      return true; // All fields can be changed if not locked
    }
    
    if (!status.changeLock.allowedChanges) {
      return false; // No changes allowed
    }
    
    return status.changeLock.allowedChanges.includes(fieldName);
  }
  
  /**
   * Get human-readable status description
   */
  static getStatusDescription(
    status: ProductionStatus,
    locale: string = 'de-DE'
  ): string {
    const descriptions: Record<string, Record<ProductionStatus, string>> = {
      'de-DE': {
        'pending': 'Warten auf Produktionsstart',
        'in-production': 'In Produktion',
        'quality-check': 'Qualitätsprüfung',
        'completed': 'Produktion abgeschlossen',
        'shipped': 'Versendet',
        'delivered': 'Zugestellt',
        'cancelled': 'Storniert',
      },
      'en-US': {
        'pending': 'Waiting for production start',
        'in-production': 'In production',
        'quality-check': 'Quality check',
        'completed': 'Production completed',
        'shipped': 'Shipped',
        'delivered': 'Delivered',
        'cancelled': 'Cancelled',
      },
    };
    
    return descriptions[locale]?.[status] || descriptions['en-US'][status];
  }
}

// ============================================================
// HELPER FUNCTIONS
// ============================================================

/**
 * Determine fulfillment type from cart items
 */
export function determineFulfillmentType(
  cartItems: Array<{ type: string }>
): FulfillmentType {
  const hasCustom = cartItems.some(item => item.type === 'CONFIGURATOR_DESIGN');
  const hasStandard = cartItems.some(item => item.type !== 'CONFIGURATOR_DESIGN');
  
  if (hasCustom && hasStandard) {
    return 'mixed';
  } else if (hasCustom) {
    return 'custom';
  } else {
    return 'standard';
  }
}

/**
 * Calculate production duration (for metrics)
 */
export function calculateProductionDuration(
  status: OrderFulfillmentStatus
): number | null {
  if (!status.productionStartedAt || !status.productionCompletedAt) {
    return null;
  }
  
  const startTime = new Date(status.productionStartedAt).getTime();
  const endTime = new Date(status.productionCompletedAt).getTime();
  
  return endTime - startTime; // Duration in milliseconds
}

/**
 * Format production duration
 */
export function formatProductionDuration(durationMs: number): string {
  const hours = Math.floor(durationMs / (1000 * 60 * 60));
  const days = Math.floor(hours / 24);
  
  if (days > 0) {
    return `${days} Tag${days > 1 ? 'e' : ''}`;
  } else {
    return `${hours} Stunde${hours > 1 ? 'n' : ''}`;
  }
}

// ============================================================
// EXPORTS
// ============================================================

export type {
  OrderFulfillmentStatus,
  StatusTransitionEvent,
  ChangeLockStatus,
};
