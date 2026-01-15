/**
 * API Endpoint: Calculate Cart Pricing Snapshot
 * POST /api/pricing/calculate
 * 
 * Calculates complete cart pricing from DB pricing config
 * Used by frontend Cart to get accurate price before checkout
 * Returns same structure as checkout pricing snapshot
 */

import { calcConfiguredPrice } from '../../../lib/pricing/calcConfiguredPriceDB.js';

// Shipping calculation (same as checkout)
function calculateShipping(country = 'DE') {
  const shippingRates = {
    'DE': 490,  // €4.90
    'AT': 590,
    'CH': 790,
    'NL': 690,
    'BE': 690,
    'LU': 690,
    'FR': 790,
    'IT': 890,
    'ES': 990,
    'PT': 990,
  };
  return shippingRates[country] || 1290; // Default international
}

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { items, productType, config, customFeeCents } = req.body;

    // DUAL MODE: Support both cart pricing and single-product pricing
    // Mode 1: Cart pricing (items array)
    // Mode 2: Single product pricing (productType + config)
    
    if (items && Array.isArray(items) && items.length > 0) {
      // MODE 1: CART PRICING
      return await handleCartPricing(items, res);
    } else if (productType && config) {
      // MODE 2: SINGLE PRODUCT PRICING
      return await handleSingleProductPricing(productType, config, customFeeCents || 0, res);
    } else {
      return res.status(400).json({ 
        error: 'Invalid request',
        message: 'Either items array OR (productType + config) required'
      });
    }

  } catch (error) {
    console.error('❌ [PRICING API] Error:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      message: error.message
    });
  }
}

// Handle single product pricing (for shop page)
async function handleSingleProductPricing(productType, config, customFeeCents, res) {
  console.log('💰 [PRICING API] Single product pricing:', { productType });
  
  const pricing = await calcConfiguredPrice({
    productType,
    config,
    customFeeCents,
  });

  if (!pricing || !pricing.subtotal_cents || pricing.subtotal_cents <= 0) {
    console.error('❌ [PRICING API] Invalid pricing result');
    return res.status(500).json({ 
      error: 'Pricing calculation failed',
      message: 'Unable to calculate valid price'
    });
  }

  console.log('✅ [PRICING API] Single product priced:', {
    subtotal_cents: pricing.subtotal_cents,
    base: pricing.base_price_cents,
    options: pricing.option_prices_cents,
  });

  return res.status(200).json({
    success: true,
    pricing: {
      base_price_cents: pricing.base_price_cents,
      option_prices_cents: pricing.option_prices_cents,
      custom_fee_cents: pricing.custom_fee_cents || 0,
      subtotal_cents: pricing.subtotal_cents,
    },
    price_euros: (pricing.subtotal_cents / 100).toFixed(2),
    sku: pricing.sku,
    display_title: pricing.display_title,
    pricing_version: pricing.pricing_version,
  });
}

// Handle cart pricing (for cart page)
async function handleCartPricing(items, res) {
  console.log('💰 [PRICING API] Cart pricing:', { items_count: items.length });

  // Calculate pricing for each item
  const itemPricing = [];
  let subtotalCents = 0;

    for (const item of items) {
      // Handle configurator items
      if (item.product_id === 'glass_configurator' && item.config) {
        const variant = item.config.variant || 'glass_holder';
        
        const pricing = await calcConfiguredPrice({
          productType: variant,
          config: item.config,
          customFeeCents: 0,
        });

        if (!pricing || !pricing.subtotal_cents || pricing.subtotal_cents <= 0) {
          console.error('❌ [PRICING API] Invalid pricing for item:', item);
          return res.status(500).json({ 
            error: 'Pricing calculation failed',
            message: 'Unable to calculate valid price for configurator item'
          });
        }

        const quantity = item.quantity || 1;
        const lineTotalCents = pricing.subtotal_cents * quantity;
        subtotalCents += lineTotalCents;

        itemPricing.push({
          product_id: item.product_id,
          sku: item.sku || pricing.sku,
          name: pricing.display_title || 'Glashalter (konfiguriert)',
          quantity,
          unit_price_cents: pricing.subtotal_cents,
          line_total_cents: lineTotalCents,
          pricing_breakdown: {
            pricing_version: pricing.pricing_version,
            base_price_cents: pricing.base_price_cents,
            option_prices_cents: pricing.option_prices_cents,
            custom_fee_cents: pricing.custom_fee_cents,
            computed_subtotal_cents: pricing.subtotal_cents,
          },
        });
      } else {
        // Handle other product types (if any)
        const unitPrice = item.price_cents || 0;
        const quantity = item.quantity || 1;
        const lineTotalCents = unitPrice * quantity;
        subtotalCents += lineTotalCents;

        itemPricing.push({
          product_id: item.product_id,
          sku: item.sku || 'UNKNOWN',
          name: item.name || 'Product',
          quantity,
          unit_price_cents: unitPrice,
          line_total_cents: lineTotalCents,
        });
      }
    }

    // Calculate shipping
    const shippingCents = calculateShipping('DE'); // TODO: Get from user selection
    const taxCents = 0; // Tax calculated at checkout by Stripe
    const grandTotalCents = subtotalCents + shippingCents;

    console.log('✅ [PRICING API] Cart pricing calculated:', {
      items_count: itemPricing.length,
      subtotal_cents: subtotalCents,
      shipping_cents: shippingCents,
      grand_total_cents: grandTotalCents,
      CALCULATION: `${subtotalCents} + ${shippingCents} = ${grandTotalCents}`,
    });

    // Return pricing snapshot (same structure as checkout)
    return res.status(200).json({
      success: true,
      items: itemPricing,
      subtotal_cents: subtotalCents,
      shipping_cents: shippingCents,
      shipping_country: 'DE',
      tax_cents: taxCents,
      grand_total_cents: grandTotalCents,
      currency: 'EUR',
      pricing_source: 'adminpanel_db',
      calculated_at: new Date().toISOString(),
    });
}
