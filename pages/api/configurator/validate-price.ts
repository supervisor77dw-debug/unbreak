/**
 * Price Validation API (Phase 5)
 * 
 * Server-side price validation endpoint
 * Ensures UI and checkout prices match exactly
 * 
 * @version 1.0.0
 * @date 2026-01-03
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import {
  calculatePrice,
  validatePriceCalculation,
  PriceCalculationInput,
  PriceCalculationResult
} from '@/lib/configurator/pricing-calculator';

/**
 * Price Validation Request
 */
export interface PriceValidationRequest {
  /**
   * Base product SKU
   */
  baseProductSku: string;

  /**
   * Selected components
   */
  selectedComponents: Array<{
    componentId: string;
    label: string;
    category: 'material' | 'finish' | 'addon';
    priceDelta: number;
    isPremium: boolean;
    quantity?: number;
  }>;

  /**
   * Client-calculated price (for validation)
   */
  clientPrice: {
    finalPriceNet: number;
    finalPriceGross: number;
  };
}

/**
 * Price Validation Response
 */
export interface PriceValidationResponse {
  valid: boolean;
  serverPrice: PriceCalculationResult;
  clientPrice?: {
    finalPriceNet: number;
    finalPriceGross: number;
  };
  errors?: string[];
  priceDifference?: number;
}

/**
 * Price Validation API Endpoint
 * POST /api/configurator/validate-price
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<PriceValidationResponse>
) {
  if (req.method !== 'POST') {
    return res.status(405).json({
      valid: false,
      serverPrice: {} as PriceCalculationResult,
      errors: ['Method not allowed']
    });
  }

  try {
    const requestData = req.body as PriceValidationRequest;

    // Validate request data
    if (!requestData.baseProductSku) {
      return res.status(400).json({
        valid: false,
        serverPrice: {} as PriceCalculationResult,
        errors: ['Base product SKU required']
      });
    }

    // Calculate server-side price
    const serverPrice = calculatePrice({
      baseProductSku: requestData.baseProductSku,
      selectedComponents: requestData.selectedComponents
    });

    // Validate against client price if provided
    if (requestData.clientPrice) {
      const priceDifference = Math.abs(
        serverPrice.finalPriceNet - requestData.clientPrice.finalPriceNet
      );

      // Allow 0.01 EUR tolerance for rounding
      if (priceDifference > 0.01) {
        return res.status(400).json({
          valid: false,
          serverPrice,
          clientPrice: requestData.clientPrice,
          errors: [
            `Price mismatch: client=${requestData.clientPrice.finalPriceNet}, server=${serverPrice.finalPriceNet}`
          ],
          priceDifference
        });
      }
    }

    // Price is valid
    return res.status(200).json({
      valid: true,
      serverPrice,
      clientPrice: requestData.clientPrice
    });

  } catch (error) {
    console.error('Price validation error:', error);
    
    return res.status(500).json({
      valid: false,
      serverPrice: {} as PriceCalculationResult,
      errors: [
        error instanceof Error ? error.message : 'Price validation failed'
      ]
    });
  }
}

/**
 * Client-side Helper: Validate Price
 */
export async function validatePriceOnServer(
  baseProductSku: string,
  selectedComponents: any[],
  clientPrice: { finalPriceNet: number; finalPriceGross: number }
): Promise<PriceValidationResponse> {
  const response = await fetch('/api/configurator/validate-price', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      baseProductSku,
      selectedComponents,
      clientPrice
    })
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.errors?.join(', ') || 'Price validation failed');
  }

  return data;
}

/**
 * Batch Price Validation
 * Validates multiple cart items at once
 */
export interface BatchPriceValidationRequest {
  items: Array<{
    itemId: string;
    baseProductSku: string;
    selectedComponents: any[];
    clientPrice: { finalPriceNet: number; finalPriceGross: number };
  }>;
}

export interface BatchPriceValidationResponse {
  valid: boolean;
  results: Array<{
    itemId: string;
    valid: boolean;
    serverPrice: PriceCalculationResult;
    errors?: string[];
  }>;
  totalErrors: number;
}

/**
 * Batch Price Validation Endpoint
 * POST /api/configurator/validate-prices-batch
 */
