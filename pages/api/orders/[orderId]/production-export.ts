/**
 * PRODUCTION EXPORT API – PHASE 6
 * 
 * API endpoint for exporting production snapshots as PDF/JSON.
 * Used by admin panel and automated systems to retrieve production files.
 * 
 * Endpoints:
 * - GET /api/orders/[orderId]/production-export?format=pdf|json|both
 * - POST /api/orders/[orderId]/create-production-snapshot
 * - GET /api/orders/[orderId]/production-status
 * 
 * @module pages/api/orders/[orderId]/production-export
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import type { ProductionSnapshot } from '../../../../lib/production/production-snapshot';
import type { ProductionExportResult } from '../../../../lib/production/production-export';
import type { OrderFulfillmentStatus } from '../../../../lib/fulfillment/fulfillment-manager';
import type { CartItemWithPricing } from '../../../../lib/cart/cart-pricing-persistence';

import {
  createProductionSnapshot,
  createProductionSnapshotsFromOrder,
  verifySnapshotIntegrity,
} from '../../../../lib/production/production-snapshot';
import {
  exportProductionSnapshot,
  exportAsJSON,
} from '../../../../lib/production/production-export';
import {
  FulfillmentManager,
  determineFulfillmentType,
} from '../../../../lib/fulfillment/fulfillment-manager';
import {
  calculateOrderDeliveryEstimate,
  prepareDeliveryDataForStorage,
} from '../../../../lib/fulfillment/delivery-estimation';

// ============================================================
// TYPE DEFINITIONS
// ============================================================

interface ProductionExportRequest {
  format?: 'pdf' | 'json' | 'both';
  includePreview?: boolean;
  includeCustomerInfo?: boolean;
  locale?: string;
}

interface ProductionExportResponse {
  success: boolean;
  data?: {
    snapshots: ProductionSnapshot[];
    exports?: ProductionExportResult[];
    downloadUrls?: {
      pdf?: string;
      json?: string;
    };
  };
  error?: string;
}

interface CreateSnapshotRequest {
  orderId: string;
  orderNumber: string;
  cartItems: CartItemWithPricing[];
  customerInfo: {
    name: string;
    shippingAddress: string;
  };
}

interface CreateSnapshotResponse {
  success: boolean;
  data?: {
    snapshots: ProductionSnapshot[];
    fulfillmentStatus: OrderFulfillmentStatus;
    deliveryEstimate: any;
  };
  error?: string;
}

interface ProductionStatusResponse {
  success: boolean;
  data?: {
    fulfillmentStatus: OrderFulfillmentStatus;
    snapshots: ProductionSnapshot[];
    canModify: boolean;
    nextAllowedStatuses: string[];
  };
  error?: string;
}

// ============================================================
// PRODUCTION EXPORT HANDLER
// ============================================================

/**
 * GET /api/orders/[orderId]/production-export
 * Export production snapshots as PDF/JSON
 */
async function handleProductionExport(
  req: NextApiRequest,
  res: NextApiResponse<ProductionExportResponse>
) {
  const { orderId } = req.query;
  const {
    format = 'both',
    includePreview,
    includeCustomerInfo,
    locale = 'de-DE',
  } = req.query;
  
  // Parse boolean query parameters (come as strings from URL)
  const includePreviewBool = includePreview === 'true' || includePreview === undefined;
  const includeCustomerInfoBool = includeCustomerInfo === 'true' || includeCustomerInfo === undefined;
  
  try {
    // TODO: Fetch snapshots from database
    // For now, use mock data
    const snapshots = await fetchProductionSnapshots(orderId as string);
    
    if (!snapshots || snapshots.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'No production snapshots found for this order',
      });
    }
    
    // Export each snapshot
    const exports: ProductionExportResult[] = [];
    
    for (const snapshot of snapshots) {
      const exportResult = await exportProductionSnapshot(snapshot, {
        format: format as 'pdf' | 'json' | 'both',
        includePreview: includePreviewBool,
        includeCustomerInfo: includeCustomerInfoBool,
        locale: locale as string,
      });
      
      exports.push(exportResult);
    }
    
    // For PDF/JSON format, set appropriate headers and return file
    if (format === 'pdf' && exports.length === 1 && exports[0].pdf) {
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${exports[0].pdf.filename}"`
      );
      return res.send(exports[0].pdf.buffer as any);
    }
    
    if (format === 'json' && exports.length === 1 && exports[0].json) {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${exports[0].json.filename}"`
      );
      return res.send(exports[0].json.data as any);
    }
    
    // Return JSON response with all exports
    return res.status(200).json({
      success: true,
      data: {
        snapshots,
        exports,
      },
    });
  } catch (error) {
    console.error('Production export error:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Export failed',
    });
  }
}

