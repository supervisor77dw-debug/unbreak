/**
 * Design Pricing Service
 * 
 * Authoritative pricing for DesignPayloadV1:
 * - Base components (from shop catalog)
 * - Customization fees (from pricebook)
 * - Premium addon deltas (from pricebook)
 * - Generates deterministic pricing signature for audit
 * 
 * Formula: TOTAL = SUM(base SKU * qty) + customizationFee + SUM(addon * qty)
 */

import crypto from 'crypto';
import { 
  getCustomizationFee, 
  getAddonDelta, 
  PRICEBOOK_VERSION, 
  DEFAULT_CURRENCY 
} from './pricebook.js';

/**
 * Mock shop catalog lookup
 * In production, this should query your product database
 * @param {string} sku
 * @returns {Object|null} { price, currency, title }
 */
function getProductBySKU(sku) {
  // MOCK DATA - Replace with actual database lookup
  const MOCK_CATALOG = {
    'UNBREAK-GLAS-01': { price: 49.90, currency: 'EUR', title: 'Glashalter Einzeln' },
    'UNBREAK-GLAS-SET-2': { price: 89.90, currency: 'EUR', title: 'Glashalter 2er Set' },
    'UNBREAK-GLAS-SET-4': { price: 169.90, currency: 'EUR', title: 'Glashalter 4er Set' },
    'UNBREAK-FLASCHE-01': { price: 54.90, currency: 'EUR', title: 'Flaschenhalter Einzeln' },
    'UNBREAK-FLASCHE-SET-2': { price: 99.90, currency: 'EUR', title: 'Flaschenhalter 2er Set' },
    'UNBREAK-WEIN-01': { price: 44.90, currency: 'EUR', title: 'Weinglas-Halter Einzeln' },
    'UNBREAK-GASTRO-SET-6': { price: 249.90, currency: 'EUR', title: 'Gastro Edition 6er Set' },
    'UNBREAK-GASTRO-SET-12': { price: 469.90, currency: 'EUR', title: 'Gastro Edition 12er Set' }
  };
  
  return MOCK_CATALOG[sku] || null;
}

/**
 * Price a design payload
 * 
 * @param {Object} payload - DesignPayloadV1 object
 * @param {Object} [options] - { currency?, forceRecalculate? }
 * @returns {Object} Pricing breakdown
 */
export function priceDesign(payload, options = {}) {
  const currency = options.currency || DEFAULT_CURRENCY;
  const errors = [];
  
  let baseTotal = 0;
  let customizationFee = 0;
  let addonsTotal = 0;
  const breakdownLines = [];
  
  // 1. Price base components
  if (!payload.baseComponents || payload.baseComponents.length === 0) {
    errors.push('No base components in payload');
  } else {
    for (const component of payload.baseComponents) {
      const { sku, qty } = component;
      
      if (!sku) {
        errors.push('Base component missing SKU');
        continue;
      }
      
      const product = getProductBySKU(sku);
      if (!product) {
        errors.push(`Unknown SKU: ${sku}`);
        continue;
      }
      
      const unitPrice = product.price;
      const lineTotal = unitPrice * qty;
      baseTotal += lineTotal;
      
      breakdownLines.push({
        type: 'base',
        sku,
        title: product.title,
        qty,
        unitPrice,
        lineTotal,
        currency: product.currency
      });
    }
  }
  
  // 2. Price customization fee
  if (payload.customization?.enabled && payload.customization?.feeKey) {
    const fee = getCustomizationFee(payload.customization.feeKey);
    
    if (!fee) {
      errors.push(`Unknown customization fee: ${payload.customization.feeKey}`);
    } else {
      customizationFee = fee.amount;
      
      breakdownLines.push({
        type: 'customization',
        feeKey: payload.customization.feeKey,
        title: fee.description,
        lineTotal: fee.amount,
        currency: fee.currency
      });
    }
  }
  
  // 3. Price premium addons
  if (payload.premiumAddons && payload.premiumAddons.length > 0) {
    for (const addon of payload.premiumAddons) {
      const { pricingKey, qty, label } = addon;
      
      if (!pricingKey) {
        errors.push('Premium addon missing pricingKey');
        continue;
      }
      
      const addonInfo = getAddonDelta(pricingKey);
      if (!addonInfo) {
        errors.push(`Unknown addon pricingKey: ${pricingKey}`);
        continue;
      }
      
      const unitPrice = addonInfo.amount;
      const lineTotal = unitPrice * qty;
      addonsTotal += lineTotal;
      
      breakdownLines.push({
        type: 'addon',
        pricingKey,
        label: label || addonInfo.description,
        qty,
        unitPrice,
        lineTotal,
        currency: addonInfo.currency
      });
    }
  }
  
  // Calculate total
  const total = baseTotal + customizationFee + addonsTotal;
  
  // Generate pricing signature
  const pricingSignature = generatePricingSignature(payload, {
    baseTotal,
    customizationFee,
    addonsTotal,
    total,
    currency,
    pricebookVersion: PRICEBOOK_VERSION
  });
  
  return {
    valid: errors.length === 0,
    errors,
    currency,
    baseTotal,
    customizationFee,
    addonsTotal,
    total,
    breakdownLines,
    pricebookVersion: PRICEBOOK_VERSION,
    pricingSignature,
    calculatedAt: new Date().toISOString()
  };
}

