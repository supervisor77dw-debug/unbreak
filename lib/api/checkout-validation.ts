/**
 * Checkout Validation API
 * 
 * Server-side validation for legal consent
 * Enforces mandatory confirmation before order creation
 * 
 * @version 1.0.0
 * @date 2026-01-03
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import {
  LegalConsentData,
  validateLegalConsent,
  createLegalConsentRecord,
  LEGAL_TEXTS
} from '@/lib/legal/legal-texts';

/**
 * Checkout Request Payload
 */
export interface CheckoutRequest {
  // Cart data
  cartItems: any[];
  
  // Customer data
  customer: {
    name: string;
    email: string;
    address: any;
  };
  
  // Payment data
  payment: {
    method: string;
    sessionId?: string;
  };
  
  // REQUIRED: Legal consent
  legalConsent: {
    checkboxConfirmed: boolean;
    timestamp: string;
  };
}

/**
 * Checkout Response
 */
export interface CheckoutResponse {
  success: boolean;
  orderId?: string;
  orderNumber?: string;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
}

/**
 * Validate Checkout Request
 * Server-side hard-fail validation
 */
export function validateCheckoutRequest(
  req: CheckoutRequest,
  clientIP: string,
  userAgent: string
): {
  valid: boolean;
  errors: string[];
  consentData?: LegalConsentData;
} {
  const errors: string[] = [];

  // 1. Check if cart has custom products
  const hasCustomProducts = req.cartItems.some(
    item => item.type === 'CONFIGURATOR_DESIGN'
  );

  if (!hasCustomProducts) {
    // No custom products = no legal consent required
    return { valid: true, errors: [] };
  }

  // 2. Validate legal consent exists
  if (!req.legalConsent) {
    errors.push('Legal consent missing for custom product order');
    return { valid: false, errors };
  }

  // 3. Validate checkbox confirmed
  if (!req.legalConsent.checkboxConfirmed) {
    errors.push('Checkout confirmation checkbox must be checked');
    return { valid: false, errors };
  }

  // 4. Validate timestamp (must be recent)
  const consentTimestamp = new Date(req.legalConsent.timestamp);
  const now = new Date();
  const ageMinutes = (now.getTime() - consentTimestamp.getTime()) / 1000 / 60;

  if (ageMinutes > 30) {
    errors.push('Consent timestamp too old (max 30 minutes)');
  }

  if (ageMinutes < -5) {
    errors.push('Consent timestamp in the future');
  }

  // 5. Create consent record
  const consentData = createLegalConsentRecord(
    clientIP,
    userAgent,
    req.payment.sessionId
  );

  // 6. Validate consent data
  const validation = validateLegalConsent(consentData);
  
  if (!validation.valid) {
    errors.push(...validation.errors);
  }

  return {
    valid: errors.length === 0,
    errors,
    consentData: errors.length === 0 ? consentData : undefined
  };
}

/**
 * Get Client IP Address
 * Handles proxy headers (Vercel, Cloudflare, etc.)
 */
export function getClientIP(req: NextApiRequest): string {
  const forwarded = req.headers['x-forwarded-for'];
  const realIP = req.headers['x-real-ip'];
  const cfConnectingIP = req.headers['cf-connecting-ip'];

  if (typeof cfConnectingIP === 'string') {
    return cfConnectingIP;
  }

  if (typeof forwarded === 'string') {
    return forwarded.split(',')[0].trim();
  }

  if (typeof realIP === 'string') {
    return realIP;
  }

  return req.socket.remoteAddress || '0.0.0.0';
}

/**
 * Checkout API Endpoint
 * POST /api/checkout
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<CheckoutResponse>
) {
  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      error: {
        code: 'METHOD_NOT_ALLOWED',
        message: 'Only POST requests allowed'
      }
    });
  }

  try {
    const checkoutRequest = req.body as CheckoutRequest;

    // Get client metadata
    const clientIP = getClientIP(req);
    const userAgent = req.headers['user-agent'] || 'Unknown';

    // Validate request
    const validation = validateCheckoutRequest(
      checkoutRequest,
      clientIP,
      userAgent
    );

    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_FAILED',
          message: 'Checkout validation failed',
          details: validation.errors
        }
      });
    }

    // Create order with legal consent
    // const order = await createOrderWithLegalConsent(
    //   {
    //     ...checkoutRequest,
    //     orderNumber: generateOrderNumber()
    //   },
    //   validation.consentData!
    // );

    // Placeholder response
    return res.status(200).json({
      success: true,
      orderId: `ord_${Date.now()}`,
      orderNumber: `ORD-${Date.now()}`
    });

  } catch (error) {
    console.error('Checkout error:', error);
    
    return res.status(500).json({
      success: false,
      error: {
        code: 'CHECKOUT_FAILED',
        message: 'Order creation failed'
      }
    });
  }
}

/**
 * Validate Legal Consent API
 * POST /api/validate-legal-consent
 * 
 * Pre-checkout validation endpoint
 */
export async function validateLegalConsentAPI(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { checkboxConfirmed, timestamp } = req.body;

  if (!checkboxConfirmed) {
    return res.status(400).json({
      valid: false,
      error: LEGAL_TEXTS.checkoutConfirmation.validationError
    });
  }

  const consentTimestamp = new Date(timestamp);
  const ageMinutes = (Date.now() - consentTimestamp.getTime()) / 1000 / 60;

  if (ageMinutes > 30) {
    return res.status(400).json({
      valid: false,
      error: 'Ihre Bestätigung ist abgelaufen. Bitte bestätigen Sie erneut.'
    });
  }

  return res.status(200).json({
    valid: true
  });
}

/**
 * Client-side Checkout Helper
 * Use in checkout page to submit order
 */
export async function submitCheckout(
  cartItems: any[],
  customer: any,
  payment: any,
  legalConsentConfirmed: boolean
): Promise<CheckoutResponse> {
  if (!legalConsentConfirmed) {
    throw new Error('Legal consent required');
  }

  const response = await fetch('/api/checkout', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      cartItems,
      customer,
      payment,
      legalConsent: {
        checkboxConfirmed: legalConsentConfirmed,
        timestamp: new Date().toISOString()
      }
    })
  });

  const data = await response.json();

  if (!response.ok || !data.success) {
    throw new Error(data.error?.message || 'Checkout failed');
  }

  return data;
}

/**
 * Example Usage:
 * 
 * ```tsx
 * // In checkout page component
 * import { submitCheckout } from '@/lib/api/checkout-validation';
 * 
 * async function handleCheckout() {
 *   try {
 *     const result = await submitCheckout(
 *       cartItems,
 *       customerData,
 *       paymentData,
 *       legalConsentConfirmed
 *     );
 *     
 *     // Redirect to success page
 *     router.push(`/order-confirmation?orderId=${result.orderId}`);
 *     
 *   } catch (error) {
 *     setError(error.message);
 *   }
 * }
 * ```
 */
