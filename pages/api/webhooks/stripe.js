import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';
import { buffer } from 'micro';
import prisma from '../../../lib/prisma';
import { calcConfiguredPrice } from '../../../lib/pricing/calcConfiguredPriceDB.js';
import { countryToRegion } from '../../../lib/utils/shipping.js';
import { sendOrderConfirmation } from '../../../lib/email/emailService';
import { stripe, getWebhookSecret, IS_TEST_MODE } from '../../../lib/stripe-config.js';
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Disable default body parser - we need raw body for signature verification
export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req, res) {
  // === DIAGNOSTIC LOGGING ===
  console.log('🪝 [WEBHOOK HIT] Method:', req.method);
  console.log('🪝 [WEBHOOK HIT] Has stripe-signature:', !!req.headers['stripe-signature']);
  console.log('🪝 [ENV CHECK] STRIPE_SECRET_KEY present:', !!process.env.STRIPE_SECRET_KEY);
  console.log('🪝 [ENV CHECK] STRIPE_WEBHOOK_SECRET present:', !!process.env.STRIPE_WEBHOOK_SECRET);
  
  // === DB ENVIRONMENT DEBUG (Masked) ===
  const dbUrl = process.env.DATABASE_URL || '';
  const dbHost = dbUrl.match(/@([^:]+)/)?.[1] || 'unknown';
  const dbUrlLast6 = dbUrl.slice(-6);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('[DB_ENV] APP_ENV:', process.env.APP_ENV || 'production');
  console.log('[DB_ENV] DB_HOST:', dbHost);
  console.log('[DB_ENV] DB_URL_TAIL:', '...' + dbUrlLast6);
  console.log('[DB_ENV] DB_LABEL:', process.env.DB_PROJECT_LABEL || 'unbreak-one-prod');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  if (req.method !== 'POST') {
    console.log('⚠️ [Webhook] Non-POST request received:', req.method);
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // 1. Get raw body for signature verification
    const buf = await buffer(req);
    const sig = req.headers['stripe-signature'];

    if (!sig) {
      console.error('❌ [Webhook] No stripe-signature header');
      return res.status(400).json({ error: 'Missing stripe-signature header' });
    }

    // 2. Verify webhook signature (multi-secret support)
    let event;
    let matchedSecretIndex = -1;
    
    // Parse webhook secrets (supports single or multiple secrets separated by | or ,)
    const webhookSecretEnv = getWebhookSecret();
    const webhookSecrets = webhookSecretEnv.includes('|') 
      ? webhookSecretEnv.split('|').map(s => s.trim())
      : webhookSecretEnv.includes(',')
      ? webhookSecretEnv.split(',').map(s => s.trim())
      : [webhookSecretEnv.trim()];
    
    console.log(`🔑 [SECRETS] Found ${webhookSecrets.length} webhook secret(s)`);
    
    // Try to verify with each secret
    let lastError = null;
    for (let i = 0; i < webhookSecrets.length; i++) {
      try {
        event = stripe.webhooks.constructEvent(buf, sig, webhookSecrets[i]);
        matchedSecretIndex = i;
        break; // Success - stop trying
      } catch (err) {
        lastError = err;
        // Continue to next secret
      }
    }
    
    if (matchedSecretIndex === -1) {
      // No secret matched
      const eventIdHint = lastError?.raw?.event?.id || 'unknown';
      const livemodeHint = lastError?.raw?.event?.livemode !== undefined 
        ? lastError.raw.event.livemode 
        : 'unknown';
      
      console.error(`❌ [WEBHOOK] FAIL signature mismatch (tried ${webhookSecrets.length} secrets)`);
      console.error(`❌ [WEBHOOK] event_id=${eventIdHint} livemode=${livemodeHint}`);
      console.error(`❌ [SIGNATURE] Last error: ${lastError.message}`);
      
      return res.status(400).json({ 
        error: `Webhook signature verification failed: ${lastError.message}` 
      });
    }
    
    // Success
    const eventMode = event.livemode ? 'LIVE' : 'TEST';
    const trace_id = event.data.object.metadata?.trace_id;
    
    console.log(`✅ [WEBHOOK] OK secret_index=${matchedSecretIndex} livemode=${event.livemode} event=${event.type} id=${event.id}`);
    console.log(`🔒 [MODE] event.livemode=${event.livemode} → ${eventMode}`);
    
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // MODE/KEY CONSISTENCY CHECK
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    const stripeKeyPrefix = process.env.STRIPE_SECRET_KEY?.substring(0, 7) || 'unknown';
    const keyIsLive = stripeKeyPrefix.includes('sk_live');
    const keyIsTest = stripeKeyPrefix.includes('sk_test');
    
    console.log(`🔑 [KEY_CHECK] STRIPE_SECRET_KEY prefix: ${stripeKeyPrefix}`);
    console.log(`🔑 [KEY_CHECK] Key mode: ${keyIsLive ? 'LIVE' : keyIsTest ? 'TEST' : 'UNKNOWN'}`);
    
    // Check for mode mismatch
    if (event.livemode && keyIsTest) {
      console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.error('❌ [MODE_MISMATCH] Event is LIVE but key is TEST');
      console.error(`❌ event.livemode=${event.livemode} but STRIPE_SECRET_KEY=${stripeKeyPrefix}`);
      console.error('❌ Cannot process - wrong API key for this event');
      console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      return res.status(500).json({
        error: 'MODE_MISMATCH: Live event with test key',
        event_livemode: event.livemode,
        key_prefix: stripeKeyPrefix
      });
    }
    
    if (!event.livemode && keyIsLive) {
      console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.error('❌ [MODE_MISMATCH] Event is TEST but key is LIVE');
      console.error(`❌ event.livemode=${event.livemode} but STRIPE_SECRET_KEY=${stripeKeyPrefix}`);
      console.error('❌ Cannot process - wrong API key for this event');
      console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      return res.status(500).json({
        error: 'MODE_MISMATCH: Test event with live key',
        event_livemode: event.livemode,
        key_prefix: stripeKeyPrefix
      });
    }
    
    console.log('✅ [MODE_CHECK] Event mode and key mode are consistent');
    
    console.log('[WEBHOOK HIT]', event.type);
    console.log('[EVENT MODE]', eventMode);
    console.log('[EMAILS_ENABLED]', process.env.EMAILS_ENABLED);
    console.log('[RESEND_API_KEY]', process.env.RESEND_API_KEY ? 'SET' : 'MISSING');
    console.log('[SESSION ID]', event.data.object.id);
    console.log('[CUSTOMER EMAIL]', event.data.object.customer_details?.email);
    console.log('[TRACE] WEBHOOK_IN', {
      trace_id,
      event_id: event.id,
      event_type: event.type,
      event_livemode: event.livemode,
      event_mode: eventMode,
      timestamp: new Date().toISOString()
    });
    
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // EVENT IDEMPOTENCY: Check if event already processed (CHECK FIRST, CREATE LATER)
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    const existingEvent = await prisma.orderEvent.findFirst({
      where: { stripeEventId: event.id }
    });
    
    if (existingEvent) {
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log(`[EVENT_DUPLICATE] event_id=${event.id} event_type=${event.type} - Already processed`);
      console.log(`[EVENT_DUPLICATE] Existing event record: ${existingEvent.id}`);
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      return res.status(200).json({ 
        received: true, 
        duplicate: true, 
        event_id: event.id,
        existing_event_id: existingEvent.id
      });
    }
    
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`[EVENT_DEDUP_CHECK] event_id=${event.id} is NEW - proceeding with processing`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    // 3. Handle specific events
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutSessionCompleted({ event, session: event.data.object, trace_id, eventMode });
        break;

      case 'customer.created':
        await handleCustomerCreated(event.data.object);
        break;

      case 'customer.updated':
        await handleCustomerUpdated(event.data.object);
        break;

      default:
        console.log(`⚠️ [Webhook] Unhandled event type: ${event.type}`);
    }

    // 4. Return success response
    res.status(200).json({ received: true, event: event.type, mode: eventMode });

  } catch (error) {
    console.error('❌ [Webhook] Fatal error:', error);
    console.error('❌ [Webhook] Error stack:', error.stack);
    
    // Handle expected errors (like expired sessions) with 200 OK
    if (error.isExpectedError) {
      console.log('⚠️ [Webhook] Expected error - returning 200 OK to prevent retry');
      return res.status(200).json({ 
        received: true, 
        skipped: true,
        reason: error.message,
        session_id: error.sessionId
      });
    }
    
    // Unexpected errors - return 500 to trigger Stripe retry
    res.status(500).json({ 
      error: 'Webhook handler failed',
      message: error.message 
    });
  }
}

