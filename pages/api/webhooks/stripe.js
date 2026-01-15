import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';
import { buffer } from 'micro';
import prisma from '../../../lib/prisma';
import { calcConfiguredPrice } from '../../../lib/pricing/calcConfiguredPriceDB.js';
import { countryToRegion } from '../../../lib/utils/shipping.js';
import { sendOrderConfirmation } from '../../../lib/email/emailService';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
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
  console.log('🪝 [ENV CHECK] SUPABASE_URL present:', !!process.env.SUPABASE_URL);
  console.log('🪝 [ENV CHECK] SUPABASE_SERVICE_ROLE_KEY present:', !!process.env.SUPABASE_SERVICE_ROLE_KEY);

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

    // 2. Verify webhook signature
    let event;
    try {
      event = stripe.webhooks.constructEvent(
        buf,
        sig,
        process.env.STRIPE_WEBHOOK_SECRET
      );
      console.log('✅ [SIGNATURE] Verified OK');
      console.log('📥 [EVENT] Type:', event.type);
      console.log('📥 [EVENT] ID:', event.id);
    } catch (err) {
      console.error('❌ [SIGNATURE] Verification FAILED:', err.message);
      return res.status(400).json({ error: `Webhook signature verification failed: ${err.message}` });
    }

    // Extract trace_id from event metadata (passed through from checkout)
    const trace_id = event.data.object.metadata?.trace_id;
    
    console.log('[WEBHOOK HIT]', event.type);
    console.log('[EMAILS_ENABLED]', process.env.EMAILS_ENABLED);
    console.log('[RESEND_API_KEY]', process.env.RESEND_API_KEY ? 'SET' : 'MISSING');
    console.log('[SESSION ID]', event.data.object.id);
    console.log('[CUSTOMER EMAIL]', event.data.object.customer_details?.email);
    console.log('[TRACE] WEBHOOK_IN', {
      trace_id,
      event_id: event.id,
      event_type: event.type,
      timestamp: new Date().toISOString()
    });
    
    // 3. Handle specific events
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutSessionCompleted(event.data.object, trace_id);
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
    res.status(200).json({ received: true, event: event.type });

  } catch (error) {
    console.error('❌ [Webhook] Fatal error:', error);
    console.error('❌ [Webhook] Error stack:', error.stack);
    res.status(500).json({ 
      error: 'Webhook handler failed',
      message: error.message 
    });
  }
}

