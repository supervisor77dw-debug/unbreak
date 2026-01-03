/**
 * ABANDONMENT TRACKER – PHASE 7
 * 
 * Track and analyze session abandonment patterns.
 * Identifies drop-off points and reasons for non-conversion.
 * 
 * Purpose:
 * - Detect when users leave configurator without completing
 * - Capture last action before exit
 * - Record price at abandonment
 * - Calculate time spent in configurator
 * - Identify high-friction points
 * 
 * @module lib/analytics/abandonment-tracker
 */

import type {
  ConfiguratorEvent,
  ConfiguratorEventType,
  AbandonmentData,
  SessionMetrics,
} from './configurator-events';
import { aggregateSessionMetrics } from './configurator-events';

// ============================================================
// TYPE DEFINITIONS
// ============================================================

/**
 * Abandonment reasons (auto-detected or manual)
 */
export type AbandonmentReason =
  | 'price_too_high'          // Price exceeded threshold
  | 'long_decision_time'      // Spent too long without action
  | 'navigation_away'         // Left to another page
  | 'session_timeout'         // Inactive for too long
  | 'checkout_friction'       // Issues in checkout
  | 'payment_failed'          // Payment issue
  | 'unknown';                // Default

/**
 * Abandonment detection config
 */
export interface AbandonmentConfig {
  inactivityTimeout: number;     // Milliseconds of inactivity = abandonment
  priceThreshold: number;        // Price above this = "price_too_high"
  longDecisionTime: number;      // Seconds = "long_decision_time"
  trackPageVisibility: boolean;  // Use Page Visibility API
}

/**
 * Abandonment event
 */
export interface AbandonmentEvent {
  sessionId: string;
  abandonmentType: 'soft' | 'hard';  // Soft = navigated away, Hard = closed tab
  reason: AbandonmentReason;
  lastAction: ConfiguratorEventType;
  lastActionTimestamp: string;
  priceAtExit: number;
  timeInConfigurator: number;        // Seconds
  selectedComponentCount: number;
  hasPremiumComponents: boolean;
  exitPath?: string;                 // Where user went (if navigated)
  detectedAt: string;                // ISO timestamp
}

// ============================================================
// DEFAULT CONFIG
// ============================================================

const DEFAULT_CONFIG: AbandonmentConfig = {
  inactivityTimeout: 180000,      // 3 minutes
  priceThreshold: 200,            // €200
  longDecisionTime: 600,          // 10 minutes
  trackPageVisibility: true,
};

// ============================================================
// ABANDONMENT TRACKER CLASS
// ============================================================

export class AbandonmentTracker {
  private config: AbandonmentConfig;
  private sessionId: string;
  private events: ConfiguratorEvent[] = [];
  private lastActivityTime: number = Date.now();
  private sessionStartTime: number = Date.now();
  private inactivityTimer: NodeJS.Timeout | null = null;
  private isActive: boolean = true;
  private onAbandonmentCallback?: (event: AbandonmentEvent) => void;
  
  constructor(
    sessionId: string,
    config: Partial<AbandonmentConfig> = {},
    onAbandonment?: (event: AbandonmentEvent) => void
  ) {
    this.sessionId = sessionId;
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.onAbandonmentCallback = onAbandonment;
    
    this.setupInactivityDetection();
    
    if (this.config.trackPageVisibility) {
      this.setupVisibilityTracking();
    }
    
    this.setupUnloadTracking();
  }
  
  /**
   * Record event
   */
  recordEvent(event: ConfiguratorEvent): void {
    this.events.push(event);
    this.lastActivityTime = Date.now();
    
    // Reset inactivity timer
    this.resetInactivityTimer();
  }
  
  /**
   * Get current session metrics
   */
  getSessionMetrics(): SessionMetrics | null {
    return aggregateSessionMetrics(this.events);
  }
  
  /**
   * Detect abandonment reason
   */
  private detectAbandonmentReason(): AbandonmentReason {
    if (this.events.length === 0) {
      return 'unknown';
    }
    
    const metrics = this.getSessionMetrics();
    if (!metrics) return 'unknown';
    
    // Price too high
    if (metrics.endPrice > this.config.priceThreshold) {
      return 'price_too_high';
    }
    
    // Long decision time (no action for a while)
    const timeSinceLastAction = Math.floor((Date.now() - this.lastActivityTime) / 1000);
    if (timeSinceLastAction > this.config.longDecisionTime) {
      return 'long_decision_time';
    }
    
    // Session timeout (inactivity)
    if (timeSinceLastAction > this.config.inactivityTimeout / 1000) {
      return 'session_timeout';
    }
    
    // Check if in checkout
    if (metrics.startedCheckout && !metrics.completedCheckout) {
      return 'checkout_friction';
    }
    
    return 'unknown';
  }
  
