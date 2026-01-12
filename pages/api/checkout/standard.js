import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';
import { calcConfiguredPrice } from '../../../lib/pricing/calcConfiguredPriceDB.js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Build ID from environment (for traceability)
const BUILD_ID = process.env.VERCEL_GIT_COMMIT_SHA?.substring(0, 7) || 'local-dev';
const PRICING_SOURCE = 'adminpanel_db';
const IS_PRODUCTION = process.env.NODE_ENV === 'production';
const SNAPSHOT_VERSION = 'unbreak-one.pricing.v1';

// Shipping calculation (from DB rules - TODO: fetch from shipping_rules table)
function calculateShipping(country = 'DE') {
  const SHIPPING_RULES = {
    DE: 490, // €4.90 for Germany
    AT: 790, // €7.90 for Austria
    CH: 990, // €9.90 for Switzerland
    EU: 690, // €6.90 for EU
    DEFAULT: 990, // €9.90 for rest
  };
  return SHIPPING_RULES[country] || SHIPPING_RULES.DEFAULT;
}

// Helper: Get origin from request (no hardcoded domains)
function getOrigin(req) {
  // 1. Try ENV variable first (most reliable for production)
  if (process.env.NEXT_PUBLIC_SITE_URL) {
    return process.env.NEXT_PUBLIC_SITE_URL;
  }
  
  // 2. Try origin header
  if (req.headers.origin) {
    return req.headers.origin;
  }
  
  // 3. Fallback: construct from host header
  const host = req.headers.host || 'localhost:3000';
  const protocol = req.headers['x-forwarded-proto'] || (host.includes('localhost') ? 'http' : 'https');
  return `${protocol}://${host}`;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
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

  log('checkout_start', { 
    items_count: req.body.items?.length || 1,
    has_email: !!req.body.email,
  });

  try {
    // ENV CHECK
    if (!process.env.STRIPE_SECRET_KEY) {
      console.error('❌ [Checkout] STRIPE_SECRET_KEY not set');
      return res.status(500).json({ error: 'Server configuration error: STRIPE_SECRET_KEY missing' });
    }

    // STRIPE ACCOUNT VERIFICATION
    const secretKey = process.env.STRIPE_SECRET_KEY;
    const keyPrefix = secretKey.substring(0, 8); // sk_test_ or sk_live_
    const isTestMode = keyPrefix.includes('test');
    
    console.log('🔑 [STRIPE ACCOUNT] Key prefix:', keyPrefix);
    console.log('🔑 [STRIPE ACCOUNT] Mode:', isTestMode ? 'TEST' : 'LIVE');
    
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
    console.log('📦 [Checkout] Request:', { sku, email, items: items?.length });

    // Validate input
    if (!items && !sku) {
      console.error('❌ [Checkout] Missing items or sku');
      return res.status(400).json({ error: 'Either items array or sku is required' });
    }

    if (items && (!Array.isArray(items) || items.length === 0)) {
      console.error('❌ [Checkout] Invalid items array');
      return res.status(400).json({ error: 'Items must be a non-empty array' });
    }

    // 1. Fetch and validate products
    let cartItems = [];
    let totalAmount = 0;

    if (items) {
      // New cart flow: multiple items with quantities
      console.log('🛒 [Checkout] Processing cart with', items.length, 'items');

      for (const item of items) {
        if (!item.product_id || !item.quantity || item.quantity < 1) {
          console.error('❌ [Checkout] Invalid item:', item);
          return res.status(400).json({ 
            error: 'Each item must have product_id and quantity >= 1',
            invalid_item: item
          });
        }

        // CONFIGURATOR ITEMS: Calculate price from config using DB pricing engine
        if (item.product_id === 'glass_configurator' || item.sku === 'glass_configurator') {
          console.log('🎨 [Checkout] Configurator item detected');
          
          if (!item.config) {
            console.error('❌ [Checkout] Configurator item missing config');
            return res.status(400).json({ 
              error: 'Configurator item must include config object',
              message: 'Configuration data is required for custom products',
              product_id: item.product_id,
              build_id: BUILD_ID,
            });
          }

          // Validate config structure
          if (!item.config.colors || typeof item.config.colors !== 'object') {
            console.error('❌ [Checkout] Config missing colors object:', item.config);
            return res.status(400).json({ 
              error: 'Invalid config structure',
              message: 'Config must include colors object with base, arm, module, pattern',
              received_config_keys: Object.keys(item.config),
              expected_structure: { colors: { base: '...', arm: '...', module: '...', pattern: '...' }, finish: '...' },
              build_id: BUILD_ID,
            });
          }

          console.log('🔍 [Checkout] Config structure:', {
            colors: Object.keys(item.config.colors),
            finish: item.config.finish,
            variant: item.config.variant,
          });

          // Calculate price using DB pricing engine (source of truth)
          let pricing;
          try {
            pricing = await calcConfiguredPrice({
              productType: 'glass_holder',
              config: item.config,
              customFeeCents: 0,
            });
          } catch (error) {
            console.error('❌ [Checkout] Pricing calculation failed:', error);
            if (IS_PRODUCTION) {
              // FAIL-CLOSED: No fallback in production
              return res.status(500).json({ 
                error: 'Pricing configuration not available',
                message: 'Unable to calculate product price. Please contact support.',
                build_id: BUILD_ID,
              });
            } else {
              // DEV: Log and continue with minimal price for testing
              console.warn('⚠️ [DEV] Using fallback pricing for development');
              pricing = {
                pricing_version: 'dev-fallback',
                base_price_cents: 4990,
                option_prices_cents: { base: 0, arm: 0, module: 0, pattern: 0, finish: 0 },
                custom_fee_cents: 0,
                subtotal_cents: 4990,
                display_title: 'Glashalter (konfiguriert)',
                sku: 'UNBREAK-GLAS-CONFIG',
              };
            }
          }

          // Validate pricing result
          if (!pricing || !pricing.subtotal_cents || pricing.subtotal_cents <= 0) {
            console.error('❌ [Checkout] Invalid pricing result:', pricing);
            return res.status(500).json({ 
              error: 'Invalid pricing calculation',
              message: 'Calculated price is invalid. Please contact support.',
              build_id: BUILD_ID,
            });
          }

          // Create pricing snapshot for order
          const pricingSnapshot = {
            pricing_source: PRICING_SOURCE,
            pricing_version: pricing.pricing_version,
            admin_base_price_cents: pricing.base_price_cents,
            option_prices_cents: pricing.option_prices_cents,
            custom_fee_cents: pricing.custom_fee_cents,
            computed_subtotal_cents: pricing.subtotal_cents,
            build_id: BUILD_ID,
            calculated_at: new Date().toISOString(),
          };

          const itemTotal = pricing.subtotal_cents * item.quantity;
          totalAmount += itemTotal;

          cartItems.push({
            product_id: 'glass_configurator',
            sku: pricing.sku,
            name: pricing.display_title,
            unit_price_cents: pricing.subtotal_cents,
            quantity: item.quantity,
            image_url: null,
            is_configurator: true,
            config: item.config,
            pricing_snapshot: pricingSnapshot,
          });

          console.log('✅ [Checkout] Configurator price calculated:', {
            sku: pricing.sku,
            quantity: item.quantity,
            unit_price_cents: pricing.subtotal_cents,
            admin_base_price_cents: pricing.base_price_cents,
            option_prices_cents: pricing.option_prices_cents,
            pricing_version: pricing.pricing_version,
            build_id: BUILD_ID,
          });
          continue; // Skip DB lookup
        }

        // STANDARD PRODUCTS: Fetch from database
        const { data: product, error: productError } = await supabase
          .from('products')
          .select('*')
          .eq('id', item.product_id)
          .eq('active', true)
          .single();

        if (productError || !product) {
          console.error('❌ [Checkout] Product not found:', item.product_id);
          return res.status(404).json({ 
            error: 'Product not found or inactive',
            product_id: item.product_id,
            build_id: BUILD_ID,
          });
        }

        const itemTotal = product.base_price_cents * item.quantity;
        totalAmount += itemTotal;

        cartItems.push({
          product_id: product.id,
          sku: product.sku,
          name: product.title_de || product.name || product.sku,
          unit_price_cents: product.base_price_cents,
          quantity: item.quantity,
          image_url: product.image_url || null,
        });

        console.log('✅ [Checkout] Item validated:', {
          sku: product.sku,
          quantity: item.quantity,
          unit_price: product.base_price_cents,
          subtotal: itemTotal
        });
      }

      console.log('💰 [Checkout] Total amount:', totalAmount, 'cents');

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

    // 2.5. Calculate shipping and create comprehensive pricing snapshot
    const shippingCountry = 'DE'; // TODO: Get from user selection or session
    const shippingCents = calculateShipping(shippingCountry);
    
    // Tax will be calculated by Stripe automatic_tax
    // We store 0 here and update after payment with actual amount
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

    // 3. Create order record with pricing snapshot
    const orderData = {
      customer_user_id: userId,
      customer_email: customerEmail,
      items: cartItems, // JSON array of cart items
      total_amount_cents: grandTotalCents,
      currency: 'EUR',
      status: 'pending',
      order_type: 'standard',
      
      // CRITICAL: Store pricing snapshot in dedicated column (primary source)
      price_breakdown_json: orderPricingSnapshot,
      
      // Traceability stored in metadata (DB columns may not exist yet)
      metadata: {
        pricing_snapshot: orderPricingSnapshot,
        source: 'shop_checkout',
        build_id: BUILD_ID,
        trace_id: traceId,
        snapshot_id: snapshotId,
      },
      
      // Legacy fields for backwards compatibility
      product_sku: cartItems[0]?.sku || null,
      quantity: items ? items.reduce((sum, item) => sum + item.quantity, 0) : 1,
    };

    // DEBUG: Log what we're trying to save
    log('order_data_prepared', {
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

    // Build line_items from cart (always use price_data for dynamic pricing)
    const lineItems = cartItems.map(item => {
      console.log(`💰 [Checkout] Creating line item for ${item.sku}: €${(item.unit_price_cents / 100).toFixed(2)}`);
      return {
        price_data: {
          currency: 'eur',
          product_data: {
            name: item.name,
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
    lineItems.push({
      price_data: {
        currency: 'eur',
        product_data: {
          name: `Versand (${shippingCountry})`,
          description: 'Standard shipping',
        },
        unit_amount: shippingCents,
      },
      quantity: 1,
    });
    
    console.log('📦 [Checkout] Shipping calculated:', { country: shippingCountry, amount_cents: shippingCents });

    // SAFETY CHECK: Verify Stripe amount matches pricing snapshot
    const calculatedStripeAmountCents = lineItems.reduce((sum, item) => {
      return sum + (item.price_data.unit_amount * item.quantity);
    }, 0);
    
    if (calculatedStripeAmountCents !== orderPricingSnapshot.grand_total_cents) {
      console.error('❌ [Checkout] CRITICAL: Stripe amount mismatch!', {
        stripe_calculated: calculatedStripeAmountCents,
        snapshot_grand_total: orderPricingSnapshot.grand_total_cents,
        diff: Math.abs(calculatedStripeAmountCents - orderPricingSnapshot.grand_total_cents),
      });
      return res.status(500).json({ 
        error: 'Pricing verification failed',
        details: 'Amount mismatch between cart and checkout calculation'
      });
    }
    
    console.log('✅ [Checkout] Stripe amount verified:', { 
      amount_cents: calculatedStripeAmountCents,
      matches_snapshot: true 
    });

    const sessionData = {
      payment_method_types: ['card'],
      line_items: lineItems,
      mode: 'payment',
      success_url: `${origin}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/cart`,
      
      // SHIPPING: Address collection (for fulfillment, not pricing)
      shipping_address_collection: {
        allowed_countries: ['DE', 'AT', 'CH', 'NL', 'BE', 'LU', 'FR', 'IT', 'ES', 'PT'],
      },
      
      // TAX: Automatic tax calculation
      automatic_tax: {
        enabled: true,
      },
      
      // CUSTOMER: Use existing or create new
      ...(stripeCustomerId ? {
        customer: stripeCustomerId,
      } : {
        customer_creation: 'always',
        customer_email: customerEmail || undefined,
      }),
      
      // METADATA: Link session to order in DB
      metadata: {
        order_id: order.id,
        customer_email: customerEmail || 'guest',
        source: 'shop_checkout',
        build_id: BUILD_ID,
        pricing_source: PRICING_SOURCE,
        trace_id: traceId,
        snapshot_id: snapshotId,
      },
    };

    // 6. Create Stripe checkout session
    const session = await stripe.checkout.sessions.create(sessionData);
    
    log('stripe_session_created', {
      order_id: order.id,
      stripe_session_id: session.id,
      stripe_amount_total: session.amount_total,
      stripe_currency: session.currency,
      expected_amount_cents: grandTotalCents,
      amount_match: session.amount_total === grandTotalCents,
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
    log('checkout_success', {
      order_id: order.id,
      stripe_session_id: session.id,
      session_url_length: session.url?.length || 0,
    });

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
