/**
 * API Route: Validate Design Pricing
 * 
 * POST /api/pricing/validate-design
 * 
 * Server-side pricing validation without adding to cart.
 * Used to verify pricing before checkout or after pricebook updates.
 */

import { validatePayloadV1 } from '../../../configurator/design-payload-v1-types.js';
import { priceDesign, verifyPricingSignature } from '../../../lib/pricing/design-pricing.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  try {
    const { payload, clientPricing } = req.body;
    
    // 1. Validate payload
    const validation = validatePayloadV1(payload);
    if (!validation.valid) {
      return res.status(400).json({
        error: 'INVALID_PAYLOAD',
        details: validation.errors,
        valid: false
      });
    }
    
    // 2. Calculate server-side pricing
    const serverPricing = priceDesign(payload);
    
    if (!serverPricing.valid) {
      return res.status(400).json({
        error: 'PRICING_ERROR',
        details: serverPricing.errors,
        valid: false
      });
    }
    
    // 3. Verify signature if provided
    let signatureVerification = null;
    if (clientPricing?.pricingSignature) {
      signatureVerification = verifyPricingSignature(
        payload,
        clientPricing.pricingSignature,
        clientPricing.pricebookVersion
      );
    }
    
    // 4. Return validation result
    return res.status(200).json({
      valid: true,
      serverPricing,
      signatureVerification,
      match: signatureVerification?.valid || false
    });
    
  } catch (error) {
    console.error('[API:ValidateDesign] Error:', error);
    
    return res.status(500).json({
      error: 'INTERNAL_ERROR',
      message: error.message,
      valid: false
    });
  }
}