async function handleCheckoutSessionCompleted({ event, session, trace_id, eventMode }) {
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // CRITICAL: Create stable variables IMMEDIATELY to prevent ReferenceError in nested scopes
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  const stripeEventId = event?.id || null;
  const stripeEventType = event?.type || 'unknown';
  const sessionId = session?.id || 'unknown';
  
  console.log('[TRACE] WEBHOOK_SESSION_DATA', {
    trace_id,
    event_id: stripeEventId,
    stripe_session_id: sessionId,
    stripe_customer_id: session.customer,
    email: session.customer_details?.email || session.customer_email,
    payment_status: session.payment_status,
    amount_total: session.amount_total,
    has_metadata: !!session.metadata
  });
  
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('💳 [STRIPE SESSION] ID:', sessionId);
  console.log('💳 [STRIPE SESSION] Payment status:', session.payment_status);
  console.log('💳 [STRIPE EVENT] ID:', stripeEventId, 'Type:', stripeEventType);
  console.log('💳 [SSOT MODE] Writing directly to admin_orders (NO legacy tables)');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  let logData = {
    event_type: 'checkout.session.completed',
    stripe_session_id: sessionId,
    status: 'processing',
    error_message: null,
    order_id: null,
    rows_affected: 0
  };

  try {
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // SSOT MODE: Extract ALL data from Stripe Session (NO legacy table reads)
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🔍 [STRIPE DATA EXTRACTION] Using event.data.object directly...');
    
    // Check if line_items are already in the event
    let fullSession = session;
    
    // Only retrieve session if line_items are not expanded
    if (!session.line_items || !session.line_items.data || session.line_items.data.length === 0) {
      console.log('⚠️ [STRIPE DATA] line_items not in event, attempting retrieve...');
      
      try {
        fullSession = await stripe.checkout.sessions.retrieve(session.id, {
          expand: [
            'line_items',
            'line_items.data.price.product',
            'customer',
            'payment_intent'
          ]
        });
        console.log('✅ [STRIPE DATA] Session retrieved successfully');
      } catch (sessionError) {
        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        // CRITICAL FIX: session.retrieve failure does NOT block order creation
        // We continue with event.data.object and try to extract what we can
        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        console.warn('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.warn('⚠️ [STRIPE SESSION RETRIEVE FAILED]');
        console.warn('⚠️ [SESSION ID]:', sessionId);
        console.warn('⚠️ [ERROR]:', sessionError.message);
        console.warn('⚠️ [CODE]:', sessionError.code);
        console.warn('⚠️ [STATUS CODE]:', sessionError.statusCode);
        console.warn('⚠️ [ACTION] Continuing with event.data.object (may have incomplete data)');
        console.warn('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        
        // Use session from event as fallback
        fullSession = session;
        
        // Check if we have metadata with cart/config info as fallback
        if (session.metadata?.config_json || session.metadata?.cart_json) {
          console.log('✅ [FALLBACK] Found cart/config data in session.metadata');
        } else {
          console.warn('⚠️ [FALLBACK] No metadata fallback - order may be incomplete');
        }
      }
    } else {
      console.log('✅ [STRIPE DATA] line_items already in event, skipping retrieve');
    }
    
    console.log('✅ [STRIPE DATA] Session ready');
    console.log('✅ [STRIPE DATA] Line items:', fullSession.line_items?.data?.length || 0);
    console.log('✅ [STRIPE DATA] Customer:', fullSession.customer_details?.email);
    console.log('✅ [STRIPE DATA] Payment Intent:', fullSession.payment_intent);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    // === EXTRACT CUSTOMER DATA ===
    const customerEmail = fullSession.customer_details?.email || fullSession.customer_email;
    const customerName = fullSession.customer_details?.name;
    const customerPhone = fullSession.customer_details?.phone;
    
    if (!customerEmail) {
      console.error('❌ [VALIDATION] No customer email in session');
      throw new Error('No customer email in Stripe session');
    }
    
    console.log('👤 [CUSTOMER] Email:', customerEmail);
    console.log('👤 [CUSTOMER] Name:', customerName || '(none)');
    console.log('👤 [CUSTOMER] Phone:', customerPhone || '(none)');
    
    // === EXTRACT ADDRESSES ===
    // Log session shape for debugging
    const hasCustomerAddress = !!fullSession.customer_details?.address;
    const hasShippingAddress = !!fullSession.shipping_details?.address;
    const customerAddrKeys = hasCustomerAddress ? Object.keys(fullSession.customer_details.address) : [];
    const shippingAddrKeys = hasShippingAddress ? Object.keys(fullSession.shipping_details.address) : [];
    
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`[STRIPE_SESSION_SHAPE] hasCustomerAddress=${hasCustomerAddress} hasShippingAddress=${hasShippingAddress}`);
    console.log(`[STRIPE_SESSION_SHAPE] customerAddrKeys=[${customerAddrKeys.join(',')}]`);
    console.log(`[STRIPE_SESSION_SHAPE] shippingAddrKeys=[${shippingAddrKeys.join(',')}]`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    const billingAddress = fullSession.customer_details?.address ?? null;
    const shippingAddress = fullSession.shipping_details?.address ?? billingAddress ?? null;
    const shippingName = fullSession.shipping_details?.name || customerName || null;
    
    console.log('🏠 [ADDRESS] Shipping:', shippingAddress ? `${shippingAddress.line1}, ${shippingAddress.city}` : 'MISSING');
    console.log('📋 [ADDRESS] Billing:', billingAddress ? `${billingAddress.line1}, ${billingAddress.city}` : 'MISSING');
    
    // === EXTRACT LINE ITEMS ===
    const lineItems = fullSession.line_items?.data || [];
    
    // Try to extract from metadata if line_items are missing
    if (lineItems.length === 0) {
      console.warn('⚠️ [LINE ITEMS] No line_items in session data');
      
      // Check for fallback in metadata
      if (fullSession.metadata?.cart_json || fullSession.metadata?.config_json) {
        console.warn('⚠️ [LINE ITEMS] Attempting to parse from metadata...');
        try {
          const cartData = fullSession.metadata.cart_json 
            ? JSON.parse(fullSession.metadata.cart_json)
            : null;
          const configData = fullSession.metadata.config_json
            ? JSON.parse(fullSession.metadata.config_json)
            : null;
          
          if (cartData || configData) {
            console.warn('⚠️ [LINE ITEMS] Found metadata but parsing not implemented yet');
            console.warn('⚠️ [LINE ITEMS] Order will be created but may be incomplete');
          }
        } catch (parseError) {
          console.error('❌ [METADATA PARSE] Failed:', parseError.message);
        }
      }
      
      // Don't throw - allow order creation even if incomplete
      console.warn('⚠️ [VALIDATION] No line items - order will be marked incomplete');
    }
    
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🛒 [LINE ITEMS] Extracting items from Stripe session...');
    
    const items = lineItems.map((item, idx) => {
      const product = item.price?.product;
      const name = item.description || product?.name || 'Unknown Product';
      const sku = product?.metadata?.sku || `STRIPE-${item.price?.id}`;
      const qty = item.quantity || 1;
      const unitPrice = item.price?.unit_amount || 0;
      const totalPrice = item.amount_total || (unitPrice * qty);
      
      console.log(`  [${idx + 1}] ${qty}× ${name} (${sku}) @ ${unitPrice}¢ = ${totalPrice}¢`);
      
      return {
        sku,
        name,
        qty,
        unitPrice,
        totalPrice,
        variant: product?.metadata?.variant || null
      };
    });
    
    console.log(`✅ [LINE ITEMS] Extracted ${items.length} items`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    // === WRITE TO SUPABASE admin_orders ===
    const adminOrder = await syncStripeSessionToAdminOrders(fullSession, {
      customerEmail,
      customerName,
      customerPhone,
      shippingAddress,
      billingAddress,
      shippingName,
      items
    });
    
    if (!adminOrder) {
      console.error('❌ [SSOT] Failed to write to admin_orders');
      throw new Error('Failed to create admin_orders entry');
    }
    
    logData.order_id = adminOrder.id;
    logData.status = 'success';
    
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // CRITICAL: Mark event as processed ONLY AFTER successful order write
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('[EVENT_MARK_PROCESSED] Order write successful, marking event as processed...');
    
    try {
      await prisma.orderEvent.create({
        data: {
          stripeEventId: stripeEventId,
          eventType: stripeEventType,
          type: 'STRIPE_WEBHOOK',
          source: 'stripe',
          orderId: adminOrder.id,
          payload: {
            session_id: sessionId,
            order_id: adminOrder.id,
            marked_at: new Date().toISOString()
          }
        }
      });
      console.log(`[EVENT_MARK_PROCESSED] ✅ Event ${stripeEventId} marked as processed`);
    } catch (eventMarkError) {
      // If this fails, it might be a duplicate (race condition) - that's OK
      if (eventMarkError.code === 'P2002') {
        console.log(`[EVENT_MARK_PROCESSED] ⚠️ Event already marked (race condition) - OK`);
      } else {
        console.error(`[EVENT_MARK_PROCESSED] ❌ Failed to mark event:`, eventMarkError.message);
        // Don't throw - order is already written
      }
    }
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    // === DB-RELOAD: Load order with items from admin_orders (VALIDATION) ===
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🔄 [DB_RELOAD] Loading order from admin_orders for validation...');
    
    const orderWithItems = await prisma.order.findUnique({
      where: { id: adminOrder.id },
      include: {
        items: {
          select: {
            id: true,
            sku: true,
            name: true,
            variant: true,
            qty: true,
            unitPrice: true,
            totalPrice: true,
          }
        }
      }
    });
    
    if (!orderWithItems) {
      console.error('❌ [DB_RELOAD] Order not found after write!');
      throw new Error('DB-Reload failed: order not found');
    }
    
    const itemsCount = orderWithItems.items?.length || 0;
    const hasBilling = !!(orderWithItems.billingAddress && orderWithItems.billingAddress.line1);
    const hasShipping = !!(orderWithItems.shippingAddress && orderWithItems.shippingAddress.line1);
    const hasTotals = !!(orderWithItems.subtotalNet && orderWithItems.totalGross);
    const hasEmail = !!orderWithItems.email;
    const hasPhone = !!orderWithItems.customer?.phone;
    
    console.log(`[DB_RELOAD_OK] order_id=${adminOrder.id.substring(0, 8)} fields={email:${hasEmail},phone:${hasPhone},billing:${hasBilling},shipping:${hasShipping},items:${itemsCount},totals:{subtotal:${orderWithItems.subtotalNet}¢,shipping:${orderWithItems.amountShipping}¢,tax:${orderWithItems.taxAmount}¢,total:${orderWithItems.totalGross}¢}}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    // === VALIDATION: Check completeness ===
    if (itemsCount === 0 || !hasTotals) {
      console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.error('❌ [VALIDATION_FAIL] Order incomplete after DB write!');
      console.error(`❌ items_count=${itemsCount} has_totals=${hasTotals}`);
      console.error('❌ Order was created but email will NOT be sent');
      console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      
      await prisma.order.update({
        where: { id: adminOrder.id },
        data: { 
          emailStatus: 'blocked_incomplete',
          emailLastError: `Validation failed: items=${itemsCount}, totals=${hasTotals}`
        }
      });
      
      await prisma.orderEvent.create({
        data: {
          orderId: adminOrder.id,
          type: 'ERROR',
          source: 'webhook',
          payload: { 
            reason: 'validation_failed', 
            items_count: itemsCount,
            has_totals: hasTotals
          }
        }
      });
      
      console.log('✅ [DB_WRITE_OK] Order created (incomplete) - will not retry');
      return; // Don't send email but event was processed successfully
    }
    
    // === SEND EMAIL (with idempotency + required fields gate) ===
    await sendOrderEmailFromAdminOrders(adminOrder.id, trace_id, eventMode);
    
    await logWebhookEvent(logData);
    
  } catch (error) {
    console.error('❌ [Webhook] handleCheckoutSessionCompleted failed:', error);
    if (logData.status !== 'error') {
      logData.status = 'error';
      logData.error_message = error.message;
      await logWebhookEvent(logData);
    }
    throw error; // Re-throw to trigger retry in Stripe
  }
}

/**
 * Send order confirmation email from admin_orders (with all gates)
 */
async function sendOrderEmailFromAdminOrders(orderId, trace_id, eventMode) {
  let orderWithItems = null;
  
  try {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`[EMAIL_FLOW_START] order_id=${orderId.substring(0, 8)}`);
    
    // 1. Load order with items from admin_orders
    orderWithItems = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: {
          select: {
            id: true,
            sku: true,
            name: true,
            variant: true,
            qty: true,
            unitPrice: true,
            totalPrice: true,
          }
        }
      }
    });
    
    if (!orderWithItems) {
      console.error('❌ [EMAIL] Order not found in admin_orders:', orderId);
      throw new Error('Order not found in admin_orders');
    }
    
    console.log('[DB_RELOAD_OK] admin_orders loaded with items');
    
    // 2. MARK AS PROCESSING (FIRST DB WRITE - ensures visibility)
    await prisma.order.update({
      where: { id: orderId },
      data: { emailStatus: 'processing' }
    });
    console.log(`[EMAIL_DB_UPDATE] order_id=${orderId.substring(0, 8)} emailStatus=processing`);
    
    // 3. IDEMPOTENCY CHECK (prevent duplicate emails)
    if (orderWithItems.customerEmailSentAt || orderWithItems.adminEmailSentAt) {
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log(`[EMAIL_SKIP_ALREADY_SENT] order_id=${orderId.substring(0, 8)} customer_sent=${!!orderWithItems.customerEmailSentAt} admin_sent=${!!orderWithItems.adminEmailSentAt}`);
      
      // Update status to reflect already sent
      await prisma.order.update({
        where: { id: orderId },
        data: { emailStatus: 'sent' }
      });
      
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      return;
    }
    
    // 4. REQUIRED FIELDS GATE
    const missingFields = [];
    
    if (!orderWithItems.email) missingFields.push('email');
    if (!orderWithItems.currency) missingFields.push('currency');
    if (!orderWithItems.subtotalNet) missingFields.push('subtotalNet');
    if (!orderWithItems.taxAmount) missingFields.push('taxAmount');
    if (!orderWithItems.totalGross) missingFields.push('totalGross');
    if (!orderWithItems.amountShipping) missingFields.push('amountShipping');
    if (!orderWithItems.billingAddress) missingFields.push('billingAddress');
    if (!orderWithItems.shippingAddress) missingFields.push('shippingAddress');
    if (!orderWithItems.items || orderWithItems.items.length === 0) missingFields.push('items');
    
    if (missingFields.length > 0) {
      console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.error('❌ [EMAIL_BLOCKED] Order incomplete - cannot send email');
      console.error('❌ [EMAIL_BLOCKED] Order ID:', orderId.substring(0, 8));
      console.error('❌ [EMAIL_BLOCKED] Missing fields:', missingFields.join(', '));
      console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      
      const errorMsg = `Missing: ${missingFields.join(', ')}`;
      await prisma.order.update({
        where: { id: orderId },
        data: { 
          emailStatus: 'blocked_incomplete',
          emailLastError: errorMsg.substring(0, 500) // Max 500 chars
        }
      });
      
      console.log(`[EMAIL_DB_UPDATED] order_id=${orderId.substring(0, 8)} status=blocked_incomplete`);
      
      // Log event
      await prisma.orderEvent.create({
        data: {
          orderId: orderId,
          type: 'EMAIL_BLOCKED',
          source: 'webhook',
          payload: { reason: 'incomplete', missing: missingFields }
        }
      });
      
      return; // Don't send email
    }
    
    console.log('✅ [EMAIL GATE] All required fields present');
    
    // 5. Check if emails are DISABLED globally
    const emailsDisabled = process.env.DISABLE_EMAILS === 'true';
    
    if (emailsDisabled) {
      console.warn('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.warn('⚠️ [EMAIL DISABLED] DISABLE_EMAILS=true - marking order');
      console.warn('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      
      await prisma.order.update({
        where: { id: orderId },
        data: {
          emailStatus: 'disabled',
          emailLastError: 'DISABLE_EMAILS=true in env'
        }
      });
      
      console.log(`[EMAIL_DB_UPDATED] order_id=${orderId.substring(0, 8)} emailStatus=disabled`);
      return;
    }
    
    // 6. Log routing info
    const adminEmail = process.env.ADMIN_ORDER_EMAIL || 'orders@unbreak-one.com';
    console.log(`[EMAIL_ROUTE] customer=${orderWithItems.email} admin=${adminEmail}`);
    
    // 7. Format items for email
    const emailItems = orderWithItems.items.map(item => ({
      name: item.name,
      quantity: item.qty,
      price_cents: item.unitPrice,
      line_total_cents: item.totalPrice
    }));
    
    console.log('[EMAIL_PAYLOAD_FROM_DB] Supabase admin_orders data:');
    console.log(`[EMAIL_PAYLOAD_FROM_DB] order_id=${orderId.substring(0, 8)}`);
    console.log(`[EMAIL_PAYLOAD_FROM_DB] items_count=${emailItems.length}`);
    
    // 8. SEND CUSTOMER EMAIL
    let customerResult = { sent: false, error: null, id: null };
    try {
      const result = await sendOrderConfirmation({
        orderId: orderWithItems.id,
        orderNumber: orderWithItems.id.substring(0, 8).toUpperCase(),
        customerEmail: orderWithItems.email,
        customerName: orderWithItems.shippingName,
        items: emailItems,
        totalAmount: orderWithItems.totalGross,
        language: 'de',
        shippingAddress: orderWithItems.shippingAddress,
        billingAddress: orderWithItems.billingAddress,
        amountSubtotal: orderWithItems.subtotalNet,
        shippingCost: orderWithItems.amountShipping,
        orderDate: orderWithItems.createdAt,
        bcc: []
      });
      
      if (result.sent === true) {
        customerResult = { sent: true, error: null, id: result.id || null };
        console.log(`[EMAIL_SENT_CUSTOMER] resend_id=${result.id}`);
      } else if (result.error) {
        customerResult = { sent: false, error: result.error, id: null };
        console.error(`[EMAIL_ERROR] customer: ${result.error}`);
      } else {
        // Unexpected result format
        customerResult = { sent: false, error: 'Unexpected result format from sendOrderConfirmation', id: null };
        console.error(`[EMAIL_ERROR] customer: Unexpected result format:`, result);
      }
    } catch (emailError) {
      customerResult = { sent: false, error: emailError.message, id: null };
      console.error(`[EMAIL_ERROR] customer exception: ${emailError.message}`);
    }
    
    // 9. SEND ADMIN EMAIL
    let adminResult = { sent: false, error: null, id: null };
    try {
      const result = await sendOrderConfirmation({
        orderId: orderWithItems.id,
        orderNumber: orderWithItems.id.substring(0, 8).toUpperCase(),
        customerEmail: adminEmail,
        customerName: orderWithItems.shippingName,
        items: emailItems,
        totalAmount: orderWithItems.totalGross,
        language: 'de',
        shippingAddress: orderWithItems.shippingAddress,
        billingAddress: orderWithItems.billingAddress,
        amountSubtotal: orderWithItems.subtotalNet,
        shippingCost: orderWithItems.amountShipping,
        orderDate: orderWithItems.createdAt,
        bcc: []
      });
      
      if (result.sent === true) {
        adminResult = { sent: true, error: null, id: result.id || null };
        console.log(`[EMAIL_SENT_ADMIN] resend_id=${result.id}`);
      } else if (result.error) {
        adminResult = { sent: false, error: result.error, id: null };
        console.error(`[EMAIL_ERROR] admin: ${result.error}`);
      } else {
        // Unexpected result format
        adminResult = { sent: false, error: 'Unexpected result format from sendOrderConfirmation', id: null };
        console.error(`[EMAIL_ERROR] admin: Unexpected result format:`, result);
      }
    } catch (emailError) {
      adminResult = { sent: false, error: emailError.message, id: null };
      console.error(`[EMAIL_ERROR] admin exception: ${emailError.message}`);
    }
    
    // 10. LOG RESULTS
    console.log(`[EMAIL_SEND_RESULT] customer=${customerResult.sent ? 'ok' : 'error'} admin=${adminResult.sent ? 'ok' : 'error'}`);
    
    // 11. UPDATE DB BASED ON RESULTS (GUARANTEED TO RUN)
    const updateData = {};
    
    // Customer email timestamp
    if (customerResult.sent) {
      updateData.customerEmailSentAt = new Date();
    }
    
    // Admin email timestamp  
    if (adminResult.sent) {
      updateData.adminEmailSentAt = new Date();
    }
    
    // Email status and error message
    if (customerResult.sent && adminResult.sent) {
      updateData.emailStatus = 'sent';
      updateData.emailLastError = null;
    } else if (!customerResult.sent && !adminResult.sent) {
      updateData.emailStatus = 'error';
      const errorMsg = `Customer: ${customerResult.error || 'Unknown'}; Admin: ${adminResult.error || 'Unknown'}`;
      updateData.emailLastError = errorMsg.substring(0, 500); // Max 500 chars
    } else {
      updateData.emailStatus = 'partial';
      const errors = [];
      if (!customerResult.sent) errors.push(`Customer: ${customerResult.error || 'Unknown'}`);
      if (!adminResult.sent) errors.push(`Admin: ${adminResult.error || 'Unknown'}`);
      updateData.emailLastError = errors.join('; ').substring(0, 500);
    }
    
    // 12. COMMIT TO DATABASE (MUST ALWAYS HAPPEN)
    await prisma.order.update({
      where: { id: orderId },
      data: updateData
    });
    
    console.log(`[EMAIL_DB_UPDATED] order_id=${orderId.substring(0, 8)} status=${updateData.emailStatus} customer_sent=${!!updateData.customerEmailSentAt} admin_sent=${!!updateData.adminEmailSentAt}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
  } catch (error) {
    // CRITICAL: If we reach here, ensure DB is updated with error
    console.error('❌ [EMAIL_EXCEPTION]', error.message);
    console.error('❌ [EMAIL_EXCEPTION] Stack:', error.stack);
    
    // Try to update DB with error status
    if (orderWithItems?.id || orderId) {
      try {
        await prisma.order.update({
          where: { id: orderWithItems?.id || orderId },
          data: {
            emailStatus: 'error',
            emailLastError: `Exception: ${error.message}`.substring(0, 500)
          }
        });
        console.log(`[EMAIL_DB_UPDATED] order_id=${orderId.substring(0, 8)} status=error (exception)`);
      } catch (dbError) {
        console.error('❌ [EMAIL_DB_UPDATE_FAILED] Could not update DB with error:', dbError.message);
      }
    }
    
    // DON'T rethrow - we've done everything we can
    console.error('❌ [EMAIL] Flow completed with errors');
  }
}

async function logWebhookEvent(logData) {
  try {
    const { error } = await supabase
      .from('webhook_logs')
      .insert({
        event_type: logData.event_type,
        stripe_session_id: logData.stripe_session_id,
        status: logData.status,
        error_message: logData.error_message,
        order_id: logData.order_id,
        rows_affected: logData.rows_affected
      });

    if (error) {
      console.error('❌ [WEBHOOK LOG] Failed to log event:', error.message);
    } else {
      console.log('✅ [WEBHOOK LOG] Event logged successfully');
    }
  } catch (err) {
    console.error('❌ [WEBHOOK LOG] Exception:', err.message);
  }
}

async function sendOrderConfirmationEmail(order, trace_id, eventMode) {
  try {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`📧 [EMAIL PROCESS] trace_id=${trace_id} mode=${eventMode}`);
    console.log('📧 [EMAIL] SOURCE: DATABASE (DB-FIRST)');
    console.log(`📧 [EMAIL] Order ID: ${order.id}`);
    console.log(`📧 [EMAIL] Order Number: ${order.order_number}`);
    console.log(`📧 [EMAIL] Customer: ${order.customer_email}`);
    
    // Email validation helper
    const isValidEmail = (email) => {
      if (!email || typeof email !== 'string') return false;
      // Simple validation: contains @ and .
      return email.includes('@') && email.includes('.') && email.length > 5;
    };

    // Extract customer email from DB order
    const customerEmail = order.customer_email;
    
    if (!isValidEmail(customerEmail)) {
      console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.error('❌ [EMAIL CRITICAL] No valid customer email in order!');
      console.error('❌ [EMAIL] Order ID:', order.id);
      console.error('❌ [EMAIL] customer_email:', customerEmail);
      console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      return; // Don't send email
    }

    // Extract all data from DB order (SINGLE SOURCE OF TRUTH)
    const customerName = order.customer_name || '(fehlt)';
    const customerPhone = order.customer_phone || '(fehlt)';
    const billingAddress = order.billing_address || null;
    const shippingAddress = order.shipping_address || null;
    const orderNumber = order.order_number || order.id.substring(0, 8).toUpperCase();
    const paymentIntentId = order.stripe_payment_intent_id || '(fehlt)';
    const paymentStatus = 'paid'; // From order.status
    const orderDate = order.created_at ? new Date(order.created_at) : new Date();
    
    // Extract items from DB (already saved with prices)
    let items = [];
    if (Array.isArray(order.items)) {
      items = order.items;
    } else if (typeof order.items === 'string') {
      try {
        items = JSON.parse(order.items);
      } catch (e) {
        console.error('❌ [EMAIL] Failed to parse items JSON:', e.message);
        items = [];
      }
    }

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('[EMAIL DATA] From DB Order:');
    console.log('  Customer:', customerName, customerEmail, customerPhone);
    console.log('  Billing:', billingAddress ? 'YES' : 'NO');
    console.log('  Shipping:', shippingAddress ? 'YES' : 'NO');
    console.log('  Payment Intent:', paymentIntentId);
    console.log('  Payment Status:', paymentStatus);
    console.log('  Items count:', items.length);
    console.log('  Total:', order.total_amount_cents, '¢');
    console.log('  Currency:', order.currency || 'EUR');
    console.log('  Order Date:', orderDate.toISOString());
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    // Validate items
    if (!items || items.length === 0) {
      console.error('❌ [EMAIL] No items in order - cannot send email');
      return;
    }

    // Detect language from order data
    let language = 'de';
    if (order.cart_items && Array.isArray(order.cart_items)) {
      const firstItem = order.cart_items[0];
      if (firstItem?.lang && ['de', 'en'].includes(firstItem.lang)) {
        language = firstItem.lang;
      } else if (firstItem?.meta?.lang && ['de', 'en'].includes(firstItem.meta.lang)) {
        language = firstItem.meta.lang;
      }
    } else if (shippingAddress?.country) {
      language = ['GB', 'US', 'CA', 'AU', 'NZ'].includes(shippingAddress.country) ? 'en' : 'de';
    }

    // Extract totals from order (DB-first)
    const totals = order.totals || {};
    const amountTotal = order.total_amount_cents || 0;
    const amountSubtotal = totals.subtotal_cents || items.reduce((sum, item) => sum + (item.line_total_cents || 0), 0);
    const shippingCost = totals.shipping_cents || 0;
    const taxTotal = totals.tax_cents || 0;

    // REQUIRED LOG: EMAIL_PAYLOAD_FROM_DB
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`[EMAIL_PAYLOAD_FROM_DB] order_id=${order.id} includes={addresses:${!!(billingAddress && shippingAddress)}, unit_prices:${items.every(i => i.price_cents > 0)}, totals:${!!(amountTotal && amountSubtotal)}}`);
    console.log('[EMAIL_PAYLOAD_FROM_DB] Items:');
    items.forEach((item, idx) => {
      console.log(`[EMAIL_PAYLOAD_FROM_DB]   [${idx + 1}] ${item.quantity}× ${item.name} @ ${item.price_cents}¢ = ${item.line_total_cents}¢`);
    });
    console.log(`[EMAIL_PAYLOAD_FROM_DB] Totals: subtotal=${amountSubtotal}¢ shipping=${shippingCost}¢ tax=${taxTotal}¢ total=${amountTotal}¢`);
    console.log(`[EMAIL_PAYLOAD_FROM_DB] Addresses: billing=${billingAddress ? billingAddress.line1 : 'NONE'} shipping=${shippingAddress ? shippingAddress.line1 : 'NONE'}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    // Call emailService with DB data
    console.log(`[EMAIL SEND] trace_id=${trace_id || 'none'} - Calling sendOrderConfirmation with DB data`);
    const emailResult = await sendOrderConfirmation({
      orderId: order.id,
      orderNumber: orderNumber,
      customerEmail: customerEmail,
      customerName: customerName,
      customerPhone: customerPhone,
      items: items, // From DB
      totalAmount: amountTotal, // From DB
      language: language,
      shippingAddress: shippingAddress, // From DB
      billingAddress: billingAddress, // From DB
      paymentIntentId: paymentIntentId,
      paymentStatus: paymentStatus,
      amountSubtotal: amountSubtotal,
      shippingCost: shippingCost,
      orderDate: orderDate,
      // BCC to admin + orders for internal tracking
      bcc: ['admin@unbreak-one.com', 'orders@unbreak-one.com']
    });
    
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`[EMAIL RESULT] trace_id=${trace_id || 'none'}:`, emailResult);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    if (emailResult.sent) {
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log(`✅ [EMAIL SUCCESS] trace_id=${trace_id || 'none'} - Order confirmation sent!`);
      console.log(`✅ [EMAIL] Resend Email ID: ${emailResult.id}`);
      console.log(`✅ [EMAIL] TO: ${customerEmail} (DB source)`);
      console.log(`✅ [EMAIL] BCC: admin@unbreak-one.com, orders@unbreak-one.com`);
      console.log(`✅ [EMAIL] Order: ${orderNumber}`);
      console.log('[MAIL] send customer ok');
      console.log('[MAIL] send internal/bcc ok');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

      // Update email status timestamps in DB
      const emailStatusUpdate = {
        email_status: 'sent_customer_and_admin',
        customer_email_sent_at: new Date().toISOString(),
        admin_email_sent_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const { error: statusError } = await supabase
        .from(tableName)
        .update(emailStatusUpdate)
        .eq('id', order.id);

      if (statusError) {
        console.error(`[EMAIL_STATUS_UPDATE_ERROR] Failed to update email status for order ${order.id}:`, statusError);
      } else {
        console.log(`[EMAIL_STATUS_UPDATE_OK] order_id=${order.id} status=sent_customer_and_admin customer_sent_at=${emailStatusUpdate.customer_email_sent_at} admin_sent_at=${emailStatusUpdate.admin_email_sent_at}`);
      }
    } else if (emailResult.preview) {
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log(`📋 [EMAIL PREVIEW] trace_id=${trace_id || 'none'} - EMAILS_ENABLED=false`);
      console.log('📋 [EMAIL] Email NOT sent (preview mode)');
      console.log('📋 [EMAIL] Would send to:', customerEmail);
      console.log('📋 [EMAIL] Would BCC to: admin@unbreak-one.com');
      console.log('📋 [EMAIL] To enable: Set EMAILS_ENABLED=true in Vercel ENV');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    } else {
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.error(`❌ [EMAIL FAILED] trace_id=${trace_id || 'none'} - Email send failed!`);
      console.error(`❌ [EMAIL] Error: ${emailResult.error}`);
      console.error(`❌ [EMAIL] TO: ${customerEmail}`);
      console.error(`❌ [EMAIL] Order: ${orderNumber}`);
      console.error(`❌ [EMAIL] EMAILS_ENABLED: ${process.env.EMAILS_ENABLED}`);
      console.error(`❌ [EMAIL] RESEND_API_KEY: ${process.env.RESEND_API_KEY ? 'SET' : 'MISSING'}`);
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    }

  } catch (error) {
    // Log but don't throw - email failure shouldn't block webhook processing
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.error(`❌ [EMAIL EXCEPTION] trace_id=${trace_id || 'none'} - Unexpected email error!`);
    console.error(`❌ [EMAIL] Error: ${error.message}`);
    console.error(`❌ [EMAIL] Stack:`, error.stack);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  }
}

/**
 * SSOT MODE: Sync Stripe Session directly to admin_orders (NO legacy tables)
 * 
 * @param {Object} session - Stripe session (with expansions)
 * @param {Object} extractedData - Pre-extracted data: { customerEmail, customerName, customerPhone, shippingAddress, billingAddress, items }
 * @returns {Object|null} - Created/updated admin_orders record or null on failure
 */
async function syncStripeSessionToAdminOrders(session, extractedData) {
  try {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('💾 [SSOT WRITE] Starting direct write to admin_orders...');
    console.log('💾 [SSOT WRITE] Session ID:', session.id);
    console.log('💾 [SSOT WRITE] Payment Intent:', session.payment_intent);
    console.log('💾 [SSOT WRITE] Customer:', extractedData.customerEmail);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    const { customerEmail, customerName, customerPhone, shippingAddress, billingAddress, shippingName, items } = extractedData;
    
    // 1. Upsert customer in admin_customers
    const customer = await prisma.customer.upsert({
      where: { email: customerEmail },
      update: {
        name: customerName,
        lastOrderAt: new Date(),
      },
      create: {
        email: customerEmail,
        name: customerName,
        phone: customerPhone,
      },
    });
    
    console.log('✅ [ADMIN_CUSTOMERS] Upserted customer:', customer.id.substring(0, 8));
    
    // 2. Determine shipping region
    const shippingCountry = shippingAddress?.country || billingAddress?.country || 'DE';
    const { countryToRegion } = require('../../../lib/utils/shipping');
    const shippingRegion = countryToRegion(shippingCountry);
    
    console.log('🌍 [SHIPPING] Country:', shippingCountry, '→ Region:', shippingRegion);
    
    // 3. Calculate subtotal
    const subtotalNet = items.reduce((sum, item) => sum + item.totalPrice, 0);
    const taxRate = 0.19;
    
    // 4. Get shipping rate from DB (GROSS calculation)
    let amountShipping = 0;
    try {
      const shippingRate = await prisma.shippingRate.findFirst({
        where: { 
          countryCode: shippingRegion,
          active: true 
        },
        select: {
          priceNet: true,
          labelDe: true
        }
      });
      
      if (shippingRate) {
        const shippingNet = shippingRate.priceNet;
        const shippingTax = Math.round(shippingNet * taxRate);
        amountShipping = shippingNet + shippingTax; // GROSS
        
        console.log('✅ [SHIPPING] From DB:', shippingRegion, '→ Net:', shippingNet, '¢ + Tax:', shippingTax, '¢ = Gross:', amountShipping, '¢');
      } else {
        const fallbackNetRates = { DE: 490, EU: 1290, INT: 2490 };
        const shippingNet = fallbackNetRates[shippingRegion] || 2490;
        const shippingTax = Math.round(shippingNet * taxRate);
        amountShipping = shippingNet + shippingTax;
        
        console.warn('⚠️ [SHIPPING] No DB rate, using fallback: Net', shippingNet, '¢ + Tax', shippingTax, '¢ = Gross', amountShipping, '¢');
      }
    } catch (error) {
      console.error('❌ [SHIPPING] DB query failed:', error.message);
      const fallbackNetRates = { DE: 490, EU: 1290, INT: 2490 };
      const shippingNet = fallbackNetRates[shippingRegion] || 2490;
      const shippingTax = Math.round(shippingNet * taxRate);
      amountShipping = shippingNet + shippingTax;
      
      console.warn('⚠️ [SHIPPING] Using fallback: Net', shippingNet, '¢ + Tax', shippingTax, '¢ = Gross', amountShipping, '¢');
    }
    
    // 5. Calculate tax and total
    const taxAmount = Math.round(subtotalNet * taxRate);
    const totalGross = subtotalNet + taxAmount + amountShipping;
    
    console.log('💰 [PRICING] Subtotal:', subtotalNet, '¢ | Shipping (GROSS):', amountShipping, '¢ | Tax:', taxAmount, '¢ | Total:', totalGross, '¢');
    
    // 6. Create/update order in admin_orders
    // Extract payment_intent ID (handle both string and object)
    const paymentIntentId = typeof session.payment_intent === 'string' 
      ? session.payment_intent 
      : session.payment_intent?.id || null;
    
    console.log('💳 [PAYMENT] payment_intent:', paymentIntentId);
    
    const order = await prisma.order.upsert({
      where: { stripeCheckoutSessionId: session.id },
      update: {
        statusPayment: 'PAID',
        ...(paymentIntentId && { stripePaymentIntentId: paymentIntentId }),
        email: customerEmail,
        shippingName: shippingName,
        shippingAddress: shippingAddress,
        billingAddress: billingAddress,
        shippingRegion: shippingRegion,
        subtotalNet: subtotalNet,
        taxAmount: taxAmount,
        totalGross: totalGross,
        amountShipping: amountShipping,
        paidAt: new Date(),
        updatedAt: new Date(),
      },
      create: {
        stripeCheckoutSessionId: session.id,
        ...(paymentIntentId && { stripePaymentIntentId: paymentIntentId }),
        statusPayment: 'PAID',
        statusFulfillment: 'NEW',
        currency: (session.currency || 'EUR').toUpperCase(),
        amountTotal: totalGross,
        amountShipping: amountShipping,
        amountTax: taxAmount,
        subtotalNet: subtotalNet,
        taxRate: taxRate,
        taxAmount: taxAmount,
        totalGross: totalGross,
        email: customerEmail,
        shippingName: shippingName,
        shippingAddress: shippingAddress,
        billingAddress: billingAddress,
        shippingRegion: shippingRegion,
        customerId: customer.id,
        paidAt: new Date(),
      },
    });

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`[DB_WRITE_OK] admin_orders upserted: ${order.id.substring(0, 8)}`);
    console.log(`[DB_WRITE_OK] session_id=${session.id.substring(0, 20)} payment_intent=${session.payment_intent}`);
    console.log(`[DB_WRITE_OK] email=${customerEmail} region=${shippingRegion}`);
    console.log(`[DB_WRITE_OK] amounts: subtotal=${subtotalNet}¢ shipping_gross=${amountShipping}¢ tax=${taxAmount}¢ total=${totalGross}¢`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    // 7. Idempotency check for items
    const existingItems = await prisma.orderItem.count({
      where: { orderId: order.id }
    });

    if (existingItems > 0) {
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log(`[IDEMPOTENT_SKIP] Items already exist for order ${order.id.substring(0, 8)}: ${existingItems} items`);
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    } else if (items.length > 0) {
      console.log('🛒 [ADMIN_ORDER_ITEMS] Creating items...');
      let insertedCount = 0;
      
      for (const item of items) {
        await prisma.orderItem.create({
          data: {
            orderId: order.id,
            sku: item.sku,
            name: item.name,
            variant: item.variant,
            qty: item.qty,
            unitPrice: item.unitPrice,
            totalPrice: item.totalPrice,
          },
        });
        insertedCount++;
      }
      
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log(`[DB_WRITE_OK] admin_order_items inserted: ${insertedCount} items for order ${order.id.substring(0, 8)}`);
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    }

    // 8. Log event to admin_order_events
    await prisma.orderEvent.create({
      data: {
        orderId: order.id,
        type: 'STRIPE_WEBHOOK',
        source: 'stripe',
        payload: {
          event: 'checkout.session.completed',
          session_id: session.id,
          payment_intent: session.payment_intent,
          amount_total: session.amount_total,
        },
      },
    });

    console.log('✅ [SSOT WRITE] Complete - admin_orders + admin_order_items + admin_order_events written');

    return order;

  } catch (error) {
    console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.error('❌ [SSOT WRITE] CRITICAL FAILURE');
    console.error('❌ [SSOT WRITE] Error:', error.message);
    console.error('❌ [SSOT WRITE] Code:', error.code);
    console.error('❌ [SSOT WRITE] Stack:', error.stack);
    
    // Log specific Prisma errors
    if (error.code === 'P2002') {
      console.error('❌ [PRISMA] Unique constraint violation');
      console.error('❌ [PRISMA] Target:', error.meta?.target);
    } else if (error.code === 'P2025') {
      console.error('❌ [PRISMA] Record not found');
    } else if (error.code?.startsWith('P')) {
      console.error('❌ [PRISMA] Database error code:', error.code);
      console.error('❌ [PRISMA] Meta:', error.meta);
    }
    
    console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    return null;
  }
}

/**
 * Sync order to Supabase admin_orders + admin_order_items
 * (Prisma is only the query client, NOT the data owner)
 */
async function syncOrderToSupabase(session, supabaseOrder, orderSource) {
  try {
    console.log('💾 [ADMIN_ORDERS SYNC] Starting order sync to Supabase...');
    console.log('💾 [ADMIN_ORDERS SYNC] Session ID:', session.id);
    console.log('💾 [ADMIN_ORDERS SYNC] Order ID:', supabaseOrder.id);
    console.log('💾 [ADMIN_ORDERS SYNC] Order Source:', orderSource);

    let customerEmail, customerName;
    let items = [];
    let amountTotal, amountShipping = 0, amountTax = 0;

    // Handle different order formats
    if (orderSource === 'configurator') {
      // Orders table format (configurator)
      console.log('💾 [ADMIN_ORDERS] Processing CONFIGURATOR order:', supabaseOrder.order_number);
      
      // Get customer from customers table
      const { data: customerData, error: customerError } = await supabase
        .from('customers')
        .select('email, name')
        .eq('id', supabaseOrder.customer_id)
        .single();

      if (customerError || !customerData) {
        console.error('❌ [ADMIN_ORDERS] Failed to get customer:', customerError?.message);
        return;
      }

      customerEmail = customerData.email;
      customerName = customerData.name;
      amountTotal = supabaseOrder.total_cents;
      // amountShipping will be calculated from DB below
      amountTax = supabaseOrder.tax_cents || 0;

      // Get product from configuration
      if (supabaseOrder.configuration_id) {
        const { data: config } = await supabase
          .from('configurations')
          .select('product_id, config_json, price_cents')
          .eq('id', supabaseOrder.configuration_id)
          .single();
        
        if (config?.product_id) {
          const { data: product } = await supabase
            .from('products')
            .select('name, sku')
            .eq('id', config.product_id)
            .single();
          
          if (product) {
            items.push({
              sku: product.sku,
              name: product.name,
              variant: `Configured (${supabaseOrder.order_number})`,
              qty: 1,
              unitPrice: supabaseOrder.subtotal_cents || config.price_cents,
              totalPrice: supabaseOrder.subtotal_cents || config.price_cents,
            });
          }
        }
      }
    } else {
      // simple_orders table format (standard shop)
      console.log('💾 [ADMIN_ORDERS] Processing SHOP order');
      
      customerEmail = session.customer_details?.email || session.customer_email;
      customerName = session.customer_details?.name || null;
      
      if (!customerEmail) {
        console.warn('⚠️ [ADMIN_ORDERS] No customer email - skipping');
        return;
      }

      amountTotal = session.amount_total || supabaseOrder.total_amount_cents || 0;
      // amountShipping will be calculated from DB below
      // amountTax will be recalculated after shipping is known

      // Parse items from simple_orders JSON
      try {
        const parsedItems = typeof supabaseOrder.items === 'string' 
          ? JSON.parse(supabaseOrder.items) 
          : supabaseOrder.items || [];
        
        for (const item of parsedItems) {
          items.push({
            sku: item.sku || item.product_id,
            name: item.name || 'Product',
            variant: item.variant || null,
            qty: item.quantity || 1,
            unitPrice: item.unit_price_cents || 0,
            totalPrice: (item.quantity || 1) * (item.unit_price_cents || 0),
          });
        }
      } catch (err) {
        console.error('❌ [ADMIN_ORDERS] Failed to parse items:', err.message);
      }
    }

    console.log('✅ [ADMIN_ORDERS] Customer email:', customerEmail);
    console.log('✅ [ADMIN_ORDERS] Items:', items.length);

    // 2. Upsert customer in admin system
    const customer = await prisma.customer.upsert({
      where: { email: customerEmail },
      update: {
        name: customerName,
        lastOrderAt: new Date(),
      },
      create: {
        email: customerEmail,
        name: customerName,
        locale: session.locale || 'de',
      },
    });

    console.log('✅ [ADMIN_ORDERS] Admin customer:', customer.id);

    // 3. Parse config_json from session metadata or supabaseOrder
    let configJson = null;
    try {
      if (session.metadata?.config_json) {
        configJson = JSON.parse(session.metadata.config_json);
        console.log('✅ [ADMIN_ORDERS] config_json from Stripe metadata:', configJson);
      } else if (supabaseOrder?.config_json) {
        configJson = supabaseOrder.config_json;
        console.log('✅ [ADMIN_ORDERS] config_json from Supabase order:', configJson);
      }
    } catch (error) {
      console.warn('⚠️ [ADMIN_ORDERS] Failed to parse config_json:', error.message);
    }

    // 4. Create or update order in admin system
    
    // Determine shipping region from country code
    const shippingCountry = session.shipping_details?.address?.country || 
                           session.customer_details?.address?.country || 
                           null;
    const shippingRegion = countryToRegion(shippingCountry);
    
    console.log('🌍 [ADMIN_ORDERS] Shipping country:', shippingCountry, '→ Region:', shippingRegion);
    
    // Calculate shipping from Backend DB (NOT from Stripe!)
    // Calculate subtotal to determine tax rate first
    const subtotalNet = items.reduce((sum, item) => sum + (item.unitPrice * item.qty), 0);
    
    // Determine tax rate (19% for Germany)
    const taxRate = 0.19;
    
    amountShipping = 0; // Reset before calculation
    try {
      const shippingRate = await prisma.shippingRate.findFirst({
        where: { 
          countryCode: shippingRegion,
          active: true 
        },
        select: {
          priceNet: true,
          labelDe: true
        }
      });
      
      if (shippingRate) {
        const shippingNet = shippingRate.priceNet;
        const shippingTax = Math.round(shippingNet * taxRate);
        amountShipping = shippingNet + shippingTax; // GROSS = NET + TAX
        
        console.log('✅ [SHIPPING] From DB:', shippingRegion, '→ Net:', shippingNet, '¢ + Tax:', shippingTax, '¢ = Gross:', amountShipping, '¢ (', shippingRate.labelDe, ')');
      } else {
        // Fallback to hardcoded NET values, then add tax
        const fallbackNetRates = { DE: 490, EU: 1290, INT: 2490 };
        const shippingNet = fallbackNetRates[shippingRegion] || 2490;
        const shippingTax = Math.round(shippingNet * taxRate);
        amountShipping = shippingNet + shippingTax;
        
        console.warn('⚠️ [SHIPPING] No DB rate found, using fallback: Net', shippingNet, '¢ + Tax', shippingTax, '¢ = Gross', amountShipping, '¢');
      }
    } catch (error) {
      console.error('❌ [SHIPPING] DB query failed:', error.message);
      const fallbackNetRates = { DE: 490, EU: 1290, INT: 2490 };
      const shippingNet = fallbackNetRates[shippingRegion] || 2490;
      const shippingTax = Math.round(shippingNet * taxRate);
      amountShipping = shippingNet + shippingTax;
      
      console.warn('⚠️ [SHIPPING] Using fallback: Net', shippingNet, '¢ + Tax', shippingTax, '¢ = Gross', amountShipping, '¢');
    }
    
    // Extract addresses with fallbacks (CRITICAL for admin_orders)
    const shippingAddress = session.shipping_details?.address ?? session.customer_details?.address ?? null;
    const billingAddress = session.customer_details?.address ?? session.shipping_details?.address ?? null;
    const shippingName = session.shipping_details?.name ?? session.customer_details?.name ?? customerName;
    const billingName = session.customer_details?.name ?? session.shipping_details?.name ?? customerName;
    
    console.log('🏠 [ADMIN_ORDERS] Shipping address:', shippingAddress ? `${shippingAddress.line1}, ${shippingAddress.city}` : 'MISSING');
    console.log('📋 [ADMIN_ORDERS] Billing address:', billingAddress ? `${billingAddress.line1}, ${billingAddress.city}` : 'MISSING');
    
    // Recalculate tax and total
    // Note: amountShipping is already GROSS (includes tax), so only tax the subtotal
    const taxAmount = Math.round(subtotalNet * taxRate);
    const totalGross = subtotalNet + taxAmount + amountShipping;
    
    console.log('💰 [PRICING] Subtotal:', subtotalNet, '¢ | Shipping (GROSS):', amountShipping, '¢ | Tax:', taxAmount, '¢ | Total:', totalGross, '¢');
    
    const order = await prisma.order.upsert({
      where: { stripeCheckoutSessionId: session.id },
      update: {
        statusPayment: 'PAID',
        stripePaymentIntentId: session.payment_intent,
        paidAt: new Date(),
        updatedAt: new Date(),
        shippingRegion: shippingRegion,
        ...(configJson && { configJson: configJson }),
      },
      create: {
        stripeCheckoutSessionId: session.id,
        stripePaymentIntentId: session.payment_intent,
        statusPayment: 'PAID',
        statusFulfillment: 'NEW',
        currency: (session.currency || supabaseOrder.currency || 'EUR').toUpperCase(),
        amountTotal: totalGross, // Recalculated with Backend shipping
        amountShipping: amountShipping, // From DB shipping_rates
        amountTax: taxAmount, // Recalculated
        subtotalNet: subtotalNet, // From items
        taxRate: taxRate,
        taxAmount: taxAmount,
        totalGross: totalGross,
        email: customerEmail,
        shippingName: shippingName,
        shippingAddress: shippingAddress,
        billingAddress: billingAddress,
        shippingRegion: shippingRegion,
        customerId: customer.id,
        paidAt: new Date(),
        configJson: configJson,
      },
    });

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`[DB_WRITE_ORDER] order_id=${order.id.substring(0, 8)} session_id=${session.id.substring(0, 20)}`);
    console.log(`[DB_WRITE_ORDER] shipping_address_present=${!!shippingAddress} billing_address_present=${!!billingAddress}`);
    console.log(`[DB_WRITE_ORDER] email=${customerEmail} region=${shippingRegion}`);
    console.log(`[DB_WRITE_ORDER] amounts: subtotal=${subtotalNet}¢ shipping_gross=${amountShipping}¢ tax=${taxAmount}¢ total=${totalGross}¢`);
    console.log(`[DB_WRITE_ORDER] shipping_source=DB_shipping_rates (GROSS=NET+TAX, NOT Stripe!)`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ [ADMIN_ORDERS] Admin order:', order.id);

    // 4. Check if items already exist (IDEMPOTENCY)
    const existingItems = await prisma.orderItem.count({
      where: { orderId: order.id }
    });

    if (existingItems > 0) {
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log(`[IDEMPOTENT_SKIP] reason=items_already_exist order_id=${order.id.substring(0, 8)} existing_count=${existingItems}`);
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    } else if (items.length > 0) {
      console.log('🛒 [ADMIN_ORDERS] Creating order items...');
      let insertedCount = 0;
      
      for (const item of items) {
        // Calculate pricing fields if this is a configured product
        let pricingFields = {};
        let finalUnitPrice = item.unitPrice;
        let finalTotalPrice = item.totalPrice;
        let finalName = item.name;
        let finalSku = item.sku;
        
        if (configJson && configJson.colors) {
          const productType = configJson.variant === 'bottle_holder' ? 'bottle_holder' : 'glass_holder';
          const pricing = await calcConfiguredPrice({
            productType,
            config: configJson,
            customFeeCents: 0,
          });
          
          // SINGLE SOURCE OF TRUTH: Use calculated subtotal as unit_price
          finalUnitPrice = pricing.subtotal_cents;
          finalTotalPrice = pricing.subtotal_cents * (item.qty || 1);
          finalName = pricing.display_title; // e.g., "Glashalter (konfiguriert)"
          finalSku = pricing.sku; // e.g., "UNBREAK-GLAS-CONFIG"
          
          pricingFields = {
            pricingVersion: pricing.pricing_version,
            basePriceCents: pricing.base_price_cents,
            optionPricesCents: pricing.option_prices_cents,
            customFeeCents: pricing.custom_fee_cents,
            subtotalCents: pricing.subtotal_cents,
            config: configJson,
          };
          
          console.log('💰 [ADMIN_ORDERS] Calculated pricing:', {
            sku: finalSku,
            name: finalName,
            unit_price: finalUnitPrice,
            subtotal: pricing.subtotal_cents,
            base: pricing.base_price_cents,
          });
        }
        
        await prisma.orderItem.create({
          data: {
            orderId: order.id,
            sku: finalSku,
            name: finalName,
            variant: item.variant,
            qty: item.qty,
            unitPrice: finalUnitPrice,
            totalPrice: finalTotalPrice,
            ...pricingFields,
          },
        });
        insertedCount++;
      }
      console.log(`✅ [ADMIN_ORDERS] Created ${insertedCount} order items`);
      
      // 5. Recalculate order totals from items (SINGLE SOURCE OF TRUTH)
      const createdItems = await prisma.orderItem.findMany({
        where: { orderId: order.id }
      });
      
      const subtotalNet = createdItems.reduce((sum, item) => sum + (item.unitPrice * item.qty), 0);
      const taxRate = 0.19; // 19% German VAT
      const shippingAmount = amountShipping || 0;
      const taxAmount = Math.round((subtotalNet + shippingAmount) * taxRate);
      const totalGross = subtotalNet + taxAmount + shippingAmount;
      
      await prisma.order.update({
        where: { id: order.id },
        data: {
          subtotalNet: subtotalNet,
          taxRate: taxRate,
          taxAmount: taxAmount,
          amountShipping: shippingAmount,
          amountTax: taxAmount, // Keep legacy field synced
          amountTotal: totalGross, // Keep legacy field synced
          totalGross: totalGross,
        },
      });
      
      console.log('💰 [ADMIN_ORDERS] Recalculated totals:', {
        subtotal_net: subtotalNet,
        tax_amount: taxAmount,
        shipping: shippingAmount,
        total_gross: totalGross,
      });
      
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log(`[DB_WRITE_ITEMS] inserted_count=${insertedCount} order_id=${order.id.substring(0, 8)}`);
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    }

    // 6. Log event
    await prisma.orderEvent.create({
      data: {
        orderId: order.id,
        type: 'STRIPE_WEBHOOK',
        source: 'stripe',
        payload: {
          event: 'checkout.session.completed',
          session_id: session.id,
          payment_intent: session.payment_intent,
          order_number: supabaseOrder.order_number,
          amount_total: supabaseOrder.total_cents,
        },
      },
    });

    console.log('✅ [ADMIN_ORDERS] Complete - Order synced to admin system');
    
    // Return order data for email (with items included)
    return order;

  } catch (error) {
    // Don't throw - Prisma sync failure shouldn't block webhook
    console.error('⚠️ [ADMIN_ORDERS] Failed but continuing:', error.message);
    return null;
  }
}

/**
 * Sync Stripe customer to Supabase customers table
 */
async function syncStripeCustomerToSupabase(session, order, trace_id) {
  try {
    console.log('[TRACE] CUSTOMER_SYNC_START', {
      trace_id,
      stripe_customer_id: session.customer,
      email: session.customer_details?.email || session.customer_email
    });
    
    console.log('👤 [CUSTOMER SYNC] Starting Stripe → Supabase sync...');

    // Extract customer data from session
    const stripeCustomerId = session.customer;
    const customerEmail = session.customer_details?.email || session.customer_email;
    const customerName = session.customer_details?.name || null;
    const customerPhone = session.customer_details?.phone || null;

    // Get shipping address if available
    const defaultShipping = session.shipping_details?.address ? {
      line1: session.shipping_details.address.line1,
      line2: session.shipping_details.address.line2,
      city: session.shipping_details.address.city,
      state: session.shipping_details.address.state,
      postal_code: session.shipping_details.address.postal_code,
      country: session.shipping_details.address.country,
      name: session.shipping_details.name,
    } : null;

    const defaultBilling = session.customer_details?.address ? {
      line1: session.customer_details.address.line1,
      line2: session.customer_details.address.line2,
      city: session.customer_details.address.city,
      state: session.customer_details.address.state,
      postal_code: session.customer_details.address.postal_code,
      country: session.customer_details.address.country,
    } : null;

    if (!stripeCustomerId) {
      console.log('⚠️ [CUSTOMER SYNC] No Stripe customer ID in session - using email fallback');
      
      if (!customerEmail) {
        console.error('❌ [CUSTOMER SYNC] No customer email found - cannot sync');
        return;
      }

      // Fallback: Create customer without Stripe ID (will be updated later)
      const { data: existingCustomer } = await supabase
        .from('customers')
        .select('id')
        .eq('email', customerEmail.toLowerCase())
        .maybeSingle();

      if (!existingCustomer) {
        const { error: insertError } = await supabase
          .from('customers')
          .insert({
            email: customerEmail.toLowerCase(),
            name: customerName,
            phone: customerPhone,
            default_shipping: defaultShipping,
            default_billing: defaultBilling,
          });

        if (insertError) {
          console.error('❌ [CUSTOMER SYNC] Failed to create customer:', insertError.message);
        } else {
          console.log('✅ [CUSTOMER SYNC] Customer created (no Stripe ID)');
        }
      }
      
      return;
    }

    console.log('👤 [CUSTOMER SYNC] Stripe Customer ID:', stripeCustomerId);
    console.log('👤 [CUSTOMER SYNC] Email:', customerEmail);

    // Upsert customer - Handle both stripe_customer_id and email conflicts
    // Try by stripe_customer_id first
    let customer;
    let upsertError;
    
    const customerData = {
      stripe_customer_id: stripeCustomerId,
      email: customerEmail?.toLowerCase() || `stripe-${stripeCustomerId}@unknown.com`,
      name: customerName,
      phone: customerPhone,
      updated_at: new Date().toISOString(),
    };

    // Try upsert by stripe_customer_id
    const { data: customerByStripe, error: stripeIdError } = await supabase
      .from('customers')
      .upsert(customerData, {
        onConflict: 'stripe_customer_id',
        ignoreDuplicates: false,
      })
      .select()
      .single();

    if (stripeIdError) {
      // Check if it's a duplicate email error
      if (stripeIdError.message.includes('customers_email_key')) {
        console.log('⚠️ [CUSTOMER SYNC] Email conflict, trying update by email');
        
        // Find existing customer by email and update
        const { data: existingCustomer, error: findError } = await supabase
          .from('customers')
          .select('id')
          .eq('email', customerData.email)
          .single();

        if (!findError && existingCustomer) {
          // Update existing customer with new Stripe ID
          const { data: updatedCustomer, error: updateError } = await supabase
            .from('customers')
            .update({
              stripe_customer_id: stripeCustomerId,
              name: customerName,
              phone: customerPhone,
              updated_at: new Date().toISOString(),
            })
            .eq('id', existingCustomer.id)
            .select()
            .single();

          if (updateError) {
            console.error('❌ [CUSTOMER SYNC] Update by email failed:', updateError.message);
            upsertError = updateError;
          } else {
            customer = updatedCustomer;
            console.log('✅ [CUSTOMER SYNC] Updated existing customer by email');
          }
        } else {
          console.error('❌ [CUSTOMER SYNC] Could not find customer by email:', findError?.message);
          upsertError = stripeIdError;
        }
      } else {
        upsertError = stripeIdError;
      }
    } else {
      customer = customerByStripe;
    }

    if (upsertError) {
      console.log('[TRACE] CUSTOMER_UPSERT_ERROR', {
        trace_id,
        error: upsertError.message,
        code: upsertError.code
      });
      console.error('❌ [CUSTOMER SYNC] Upsert failed:', upsertError.message);
      console.warn('⚠️ [CUSTOMER SYNC] Failed but continuing:', upsertError.message);
      // Don't throw - continue without customer_id
      customer = null;
    }

    if (customer) {
      console.log('[TRACE] CUSTOMER_UPSERT_SUCCESS', {
        trace_id,
        customer_id: customer.id,
        email: customer.email
      });
      console.log('✅ [CUSTOMER SYNC] Customer synced - ID:', customer.id);
    }

    // Update order with customer_id, stripe_customer_id and customer details
    const tableName = order.order_number ? 'orders' : 'simple_orders';
    const orderUpdate = {
      stripe_customer_id: stripeCustomerId,
      customer_email: customerEmail,
      customer_name: customerName,
      customer_phone: customerPhone,
    };
    
    // Only add customer_id if sync succeeded
    if (customer) {
      orderUpdate.customer_id = customer.id;
    }
    
    const { error: orderUpdateError } = await supabase
      .from(tableName)
      .update(orderUpdate)
      .eq('id', order.id);

    if (orderUpdateError) {
      console.log('[TRACE] ORDER_CUSTOMER_LINK_ERROR', {
        trace_id,
        order_id: order.id,
        error: orderUpdateError.message
      });
      console.error('❌ [CUSTOMER SYNC] Failed to link order to customer:', orderUpdateError.message);
    } else {
      console.log('[TRACE] ORDER_CUSTOMER_LINK_SUCCESS', {
        trace_id,
        order_id: order.id,
        customer_id: customer.id
      });
      console.log('✅ [CUSTOMER SYNC] Order linked to customer');
    }

    // Trigger stats update (handled by database trigger)
    console.log('✅ [CUSTOMER SYNC] Complete');

  } catch (error) {
    // Don't throw - customer sync failure shouldn't block webhook
    console.error('⚠️ [CUSTOMER SYNC] Failed but continuing:', error.message);
  }
}

/**
 * Handle customer.created event
 */
async function handleCustomerCreated(customer) {
  try {
    console.log('👤 [CUSTOMER.CREATED] Stripe Customer ID:', customer.id);
    console.log('👤 [CUSTOMER.CREATED] Email:', customer.email);

    const { error } = await supabase
      .from('customers')
      .upsert({
        stripe_customer_id: customer.id,
        email: customer.email?.toLowerCase() || `stripe-${customer.id}@unknown.com`,
        name: customer.name || null,
        phone: customer.phone || null,
        metadata: {
          stripe_metadata: customer.metadata,
          created_at_stripe: customer.created,
        },
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'stripe_customer_id',
        ignoreDuplicates: false,
      });

    if (error) {
      console.error('❌ [CUSTOMER.CREATED] Sync failed:', error.message);
    } else {
      console.log('✅ [CUSTOMER.CREATED] Customer synced to Supabase');
    }
  } catch (error) {
    console.error('❌ [CUSTOMER.CREATED] Exception:', error.message);
  }
}

/**
 * Handle customer.updated event
 */
async function handleCustomerUpdated(customer) {
  try {
    console.log('👤 [CUSTOMER.UPDATED] Stripe Customer ID:', customer.id);

    const { error } = await supabase
      .from('customers')
      .update({
        email: customer.email?.toLowerCase() || `stripe-${customer.id}@unknown.com`,
        name: customer.name || null,
        phone: customer.phone || null,
        metadata: {
          stripe_metadata: customer.metadata,
          updated_at_stripe: new Date().toISOString(),
        },
        updated_at: new Date().toISOString(),
      })
      .eq('stripe_customer_id', customer.id);

    if (error) {
      console.error('❌ [CUSTOMER.UPDATED] Update failed:', error.message);
    } else {
      console.log('✅ [CUSTOMER.UPDATED] Customer updated in Supabase');
    }
  } catch (error) {
    console.error('❌ [CUSTOMER.UPDATED] Exception:', error.message);
  }
}