// ============================================================
// CREATE PRODUCTION SNAPSHOT HANDLER
// ============================================================

/**
 * POST /api/orders/[orderId]/create-production-snapshot
 * Create production snapshot after order completion
 */
async function handleCreateSnapshot(
  req: NextApiRequest,
  res: NextApiResponse<CreateSnapshotResponse>
) {
  const { orderId } = req.query;
  const {
    orderNumber,
    cartItems,
    customerInfo,
  } = req.body as Omit<CreateSnapshotRequest, 'orderId'>;
  
  try {
    // Validate request
    if (!orderNumber || !cartItems || !customerInfo) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: orderNumber, cartItems, customerInfo',
      });
    }
    
    // Create production snapshots for all configurator items
    const snapshots = await createProductionSnapshotsFromOrder(
      orderId as string,
      orderNumber,
      cartItems,
      customerInfo
    );
    
    if (snapshots.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No configurator items found in order',
      });
    }
    
    // Verify snapshots
    for (const snapshot of snapshots) {
      const isValid = verifySnapshotIntegrity(snapshot);
      if (!isValid) {
        console.error(`Snapshot integrity check failed: ${snapshot.snapshotId}`);
      }
    }
    
    // Create fulfillment status
    const fulfillmentType = determineFulfillmentType(cartItems);
    const fulfillmentStatus = FulfillmentManager.createInitialStatus(
      orderId as string,
      orderNumber,
      fulfillmentType
    );
    
    // Calculate delivery estimate
    const deliveryEstimate = calculateOrderDeliveryEstimate(cartItems);
    const deliveryData = prepareDeliveryDataForStorage(deliveryEstimate, 'de-DE');
    
    // TODO: Save to database
    // - Save snapshots to production_snapshots table
    // - Save fulfillmentStatus to order_fulfillment table
    // - Save deliveryData to order table
    
    console.log('Created production snapshots:', {
      orderId,
      snapshotCount: snapshots.length,
      fulfillmentStatus: fulfillmentStatus.productionStatus,
      deliveryEstimate: deliveryData.estimatedDeliveryDate,
    });
    
    return res.status(201).json({
      success: true,
      data: {
        snapshots,
        fulfillmentStatus,
        deliveryEstimate: deliveryData,
      },
    });
  } catch (error) {
    console.error('Create snapshot error:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Snapshot creation failed',
    });
  }
}

// ============================================================
// PRODUCTION STATUS HANDLER
// ============================================================

/**
 * GET /api/orders/[orderId]/production-status
 * Get production status and snapshots
 */
