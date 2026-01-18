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
    
    // 3. Handle specific events
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutSessionCompleted(event.data.object, trace_id, eventMode);
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
    res.status(500).json({ 
      error: 'Webhook handler failed',
      message: error.message 
    });
  }
}

async function handleCheckoutSessionCompleted(session, trace_id, eventMode) {
  console.log('[TRACE] WEBHOOK_SESSION_DATA', {
    trace_id,
    stripe_session_id: session.id,
    stripe_customer_id: session.customer,
    email: session.customer_details?.email || session.customer_email,
    payment_status: session.payment_status,
    amount_total: session.amount_total,
    has_metadata: !!session.metadata
  });
  
  console.log('💳 [SESSION] ID:', session.id);
  console.log('💳 [SESSION] Payment status:', session.payment_status);
  console.log('💳 [SESSION] Amount total:', session.amount_total);
  console.log('💳 [SESSION] Customer email:', session.customer_email || session.customer_details?.email);

  let logData = {
    event_type: 'checkout.session.completed',
    stripe_session_id: session.id,
    status: 'processing',
    error_message: null,
    order_id: null,
    rows_affected: 0
  };

  try {
    // 1. Try to find order - PRIORITY: Use metadata.order_id (UUID) from Stripe
    console.log('🔍 [DB QUERY] Looking for order...');
    console.log('🔍 [METADATA] order_id:', session.metadata?.order_id);
    console.log('🔍 [METADATA] order_number:', session.metadata?.order_number);
    console.log('🔍 [FALLBACK] stripe_session_id:', session.id);
    
    // CRITICAL VALIDATION: Order number MUST exist in metadata
    if (!session.metadata?.order_number) {
      console.error('⚠️ [WEBHOOK] CRITICAL: No order_number in Stripe metadata!');
      console.error('⚠️ [WEBHOOK] Session ID:', session.id);
      console.error('⚠️ [WEBHOOK] This should NEVER happen for new orders!');
    }
    
    let order = null;
    let orderSource = null;
    
    // CRITICAL: First try to find by metadata.order_id (UUID) - MOST RELIABLE
    if (session.metadata?.order_id) {
      console.log('✅ [DB QUERY] Using metadata.order_id (UUID):', session.metadata.order_id);
      
      // Try simple_orders first (shop orders)
      const { data: shopOrder } = await supabase
        .from('simple_orders')
        .select('*')
        .eq('id', session.metadata.order_id)
        .maybeSingle();
      
      if (shopOrder) {
        order = shopOrder;
        orderSource = 'simple_orders';
        console.log('✅ [DB QUERY] Found in SIMPLE_ORDERS by UUID');
        console.log('📋 [ORDER] Number:', order.order_number || 'MISSING');
      } else {
        // Try configurator orders
        const { data: configuratorOrder } = await supabase
          .from('orders')
          .select('*')
          .eq('id', session.metadata.order_id)
          .maybeSingle();
        
        if (configuratorOrder) {
          order = configuratorOrder;
          orderSource = 'configurator';
          console.log('✅ [DB QUERY] Found in ORDERS (configurator) by UUID');
        }
      }
    }
    
    // FALLBACK: Try to find by Stripe session ID (legacy orders without metadata)
    if (!order) {
      console.log('⚠️ [DB QUERY] metadata.order_id not found or missing, falling back to session ID lookup');
      
      // First try: Configurator orders (orders table)
      const { data: configuratorOrder } = await supabase
        .from('orders')
        .select('*')
        .eq('stripe_checkout_session_id', session.id)
        .maybeSingle();
      
      if (configuratorOrder) {
        order = configuratorOrder;
        orderSource = 'configurator';
        console.log('✅ [DB QUERY] Found in CONFIGURATOR orders table (by session ID)');
      } else {
        // Second try: Standard shop orders (simple_orders table)
        // CRITICAL: Check BOTH column names (stripe_session_id AND stripe_checkout_session_id)
        const { data: shopOrder } = await supabase
          .from('simple_orders')
          .select('*')
          .or(`stripe_session_id.eq.${session.id},stripe_checkout_session_id.eq.${session.id}`)
          .maybeSingle();
        
        if (shopOrder) {
          order = shopOrder;
          orderSource = 'simple_orders';
          console.log('✅ [DB QUERY] Found in SIMPLE_ORDERS table (by session ID)');
        }
      }
    }

    if (!order) {
      console.error('❌ [DB QUERY] No order found in any table for session:', session.id);
      console.error('❌ [DB QUERY] Checked: orders (configurator) and simple_orders (shop)');
      logData.status = 'error';
      logData.error_message = `No order found for session: ${session.id}`;
      await logWebhookEvent(logData);
      throw new Error(`No order found for session: ${session.id}`);
    }

    console.log('✅ [DB QUERY] Order found - ID:', order.id);
    console.log('✅ [DB QUERY] Source:', orderSource);
    console.log('📊 [ORDER BEFORE UPDATE] ID:', order.id);
    if (order.order_number) console.log('📊 [ORDER BEFORE UPDATE] order_number:', order.order_number);
    console.log('📊 [ORDER BEFORE UPDATE] status:', order.status);
    console.log('📊 [ORDER BEFORE UPDATE] created_at:', order.created_at);

    logData.order_id = order.id;

    // 2. Check if already paid (idempotency)
    if (order.status === 'paid' || order.status === 'completed') {
      console.log('✅ [IDEMPOTENT] Order already paid - skipping');
      logData.status = 'skipped';
      logData.error_message = 'Order already paid (idempotent)';
      await logWebhookEvent(logData);
      return;
    }

    // 2.5 Retrieve COMPLETE Stripe session with ALL data (CRITICAL!)
    const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🔍 [STRIPE RETRIEVE] Loading complete session with expands...');
    console.log('🔍 [STRIPE RETRIEVE] Session ID:', session.id);
    const fullSession = await stripe.checkout.sessions.retrieve(session.id, {
      expand: [
        'line_items',                    // ← Line items array
        'line_items.data.price',         // ← Price details (unit_amount, currency)
        'line_items.data.price.product', // ← Product details (name, description)
        'customer',                      // ← Customer object (email, name, phone)
        'payment_intent'                 // ← Payment intent (for fees/status)
      ]
    });
    console.log('✅ [STRIPE RETRIEVE] Complete session loaded');
    console.log('✅ [STRIPE RETRIEVE] Line items:', fullSession.line_items?.data?.length || 0);
    console.log('✅ [STRIPE RETRIEVE] Customer:', fullSession.customer_details?.email || fullSession.customer?.email || 'MISSING');
    console.log('✅ [STRIPE RETRIEVE] Billing address:', fullSession.customer_details?.address ? 'YES' : 'NO');
    console.log('✅ [STRIPE RETRIEVE] Shipping address:', fullSession.shipping_details?.address ? 'YES' : 'NO');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    const lineItemsFromStripe = fullSession.line_items?.data || [];
    console.log('📦 [LINE_ITEMS] Retrieved from Stripe:', lineItemsFromStripe.length, 'items');
    
    // Map Stripe line_items to our format
    const lineItemsForDB = lineItemsFromStripe.map(item => ({
      name: item.description || 'Unknown Product',
      quantity: item.quantity,
      price_cents: item.price?.unit_amount || 0,
      line_total_cents: item.amount_total,
      currency: item.currency?.toUpperCase() || 'EUR'
    }));

    // CRITICAL: Calculate totals (DB-first architecture)
    const subtotalCents = lineItemsForDB.reduce((sum, item) => sum + (item.line_total_cents || 0), 0);
    const shippingCents = fullSession.total_details?.amount_shipping || 0;
    const taxCents = fullSession.total_details?.amount_tax || 0;
    const discountCents = fullSession.total_details?.amount_discount || 0;
    const totalCents = fullSession.amount_total || 0;
    const currency = fullSession.currency?.toUpperCase() || 'EUR';

    console.log('💰 [TOTALS CALCULATION]', {
      subtotal: subtotalCents + '¢',
      shipping: shippingCents + '¢',
      tax: taxCents + '¢',
      discount: discountCents + '¢',
      total: totalCents + '¢',
      currency: currency
    });

    // 3. Update order to paid in the appropriate table
    const updateData = {
      status: 'paid',
      paid_at: new Date().toISOString(), // ← CRITICAL: Set paid timestamp
      stripe_payment_intent_id: fullSession.payment_intent,
      stripe_customer_id: fullSession.customer,
      customer_email: fullSession.customer_details?.email || fullSession.customer_email,
      customer_name: fullSession.customer_details?.name,
      customer_phone: fullSession.customer_details?.phone,
      shipping_address: fullSession.shipping_details?.address || fullSession.customer_details?.address || null,
      billing_address: fullSession.customer_details?.address || null,
      items: lineItemsForDB, // ← CRITICAL: Save complete line_items from Stripe
      total_amount_cents: totalCents, // ← CRITICAL: Save total
      currency: currency, // ← CRITICAL: Save currency
      // Store detailed totals as JSON for email rendering
      totals: {
        subtotal_cents: subtotalCents,
        shipping_cents: shippingCents,
        tax_cents: taxCents,
        discount_cents: discountCents,
        total_cents: totalCents,
        currency: currency
      },
      email_status: 'pending', // ← Will be updated after email send
      updated_at: new Date().toISOString(),
    };

    const tableName = orderSource === 'configurator' ? 'orders' : 'simple_orders';
    
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('[DB_WRITE] Starting database write...');
    console.log('[DB_WRITE] Table:', tableName);
    console.log('[DB_WRITE] Order ID:', order.id);
    console.log('[DB_WRITE] Order Number:', order.order_number || 'MISSING');
    console.log('[DB_WRITE] Session ID:', fullSession.id);
    console.log('[DB_WRITE] Items:', lineItemsForDB.length);
    lineItemsForDB.forEach((item, idx) => {
      console.log(`[DB_WRITE]   [${idx + 1}] ${item.quantity}× ${item.name} @ ${item.price_cents}¢ = ${item.line_total_cents}¢`);
    });
    console.log('[DB_WRITE] Billing Address:', billingAddr ? 'YES' : 'NO');
    console.log('[DB_WRITE] Shipping Address:', shippingAddr ? 'YES' : 'NO');
    console.log('[DB_WRITE] Total:', totalCents + '¢ (' + currency + ')');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    const { data: updatedRows, error: updateError } = await supabase
      .from(tableName)
      .update(updateData)
      .eq('id', order.id)
      .select();

    if (updateError) {
      console.error('❌ [DB_WRITE_FAIL] Database write failed:', updateError.message);
      console.error('❌ [DB_WRITE_FAIL] Code:', updateError.code);
      console.error('❌ [DB_WRITE_FAIL] Details:', updateError.details);
      throw new Error(`Order update failed: ${updateError.message}`);
    }

    const rowCount = updatedRows?.length || 0;
    if (rowCount === 0) {
      console.error('❌ [DB_WRITE_FAIL] 0 rows affected!');
      console.error('❌ [DB_WRITE_FAIL] Order ID:', order.id);
      throw new Error(`Update affected 0 rows for order ${order.id}`);
    }

    logData.rows_affected = rowCount;

    // SUCCESS LOG (Required format)
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`[DB_WRITE_OK] order_id=${order.id} order_number=${order.order_number || 'N/A'} session_id=${fullSession.id} items=${lineItemsForDB.length} total=${totalCents}¢ has_shipping=${!!shippingAddr} has_billing=${!!billingAddr}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    console.log('✅ [WEBHOOK] Order successfully marked as paid:', order.id);
    logData.status = 'success';
    await logWebhookEvent(logData);

    // === DB-FIRST: RELOAD ORDER FROM DB (Single Source of Truth) ===
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('[DB_RELOAD] Reloading order from database...');
    const { data: orderFromDB, error: reloadError } = await supabase
      .from(tableName)
      .select('*')
      .eq('id', order.id)
      .single();

    if (reloadError || !orderFromDB) {
      console.error('❌ [DB_RELOAD_FAIL] Failed to reload order:', reloadError?.message);
      throw new Error('Failed to reload order from DB after update');
    }

    // Check what fields are present
    const hasItems = Array.isArray(orderFromDB.items) && orderFromDB.items.length > 0;
    const hasBilling = !!(orderFromDB.billing_address && orderFromDB.billing_address.line1);
    const hasShipping = !!(orderFromDB.shipping_address && orderFromDB.shipping_address.line1);
    const hasPrices = hasItems && orderFromDB.items.every(item => item.price_cents > 0);

    // SUCCESS LOG (Required format)
    console.log(`[DB_RELOAD_OK] order_id=${orderFromDB.id} fields={billing:${hasBilling},shipping:${hasShipping},items:${hasItems},prices:${hasPrices}}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    // === IDEMPOTENCY CHECK (prevent duplicate emails) ===
    if (orderFromDB.customer_email_sent_at || orderFromDB.admin_email_sent_at) {
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log(`[EMAIL_SKIP_ALREADY_SENT] order_id=${orderFromDB.id} customer_sent=${!!orderFromDB.customer_email_sent_at} admin_sent=${!!orderFromDB.admin_email_sent_at}`);
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      return; // Don't send duplicate emails
    }

    // === VALIDATE ORDER COMPLETENESS (Gate before email) ===
    console.log('[VALIDATION] Checking order completeness...');
    const missingFields = [];
    
    if (!orderFromDB.order_number) missingFields.push('order_number');
    if (!orderFromDB.customer_email) missingFields.push('customer_email');
    if (!hasBilling) missingFields.push('billing_address');
    if (!hasShipping) missingFields.push('shipping_address');
    if (!hasItems) missingFields.push('line_items');
    if (!orderFromDB.total_amount_cents || orderFromDB.total_amount_cents <= 0) missingFields.push('total_amount');
    if (!orderFromDB.currency) missingFields.push('currency');

    if (missingFields.length > 0) {
      console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.error('❌ [EMAIL_BLOCKED] Order incomplete - cannot send email');
      console.error('❌ [EMAIL_BLOCKED] Order ID:', orderFromDB.id);
      console.error('❌ [EMAIL_BLOCKED] Missing fields:', missingFields.join(', '));
      console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      
      // Update email_status in DB
      await supabase
        .from(tableName)
        .update({ 
          email_status: 'blocked_incomplete',
          email_last_error: `Missing: ${missingFields.join(', ')}`
        })
        .eq('id', orderFromDB.id);
      
      // Don't throw - webhook succeeded, just no email
      return;
    }

    console.log('✅ [VALIDATION] Order complete - all required fields present');
    console.log('✅ [VALIDATION] Proceeding to email...');

    // === SYNC STRIPE CUSTOMER TO SUPABASE ===
    await syncStripeCustomerToSupabase(fullSession, orderFromDB, trace_id);

    // === SYNC TO PRISMA (ADMIN SYSTEM) ===
    await syncOrderToPrisma(fullSession, orderFromDB, orderSource);

    // === SEND ORDER CONFIRMATION EMAIL (DB-FIRST) ===
    try {
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log(`📧 [EMAIL ATTEMPT] trace_id=${trace_id} mode=${eventMode}`);
      console.log(`📧 [EMAIL] Order: ${orderFromDB.id}`);
      console.log(`📧 [EMAIL] Order Number: ${orderFromDB.order_number}`);
      console.log(`📧 [EMAIL] Customer: ${orderFromDB.customer_email}`);
      console.log(`📧 [EMAIL] Source: DATABASE (not Stripe session)`);
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      
      // CRITICAL: Pass orderFromDB, not fullSession
      await sendOrderConfirmationEmail(orderFromDB, trace_id, eventMode);
      
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log(`✅ [EMAIL SUCCESS] trace_id=${trace_id} - Email flow completed`);
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    } catch (emailError) {
      // Don't fail the entire webhook if email fails
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.error(`❌ [EMAIL FAILED] trace_id=${trace_id} mode=${eventMode}`);
      console.error(`❌ [EMAIL] Error: ${emailError.message}`);
      console.error(`❌ [EMAIL] Stack:`, emailError.stack);
      console.error(`❌ [EMAIL] Order ID: ${order.id}`);
      console.error(`❌ [EMAIL] Session ID: ${session.id}`);
      console.error('⚠️ [EMAIL] Order was still created successfully (email failed)');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    }

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

async function syncOrderToPrisma(session, supabaseOrder, orderSource) {
  try {
    console.log('💾 [PRISMA SYNC] Starting order sync...');
    console.log('💾 [PRISMA SYNC] Session ID:', session.id);
    console.log('💾 [PRISMA SYNC] Order ID:', supabaseOrder.id);
    console.log('💾 [PRISMA SYNC] Order Source:', orderSource);

    let customerEmail, customerName;
    let items = [];
    let amountTotal, amountShipping = 0, amountTax = 0;

    // Handle different order formats
    if (orderSource === 'configurator') {
      // Orders table format (configurator)
      console.log('💾 [PRISMA SYNC] Processing CONFIGURATOR order:', supabaseOrder.order_number);
      
      // Get customer from customers table
      const { data: customerData, error: customerError } = await supabase
        .from('customers')
        .select('email, name')
        .eq('id', supabaseOrder.customer_id)
        .single();

      if (customerError || !customerData) {
        console.error('❌ [PRISMA SYNC] Failed to get customer:', customerError?.message);
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
      console.log('💾 [PRISMA SYNC] Processing SHOP order');
      
      customerEmail = session.customer_details?.email || session.customer_email;
      customerName = session.customer_details?.name || null;
      
      if (!customerEmail) {
        console.warn('⚠️ [PRISMA SYNC] No customer email - skipping');
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
        console.error('❌ [PRISMA SYNC] Failed to parse items:', err.message);
      }
    }

    console.log('✅ [PRISMA SYNC] Customer email:', customerEmail);
    console.log('✅ [PRISMA SYNC] Items:', items.length);

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

    console.log('✅ [PRISMA SYNC] Admin customer:', customer.id);

    // 3. Parse config_json from session metadata or supabaseOrder
    let configJson = null;
    try {
      if (session.metadata?.config_json) {
        configJson = JSON.parse(session.metadata.config_json);
        console.log('✅ [PRISMA SYNC] config_json from Stripe metadata:', configJson);
      } else if (supabaseOrder?.config_json) {
        configJson = supabaseOrder.config_json;
        console.log('✅ [PRISMA SYNC] config_json from Supabase order:', configJson);
      }
    } catch (error) {
      console.warn('⚠️ [PRISMA SYNC] Failed to parse config_json:', error.message);
    }

    // 4. Create or update order in admin system
    
    // Determine shipping region from country code
    const shippingCountry = session.shipping_details?.address?.country || 
                           session.customer_details?.address?.country || 
                           null;
    const shippingRegion = countryToRegion(shippingCountry);
    
    console.log('🌍 [PRISMA SYNC] Shipping country:', shippingCountry, '→ Region:', shippingRegion);
    
    // Calculate shipping from Backend DB (NOT from Stripe!)
    amountShipping = 0; // Reset before calculation
    try {
      const shippingRate = await prisma.shippingRate.findFirst({
        where: { 
          countryCode: shippingRegion,
          active: true 
        }
      });
      
      if (shippingRate) {
        amountShipping = shippingRate.priceNet;
        console.log('✅ [SHIPPING] From DB:', shippingRegion, '→', amountShipping, '¢ (', shippingRate.labelDe, ')');
      } else {
        // Fallback to hardcoded values if DB query fails
        const fallbackRates = { DE: 490, EU: 1290, INT: 2490 };
        amountShipping = fallbackRates[shippingRegion] || 2490;
        console.warn('⚠️ [SHIPPING] No DB rate found, using fallback:', amountShipping, '¢');
      }
    } catch (error) {
      console.error('❌ [SHIPPING] DB query failed:', error.message);
      const fallbackRates = { DE: 490, EU: 1290, INT: 2490 };
      amountShipping = fallbackRates[shippingRegion] || 2490;
      console.warn('⚠️ [SHIPPING] Using fallback:', amountShipping, '¢');
    }
    
    // Extract addresses with fallbacks (CRITICAL for admin_orders)
    const shippingAddress = session.shipping_details?.address ?? session.customer_details?.address ?? null;
    const billingAddress = session.customer_details?.address ?? session.shipping_details?.address ?? null;
    const shippingName = session.shipping_details?.name ?? session.customer_details?.name ?? customerName;
    const billingName = session.customer_details?.name ?? session.shipping_details?.name ?? customerName;
    
    console.log('🏠 [PRISMA SYNC] Shipping address:', shippingAddress ? `${shippingAddress.line1}, ${shippingAddress.city}` : 'MISSING');
    console.log('📋 [PRISMA SYNC] Billing address:', billingAddress ? `${billingAddress.line1}, ${billingAddress.city}` : 'MISSING');
    
    // Calculate subtotal from items
    const subtotalNet = items.reduce((sum, item) => sum + (item.unitPrice * item.qty), 0);
    
    // Recalculate tax and total with BACKEND shipping (NOT Stripe!)
    const taxRate = 0.19; // 19% German VAT
    const taxAmount = Math.round((subtotalNet + amountShipping) * taxRate);
    const totalGross = subtotalNet + taxAmount + amountShipping;
    
    console.log('💰 [PRICING] Subtotal:', subtotalNet, '¢ | Shipping:', amountShipping, '¢ | Tax:', taxAmount, '¢ | Total:', totalGross, '¢');
    
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
    console.log(`[DB_WRITE_ORDER] amounts: subtotal=${subtotalNet}¢ shipping=${amountShipping}¢ tax=${taxAmount}¢ total=${totalGross}¢`);
    console.log(`[DB_WRITE_ORDER] shipping_source=DB_shipping_rates (NOT Stripe!)`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ [PRISMA SYNC] Admin order:', order.id);

    // 4. Check if items already exist (IDEMPOTENCY)
    const existingItems = await prisma.orderItem.count({
      where: { orderId: order.id }
    });

    if (existingItems > 0) {
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log(`[IDEMPOTENT_SKIP] reason=items_already_exist order_id=${order.id.substring(0, 8)} existing_count=${existingItems}`);
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    } else if (items.length > 0) {
      console.log('🛒 [PRISMA SYNC] Creating order items...');
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
          
          console.log('💰 [PRISMA SYNC] Calculated pricing:', {
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
      console.log(`✅ [PRISMA SYNC] Created ${insertedCount} order items`);
      
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
      
      console.log('💰 [PRISMA SYNC] Recalculated totals:', {
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

    console.log('✅ [PRISMA SYNC] Complete - Order synced to admin system');

  } catch (error) {
    // Don't throw - Prisma sync failure shouldn't block webhook
    console.error('⚠️ [PRISMA SYNC] Failed but continuing:', error.message);
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
