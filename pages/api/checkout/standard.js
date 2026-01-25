import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';
import { calcConfiguredPrice } from '../../../lib/pricing/calcConfiguredPriceDB.js';
import { resolvePriceCents, validatePricing } from '../../../lib/pricing/pricingResolver.js';
import { getEnvFingerprint, formatFingerprintLog } from '../../../lib/utils/envFingerprint.js';
import { generatePublicId } from '../../../lib/utils/orderNumber.js'; // NOTE: generateOrderNumber moved to webhook
import { getStripeClient, getCheckoutMode, guardCheckoutSession } from '../../../lib/stripe-config.js';
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Build ID from environment (for traceability)
const BUILD_ID = process.env.VERCEL_GIT_COMMIT_SHA?.substring(0, 7) || 'local-dev';
const PRICING_SOURCE = 'adminpanel_db';
const IS_PRODUCTION = process.env.NODE_ENV === 'production';
const SNAPSHOT_VERSION = 'unbreak-one.pricing.v1';

// Environment fingerprint (loaded once at module init)
const ENV_FINGERPRINT = getEnvFingerprint();

// i18n: Product names by SKU
const PRODUCT_NAMES_I18N = {
  'UNBREAK-GLAS-01': { 
    de: 'Glashalter Universal', 
    en: 'Universal Glass Holder' 
  },
  'UNBREAK-WEIN-01': { 
    de: 'Flaschenhalter', 
    en: 'Bottle Holder' 
  },
  'glass_configurator': {
    de: 'Glashalter Konfiguriert',
    en: 'Glass Holder Configured'
  },
  'bottle_configurator': {
    de: 'Flaschenhalter Konfiguriert',
    en: 'Bottle Holder Configured'
  }
};

// i18n: Shipping labels
const SHIPPING_LABELS_I18N = {
  de: {
    name: 'Versand',
    description: 'Standardversand'
  },
  en: {
    name: 'Shipping',
    description: 'Standard shipping'
  }
};

// ============================================
// SHIPPING SSOT: Fetch from DB (shipping_rates table)
// ============================================
let shippingRatesCache = null;
let shippingRatesCacheTime = 0;
const SHIPPING_CACHE_TTL = 60000; // 1 minute

async function getShippingRatesFromDB() {
  // Return cached if fresh
  if (shippingRatesCache && Date.now() - shippingRatesCacheTime < SHIPPING_CACHE_TTL) {
    return shippingRatesCache;
  }

  try {
    const { data, error } = await supabase
      .from('shipping_rates')
      .select('country_code, price_net, active')
      .eq('active', true);

    if (error) throw error;

    // Build lookup map
    const rates = {};
    data.forEach(row => {
      rates[row.country_code] = row.price_net;
    });

    // Ensure defaults exist
    if (!rates.DEFAULT && rates.INT) rates.DEFAULT = rates.INT;
    if (!rates.DEFAULT) rates.DEFAULT = 990; // Ultimate fallback

    shippingRatesCache = rates;
    shippingRatesCacheTime = Date.now();

    console.log('[SHIPPING SSOT] Loaded rates from DB:', rates);
    return rates;
  } catch (err) {
    console.error('[SHIPPING SSOT] DB error, using fallback:', err.message);
    // Fallback if DB fails
    return {
      DE: 490,
      EU: 1290,
      INT: 2490,
      DEFAULT: 990,
    };
  }
}

// Shipping calculation (SSOT: from shipping_rates table)
async function calculateShipping(country = 'DE') {
  const rates = await getShippingRatesFromDB();
  
  // Direct match
  if (rates[country]) return rates[country];
  
  // EU mapping (common European countries)
  const EU_COUNTRIES = ['AT', 'BE', 'BG', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'GR', 
                        'HR', 'HU', 'IE', 'IT', 'LT', 'LU', 'LV', 'MT', 'NL', 'PL', 
                        'PT', 'RO', 'SE', 'SI', 'SK', 'ES'];
  if (EU_COUNTRIES.includes(country) && rates.EU) return rates.EU;
  
  // International fallback
  return rates.INT || rates.DEFAULT;
}

