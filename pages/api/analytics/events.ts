/**
 * ANALYTICS API ENDPOINTS – PHASE 7
 * 
 * API endpoints for collecting and retrieving configurator analytics data.
 * Handles event ingestion, session aggregation, and dashboard metrics.
 * 
 * Endpoints:
 * - POST /api/analytics/events - Ingest configurator events
 * - GET /api/analytics/dashboard - Get dashboard metrics
 * - GET /api/analytics/sessions/[sessionId] - Get session details
 * 
 * @module pages/api/analytics
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import type {
  ConfiguratorEvent,
  SessionMetrics,
} from '../../../lib/analytics/configurator-events';
import type {
  AbandonmentEvent,
  AbandonmentAnalysis,
} from '../../../lib/analytics/abandonment-tracker';
import {
  validateEvent,
  sanitizeEvent,
  aggregateSessionMetrics,
} from '../../../lib/analytics/configurator-events';
import {
  analyzeAbandonment,
  getTopAbandonmentReasons,
  getCriticalDropOffStages,
} from '../../../lib/analytics/abandonment-tracker';

// ============================================================
// TYPE DEFINITIONS
// ============================================================

interface EventsRequest {
  events: ConfiguratorEvent[];
}

interface EventsResponse {
  success: boolean;
  received: number;
  errors?: string[];
}

interface DashboardMetrics {
  totalSessions: number;
  completedCheckouts: number;
  conversionRate: number;
  openedConfigurator: number;
  selectedComponents: number;
  selectedPremium: number;
  savedDesign: number;
  addedToCart: number;
  startedCheckout: number;
  premiumAttachRate: number;
  averagePremiumComponentsPerOrder: number;
  averageConfigurationValue: number;
  averageOrderValue: number;
  priceIncreaseDuringSession: number;
  totalAbandonments: number;
  abandonmentRate: number;
  topAbandonmentReasons: Array<{
    reason: string;
    count: number;
    percentage: number;
  }>;
  criticalDropOffStages: Array<{
    stage: string;
    count: number;
    percentage: number;
  }>;
  averageTimeToConversion: number;
  averageTimeToAbandonment: number;
}

interface ProductMetrics {
  productId: string;
  productName: string;
  sessions: number;
  conversions: number;
  conversionRate: number;
  averageValue: number;
  premiumAttachRate: number;
}

interface DashboardResponse {
  success: boolean;
  metrics: DashboardMetrics;
  productMetrics: ProductMetrics[];
}

// ============================================================
// EVENT INGESTION ENDPOINT
// ============================================================

/**
 * POST /api/analytics/events
 * Collect configurator events
 */
