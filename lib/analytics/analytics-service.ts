/**
 * ANALYTICS SERVICE – PHASE 7
 * 
 * Centralized analytics service for configurator event tracking.
 * Manages session lifecycle, event buffering, and API communication.
 * 
 * Purpose:
 * - Track configurator events in real-time
 * - Manage anonymous session IDs
 * - Buffer events for batch sending
 * - Handle offline scenarios
 * - Privacy-compliant (no personal data)
 * 
 * @module lib/analytics/analytics-service
 */

import type {
  ConfiguratorEvent,
  ConfiguratorEventType,
  SessionMetrics,
} from './configurator-events';
import {
  createConfiguratorOpenedEvent,
  createComponentSelectedEvent,
  createPriceChangedEvent,
  createDesignSavedEvent,
  createAddToCartEvent,
  createCheckoutStartedEvent,
  createCheckoutCompletedEvent,
  createCheckoutAbandonedEvent,
  validateEvent,
  sanitizeEvent,
} from './configurator-events';

// ============================================================
// CONFIGURATION
// ============================================================

interface AnalyticsConfig {
  enabled: boolean;
  apiEndpoint: string;
  batchSize: number;              // Events to batch before sending
  flushInterval: number;          // Milliseconds to wait before auto-flush
  retryAttempts: number;
  retryDelay: number;             // Milliseconds
  debug: boolean;
}

const DEFAULT_CONFIG: AnalyticsConfig = {
  enabled: true,
  apiEndpoint: '/api/analytics/events',
  batchSize: 10,
  flushInterval: 5000,            // 5 seconds
  retryAttempts: 3,
  retryDelay: 1000,               // 1 second
  debug: false,
};

// ============================================================
// SESSION MANAGEMENT
// ============================================================

/**
 * Generate anonymous session ID
 * Format: SESS-{timestamp}-{random}
 */
function generateSessionId(): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 12).toUpperCase();
  return `SESS-${timestamp}-${random}`;
}

/**
 * Get or create session ID (stored in sessionStorage)
 */
function getSessionId(): string {
  if (typeof window === 'undefined') {
    return generateSessionId(); // Server-side fallback
  }
  
  const SESSION_KEY = 'configurator_session_id';
  
  try {
    let sessionId = sessionStorage.getItem(SESSION_KEY);
    
    if (!sessionId) {
      sessionId = generateSessionId();
      sessionStorage.setItem(SESSION_KEY, sessionId);
    }
    
    return sessionId;
  } catch (error) {
    // sessionStorage not available (private browsing)
    console.warn('sessionStorage not available, using temporary session');
    return generateSessionId();
  }
}

/**
 * Clear session (for testing or explicit session end)
 */
function clearSession(): void {
  if (typeof window === 'undefined') return;
  
  try {
    sessionStorage.removeItem('configurator_session_id');
  } catch (error) {
    console.warn('Could not clear session:', error);
  }
}

// ============================================================
// ANALYTICS SERVICE CLASS
// ============================================================

export class AnalyticsService {
  private config: AnalyticsConfig;
  private sessionId: string;
  private eventBuffer: ConfiguratorEvent[] = [];
  private flushTimer: NodeJS.Timeout | null = null;
  private sessionStartTime: number = Date.now();
  
  constructor(config: Partial<AnalyticsConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.sessionId = getSessionId();
    
    if (this.config.debug) {
      console.log('[Analytics] Initialized with session:', this.sessionId);
    }
    
    // Setup auto-flush
    this.setupAutoFlush();
    
    // Setup beforeunload handler
    this.setupUnloadHandler();
  }
  
  /**
   * Get current session ID
   */
  getSessionId(): string {
    return this.sessionId;
  }
  
  /**
   * Track event
   */
  async track(event: ConfiguratorEvent): Promise<void> {
    if (!this.config.enabled) return;
    
    // Validate event
    if (!validateEvent(event)) {
      console.warn('[Analytics] Invalid event, skipping:', event);
      return;
    }
    
    // Sanitize event (remove personal data)
    const sanitizedEvent = sanitizeEvent(event);
    
    // Add to buffer
    this.eventBuffer.push(sanitizedEvent);
    
    if (this.config.debug) {
      console.log('[Analytics] Event tracked:', sanitizedEvent);
    }
    
    // Check if buffer should be flushed
    if (this.eventBuffer.length >= this.config.batchSize) {
      await this.flush();
    }
  }
  