// PRODUCTION ONLY: All Stripe checkouts must redirect to production domain
// This ensures webhooks, success/cancel URLs work correctly
const PRODUCTION_URL = 'https://unbreak-one.com';

function getOrigin(req) {
  return PRODUCTION_URL;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // ========================================
  // FEATURE FLAG: CHECKOUT_ENABLED
  // ========================================
  const checkoutEnabled = process.env.CHECKOUT_ENABLED !== 'false'; // Default: enabled
  
  if (!checkoutEnabled) {
    console.warn('⚠️ [Checkout] Checkout is temporarily disabled (CHECKOUT_ENABLED=false)');
    return res.status(503).json({ 
      error: 'Checkout temporarily unavailable',
      message: 'The checkout system is currently undergoing maintenance. Please try again later.',
      retry_after: 3600, // Suggest retry in 1 hour
    });
  }

  // TRACE ID: Client sends or we generate
  const traceId = req.headers['x-trace-id'] || req.body.trace_id || randomUUID();
  const snapshotId = randomUUID();
  
  // Structured log helper
  const log = (step, data = {}) => {
    console.log(JSON.stringify({
      step,
      trace_id: traceId,
      snapshot_id: snapshotId,
      build_id: BUILD_ID,
      timestamp: new Date().toISOString(),
      ...data,
    }));
  };

  // Log environment fingerprint at start
  log('checkout_start', { 
    items_count: req.body.items?.length || 1,
    has_email: !!req.body.email,
    env_fingerprint: formatFingerprintLog(ENV_FINGERPRINT),
  });

  try {
    // DUAL-MODE STRIPE CLIENT
    // Mode can be passed in request body (admin only), otherwise uses STRIPE_CHECKOUT_MODE env
    // ADMIN TEST MODE: To use mode=test on production, pass x-admin-test-key header
    let stripeMode = getCheckoutMode(); // Default from ENV (live on production)
    
    if (req.body.mode === 'test') {
      // Validate admin access for test mode
      const adminTestKey = req.headers['x-admin-test-key'];
      const validAdminKey = process.env.ADMIN_API_KEY || process.env.ADMIN_TEST_KEY;
      
      if (!adminTestKey || adminTestKey !== validAdminKey) {
        console.warn('⚠️ [Checkout] Attempted test mode without valid admin key');
        // Silently fall back to default mode (don't reveal admin test feature exists)
        stripeMode = getCheckoutMode();
      } else {
        console.log('🔑 [Checkout] ADMIN TEST MODE activated');
        stripeMode = 'test';
      }
    } else if (req.body.mode === 'live') {
      stripeMode = 'live';
    }
    
    let stripe;
    
    try {
      stripe = getStripeClient(stripeMode);
    } catch (keyError) {
      console.error('❌ [Checkout] Stripe key error:', keyError.message);
      return res.status(500).json({ 
        error: 'Server configuration error',
        message: keyError.message,
        hint: 'Set STRIPE_SECRET_KEY_TEST and/or STRIPE_SECRET_KEY_LIVE in Vercel ENV'
      });
    }

    // STRIPE ACCOUNT VERIFICATION
    const isTestMode = stripeMode === 'test';
    
    console.log('🔑 [STRIPE ACCOUNT] Mode:', isTestMode ? 'TEST' : 'LIVE');
    console.log('🔑 [STRIPE ACCOUNT] Source:', req.body.mode ? 'request body' : 'STRIPE_CHECKOUT_MODE env');
    
    // Get Stripe account ID
    try {
      const account = await stripe.accounts.retrieve();
      console.log('🔑 [STRIPE ACCOUNT] Account ID:', account.id);
      console.log('🔑 [STRIPE ACCOUNT] Email:', account.email || 'N/A');
      console.log('🔑 [STRIPE ACCOUNT] Country:', account.country);
    } catch (accError) {
      console.warn('⚠️ [STRIPE ACCOUNT] Could not retrieve account:', accError.message);
    }

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('❌ [Checkout] Supabase credentials missing');
      return res.status(500).json({ error: 'Server configuration error: Supabase credentials missing' });
    }

    // Support both single product (legacy) and cart items (new)
    const { sku, email, items } = req.body;
    console.log('📦 [Checkout] Request:', { sku, email, items: items?.length || 0 });

    // Validate input
    if (!items && !sku) {
      console.error('❌ [Checkout] Missing items or sku');
      return res.status(400).json({ error: 'Either items array or sku is required' });
    }

    if (items && (!Array.isArray(items) || items.length === 0)) {
      console.error('❌ [Checkout] Invalid items array - cart is empty');
      return res.status(400).json({ 
        error: 'Cart is empty',
        message: 'Please add items to your cart before checking out',
      });
    }

    // =================================================================
    // 1. LOG REQUEST + NORMALIZE CART ITEMS (Before Pricing)
    // =================================================================
    log('cart_items_received', {
      origin: req.headers.origin || 'unknown',
      lang: req.body.lang || 'unknown',
      items_count: items?.length || (sku ? 1 : 0),
      cart_items_normalized: items ? items.map(item => ({
        id: item.id || item.product_id || 'unknown',
        sku: item.sku || 'unknown',
        product_id: item.product_id || 'unknown',
        quantity: item.quantity || 0,
        has_config: !!item.config,
        configured: item.configured || false,
        price_fields_present: {
          price: 'price' in item,
          price_cents: 'price_cents' in item,
          priceCents: 'priceCents' in item,
          unit_amount: 'unit_amount' in item,
          base_price_cents: 'base_price_cents' in item,
        },
        configHash: item.config ? 'sha256:...' : null,
      })) : [{ sku, quantity: 1 }],
    });

    // =================================================================
    // 2. RESOLVE PRICES (Central Pricing Resolver)
    // =================================================================
    console.log('\n💰 [PRICING] Starting price resolution...\n');
    
    let resolvedItems = [];
    let cartItems = [];
    let totalAmount = 0;

    if (items) {
      // CRITICAL: Validate items array structure
      if (!Array.isArray(items) || items.length === 0) {
        log('validation_failed', { reason: 'Items must be non-empty array' });
        return res.status(400).json({ 
          error: 'INVALID_CART',
          message: 'Items must be a non-empty array',
          trace_id: traceId,
        });
      }

      // Process each item through Central Pricing Resolver
      for (const [index, item] of items.entries()) {
        // Basic validation
        if (!item.product_id || !item.quantity || item.quantity < 1) {
          log('item_validation_failed', { index, item });
          return res.status(400).json({ 
            error: 'INVALID_ITEM',
            message: 'Each item must have product_id and quantity >= 1',
            invalid_item: item,
            trace_id: traceId,
          });
        }

        // RESOLVE PRICE (Single Source of Truth)
        const pricingResult = await resolvePriceCents(item, supabase, traceId);
        
        // Attach quantity for validation
        pricingResult.quantity = item.quantity;
        resolvedItems.push(pricingResult);
        
        // If pricing failed, log and return error
        if (!pricingResult.success) {
          log('pricing_resolution_failed', {
            item_index: index,
            product_id: item.product_id,
            sku: item.sku,
            error_code: pricingResult.error,
            error_details: pricingResult.details,
          });
          
          return res.status(400).json({
            error: 'PRICE_RESOLUTION_FAILED',
            message: `Failed to resolve price for item: ${pricingResult.error}`,
            error_code: pricingResult.error,
            product_id: item.product_id,
            sku: item.sku,
            details: pricingResult.details,
            trace_id: traceId,
          });
        }
        
        // Build cart item with resolved price
        const itemTotal = pricingResult.unit_amount_cents * item.quantity;
        totalAmount += itemTotal;
        
        cartItems.push({
          product_id: item.product_id,
          sku: item.sku || pricingResult.details?.sku || 'unknown',
          name: pricingResult.details?.name || item.name || 'Product',
          unit_price_cents: pricingResult.unit_amount_cents,
          quantity: item.quantity,
          image_url: item.image_url || null,
          is_configurator: pricingResult.source === 'configurator_db',
          config: item.config || null,
          pricing_snapshot: pricingResult.source === 'configurator_db' ? {
            pricing_source: PRICING_SOURCE,
            pricing_version: pricingResult.details?.pricing_version,
            admin_base_price_cents: pricingResult.details?.base_price_cents,
            option_prices_cents: pricingResult.details?.option_prices_cents,
            computed_subtotal_cents: pricingResult.unit_amount_cents,
            build_id: BUILD_ID,
            calculated_at: new Date().toISOString(),
          } : null,
        });
      }
      
      // =================================================================
      // 3. LOG PRICE RESOLUTION RESULTS (Critical Debug Info)
      // =================================================================
      log('price_resolution_complete', {
        items_resolved: resolvedItems.map(r => ({
          keyUsedForLookup: r.matchedKey,
          resolved_unit_amount_cents: r.unit_amount_cents,
          source: r.source,
          matchedRecordId: r.details?.product_id || r.details?.sku,
          quantity: r.quantity,
          line_total_cents: r.unit_amount_cents * r.quantity,
        })),
        subtotal_cents: totalAmount,
      });
      
      // =================================================================
      // 4. HARD VALIDATION (No Silent Fallbacks!)
      // =================================================================
      const validation = validatePricing(resolvedItems, traceId);
      
      if (!validation.valid) {
        log('validation_failed', {
          error: validation.error,
          failed_item: validation.failedItem,
        });
        
        return res.status(400).json({
          error: 'PRICE_VALIDATION_FAILED',
          message: validation.error,
          failed_item: validation.failedItem,
          trace_id: traceId,
        });
      }
      
      console.log('✅ [PRICING] All prices validated successfully\n');

    } else {
      // Legacy flow: single product
      console.log('🔍 [Checkout] Fetching single product:', sku);
      const { data: product, error: productError } = await supabase
        .from('products')
        .select('*')
        .eq('sku', sku)
        .eq('active', true)
        .single();

      if (productError || !product) {
        console.error('❌ [Checkout] Product not found:', sku);
        return res.status(404).json({ error: 'Product not found or inactive' });
      }

      totalAmount = product.base_price_cents;
      cartItems = [{
        product_id: product.id,
        sku: product.sku,
        name: product.title_de || product.name || product.sku,
        unit_price_cents: product.base_price_cents,
        quantity: 1,
        image_url: product.image_url || null,
      }];

      console.log('✅ [Checkout] Product found:', {
        sku: product.sku,
        price: product.base_price_cents
      });
    }

    // 2. Get user from session (if logged in)
    let userId = null;
    let customerEmail = email;

    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      console.log('🔐 [Checkout] Auth header present, checking user');
      const token = authHeader.substring(7);
      const { data: { user }, error: authError } = await supabase.auth.getUser(token);
      
      if (!authError && user) {
        userId = user.id;
        if (!customerEmail) {
          customerEmail = user.email;
        }
        console.log('✅ [Checkout] User authenticated:', userId);
      } else {
        console.log('⚠️ [Checkout] Auth header invalid or expired');
      }
    } else {
      console.log('ℹ️ [Checkout] Guest checkout (no auth header)');
    }

    console.log('👤 [Checkout] Customer email:', customerEmail || 'none provided');

    // 2.5. Calculate shipping (SSOT: from shipping_rates DB table)
    const shippingCountry = 'DE'; // TODO: Get from user selection or session
    const shippingCents = await calculateShipping(shippingCountry);
    console.log(`[SHIPPING SSOT] Country: ${shippingCountry}, Cost: ${shippingCents}¢`);
    
    // Tax handling: Prices are INCLUSIVE (tax handled in backend/invoice, not in Stripe Checkout)
    const taxCents = 0;
    const subtotalCents = totalAmount;
    const grandTotalCents = totalAmount + shippingCents; // Pre-tax total

    // Build comprehensive order pricing snapshot
    const orderPricingSnapshot = {
      // Snapshot metadata
      snapshot_id: snapshotId,
      snapshot_version: SNAPSHOT_VERSION,
      trace_id: traceId,
      
      // Pricing source
      pricing_source: PRICING_SOURCE,
      build_id: BUILD_ID,
      calculated_at: new Date().toISOString(),
      
      // Items breakdown
      items: cartItems.map(item => ({
        product_id: item.product_id,
        sku: item.sku,
        name: item.name,
        quantity: item.quantity,
        unit_price_cents: item.unit_price_cents,
        line_total_cents: item.unit_price_cents * item.quantity,
        
        // Configurator-specific data
        ...(item.is_configurator && {
          is_configurator: true,
          config: item.config,
          pricing_breakdown: item.pricing_snapshot,
        }),
      })),
      
      // Totals
      subtotal_cents: subtotalCents,
      shipping_cents: shippingCents,
      shipping_country: shippingCountry,
      tax_cents: taxCents, // Updated after Stripe payment
      grand_total_cents: grandTotalCents, // Pre-tax
      
      // Currency
      currency: 'EUR',
    };

    log('snapshot_created', {
      items_count: orderPricingSnapshot.items.length,
      subtotal_cents: orderPricingSnapshot.subtotal_cents,
      shipping_cents: orderPricingSnapshot.shipping_cents,
      grand_total_cents: orderPricingSnapshot.grand_total_cents,
      has_configurator_items: orderPricingSnapshot.items.some(i => i.is_configurator),
      configurator_colors: orderPricingSnapshot.items
        .filter(i => i.is_configurator)
        .map(i => i.config?.colors?.base || 'unknown'),
    });

    // 2.5 Generate DRAFT identifiers (NO final order number yet!)
    // CRITICAL: Use DRAFT- prefix to bypass DB trigger that auto-generates UO- numbers
    // Real UO- order_number is only assigned in webhook after successful payment
    const orderId = randomUUID(); // Generate UUID upfront
    const publicId = generatePublicId(orderId); // First 8 chars of UUID
    const draftOrderNumber = `DRAFT-${orderId.substring(0, 8)}`; // Bypasses DB trigger
    
    log('draft_identifiers_generated', {
      order_id: orderId,
      public_id: publicId,
      draft_order_number: draftOrderNumber,
      note: 'DRAFT- prefix bypasses DB trigger, real UO- assigned on payment',
    });

    // 3. Create order record with pricing snapshot (real order_number assigned in webhook)
    // CRITICAL: DRAFT- prefix marks unpaid checkouts, replaced with UO- on payment
    const orderData = {
      id: orderId, // Explicitly set UUID
      order_number: draftOrderNumber, // ← DRAFT- bypasses auto-generation trigger
      public_id: publicId, // Short public ID
      
      customer_user_id: userId,
      customer_email: customerEmail,
      items: cartItems, // JSON array of cart items
      total_amount_cents: grandTotalCents,
      currency: 'EUR',
      status: 'pending', // ← pending until payment confirmed (DB constraint only allows pending/paid)
      order_type: 'standard',
      
      // CRITICAL: Store pricing snapshot in dedicated column (primary source)
      price_breakdown_json: orderPricingSnapshot,
      
      // CRITICAL: Store trace IDs at top level for querying/debugging
      trace_id: traceId,
      snapshot_id: snapshotId,
      // has_snapshot: auto-generated by DB from price_breakdown_json
      
      // Traceability stored in metadata (fallback/legacy)
      metadata: {
        pricing_snapshot: orderPricingSnapshot,
        source: 'shop_checkout',
        build_id: BUILD_ID,
        trace_id: traceId,
        snapshot_id: snapshotId,
        // order_number: deferred to webhook
        public_id: publicId,
        
        // DIAGNOSTIC: Environment fingerprint for mismatch detection
        env_source: ENV_FINGERPRINT,
      },
      
      // Legacy fields for backwards compatibility
      product_sku: cartItems[0]?.sku || null,
      quantity: items ? items.reduce((sum, item) => sum + item.quantity, 0) : 1,
    };

    // DEBUG: Log what we're trying to save
    log('order_data_prepared', {
      order_id: orderId,
      order_number: null, // Deferred to webhook
      public_id: publicId,
      has_price_breakdown_json: !!orderData.price_breakdown_json,
      has_metadata: !!orderData.metadata,
      has_metadata_pricing_snapshot: !!orderData.metadata?.pricing_snapshot,
      price_breakdown_keys: Object.keys(orderData.price_breakdown_json || {}),
      metadata_keys: Object.keys(orderData.metadata || {}),
    });

    const { data: order, error: orderError } = await supabase
      .from('simple_orders')
      .insert(orderData)
      .select()
      .single();

    if (orderError) {
      log('order_save_failed', { 
        error: orderError.message,
        code: orderError.code,
        hint: orderError.hint,
      });
      return res.status(500).json({ 
        error: 'Failed to create order', 
        details: orderError.message,
        hint: orderError.hint,
        trace_id: traceId,
      });
    }
    
    if (!order) {
      log('order_save_no_data', {});
      return res.status(500).json({ 
        error: 'Order creation returned no data',
        trace_id: traceId,
      });
    }

    // Verify snapshot was saved
    const snapshotSaved = !!(order.price_breakdown_json || order.metadata?.pricing_snapshot);
    
    log('order_saved', {
      order_id: order.id,
      table: 'simple_orders',
      snapshot_saved: snapshotSaved,
      snapshot_in_price_breakdown: !!order.price_breakdown_json,
      snapshot_in_metadata: !!order.metadata?.pricing_snapshot,
      // CRITICAL DEBUG: Log what Supabase returned
      returned_fields: Object.keys(order),
      price_breakdown_type: typeof order.price_breakdown_json,
      metadata_type: typeof order.metadata,
    });

    if (!snapshotSaved) {
      log('WARNING_SNAPSHOT_NOT_SAVED', {
        order_id: order.id,
        fields_checked: ['price_breakdown_json', 'metadata.pricing_snapshot'],
        // Check if fields are undefined vs null
        price_breakdown_is_null: order.price_breakdown_json === null,
        price_breakdown_is_undefined: order.price_breakdown_json === undefined,
        metadata_is_null: order.metadata === null,
        metadata_is_undefined: order.metadata === undefined,
      });
    }

    // 4. Get existing Stripe customer ID (if user is logged in)
    let stripeCustomerId = null;
    if (userId) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('stripe_customer_id')
        .eq('id', userId)
        .single();
      if (profile?.stripe_customer_id) {
        stripeCustomerId = profile.stripe_customer_id;
        console.log('✅ [Checkout] Using existing Stripe customer:', stripeCustomerId);
      }
    }

    // 5. Create Stripe Checkout Session
    console.log('💳 [Checkout] Creating Stripe session');
    const origin = getOrigin(req);
    console.log('🌐 [Checkout] Origin:', origin);

    // Detect user language (Priority: req.body.locale > cart items > default 'de')
    let userLanguage = 'de'; // Default to German
    
    // Priority 1: Explicit locale from request body (sent by cart)
    if (req.body.locale && ['de', 'en'].includes(req.body.locale)) {
      userLanguage = req.body.locale;
    }
    // Priority 2: Cart items metadata
    else if (items && items.length > 0) {
      const firstItem = items[0];
      if (firstItem.lang && ['de', 'en'].includes(firstItem.lang)) {
        userLanguage = firstItem.lang;
      } else if (firstItem.meta?.lang && ['de', 'en'].includes(firstItem.meta.lang)) {
        userLanguage = firstItem.meta.lang;
      }
    }
    
    const stripeLocale = userLanguage === 'en' ? 'en' : 'de';

    // Build line_items from cart (always use price_data for dynamic pricing)
    const lineItems = cartItems.map(item => {
      // Get localized product name
      const productName = PRODUCT_NAMES_I18N[item.sku]?.[userLanguage] 
        || PRODUCT_NAMES_I18N[item.sku]?.en 
        || item.name; // Fallback to cart name if not in map

      return {
        price_data: {
          currency: 'eur',
          product_data: {
            name: productName,
            images: item.image_url ? [item.image_url] : undefined,
            metadata: {
              sku: item.sku,
              is_configurator: item.is_configurator ? 'true' : 'false',
            },
          },
          unit_amount: item.unit_price_cents,
        },
        quantity: item.quantity,
      };
    });

    // Shipping: Add as separate line item with calculated amount
    const shippingLabels = SHIPPING_LABELS_I18N[userLanguage] || SHIPPING_LABELS_I18N.en;
    
    lineItems.push({
      price_data: {
        currency: 'eur',
        product_data: {
          name: shippingLabels.name,
          description: shippingLabels.description,
        },
        unit_amount: shippingCents,
      },
      quantity: 1,
    });
    
    console.log('📦 [Checkout] Shipping calculated:', { country: shippingCountry, amount_cents: shippingCents });

    // =================================================================
    // LOG FINAL STRIPE LINE_ITEMS (Before Stripe Call)
    // =================================================================
    log('stripe_line_items_final', {
      stripe_line_items: lineItems.map(li => ({
        name: li.price_data.product_data.name,
        quantity: li.quantity,
        unit_amount: li.price_data.unit_amount,
        currency: li.price_data.currency,
        line_total: li.price_data.unit_amount * li.quantity,
      })),
      stripe_total_cents: lineItems.reduce((sum, li) => sum + (li.price_data.unit_amount * li.quantity), 0),
      currency: 'EUR',
      locale: stripeLocale,
    });

    // =================================================================
    // HARD VALIDATION: Stripe Amount vs Snapshot (Safety Check)
    // =================================================================
    const calculatedStripeAmountCents = lineItems.reduce((sum, item) => {
      return sum + (item.price_data.unit_amount * item.quantity);
    }, 0);
    
    if (calculatedStripeAmountCents !== orderPricingSnapshot.grand_total_cents) {
      log('stripe_amount_mismatch', {
        stripe_calculated: calculatedStripeAmountCents,
        snapshot_grand_total: orderPricingSnapshot.grand_total_cents,
        diff: Math.abs(calculatedStripeAmountCents - orderPricingSnapshot.grand_total_cents),
        ERROR: 'CRITICAL MISMATCH - CHECKOUT BLOCKED',
      });
      
      return res.status(500).json({ 
        error: 'PRICING_VERIFICATION_FAILED',
        message: 'Amount mismatch between cart and checkout calculation',
        stripe_amount: calculatedStripeAmountCents,
        expected_amount: orderPricingSnapshot.grand_total_cents,
        trace_id: traceId,
      });
    }
    
    console.log('✅ [VALIDATION] Stripe amount verified:', { 
      amount_cents: calculatedStripeAmountCents,
      matches_snapshot: true 
    });

    const sessionData = guardCheckoutSession({
      // PAYMENT METHODS: Card + PayPal (confirmed active)
      payment_method_types: ['card', 'paypal'],
      line_items: lineItems,
      mode: 'payment',
      locale: stripeLocale, // 'de' or 'en' based on cart language
      success_url: `${origin}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/cart`,
      
      // SHIPPING: Address collection (for fulfillment, not pricing)
      shipping_address_collection: {
        allowed_countries: ['DE', 'AT', 'CH', 'NL', 'BE', 'LU', 'FR', 'IT', 'ES', 'PT'],
      },
      phone_number_collection: {
        enabled: true,
      },
      
      // CUSTOMER: Use existing or create new
      ...(stripeCustomerId ? {
        customer: stripeCustomerId,
      } : {
        customer_creation: 'always',
        customer_email: customerEmail || undefined,
      }),
      
      // METADATA: Link session to order in DB (SINGLE SOURCE OF TRUTH)
      // NOTE: order_number is NOT set here - it will be assigned in webhook after payment
      metadata: {
        order_id: order.id, // UUID - PRIMARY identifier for webhook lookup
        // order_number: DEFERRED - assigned by webhook on payment success
        public_id: order.public_id, // Short ID (8 chars)
        customer_email: customerEmail || 'guest',
        source: 'shop_checkout',
        build_id: BUILD_ID,
        pricing_source: PRICING_SOURCE,
        trace_id: traceId,
        snapshot_id: snapshotId,
        ui_lang: userLanguage, // 'de' or 'en' for debugging
        accept_language: req.headers['accept-language'] ? req.headers['accept-language'].substring(0, 50) : 'NONE',
        build_commit: process.env.VERCEL_GIT_COMMIT_SHA || 'local',
        is_draft: 'true', // Flag to indicate order_number not yet assigned
      },
    });

    // 6. Create Stripe checkout session
    const session = await stripe.checkout.sessions.create(sessionData);
    
    // LOG: Payment methods configuration
    console.log('💳 [STRIPE PAYMENT METHODS]', {
      payment_method_types: session.payment_method_types,
      locale: session.locale,
    });
    
    log('stripe_session_created', {
      order_id: order.id,
      stripe_session_id: session.id,
      stripe_amount_total: session.amount_total,
      stripe_currency: session.currency,
      expected_amount_cents: grandTotalCents,
      amount_match: session.amount_total === grandTotalCents,
      payment_methods: session.payment_method_types,
    });

    // 7. Update order with Stripe session ID
    console.log('📝 [Checkout] Updating order with session ID');
    const { error: updateError } = await supabase
      .from('simple_orders')
      .update({ 
        stripe_session_id: session.id,
        updated_at: new Date().toISOString(),
      })
      .eq('id', order.id);

    if (updateError) {
      console.error('⚠️ [Checkout] Failed to update order:', updateError);
      // Don't fail the request - session is created
    }

    // 8. Return checkout URL
    log('checkout_draft_created', {
      order_id: order.id,
      public_id: order.public_id,
      status: 'draft',
      stripe_session_id: session.id,
      session_url_length: session.url?.length || 0,
      note: 'order_number assigned on payment success via webhook',
    });

    console.log(`✅ [CHECKOUT DRAFT] Order ${order.id.substring(0,8)} (draft) - Session: ${session.id}`);

    res.status(200).json({ 
      url: session.url,
      session_id: session.id,
      order_id: order.id,
      trace_id: traceId,
      snapshot_id: snapshotId,
    });

  } catch (error) {
    log('checkout_error', {
      error_type: error.type || error.name,
      error_message: error.message,
      error_code: error.code,
    });
    
    // Specific error handling
    if (error.type === 'StripeInvalidRequestError') {
      return res.status(400).json({ 
        error: 'Invalid payment request',
        details: error.message,
        trace_id: traceId,
      });
    }
    
    if (error.code === 'PGRST116') {
      return res.status(404).json({
        error: 'Database record not found',
        details: error.message,
        trace_id: traceId,
      });
    }

    res.status(500).json({ 
      error: 'Checkout failed',
      message: error.message || 'Internal server error',
      type: error.type || 'UnknownError',
      trace_id: traceId,
    });
  }
}