export async function handleEventsIngestion(
  req: NextApiRequest,
  res: NextApiResponse<EventsResponse>
) {
  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      received: 0,
      errors: ['Method not allowed'],
    });
  }
  
  try {
    const { events } = req.body as EventsRequest;
    
    if (!Array.isArray(events) || events.length === 0) {
      return res.status(400).json({
        success: false,
        received: 0,
        errors: ['No events provided'],
      });
    }
    
    const errors: string[] = [];
    const validEvents: ConfiguratorEvent[] = [];
    
    // Validate and sanitize events
    for (let i = 0; i < events.length; i++) {
      const event = events[i];
      
      if (!validateEvent(event)) {
        errors.push(`Event ${i} failed validation`);
        continue;
      }
      
      const sanitized = sanitizeEvent(event);
      validEvents.push(sanitized);
    }
    
    // Store events in database
    // TODO: Implement database storage
    await storeEvents(validEvents);
    
    return res.status(200).json({
      success: true,
      received: validEvents.length,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error('Event ingestion error:', error);
    return res.status(500).json({
      success: false,
      received: 0,
      errors: [error instanceof Error ? error.message : 'Internal error'],
    });
  }
}

// ============================================================
// DASHBOARD METRICS ENDPOINT
// ============================================================

/**
 * GET /api/analytics/dashboard?range=7days
 * Get aggregated dashboard metrics
 */
export async function handleDashboardMetrics(
  req: NextApiRequest,
  res: NextApiResponse<DashboardResponse>
) {
  if (req.method !== 'GET') {
    return res.status(405).json({
      success: false,
      metrics: {} as any,
      productMetrics: [],
    });
  }
  
  try {
    const { range = '7days' } = req.query;
    
    // Fetch events from database
    // TODO: Implement database query
    const events = await fetchEvents(range as string);
    const abandonmentEvents = await fetchAbandonmentEvents(range as string);
    
    // Calculate metrics
    const metrics = calculateDashboardMetrics(events, abandonmentEvents);
    const productMetrics = calculateProductMetrics(events);
    
    return res.status(200).json({
      success: true,
      metrics,
      productMetrics,
    });
  } catch (error) {
    console.error('Dashboard metrics error:', error);
    return res.status(500).json({
      success: false,
      metrics: {} as any,
      productMetrics: [],
    });
  }
}

// ============================================================
// SESSION DETAILS ENDPOINT
// ============================================================

/**
 * GET /api/analytics/sessions/[sessionId]
 * Get detailed session data
 */
export async function handleSessionDetails(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ success: false });
  }
  
  try {
    const { sessionId } = req.query;
    
    if (!sessionId || typeof sessionId !== 'string') {
      return res.status(400).json({ success: false, error: 'Invalid session ID' });
    }
    
    // Fetch session events
    const events = await fetchSessionEvents(sessionId);
    
    if (events.length === 0) {
      return res.status(404).json({ success: false, error: 'Session not found' });
    }
    
    // Aggregate metrics
    const metrics = aggregateSessionMetrics(events);
    
    return res.status(200).json({
      success: true,
      sessionId,
      events,
      metrics,
    });
  } catch (error) {
    console.error('Session details error:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal error',
    });
  }
}

// ============================================================
// MAIN HANDLER
// ============================================================

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Route based on path
  const path = req.url?.split('?')[0] || '';
  
  if (path.endsWith('/events')) {
    return handleEventsIngestion(req, res);
  } else if (path.endsWith('/dashboard')) {
    return handleDashboardMetrics(req, res);
  } else if (path.includes('/sessions/')) {
    return handleSessionDetails(req, res);
  }
  
  return res.status(404).json({ success: false, error: 'Endpoint not found' });
}

// ============================================================
// CALCULATION HELPERS
// ============================================================

/**
 * Calculate dashboard metrics from events
 */