export async function batchValidateHandler(
  req: NextApiRequest,
  res: NextApiResponse<BatchPriceValidationResponse>
) {
  if (req.method !== 'POST') {
    return res.status(405).json({
      valid: false,
      results: [],
      totalErrors: 1
    });
  }

  try {
    const { items } = req.body as BatchPriceValidationRequest;

    const results = items.map(item => {
      try {
        const serverPrice = calculatePrice({
          baseProductSku: item.baseProductSku,
          selectedComponents: item.selectedComponents
        });

        const priceDifference = Math.abs(
          serverPrice.finalPriceNet - item.clientPrice.finalPriceNet
        );

        if (priceDifference > 0.01) {
          return {
            itemId: item.itemId,
            valid: false,
            serverPrice,
            errors: [`Price mismatch: ${priceDifference.toFixed(2)} EUR`]
          };
        }

        return {
          itemId: item.itemId,
          valid: true,
          serverPrice
        };

      } catch (error) {
        return {
          itemId: item.itemId,
          valid: false,
          serverPrice: {} as PriceCalculationResult,
          errors: [error instanceof Error ? error.message : 'Validation failed']
        };
      }
    });

    const totalErrors = results.filter(r => !r.valid).length;

    return res.status(200).json({
      valid: totalErrors === 0,
      results,
      totalErrors
    });

  } catch (error) {
    console.error('Batch validation error:', error);
    
    return res.status(500).json({
      valid: false,
      results: [],
      totalErrors: 1
    });
  }
}

/**
 * Price Lock
 * Creates a temporary price lock for checkout
 */
export interface PriceLockRequest {
  baseProductSku: string;
  selectedComponents: any[];
  lockDuration?: number; // minutes, default 30
}

export interface PriceLockResponse {
  lockId: string;
  lockedPrice: PriceCalculationResult;
  expiresAt: string;
  lockDurationMinutes: number;
}

/**
 * Price Lock Endpoint
 * POST /api/configurator/lock-price
 * 
 * Creates a price guarantee for limited time
 */
export async function priceLockHandler(
  req: NextApiRequest,
  res: NextApiResponse<PriceLockResponse>
) {
  if (req.method !== 'POST') {
    return res.status(405).end();
  }

  try {
    const { baseProductSku, selectedComponents, lockDuration = 30 } = req.body as PriceLockRequest;

    // Calculate current price
    const lockedPrice = calculatePrice({
      baseProductSku,
      selectedComponents
    });

    // Create lock (in production: store in Redis/database)
    const lockId = `lock_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const expiresAt = new Date(Date.now() + lockDuration * 60 * 1000).toISOString();

    // Store price lock
    // await redis.setex(
    //   `price_lock:${lockId}`,
    //   lockDuration * 60,
    //   JSON.stringify({ baseProductSku, selectedComponents, lockedPrice })
    // );

    return res.status(200).json({
      lockId,
      lockedPrice,
      expiresAt,
      lockDurationMinutes: lockDuration
    });

  } catch (error) {
    console.error('Price lock error:', error);
    return res.status(500).end();
  }
}

/**
 * Verify Price Lock
 * GET /api/configurator/verify-lock/:lockId
 */
export async function verifyPriceLockHandler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const { lockId } = req.query;

  // Retrieve lock from storage
  // const lockData = await redis.get(`price_lock:${lockId}`);
  
  // if (!lockData) {
  //   return res.status(404).json({ valid: false, error: 'Price lock expired' });
  // }

  // return res.status(200).json({ valid: true, lock: JSON.parse(lockData) });

  return res.status(501).json({ error: 'Not implemented' });
}

/**
 * Example Usage:
 * 
 * Client-side validation before checkout:
 * ```tsx
 * import { validatePriceOnServer } from '@/lib/api/price-validation';
 * 
 * async function handleAddToCart() {
 *   try {
 *     // Validate price on server
 *     const validation = await validatePriceOnServer(
 *       'UNBREAK-GLAS-SET-2',
 *       selectedComponents,
 *       { 
 *         finalPriceNet: clientPriceResult.finalPriceNet,
 *         finalPriceGross: clientPriceResult.finalPriceGross 
 *       }
 *     );
 * 
 *     if (!validation.valid) {
 *       alert('Price has changed. Please review your configuration.');
 *       return;
 *     }
 * 
 *     // Add to cart with server-validated price
 *     addToCart({
 *       ...cartItem,
 *       pricing: validation.serverPrice
 *     });
 * 
 *   } catch (error) {
 *     console.error('Price validation failed:', error);
 *   }
 * }
 * ```
 * 
 * Price lock for checkout:
 * ```tsx
 * async function handleCheckout() {
 *   const response = await fetch('/api/configurator/lock-price', {
 *     method: 'POST',
 *     headers: { 'Content-Type': 'application/json' },
 *     body: JSON.stringify({
 *       baseProductSku: 'UNBREAK-GLAS-SET-2',
 *       selectedComponents,
 *       lockDuration: 30 // 30 minutes
 *     })
 *   });
 * 
 *   const { lockId, expiresAt } = await response.json();
 *   
 *   // Proceed to payment with locked price
 *   router.push(`/checkout?lockId=${lockId}`);
 * }
 * ```
 */
