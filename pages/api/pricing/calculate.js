/**
 * API Endpoint: Calculate Configurator Price
 * POST /api/pricing/calculate
 * 
 * Calculates configured product price from DB pricing config
 * Used by frontend Cart to get accurate price before checkout
 */

import { calcConfiguredPrice } from '../../../lib/pricing/calcConfiguredPriceDB.js';

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
    const { productType, config, customFeeCents } = req.body;

    // Validation
    if (!productType || !['glass_holder', 'bottle_holder'].includes(productType)) {
      return res.status(400).json({ 
        error: 'Invalid productType',
        message: 'Must be glass_holder or bottle_holder'
      });
    }

    if (!config || typeof config !== 'object') {
      return res.status(400).json({ 
        error: 'Invalid config',
        message: 'Config object required'
      });
    }

    console.log('💰 [PRICING API] Calculate request:', { 
      productType, 
      configKeys: Object.keys(config),
      customFeeCents: customFeeCents || 0
    });

    // Calculate price from DB
    const pricing = await calcConfiguredPrice({
      productType,
      config,
      customFeeCents: customFeeCents || 0,
    });

    if (!pricing || !pricing.subtotal_cents || pricing.subtotal_cents <= 0) {
      console.error('❌ [PRICING API] Invalid pricing result:', pricing);
      return res.status(500).json({ 
        error: 'Pricing calculation failed',
        message: 'Unable to calculate valid price'
      });
    }

    console.log('✅ [PRICING API] Price calculated:', {
      base_price_cents: pricing.base_price_cents,
      option_prices_cents: pricing.option_prices_cents,
      subtotal_cents: pricing.subtotal_cents,
      pricing_version: pricing.pricing_version,
    });

    // Return pricing breakdown
    return res.status(200).json({
      success: true,
      pricing: {
        pricing_version: pricing.pricing_version,
        base_price_cents: pricing.base_price_cents,
        option_prices_cents: pricing.option_prices_cents,
        custom_fee_cents: pricing.custom_fee_cents,
        subtotal_cents: pricing.subtotal_cents,
        display_title: pricing.display_title,
        sku: pricing.sku,
      },
      // Convenience fields for frontend
      price_euros: (pricing.subtotal_cents / 100).toFixed(2),
      currency: 'EUR',
    });

  } catch (error) {
    console.error('❌ [PRICING API] Error:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      message: error.message
    });
  }
}