  /**
   * Flush event buffer to API
   */
  async flush(): Promise<void> {
    if (this.eventBuffer.length === 0) return;
    
    const eventsToSend = [...this.eventBuffer];
    this.eventBuffer = [];
    
    // Clear auto-flush timer
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }
    
    // Send to API
    await this.sendEvents(eventsToSend);
    
    // Restart auto-flush timer
    this.setupAutoFlush();
  }
  
  /**
   * Send events to API with retry logic
   */
  private async sendEvents(events: ConfiguratorEvent[], attempt: number = 0): Promise<void> {
    try {
      const response = await fetch(this.config.apiEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ events }),
      });
      
      if (!response.ok) {
        throw new Error(`API returned ${response.status}`);
      }
      
      if (this.config.debug) {
        console.log(`[Analytics] Sent ${events.length} events to API`);
      }
    } catch (error) {
      console.error('[Analytics] Failed to send events:', error);
      
      // Retry logic
      if (attempt < this.config.retryAttempts) {
        if (this.config.debug) {
          console.log(`[Analytics] Retrying (${attempt + 1}/${this.config.retryAttempts})...`);
        }
        
        await new Promise(resolve => setTimeout(resolve, this.config.retryDelay));
        await this.sendEvents(events, attempt + 1);
      } else {
        console.error('[Analytics] Max retries reached, events lost:', events.length);
      }
    }
  }
  
  /**
   * Setup auto-flush timer
   */
  private setupAutoFlush(): void {
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
    }
    
    this.flushTimer = setTimeout(() => {
      this.flush();
    }, this.config.flushInterval);
  }
  
  /**
   * Setup beforeunload handler (flush on page exit)
   */
  private setupUnloadHandler(): void {
    if (typeof window === 'undefined') return;
    
    window.addEventListener('beforeunload', () => {
      // Flush immediately using sendBeacon (more reliable than fetch)
      if (this.eventBuffer.length > 0 && navigator.sendBeacon) {
        const eventsToSend = [...this.eventBuffer];
        const blob = new Blob(
          [JSON.stringify({ events: eventsToSend })],
          { type: 'application/json' }
        );
        navigator.sendBeacon(this.config.apiEndpoint, blob);
        this.eventBuffer = [];
      }
    });
  }
  
  // ============================================================
  // CONVENIENCE METHODS
  // ============================================================
  
  /**
   * Track configurator opened
   */
  async trackConfiguratorOpened(
    productId: string,
    baseProductSku?: string
  ): Promise<void> {
    const event = createConfiguratorOpenedEvent(
      this.sessionId,
      productId,
      baseProductSku
    );
    await this.track(event);
  }
  
  /**
   * Track component selected
   */
  async trackComponentSelected(
    productId: string,
    componentId: string,
    componentName: string,
    componentCategory: 'material' | 'finish' | 'addon',
    isPremium: boolean,
    priceDelta: number,
    currentPrice: { net: number; gross: number; currency: string },
    selectedComponentCount: number,
    hasPremiumComponents: boolean
  ): Promise<void> {
    const event = createComponentSelectedEvent(
      this.sessionId,
      productId,
      componentId,
      componentName,
      componentCategory,
      isPremium,
      priceDelta,
      currentPrice,
      selectedComponentCount,
      hasPremiumComponents
    );
    await this.track(event);
  }
  
  /**
   * Track price changed
   */
  async trackPriceChanged(
    productId: string,
    previousPrice: { net: number; gross: number },
    currentPrice: { net: number; gross: number; currency: string },
    selectedComponentCount: number,
    hasPremiumComponents: boolean,
    triggerAction: string
  ): Promise<void> {
    const event = createPriceChangedEvent(
      this.sessionId,
      productId,
      previousPrice,
      currentPrice,
      selectedComponentCount,
      hasPremiumComponents,
      triggerAction
    );
    await this.track(event);
  }
  
  /**
   * Track design saved
   */
  async trackDesignSaved(
    productId: string,
    designId: string,
    componentIds: string[],
    currentPrice: { net: number; gross: number; currency: string },
    hasPremiumComponents: boolean,
    saveMethod: 'auto' | 'manual' | 'share' = 'manual'
  ): Promise<void> {
    const event = createDesignSavedEvent(
      this.sessionId,
      productId,
      designId,
      componentIds,
      currentPrice,
      hasPremiumComponents,
      saveMethod
    );
    await this.track(event);
  }
  
  /**
   * Track added to cart
   */
  async trackAddedToCart(
    productId: string,
    designId: string,
    quantity: number,
    currentPrice: { net: number; gross: number; currency: string },
    selectedComponentCount: number,
    hasPremiumComponents: boolean
  ): Promise<void> {
    const timeInConfigurator = Math.floor((Date.now() - this.sessionStartTime) / 1000);
    
    const event = createAddToCartEvent(
      this.sessionId,
      productId,
      designId,
      quantity,
      currentPrice,
      selectedComponentCount,
      hasPremiumComponents,
      timeInConfigurator
    );
    await this.track(event);
  }
  
  /**
   * Track checkout started
   */
  async trackCheckoutStarted(
    productId: string,
    currentPrice: { net: number; gross: number; currency: string },
    selectedComponentCount: number,
    hasPremiumComponents: boolean
  ): Promise<void> {
    const event = createCheckoutStartedEvent(
      this.sessionId,
      productId,
      currentPrice,
      selectedComponentCount,
      hasPremiumComponents
    );
    await this.track(event);
  }
  
  /**
   * Track checkout completed
   */
  async trackCheckoutCompleted(
    productId: string,
    orderId: string,
    orderValue: number,
    currentPrice: { net: number; gross: number; currency: string },
    selectedComponentCount: number,
    hasPremiumComponents: boolean,
    checkoutDuration?: number
  ): Promise<void> {
    const event = createCheckoutCompletedEvent(
      this.sessionId,
      productId,
      orderId,
      orderValue,
      currentPrice,
      selectedComponentCount,
      hasPremiumComponents,
      checkoutDuration
    );
    await this.track(event);
    
    // Flush immediately on conversion
    await this.flush();
  }
  
  /**
   * Track checkout abandoned
   */
  async trackCheckoutAbandoned(
    productId: string,
    currentPrice: { net: number; gross: number; currency: string },
    selectedComponentCount: number,
    hasPremiumComponents: boolean,
    abandonmentReason?: string,
    checkoutDuration?: number
  ): Promise<void> {
    const event = createCheckoutAbandonedEvent(
      this.sessionId,
      productId,
      currentPrice,
      selectedComponentCount,
      hasPremiumComponents,
      abandonmentReason,
      checkoutDuration
    );
    await this.track(event);
    
    // Flush immediately on abandonment
    await this.flush();
  }
}

// ============================================================
// SINGLETON INSTANCE
// ============================================================

let analyticsInstance: AnalyticsService | null = null;

/**
 * Get or create analytics service instance
 */
export function getAnalytics(config?: Partial<AnalyticsConfig>): AnalyticsService {
  if (!analyticsInstance) {
    analyticsInstance = new AnalyticsService(config);
  }
  return analyticsInstance;
}

/**
 * Initialize analytics (call once in app)
 */
export function initializeAnalytics(config?: Partial<AnalyticsConfig>): AnalyticsService {
  analyticsInstance = new AnalyticsService(config);
  return analyticsInstance;
}

/**
 * Clear analytics instance (for testing)
 */
export function clearAnalytics(): void {
  if (analyticsInstance) {
    analyticsInstance.flush();
    analyticsInstance = null;
  }
  clearSession();
}

// ============================================================
// EXPORTS
// ============================================================

export { generateSessionId, getSessionId, clearSession };
export type { AnalyticsConfig };
