/**
 * CENTRAL PRICING RESOLVER
 * Single Source of Truth for all product pricing
 * 
 * Purpose:
 * - Resolve unit_amount_cents for ANY product (standard, configured, bundle)
 * - Deterministic: same input → same output
 * - No silent fallbacks: fail loudly if price cannot be resolved
 * - Full audit trail: log source, matched record, version
 * 
 * Usage:
 *   const result = await resolvePriceCents(item, supabase);
 *   if (!result.success) throw new Error(result.error);
 *   const { unit_amount_cents, source, matchedKey } = result;
 */

import { calcConfiguredPrice } from './calcConfiguredPriceDB.js';

/**
 * Resolve unit price in cents for a cart item
 * 
 * @param {object} item - Cart item from request
 * @param {object} supabase - Supabase client
 * @param {string} traceId - Request trace ID for logging
 * @returns {Promise<{success: boolean, unit_amount_cents?: number, source?: string, matchedKey?: string, error?: string, details?: object}>}
 */
export async function resolvePriceCents(item, supabase, traceId) {
  const logPrefix = `[PRICING][${traceId}]`;
  
  console.log(`${logPrefix} Resolving price for:`, {
    product_id: item.product_id,
    sku: item.sku,
    quantity: item.quantity,
    has_config: !!item.config,
    configured: item.configured || false,
  });

  // ==============================================
  // CASE 1: CONFIGURATOR PRODUCT
  // ==============================================
  if (item.config && (item.configured || item.product_id === 'glass_configurator')) {
    console.log(`${logPrefix} → CONFIGURATOR product detected`);
    
    try {
      const pricing = await calcConfiguredPrice(item.config, supabase);
      
      if (!pricing || !pricing.subtotal_cents || pricing.subtotal_cents <= 0) {
        return {
          success: false,
          error: 'CONFIGURATOR_PRICE_INVALID',
          details: {
            product_id: item.product_id,
            sku: item.sku,
            pricing_result: pricing,
            reason: 'calcConfiguredPrice returned invalid result',
          },
        };
      }
      
      console.log(`${logPrefix} ✅ Configurator price resolved:`, {
        unit_amount_cents: pricing.subtotal_cents,
        source: 'configurator_db',
        pricing_version: pricing.pricing_version,
        base_price_cents: pricing.base_price_cents,
        option_prices: pricing.option_prices_cents,
      });
      
      return {
        success: true,
        unit_amount_cents: pricing.subtotal_cents,
        source: 'configurator_db',
        matchedKey: `variant:${item.config?.colors?.base || 'unknown'}`,
        details: {
          pricing_version: pricing.pricing_version,
          base_price_cents: pricing.base_price_cents,
          option_prices_cents: pricing.option_prices_cents,
          sku: pricing.sku,
        },
      };
    } catch (err) {
      return {
        success: false,
        error: 'CONFIGURATOR_PRICE_FAILED',
        details: {
          product_id: item.product_id,
          sku: item.sku,
          error_message: err.message,
          error_stack: err.stack,
        },
      };
    }
  }

  // ==============================================
  // CASE 2: STANDARD PRODUCT (from products table)
  // ==============================================
  console.log(`${logPrefix} → STANDARD product, fetching from DB`);
  
  // Try by product_id first (primary key)
  if (item.product_id && item.product_id !== 'glass_configurator') {
    const { data: product, error } = await supabase
      .from('products')
      .select('id, sku, base_price_cents, active, name')
      .eq('id', item.product_id)
      .eq('active', true)
      .single();
    
    if (error) {
      console.error(`${logPrefix} ❌ DB error (by product_id):`, error);
    }
    
    if (product) {
      if (!product.base_price_cents || product.base_price_cents <= 0) {
        return {
          success: false,
          error: 'PRODUCT_PRICE_ZERO',
          details: {
            product_id: product.id,
            sku: product.sku,
            base_price_cents: product.base_price_cents,
            reason: 'Product exists but base_price_cents is 0 or null',
          },
        };
      }
      
      console.log(`${logPrefix} ✅ Standard product price resolved (by product_id):`, {
        product_id: product.id,
        sku: product.sku,
        unit_amount_cents: product.base_price_cents,
        source: 'products_table',
      });
      
      return {
        success: true,
        unit_amount_cents: product.base_price_cents,
        source: 'products_table',
        matchedKey: `product_id:${product.id}`,
        details: {
          sku: product.sku,
          name: product.name,
          active: product.active,
        },
      };
    }
  }
  
  // Try by SKU (fallback for legacy items)
  if (item.sku) {
    const { data: product, error } = await supabase
      .from('products')
      .select('id, sku, base_price_cents, active, name')
      .eq('sku', item.sku)
      .eq('active', true)
      .single();
    
    if (error) {
      console.error(`${logPrefix} ❌ DB error (by SKU):`, error);
    }
    
    if (product) {
      if (!product.base_price_cents || product.base_price_cents <= 0) {
        return {
          success: false,
          error: 'PRODUCT_PRICE_ZERO',
          details: {
            product_id: product.id,
            sku: product.sku,
            base_price_cents: product.base_price_cents,
            reason: 'Product exists but base_price_cents is 0 or null',
          },
        };
      }
      
      console.log(`${logPrefix} ✅ Standard product price resolved (by SKU):`, {
        product_id: product.id,
        sku: product.sku,
        unit_amount_cents: product.base_price_cents,
        source: 'products_table',
      });
      
      return {
        success: true,
        unit_amount_cents: product.base_price_cents,
        source: 'products_table',
        matchedKey: `sku:${product.sku}`,
        details: {
          product_id: product.id,
          name: product.name,
          active: product.active,
        },
      };
    }
  }

  // ==============================================
  // CASE 3: NOT FOUND
  // ==============================================
  return {
    success: false,
    error: 'PRODUCT_NOT_FOUND',
    details: {
      product_id: item.product_id,
      sku: item.sku,
      searched_by: item.product_id ? 'product_id + sku' : 'sku only',
      reason: 'Product not found in database or inactive',
    },
  };
}