  /**
   * Create abandonment event
   */
  private createAbandonmentEvent(
    abandonmentType: 'soft' | 'hard',
    exitPath?: string
  ): AbandonmentEvent | null {
    if (this.events.length === 0) return null;
    
    const metrics = this.getSessionMetrics();
    if (!metrics) return null;
    
    const lastEvent = this.events[this.events.length - 1];
    const lastEventMeta = (lastEvent as any).eventType || lastEvent.metadata?.eventType;
    
    return {
      sessionId: this.sessionId,
      abandonmentType,
      reason: this.detectAbandonmentReason(),
      lastAction: lastEventMeta,
      lastActionTimestamp: lastEvent.timestamp,
      priceAtExit: lastEvent.currentPrice.net,
      timeInConfigurator: Math.floor((Date.now() - this.sessionStartTime) / 1000),
      selectedComponentCount: lastEvent.selectedComponentCount,
      hasPremiumComponents: lastEvent.hasPremiumComponents,
      exitPath,
      detectedAt: new Date().toISOString(),
    };
  }
  
  /**
   * Trigger abandonment callback
   */
  private triggerAbandonment(
    abandonmentType: 'soft' | 'hard',
    exitPath?: string
  ): void {
    const event = this.createAbandonmentEvent(abandonmentType, exitPath);
    
    if (event && this.onAbandonmentCallback) {
      this.onAbandonmentCallback(event);
    }
  }
  
  /**
   * Setup inactivity detection
   */
  private setupInactivityDetection(): void {
    this.resetInactivityTimer();
  }
  
  /**
   * Reset inactivity timer
   */
  private resetInactivityTimer(): void {
    if (this.inactivityTimer) {
      clearTimeout(this.inactivityTimer);
    }
    
    this.inactivityTimer = setTimeout(() => {
      if (this.isActive) {
        // User inactive for too long
        this.triggerAbandonment('soft', 'inactivity');
        this.isActive = false;
      }
    }, this.config.inactivityTimeout);
  }
  
  /**
   * Setup page visibility tracking
   */
  private setupVisibilityTracking(): void {
    if (typeof document === 'undefined') return;
    
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        // User switched tab/minimized window
        this.triggerAbandonment('soft', 'tab-hidden');
      } else {
        // User returned
        this.isActive = true;
        this.lastActivityTime = Date.now();
        this.resetInactivityTimer();
      }
    });
  }
  
  /**
   * Setup unload tracking (hard abandonment)
   */
  private setupUnloadTracking(): void {
    if (typeof window === 'undefined') return;
    
    window.addEventListener('beforeunload', (event) => {
      // Check if user completed checkout
      const metrics = this.getSessionMetrics();
      if (metrics && !metrics.completedCheckout && metrics.totalEvents > 1) {
        // Hard abandonment (closing tab/window)
        this.triggerAbandonment('hard', 'window-closed');
      }
    });
    
    // Track navigation away from configurator
    window.addEventListener('popstate', () => {
      const metrics = this.getSessionMetrics();
      if (metrics && !metrics.completedCheckout && metrics.totalEvents > 1) {
        this.triggerAbandonment('soft', 'navigation-back');
      }
    });
  }
  
  /**
   * Destroy tracker (cleanup)
   */
  destroy(): void {
    if (this.inactivityTimer) {
      clearTimeout(this.inactivityTimer);
    }
  }
}

// ============================================================
// ABANDONMENT ANALYSIS
// ============================================================

/**
 * Analyze abandonment patterns from multiple sessions
 */
export interface AbandonmentAnalysis {
  totalSessions: number;
  totalAbandonments: number;
  abandonmentRate: number;              // Percentage
  
  // By reason
  abandonmentByReason: Record<AbandonmentReason, number>;
  
  // By stage
  abandonmentByStage: Record<ConfiguratorEventType, number>;
  