async function handleCheckoutSessionCompleted(session, trace_id) {
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

    // 3. Update order to paid in the appropriate table
    const updateData = {
      status: 'paid',
      stripe_payment_intent_id: session.payment_intent,
      stripe_customer_id: session.customer,
      customer_email: session.customer_details?.email || session.customer_email,
      customer_name: session.customer_details?.name,
      customer_phone: session.customer_details?.phone,
      shipping_address: session.shipping_details?.address || null,
      billing_address: session.customer_details?.address || null,
      updated_at: new Date().toISOString(),
    };

    console.log('📝 [DB UPDATE] Attempting update in', orderSource, 'table...');
    console.log('📝 [DB UPDATE] WHERE order.id =', order.id);
    console.log('📝 [DB UPDATE] SET data:', JSON.stringify(updateData, null, 2));

    const tableName = orderSource === 'configurator' ? 'orders' : 'simple_orders';
    
    const { data: updatedRows, error: updateError } = await supabase
      .from(tableName)
      .update(updateData)
      .eq('id', order.id)
      .select();

    if (updateError) {
      console.error('❌ [DB UPDATE] Failed:', updateError.message);
      console.error('❌ [DB UPDATE] Code:', updateError.code);
      console.error('❌ [DB UPDATE] Details:', updateError.details);
      console.error('❌ [DB UPDATE] Hint:', updateError.hint);
      throw new Error(`Order update failed: ${updateError.message}`);
    }

    const rowCount = updatedRows?.length || 0;
    console.log('✅ [DB UPDATE] Complete - Rows affected:', rowCount);

    if (rowCount === 0) {
      console.error('❌ [DB UPDATE] WARNING: 0 rows affected!');
      console.error('❌ [DB UPDATE] Order ID:', order.id);
      console.error('❌ [DB UPDATE] Session ID:', session.id);
      console.error('❌ [DB UPDATE] This means WHERE clause matched nothing');
      logData.status = 'error';
      logData.error_message = `Update affected 0 rows for order ${order.id}`;
      logData.rows_affected = 0;
      await logWebhookEvent(logData);
      throw new Error(`Update affected 0 rows for order ${order.id}`);
    }

    logData.rows_affected = rowCount;

    if (rowCount > 0 && updatedRows[0]) {
      console.log('✅ [DB UPDATE] Updated order ID:', updatedRows[0].id);
      console.log('✅ [DB UPDATE] New status:', updatedRows[0].status);
      console.log('✅ [DB UPDATE] Paid at:', updatedRows[0].paid_at);
    }

    console.log('✅ [WEBHOOK] Order successfully marked as paid:', order.id);
    logData.status = 'success';
    await logWebhookEvent(logData);

    // === SYNC STRIPE CUSTOMER TO SUPABASE ===
    await syncStripeCustomerToSupabase(session, order, trace_id);

    // === SYNC TO PRISMA (ADMIN SYSTEM) ===
    await syncOrderToPrisma(session, order, orderSource);

    // === SEND ORDER CONFIRMATION EMAIL ===
    try {
      console.log('[EMAIL CALL] About to send order confirmation');
      console.log('[EMAIL CALL] Order ID:', order.id);
      console.log('[EMAIL CALL] Session ID:', session.id);
      await sendOrderConfirmationEmail(session, order);
      console.log('[EMAIL CALL] sendOrderConfirmationEmail finished');
    } catch (emailError) {
      // Don't fail the entire webhook if email fails
      console.error('[EMAIL CALL] EXCEPTION:', emailError.message);
      console.error('[EMAIL CALL] Stack:', emailError.stack);
      console.error('⚠️ [EMAIL] Failed to send confirmation email:', emailError.message);
      console.error('⚠️ [EMAIL] Order was still created successfully');
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

async function sendOrderConfirmationEmail(session, order) {
  try {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📧 [EMAIL RESOLUTION] Determining recipient email...');
    console.log(`📧 [EMAIL SOURCE] session.id: ${session.id}`);
    console.log(`📧 [EMAIL SOURCE] session.customer_details?.email: ${session.customer_details?.email || 'EMPTY'}`);
    console.log(`📧 [EMAIL SOURCE] session.customer_email: ${session.customer_email || 'EMPTY'}`);
    console.log(`📧 [EMAIL SOURCE] session.metadata?.customer_email: ${session.metadata?.customer_email || 'EMPTY'}`);
    
    // Email validation helper
    const isValidEmail = (email) => {
      if (!email || typeof email !== 'string') return false;
      // Simple validation: contains @ and .
      return email.includes('@') && email.includes('.') && email.length > 5;
    };

    // Determine recipient email with priority
    let customerEmail = null;
    let emailSource = null;

    // PRIORITY 1: session.customer_details?.email (most reliable from Stripe)
    if (session.customer_details?.email && isValidEmail(session.customer_details.email)) {
      customerEmail = session.customer_details.email;
      emailSource = 'session.customer_details.email';
    }
    // PRIORITY 2: session.customer_email (fallback)
    else if (session.customer_email && isValidEmail(session.customer_email)) {
      customerEmail = session.customer_email;
      emailSource = 'session.customer_email';
    }
    // PRIORITY 3: metadata.customer_email (only if valid email pattern)
    else if (session.metadata?.customer_email && isValidEmail(session.metadata.customer_email)) {
      customerEmail = session.metadata.customer_email;
      emailSource = 'session.metadata.customer_email';
    }

    console.log(`📧 [EMAIL RESOLVED] Recipient: ${customerEmail || 'NONE'}`);
    console.log(`📧 [EMAIL RESOLVED] Source: ${emailSource || 'NONE'}`);

    // If no valid email found, NOTIFY ADMIN
    if (!customerEmail) {
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.error('⚠️  [EMAIL CRITICAL] NO VALID CUSTOMER EMAIL FOUND!');
      console.error('⚠️  [EMAIL] Order ID:', order.id);
      console.error('⚠️  [EMAIL] Session ID:', session.id);
      console.error('⚠️  [EMAIL] Sending admin notification...');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

      // Send admin notification
      try {
        const orderNumber = order.id.substring(0, 8).toUpperCase();
        await sendOrderConfirmation({
          orderId: order.id,
          orderNumber: orderNumber,
          customerEmail: 'admin@unbreak-one.com',
          customerName: '⚠️ ADMIN ALERT - No Customer Email',
          items: [{ 
            name: '⚠️ ORDER WITHOUT CUSTOMER EMAIL', 
            quantity: 1, 
            price_cents: order.total_amount_cents 
          }],
          totalAmount: order.total_amount_cents,
          language: 'de',
          shippingAddress: session.shipping_details?.address
        });
        console.log('✅ [EMAIL] Admin notification sent');
      } catch (adminEmailError) {
        console.error('❌ [EMAIL] Failed to send admin notification:', adminEmailError.message);
      }
      return;
    }

    // Extract customer data from Stripe session
    const customerName = session.customer_details?.name;
    const shippingAddress = session.shipping_details?.address;

    // Load Line Items from Stripe (with proper amounts)
    console.log('[MAIL] Loading line items from Stripe...');
    let items = [];
    try {
      const lineItems = await stripe.checkout.sessions.listLineItems(session.id, { limit: 100 });
      console.log('[MAIL] lineItems count:', lineItems.data.length);
      
      items = lineItems.data.map(item => {
        const unitAmount = item.price?.unit_amount || item.amount_total / item.quantity || 0;
        const lineTotal = item.amount_total || unitAmount * item.quantity;
        
        console.log('[MAIL] item:', {
          name: item.description,
          unit: unitAmount,
          qty: item.quantity,
          lineTotal: lineTotal
        });
        
        return {
          name: item.description || 'Product',
          quantity: item.quantity,
          price_cents: unitAmount,
          line_total_cents: lineTotal
        };
      });
      
      console.log('[MAIL] total:', session.amount_total);
    } catch (err) {
      console.error('❌ [EMAIL] Failed to load Stripe line items:', err.message);
      // Fallback to order items from DB
      try {
        items = typeof order.items === 'string' ? JSON.parse(order.items) : order.items;
      } catch (parseErr) {
        console.error('❌ [EMAIL] Failed to parse order items:', parseErr.message);
        items = [{ name: 'Order', quantity: 1, price_cents: order.total_amount_cents }];
      }
    }

    // Detect language from customer data (default to German)
    let language = 'de';
    if (session.locale) {
      language = session.locale.startsWith('en') ? 'en' : 'de';
    } else if (shippingAddress?.country) {
      // English for UK, US, etc.
      language = ['GB', 'US', 'CA', 'AU', 'NZ'].includes(shippingAddress.country) ? 'en' : 'de';
    }

    const orderNumber = order.id.substring(0, 8).toUpperCase();

    console.log(`📧 [EMAIL] Recipient: ${customerEmail} (${emailSource})`);
    console.log(`📧 [EMAIL] BCC: admin@unbreak-one.com, orders@unbreak-one.com`);
    console.log(`📧 [EMAIL] Order: ${orderNumber} (${order.id})`);
    console.log(`📧 [EMAIL] EMAILS_ENABLED: ${process.env.EMAILS_ENABLED}`);
    console.log(`📧 [EMAIL] RESEND_API_KEY: ${process.env.RESEND_API_KEY ? '✅ Set' : '❌ Missing'}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    // Direct call to emailService (no HTTP fetch!)
    console.log('[EMAIL SEND] Calling sendOrderConfirmation with:', {
      customerEmail,
      orderNumber,
      itemCount: items.length,
      totalAmount: order.total_amount_cents
    });
    const emailResult = await sendOrderConfirmation({
      orderId: order.id,
      orderNumber: orderNumber,
      customerEmail,
      customerName,
      items,
      totalAmount: order.total_amount_cents,
      language,
      shippingAddress,
      // BCC to admin + orders for internal tracking
      bcc: ['admin@unbreak-one.com', 'orders@unbreak-one.com']
    });
    console.log('[EMAIL SEND] Result:', emailResult);

    if (emailResult.sent) {
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('✅ [EMAIL SUCCESS] Order confirmation sent!');
      console.log(`✅ [EMAIL] Resend Email ID: ${emailResult.id}`);
      console.log(`✅ [EMAIL] TO: ${customerEmail} (${emailSource})`);
      console.log(`✅ [EMAIL] BCC: admin@unbreak-one.com, orders@unbreak-one.com`);
      console.log(`✅ [EMAIL] Order: ${orderNumber}`);
      console.log('[MAIL] send customer ok');
      console.log('[MAIL] send internal/bcc ok');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    } else if (emailResult.preview) {
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('📋 [EMAIL PREVIEW MODE] EMAILS_ENABLED=false');
      console.log('📋 [EMAIL] Email NOT sent (preview mode)');
      console.log('📋 [EMAIL] Would send to:', customerEmail);
      console.log('📋 [EMAIL] Would BCC to: admin@unbreak-one.com');
      console.log('📋 [EMAIL] To enable: Set EMAILS_ENABLED=true in Vercel ENV');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    } else {
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.error('❌ [EMAIL FAILED] Email send failed!');
      console.error(`❌ [EMAIL] Error: ${emailResult.error}`);
      console.error(`❌ [EMAIL] TO: ${customerEmail} (${emailSource})`);
      console.error(`❌ [EMAIL] Order: ${orderNumber}`);
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    }

  } catch (error) {
    // Log but don't throw - email failure shouldn't block webhook processing
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.error('❌ [EMAIL EXCEPTION] Unexpected email error!');
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
      amountShipping = supabaseOrder.shipping_cents || 0;
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
      amountShipping = session.total_details?.amount_shipping || 0;
      amountTax = session.total_details?.amount_tax || 0;

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
        amountTotal: amountTotal,
        amountShipping: amountShipping,
        amountTax: amountTax,
        email: customerEmail,
        shippingName: customerName || session.shipping_details?.name,
        shippingAddress: session.shipping_details?.address || supabaseOrder.shipping_address || null,
        shippingRegion: shippingRegion,
        customerId: customer.id,
        paidAt: new Date(),
        configJson: configJson,
      },
    });

    console.log('✅ [PRISMA SYNC] Admin order:', order.id);

    // 4. Create order items
    const existingItems = await prisma.orderItem.count({
      where: { orderId: order.id }
    });

    if (existingItems === 0 && items.length > 0) {
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
      }
      console.log(`✅ [PRISMA SYNC] Created ${items.length} order items`);
      
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
    } else {
      console.log('ℹ️ [PRISMA SYNC] Order items already exist - skipping');
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

    // Upsert customer - MINIMAL VERSION due to PostgREST schema cache issues
    // Only use columns that existed BEFORE migration 008
    const { data: customer, error: upsertError } = await supabase
      .from('customers')
      .upsert({
        stripe_customer_id: stripeCustomerId,
        email: customerEmail?.toLowerCase() || `stripe-${stripeCustomerId}@unknown.com`,
        name: customerName,
        phone: customerPhone,
        // All other columns disabled until schema cache refreshes
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'stripe_customer_id',
        ignoreDuplicates: false,
      })
      .select()
      .single();

    if (upsertError) {
      console.log('[TRACE] CUSTOMER_UPSERT_ERROR', {
        trace_id,
        error: upsertError.message,
        code: upsertError.code
      });
      console.error('❌ [CUSTOMER SYNC] Upsert failed:', upsertError.message);
      throw upsertError;
    }

    console.log('[TRACE] CUSTOMER_UPSERT_SUCCESS', {
      trace_id,
      customer_id: customer.id,
      email: customer.email
    });
    console.log('✅ [CUSTOMER SYNC] Customer synced - ID:', customer.id);

    // Update order with customer_id, stripe_customer_id and customer details
    const tableName = order.order_number ? 'orders' : 'simple_orders';
    const { error: orderUpdateError } = await supabase
      .from(tableName)
      .update({
        customer_id: customer.id,
        stripe_customer_id: stripeCustomerId,
        customer_email: customerEmail,
        customer_name: customerName,
        customer_phone: customerPhone,
        shipping_address: defaultShipping,
        billing_address: defaultBilling,
        updated_at: new Date().toISOString(),
      })
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