async function handleProductionStatus(
  req: NextApiRequest,
  res: NextApiResponse<ProductionStatusResponse>
) {
  const { orderId } = req.query;
  
  try {
    // TODO: Fetch from database
    const fulfillmentStatus = await fetchFulfillmentStatus(orderId as string);
    const snapshots = await fetchProductionSnapshots(orderId as string);
    
    if (!fulfillmentStatus) {
      return res.status(404).json({
        success: false,
        error: 'Fulfillment status not found',
      });
    }
    
    // Check if order can be modified
    const canModify = FulfillmentManager.canModifyOrder(fulfillmentStatus);
    
    // Get next allowed statuses
    const nextAllowedStatuses = FulfillmentManager.getNextAllowedStatuses(
      fulfillmentStatus.productionStatus
    );
    
    return res.status(200).json({
      success: true,
      data: {
        fulfillmentStatus,
        snapshots: snapshots || [],
        canModify,
        nextAllowedStatuses,
      },
    });
  } catch (error) {
    console.error('Production status error:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Status fetch failed',
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
  const { orderId } = req.query;
  
  // Validate orderId
  if (!orderId || typeof orderId !== 'string') {
    return res.status(400).json({
      success: false,
      error: 'Invalid order ID',
    });
  }
  
  // Route based on endpoint and method
  const endpoint = req.url?.split('?')[0] || '';
  
  if (endpoint.endsWith('/production-export')) {
    if (req.method === 'GET') {
      return handleProductionExport(req, res);
    }
  } else if (endpoint.endsWith('/create-production-snapshot')) {
    if (req.method === 'POST') {
      return handleCreateSnapshot(req, res);
    }
  } else if (endpoint.endsWith('/production-status')) {
    if (req.method === 'GET') {
      return handleProductionStatus(req, res);
    }
  }
  
  return res.status(405).json({
    success: false,
    error: 'Method not allowed',
  });
}

// ============================================================
// DATABASE HELPERS (TODO: Implement)
// ============================================================

/**
 * Fetch production snapshots from database
 */
async function fetchProductionSnapshots(orderId: string): Promise<ProductionSnapshot[] | null> {
  // TODO: Implement database query
  // SELECT * FROM production_snapshots WHERE order_id = $1
  console.warn('fetchProductionSnapshots not implemented – using mock data');
  return null;
}

/**
 * Fetch fulfillment status from database
 */
async function fetchFulfillmentStatus(orderId: string): Promise<OrderFulfillmentStatus | null> {
  // TODO: Implement database query
  // SELECT * FROM order_fulfillment WHERE order_id = $1
  console.warn('fetchFulfillmentStatus not implemented – using mock data');
  return null;
}

/**
 * Save production snapshot to database
 */
async function saveProductionSnapshot(snapshot: ProductionSnapshot): Promise<void> {
  // TODO: Implement database insert
  // INSERT INTO production_snapshots (...) VALUES (...)
  console.warn('saveProductionSnapshot not implemented');
}

/**
 * Save fulfillment status to database
 */
async function saveFulfillmentStatus(status: OrderFulfillmentStatus): Promise<void> {
  // TODO: Implement database insert/update
  // INSERT INTO order_fulfillment (...) VALUES (...) ON CONFLICT UPDATE
  console.warn('saveFulfillmentStatus not implemented');
}

// ============================================================
// CLIENT HELPER FUNCTIONS
// ============================================================

/**
 * Client-side helper to create production snapshot
 */
export async function createProductionSnapshotAPI(
  orderId: string,
  orderNumber: string,
  cartItems: CartItemWithPricing[],
  customerInfo: { name: string; shippingAddress: string }
): Promise<CreateSnapshotResponse> {
  const response = await fetch(`/api/orders/${orderId}/create-production-snapshot`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      orderNumber,
      cartItems,
      customerInfo,
    }),
  });
  
  return response.json();
}

/**
 * Client-side helper to export production files
 */
export async function exportProductionFilesAPI(
  orderId: string,
  format: 'pdf' | 'json' | 'both' = 'both'
): Promise<ProductionExportResponse> {
  const response = await fetch(
    `/api/orders/${orderId}/production-export?format=${format}`,
    {
      method: 'GET',
    }
  );
  
  return response.json();
}

/**
 * Client-side helper to download production PDF
 */
export async function downloadProductionPDF(orderId: string): Promise<void> {
  const url = `/api/orders/${orderId}/production-export?format=pdf`;
  window.open(url, '_blank');
}

/**
 * Client-side helper to get production status
 */
export async function getProductionStatusAPI(
  orderId: string
): Promise<ProductionStatusResponse> {
  const response = await fetch(`/api/orders/${orderId}/production-status`, {
    method: 'GET',
  });
  
  return response.json();
}