/**
 * Generate deterministic pricing signature for audit
 * 
 * Signature ensures:
 * - Payload hasn't been tampered with
 * - Pricing was calculated with specific pricebook version
 * - Server can verify client-calculated price
 * 
 * @param {Object} payload - DesignPayloadV1
 * @param {Object} pricingResult - Pricing breakdown
 * @returns {string} SHA-256 hash
 */
export function generatePricingSignature(payload, pricingResult) {
  // Normalize payload components for deterministic hashing
  const normalized = {
    baseComponents: (payload.baseComponents || [])
      .map(c => ({ sku: c.sku, qty: c.qty }))
      .sort((a, b) => a.sku.localeCompare(b.sku)),
    
    customization: payload.customization?.enabled 
      ? { feeKey: payload.customization.feeKey }
      : null,
    
    premiumAddons: (payload.premiumAddons || [])
      .map(a => ({ pricingKey: a.pricingKey, qty: a.qty }))
      .sort((a, b) => a.pricingKey.localeCompare(b.pricingKey))
  };
  
  const signatureData = {
    normalized,
    baseTotal: pricingResult.baseTotal,
    customizationFee: pricingResult.customizationFee,
    addonsTotal: pricingResult.addonsTotal,
    total: pricingResult.total,
    currency: pricingResult.currency,
    pricebookVersion: pricingResult.pricebookVersion
  };
  
  const signatureString = JSON.stringify(signatureData);
  
  // Generate SHA-256 hash
  if (typeof crypto !== 'undefined' && crypto.createHash) {
    // Node.js (server-side)
    return crypto.createHash('sha256').update(signatureString).digest('hex');
  } else if (typeof window !== 'undefined' && window.crypto && window.crypto.subtle) {
    // Browser (client-side) - return synchronous fallback
    // For production, use async crypto.subtle.digest
    return simpleHash(signatureString);
  } else {
    return simpleHash(signatureString);
  }
}

/**
 * Simple hash function for client-side (fallback)
 * Not cryptographically secure, but deterministic
 */
function simpleHash(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(16).padStart(8, '0');
}

/**
 * Verify pricing signature
 * 
 * Used server-side to validate that client-provided pricing matches
 * server-calculated pricing with same pricebook version.
 * 
 * @param {Object} payload - DesignPayloadV1
 * @param {string} clientSignature - Signature from client
 * @param {string} clientPricebookVersion - Pricebook version from client
 * @returns {{ valid: boolean, error?: string, serverPricing?: Object }}
 */
export function verifyPricingSignature(payload, clientSignature, clientPricebookVersion) {
  // Check pricebook version match
  if (clientPricebookVersion !== PRICEBOOK_VERSION) {
    return {
      valid: false,
      error: 'PRICEBOOK_VERSION_MISMATCH',
      details: {
        client: clientPricebookVersion,
        server: PRICEBOOK_VERSION,
        message: 'Price recalculation required'
      }
    };
  }
  
  // Recalculate pricing
  const serverPricing = priceDesign(payload);
  
  // Check for pricing errors
  if (!serverPricing.valid) {
    return {
      valid: false,
      error: 'PRICING_CALCULATION_ERROR',
      details: {
        errors: serverPricing.errors
      },
      serverPricing
    };
  }
  
  // Compare signatures
  if (serverPricing.pricingSignature !== clientSignature) {
    return {
      valid: false,
      error: 'SIGNATURE_MISMATCH',
      details: {
        client: clientSignature,
        server: serverPricing.pricingSignature,
        message: 'Pricing data has been modified or recalculation required'
      },
      serverPricing
    };
  }
  
  return {
    valid: true,
    serverPricing
  };
}

/**
 * Format price for display
 * @param {number} amount
 * @param {string} currency
 * @returns {string}
 */
export function formatPrice(amount, currency = 'EUR') {
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency
  }).format(amount);
}

/**
 * Get pricing summary (for UI display)
 * @param {Object} pricingResult
 * @returns {Object}
 */
export function getPricingSummary(pricingResult) {
  return {
    subtotal: pricingResult.baseTotal,
    customization: pricingResult.customizationFee,
    addons: pricingResult.addonsTotal,
    total: pricingResult.total,
    currency: pricingResult.currency,
    formatted: {
      subtotal: formatPrice(pricingResult.baseTotal, pricingResult.currency),
      customization: formatPrice(pricingResult.customizationFee, pricingResult.currency),
      addons: formatPrice(pricingResult.addonsTotal, pricingResult.currency),
      total: formatPrice(pricingResult.total, pricingResult.currency)
    }
  };
}