  // Price analysis
  averagePriceAtAbandonment: number;
  priceThresholdExceeded: number;       // Count
  
  // Time analysis
  averageTimeToAbandonment: number;     // Seconds
  shortSessions: number;                // < 30 seconds
  longSessions: number;                 // > 10 minutes
  
  // Component analysis
  averageComponentsAtAbandonment: number;
  hadPremiumComponents: number;         // Count
}

/**
 * Analyze abandonment events
 */
export function analyzeAbandonment(
  abandonmentEvents: AbandonmentEvent[]
): AbandonmentAnalysis {
  const totalAbandonments = abandonmentEvents.length;
  
  if (totalAbandonments === 0) {
    return {
      totalSessions: 0,
      totalAbandonments: 0,
      abandonmentRate: 0,
      abandonmentByReason: {} as any,
      abandonmentByStage: {} as any,
      averagePriceAtAbandonment: 0,
      priceThresholdExceeded: 0,
      averageTimeToAbandonment: 0,
      shortSessions: 0,
      longSessions: 0,
      averageComponentsAtAbandonment: 0,
      hadPremiumComponents: 0,
    };
  }
  
  // By reason
  const abandonmentByReason: Record<AbandonmentReason, number> = {
    price_too_high: 0,
    long_decision_time: 0,
    navigation_away: 0,
    session_timeout: 0,
    checkout_friction: 0,
    payment_failed: 0,
    unknown: 0,
  };
  
  for (const event of abandonmentEvents) {
    abandonmentByReason[event.reason]++;
  }
  
  // By stage
  const abandonmentByStage: Record<string, number> = {};
  for (const event of abandonmentEvents) {
    const stage = event.lastAction;
    abandonmentByStage[stage] = (abandonmentByStage[stage] || 0) + 1;
  }
  
  // Price analysis
  const prices = abandonmentEvents.map(e => e.priceAtExit);
  const averagePriceAtAbandonment = prices.reduce((sum, p) => sum + p, 0) / prices.length;
  const priceThresholdExceeded = prices.filter(p => p > 200).length;
  
  // Time analysis
  const times = abandonmentEvents.map(e => e.timeInConfigurator);
  const averageTimeToAbandonment = times.reduce((sum, t) => sum + t, 0) / times.length;
  const shortSessions = times.filter(t => t < 30).length;
  const longSessions = times.filter(t => t > 600).length;
  
  // Component analysis
  const componentCounts = abandonmentEvents.map(e => e.selectedComponentCount);
  const averageComponentsAtAbandonment = 
    componentCounts.reduce((sum, c) => sum + c, 0) / componentCounts.length;
  const hadPremiumComponents = abandonmentEvents.filter(e => e.hasPremiumComponents).length;
  
  return {
    totalSessions: totalAbandonments, // Assuming 1 abandonment per session
    totalAbandonments,
    abandonmentRate: 100, // 100% of these sessions abandoned
    abandonmentByReason,
    abandonmentByStage: abandonmentByStage as any,
    averagePriceAtAbandonment,
    priceThresholdExceeded,
    averageTimeToAbandonment,
    shortSessions,
    longSessions,
    averageComponentsAtAbandonment,
    hadPremiumComponents,
  };
}

/**
 * Get top abandonment reasons
 */
export function getTopAbandonmentReasons(
  analysis: AbandonmentAnalysis,
  limit: number = 3
): Array<{ reason: AbandonmentReason; count: number; percentage: number }> {
  const reasons = Object.entries(analysis.abandonmentByReason)
    .map(([reason, count]) => ({
      reason: reason as AbandonmentReason,
      count,
      percentage: (count / analysis.totalAbandonments) * 100,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
  
  return reasons;
}

/**
 * Get critical drop-off stages
 */
export function getCriticalDropOffStages(
  analysis: AbandonmentAnalysis,
  limit: number = 3
): Array<{ stage: ConfiguratorEventType; count: number; percentage: number }> {
  const stages = Object.entries(analysis.abandonmentByStage)
    .map(([stage, count]) => ({
      stage: stage as ConfiguratorEventType,
      count,
      percentage: (count / analysis.totalAbandonments) * 100,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
  
  return stages;
}

// ============================================================
// EXPORTS
// ============================================================

export type {
  AbandonmentReason,
  AbandonmentConfig,
  AbandonmentEvent,
  AbandonmentAnalysis,
};
