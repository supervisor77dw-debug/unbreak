/**
 * API Route: Add Configurator Design to Cart
 * 
 * POST /api/cart/add-design
 * 
 * Validates DesignPayloadV1, re-prices it server-side,
 * verifies pricing signature, and adds to cart.
 * 
 * Security: Server is source of truth for pricing.
 */

import { validatePayloadV1 } from '../../../configurator/design-payload-v1-types.js';
import { priceDesign, verifyPricingSignature } from '../../../lib/pricing/design-pricing.js';
import { createConfigurableCartItem } from '../../../lib/cart/configurable-cart-item.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  try {
    const { payload, clientPricing } = req.body;
    
    // 1. Validate payload structure
    const validation = validatePayloadV1(payload);
    if (!validation.valid) {
      console.error('[API:AddDesign] Payload validation failed:', validation.errors);
      return res.status(400).json({
        error: 'INVALID_PAYLOAD',
        details: validation.errors,
        message: 'Design payload ist ungültig'
      });
    }
    
    console.log('[API:AddDesign] Payload valid:', {
      designId: payload.designId,
      productFamily: payload.productFamily,
      baseComponents: payload.baseComponents?.length,
      addons: payload.premiumAddons?.length,
      customization: payload.customization?.enabled
    });
    
    // 2. Re-price server-side (authoritative)
    const serverPricing = priceDesign(payload);
    
    if (!serverPricing.valid) {
      console.error('[API:AddDesign] Server pricing failed:', serverPricing.errors);
      return res.status(400).json({
        error: 'PRICING_ERROR',
        details: serverPricing.errors,
        message: 'Preisberechnung fehlgeschlagen'
      });
    }
    
    console.log('[API:AddDesign] Server pricing:', {
      baseTotal: serverPricing.baseTotal,
      customizationFee: serverPricing.customizationFee,
      addonsTotal: serverPricing.addonsTotal,
      total: serverPricing.total,
      pricebookVersion: serverPricing.pricebookVersion,
      signature: serverPricing.pricingSignature
    });
    
    // 3. Verify pricing signature (if client provided)
    if (clientPricing?.pricingSignature) {
      const verification = verifyPricingSignature(
        payload,
        clientPricing.pricingSignature,
        clientPricing.pricebookVersion
      );
      
      if (!verification.valid) {
        console.warn('[API:AddDesign] Pricing signature mismatch:', verification.error);
        
        // Return server pricing for client to retry
        return res.status(409).json({
          error: verification.error,
          details: verification.details,
          serverPricing: verification.serverPricing,
          message: 'Preis muss neu berechnet werden'
        });
      }
      
      console.log('[API:AddDesign] ✅ Pricing signature verified');
    }
    
    // 4. Create cart item
    const cartItem = createConfigurableCartItem(payload);
    
    console.log('[API:AddDesign] Cart item created:', {
      cartItemId: cartItem.cartItemId,
      designId: cartItem.designId,
      title: cartItem.title,
      total: cartItem.pricing.total
    });
    
    // 5. Store in session/database
    // For MVP, return cart item to client for client-side storage
    // In production, store in database with userId/sessionId
    
    // TODO: Save to database
    // await saveCartItem(userId, cartItem);
    
    // 6. Return success
    return res.status(200).json({
      success: true,
      cartItem,
      pricing: serverPricing,
      message: 'Design wurde zum Warenkorb hinzugefügt'
    });
    
  } catch (error) {
    console.error('[API:AddDesign] Error:', error);
    
    return res.status(500).json({
      error: 'INTERNAL_ERROR',
      message: 'Ein Fehler ist aufgetreten',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}

/**
 * Logging helper for debugging
 */
function logDesignDetails(payload) {
  const details = {
    designId: payload.designId,
    productFamily: payload.productFamily,
    baseComponents: payload.baseComponents?.map(c => ({
      sku: c.sku,
      qty: c.qty
    })),
    customization: payload.customization,
    addons: payload.premiumAddons?.map(a => ({
      pricingKey: a.pricingKey,
      qty: a.qty
    }))
  };
  
  console.log('[API:AddDesign] Design details:', JSON.stringify(details, null, 2));
}