function calculateDashboardMetrics(
  events: ConfiguratorEvent[],
  abandonmentEvents: AbandonmentEvent[]
): DashboardMetrics {
  // Group events by session
  const sessionMap = new Map<string, ConfiguratorEvent[]>();
  
  for (const event of events) {
    const sessionEvents = sessionMap.get(event.sessionId) || [];
    sessionEvents.push(event);
    sessionMap.set(event.sessionId, sessionEvents);
  }
  
  // Aggregate session metrics
  const allSessionMetrics: SessionMetrics[] = [];
  
  for (const sessionEvents of sessionMap.values()) {
    const metrics = aggregateSessionMetrics(sessionEvents);
    if (metrics) {
      allSessionMetrics.push(metrics);
    }
  }
  
  const totalSessions = allSessionMetrics.length;
  
  if (totalSessions === 0) {
    return getEmptyMetrics();
  }
  
  // Conversion metrics
  const completedCheckouts = allSessionMetrics.filter(m => m.completedCheckout).length;
  const conversionRate = (completedCheckouts / totalSessions) * 100;
  
  // Funnel metrics
  const openedConfigurator = allSessionMetrics.filter(m => m.openedConfigurator).length;
  const selectedComponents = allSessionMetrics.filter(m => m.selectedComponents).length;
  const selectedPremium = allSessionMetrics.filter(m => m.selectedPremium).length;
  const savedDesign = allSessionMetrics.filter(m => m.savedDesign).length;
  const addedToCart = allSessionMetrics.filter(m => m.addedToCart).length;
  const startedCheckout = allSessionMetrics.filter(m => m.startedCheckout).length;
  
  // Premium metrics
  const totalPremiumSelections = allSessionMetrics.reduce(
    (sum, m) => sum + m.premiumComponentSelections,
    0
  );
  const totalComponentSelections = allSessionMetrics.reduce(
    (sum, m) => sum + m.totalComponentSelections,
    0
  );
  const premiumAttachRate = totalComponentSelections > 0
    ? (totalPremiumSelections / totalComponentSelections) * 100
    : 0;
  
  const convertedSessions = allSessionMetrics.filter(m => m.converted);
  const averagePremiumComponentsPerOrder = convertedSessions.length > 0
    ? convertedSessions.reduce((sum, m) => sum + m.premiumComponentSelections, 0) / convertedSessions.length
    : 0;
  
  // Pricing metrics
  const averageConfigurationValue = allSessionMetrics.reduce(
    (sum, m) => sum + m.endPrice,
    0
  ) / totalSessions;
  
  const averageOrderValue = convertedSessions.length > 0
    ? convertedSessions.reduce((sum, m) => sum + (m.orderValue || 0), 0) / convertedSessions.length
    : 0;
  
  const priceIncreaseDuringSession = allSessionMetrics.reduce(
    (sum, m) => sum + m.priceIncrease,
    0
  ) / totalSessions;
  
  // Abandonment metrics
  const totalAbandonments = abandonmentEvents.length;
  const abandonmentRate = totalSessions > 0
    ? (totalAbandonments / totalSessions) * 100
    : 0;
  
  const abandonmentAnalysis = analyzeAbandonment(abandonmentEvents);
  const topAbandonmentReasons = getTopAbandonmentReasons(abandonmentAnalysis, 5);
  const criticalDropOffStages = getCriticalDropOffStages(abandonmentAnalysis, 5);
  
  // Time metrics
  const convertedSessionDurations = convertedSessions.map(m => m.duration);
  const averageTimeToConversion = convertedSessionDurations.length > 0
    ? convertedSessionDurations.reduce((sum, d) => sum + d, 0) / convertedSessionDurations.length
    : 0;
  
  const averageTimeToAbandonment = abandonmentAnalysis.averageTimeToAbandonment || 0;
  
  return {
    totalSessions,
    completedCheckouts,
    conversionRate,
    openedConfigurator,
    selectedComponents,
    selectedPremium,
    savedDesign,
    addedToCart,
    startedCheckout,
    premiumAttachRate,
    averagePremiumComponentsPerOrder,
    averageConfigurationValue,
    averageOrderValue,
    priceIncreaseDuringSession,
    totalAbandonments,
    abandonmentRate,
    topAbandonmentReasons: topAbandonmentReasons.map(r => ({
      reason: r.reason,
      count: r.count,
      percentage: r.percentage,
    })),
    criticalDropOffStages: criticalDropOffStages.map(s => ({
      stage: s.stage,
      count: s.count,
      percentage: s.percentage,
    })),
    averageTimeToConversion,
    averageTimeToAbandonment,
  };
}

/**
 * Calculate product-level metrics
 */