/**
 * Validate resolved pricing result
 * Hard fail if ANY item has invalid price
 * 
 * @param {array} resolvedItems - Array of resolved pricing results
 * @param {string} traceId - Request trace ID
 * @returns {{valid: boolean, error?: string, failedItem?: object}}
 */
export function validatePricing(resolvedItems, traceId) {
  const logPrefix = `[PRICING][VALIDATE][${traceId}]`;
  
  for (const resolved of resolvedItems) {
    // Check success flag
    if (!resolved.success) {
      console.error(`${logPrefix} ❌ PRICE_RESOLUTION_FAILED:`, {
        product_id: resolved.details?.product_id,
        sku: resolved.details?.sku,
        error_code: resolved.error,
        error_details: resolved.details,
      });
      
      return {
        valid: false,
        error: `PRICE_RESOLUTION_FAILED: ${resolved.error}`,
        failedItem: resolved.details,
      };
    }
    
    // Check unit_amount_cents is valid integer > 0
    const price = resolved.unit_amount_cents;
    if (!Number.isInteger(price) || price <= 0) {
      console.error(`${logPrefix} ❌ PRICE_INVALID:`, {
        unit_amount_cents: price,
        type: typeof price,
        is_integer: Number.isInteger(price),
        product_id: resolved.details?.product_id,
        sku: resolved.details?.sku,
      });
      
      return {
        valid: false,
        error: `PRICE_INVALID: unit_amount_cents must be integer > 0, got ${price}`,
        failedItem: resolved.details,
      };
    }
    
    // Check quantity is valid integer >= 1
    const qty = resolved.quantity;
    if (!Number.isInteger(qty) || qty < 1) {
      console.error(`${logPrefix} ❌ QUANTITY_INVALID:`, {
        quantity: qty,
        type: typeof qty,
        is_integer: Number.isInteger(qty),
        product_id: resolved.details?.product_id,
        sku: resolved.details?.sku,
      });
      
      return {
        valid: false,
        error: `QUANTITY_INVALID: quantity must be integer >= 1, got ${qty}`,
        failedItem: resolved.details,
      };
    }
  }
  
  console.log(`${logPrefix} ✅ All prices valid (${resolvedItems.length} items)`);
  
  return { valid: true };
}