function calculateProductMetrics(events: ConfiguratorEvent[]): ProductMetrics[] {
  // Group by product
  const productMap = new Map<string, ConfiguratorEvent[]>();
  
  for (const event of events) {
    const productEvents = productMap.get(event.productId) || [];
    productEvents.push(event);
    productMap.set(event.productId, productEvents);
  }
  
  const productMetrics: ProductMetrics[] = [];
  
  for (const [productId, productEvents] of productMap.entries()) {
    // Group by session
    const sessionMap = new Map<string, ConfiguratorEvent[]>();
    
    for (const event of productEvents) {
      const sessionEvents = sessionMap.get(event.sessionId) || [];
      sessionEvents.push(event);
      sessionMap.set(event.sessionId, sessionEvents);
    }
    
    // Aggregate
    const sessions = sessionMap.size;
    const sessionMetrics = Array.from(sessionMap.values())
      .map(sessionEvents => aggregateSessionMetrics(sessionEvents))
      .filter((m): m is SessionMetrics => m !== null);
    
    const conversions = sessionMetrics.filter(m => m.converted).length;
    const conversionRate = sessions > 0 ? (conversions / sessions) * 100 : 0;
    
    const averageValue = sessionMetrics.length > 0
      ? sessionMetrics.reduce((sum, m) => sum + m.endPrice, 0) / sessionMetrics.length
      : 0;
    
    const premiumAttachRate = sessionMetrics.length > 0
      ? sessionMetrics.reduce((sum, m) => sum + m.premiumAttachRate, 0) / sessionMetrics.length
      : 0;
    
    productMetrics.push({
      productId,
      productName: getProductName(productId),
      sessions,
      conversions,
      conversionRate,
      averageValue,
      premiumAttachRate,
    });
  }
  
  return productMetrics.sort((a, b) => b.sessions - a.sessions);
}

/**
 * Get empty metrics (no data)
 */
function getEmptyMetrics(): DashboardMetrics {
  return {
    totalSessions: 0,
    completedCheckouts: 0,
    conversionRate: 0,
    openedConfigurator: 0,
    selectedComponents: 0,
    selectedPremium: 0,
    savedDesign: 0,
    addedToCart: 0,
    startedCheckout: 0,
    premiumAttachRate: 0,
    averagePremiumComponentsPerOrder: 0,
    averageConfigurationValue: 0,
    averageOrderValue: 0,
    priceIncreaseDuringSession: 0,
    totalAbandonments: 0,
    abandonmentRate: 0,
    topAbandonmentReasons: [],
    criticalDropOffStages: [],
    averageTimeToConversion: 0,
    averageTimeToAbandonment: 0,
  };
}

/**
 * Get product name from ID (TODO: fetch from database)
 */
function getProductName(productId: string): string {
  // TODO: Fetch from product catalog
  return productId;
}

// ============================================================
// DATABASE HELPERS (TODO: Implement)
// ============================================================

/**
 * Store events in database
 */
async function storeEvents(events: ConfiguratorEvent[]): Promise<void> {
  // TODO: INSERT INTO analytics_events
  console.log(`[Analytics] Storing ${events.length} events (not implemented)`);
}

/**
 * Fetch events for date range
 */
async function fetchEvents(range: string): Promise<ConfiguratorEvent[]> {
  // TODO: SELECT FROM analytics_events WHERE timestamp > ...
  console.warn('[Analytics] fetchEvents not implemented, returning mock data');
  return getMockEvents();
}

/**
 * Fetch abandonment events
 */
async function fetchAbandonmentEvents(range: string): Promise<AbandonmentEvent[]> {
  // TODO: SELECT FROM abandonment_events WHERE timestamp > ...
  console.warn('[Analytics] fetchAbandonmentEvents not implemented, returning mock data');
  return [];
}

/**
 * Fetch events for specific session
 */
async function fetchSessionEvents(sessionId: string): Promise<ConfiguratorEvent[]> {
  // TODO: SELECT FROM analytics_events WHERE session_id = ...
  console.warn('[Analytics] fetchSessionEvents not implemented');
  return [];
}

/**
 * Mock events for development
 */
function getMockEvents(): ConfiguratorEvent[] {
  // Return sample events for testing dashboard
  return [];
}

// ============================================================
// EXPORTS
// ============================================================

export type {
  EventsRequest,
  EventsResponse,
  DashboardMetrics,
  ProductMetrics,
  DashboardResponse,
};
