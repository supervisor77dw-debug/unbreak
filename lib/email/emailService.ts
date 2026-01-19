/**
 * Central Email Service - UNBREAK ONE
 * 
 * PURPOSE:
 * - Single point for all email sending
 * - Hard kill-switch via EMAILS_ENABLED env var
 * - Preview mode when disabled (no Resend API calls)
 * - Robust defaults and validation
 * 
 * USAGE:
 * import { sendEmail } from '@/lib/email/emailService';
 * 
 * await sendEmail({
 *   type: 'order-confirmation',
 *   to: 'customer@example.com',
 *   subject: 'Your Order #12345',
 *   html: '<html>...</html>',
 *   meta: { orderId: 'uuid-123' }
 * });
 */

import { Resend } from 'resend';

// Email types for categorization and logging
export type EmailType = 
  | 'order-confirmation'
  | 'order-shipped'
  | 'payment-received'
  | 'support-ticket'
  | 'account-verification'
  | 'password-reset'
  | 'system-notification'
  | 'test';

export interface SendEmailParams {
  type: EmailType;
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  from?: string;
  replyTo?: string;
  bcc?: string | string[];
  meta?: Record<string, any>;
}

export interface EmailResult {
  preview?: boolean;
  sent?: boolean;
  id?: string;
  error?: string;
}

/**
 * Validate email address format
 */
function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Get default FROM address based on email type
 */
function getDefaultFrom(type: EmailType): string {
  switch (type) {
    case 'order-confirmation':
    case 'order-shipped':
    case 'payment-received':
      return 'UNBREAK ONE <orders@unbreak-one.com>';
    
    case 'support-ticket':
      return 'UNBREAK ONE Support <support@unbreak-one.com>';
    
    case 'account-verification':
    case 'password-reset':
    case 'system-notification':
      return 'UNBREAK ONE <no-reply@unbreak-one.com>';
    
    case 'test':
      return 'UNBREAK ONE <no-reply@unbreak-one.com>';
    
    default:
      return 'UNBREAK ONE <no-reply@unbreak-one.com>';
  }
}

/**
 * Get default REPLY-TO address based on email type
 */
function getDefaultReplyTo(type: EmailType): string | undefined {
  // Order emails should have replies go to support
  if (['order-confirmation', 'order-shipped', 'payment-received'].includes(type)) {
    return 'support@unbreak-one.com';
  }
  
  // Support tickets should reply to support
  if (type === 'support-ticket') {
    return 'support@unbreak-one.com';
  }
  
  // System emails typically don't need reply-to
  return undefined;
}

/**
 * Strip HTML tags and get plain text preview
 */
function getTextPreview(html: string, maxLength: number = 120): string {
  // Remove HTML tags
  let text = html.replace(/<[^>]*>/g, ' ');
  
  // Remove multiple spaces and newlines
  text = text.replace(/\s+/g, ' ').trim();
  
  // Truncate
  if (text.length > maxLength) {
    text = text.substring(0, maxLength) + '...';
  }
  
  return text;
}

/**
 * Main email sending function with kill-switch
 * 
 * CRITICAL: This is the ONLY function that should call Resend API
 * All direct resend.emails.send() calls must go through here
 */
export async function sendEmail(params: SendEmailParams): Promise<EmailResult> {
  const {
    type,
    to,
    subject,
    html,
    text,
    from,
    replyTo,
    bcc,
    meta = {}
  } = params;

  // ========================================
  // 1. VALIDATION (runs in both preview and send mode)
  // ========================================
  
  if (!to || (Array.isArray(to) && to.length === 0)) {
    throw new Error('[EMAIL] Missing recipient (to)');
  }

  // Validate email addresses
  const recipients = Array.isArray(to) ? to : [to];
  for (const email of recipients) {
    if (!isValidEmail(email)) {
      throw new Error(`[EMAIL] Invalid email address: ${email}`);
    }
  }

  if (!subject || subject.trim().length === 0) {
    throw new Error('[EMAIL] Missing subject');
  }

  if (!html || html.trim().length === 0) {
    throw new Error('[EMAIL] Missing HTML content');
  }

  // ========================================
  // 2. PREPARE EMAIL DATA
  // ========================================
  
  const finalFrom = from || getDefaultFrom(type);
  const finalReplyTo = replyTo || getDefaultReplyTo(type);
  const finalText = text || getTextPreview(html);

  // ========================================
  // 3. SEND VIA RESEND (ALWAYS - NO KILL-SWITCH)
  // ========================================
  
  try {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`📧 [EMAIL SEND] Type: ${type}`);
    console.log(`📧 [EMAIL SEND] To: ${Array.isArray(to) ? to.join(', ') : to}`);
    console.log(`📧 [EMAIL SEND] From: ${finalFrom}`);
    if (bcc) {
      console.log(`📧 [EMAIL SEND] BCC: ${Array.isArray(bcc) ? bcc.join(', ') : bcc}`);
    }
    console.log(`📧 [EMAIL SEND] Subject: ${subject}`);
    console.log(`📧 [EMAIL SEND] Meta:`, meta);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    // Check for API key
    if (!process.env.RESEND_API_KEY) {
      console.error('❌ [EMAIL] RESEND_API_KEY not configured');
      throw new Error('[EMAIL] RESEND_API_KEY not configured');
    }
    
    console.log('✅ [EMAIL] RESEND_API_KEY present');

    // Initialize Resend (only when actually sending)
    console.log('🔧 [RESEND] Initializing Resend client...');
    const resend = new Resend(process.env.RESEND_API_KEY);
    console.log('✅ [RESEND] Client initialized');

    // Prepare BCC recipients
    const bccRecipients = bcc ? (Array.isArray(bcc) ? bcc : [bcc]) : undefined;

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📤 [RESEND CALL] ABOUT TO CALL resend.emails.send()');
    console.log('[RESEND CALL] To:', recipients);
    console.log('[RESEND CALL] From:', finalFrom);
    console.log('[RESEND CALL] BCC:', bccRecipients);
    console.log('[RESEND CALL] Subject:', subject);
    console.log('[RESEND CALL] ReplyTo:', finalReplyTo || 'none');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    // Send email with retry logic for rate limits (429)
    let result;
    let attempt = 0;
    const maxRetries = 3;
    const baseDelay = 1000; // 1 second
    
    while (attempt < maxRetries) {
      try {
        if (attempt > 0) {
          const delay = baseDelay * Math.pow(2, attempt - 1); // Exponential backoff: 1s, 2s, 4s
          console.log(`⏳ [RETRY] Attempt ${attempt + 1}/${maxRetries} - Waiting ${delay}ms before retry...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
        
        result = await resend.emails.send({
          from: finalFrom,
          to: recipients,
          subject,
          html,
          text: finalText,
          ...(finalReplyTo && { replyTo: finalReplyTo }),
          ...(bccRecipients && { bcc: bccRecipients }),
        });
        
        // If success or non-rate-limit error, break out of retry loop
        if (!result.error || result.error.name !== 'rate_limit_exceeded') {
          break;
        }
        
        // Rate limit error - will retry
        console.warn(`⚠️ [RATE LIMIT] Attempt ${attempt + 1} hit rate limit - will retry`);
        attempt++;
        
      } catch (sendError: any) {
        console.error(`❌ [SEND ERROR] Attempt ${attempt + 1} failed:`, sendError.message);
        // If last attempt, throw the error
        if (attempt === maxRetries - 1) {
          throw sendError;
        }
        attempt++;
      }
    }
    
    if (!result) {
      throw new Error('Failed to send email after retries');
    }

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📥 [RESEND RESPONSE] Received from Resend API');
    console.log('[RESEND RESULT] Full response:', JSON.stringify(result, null, 2));
    if (attempt > 0) {
      console.log(`✅ [RETRY SUCCESS] Email sent after ${attempt + 1} attempts`);
    }
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    // Check for error response
    if (result.error) {
      console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.error(`❌ [EMAIL SEND] Resend API returned error`);
      console.error('[RESEND ERROR] Message:', result.error.message);
      console.error('[RESEND ERROR] Name:', result.error.name);
      console.error('[RESEND ERROR] Full error:', JSON.stringify(result.error, null, 2));
      console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      return {
        sent: false,
        error: result.error.message || 'Unknown Resend API error',
      };
    }

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`✅ [EMAIL SEND] Success!`);
    console.log(`✅ [RESEND ID] ${result.data?.id}`);
    console.log(`✅ [EMAIL SENT TO] ${Array.isArray(to) ? to.join(', ') : to}`);
    if (bccRecipients && bccRecipients.length > 0) {
      console.log(`✅ [EMAIL BCC TO] ${bccRecipients.join(', ')}`);
      console.log(`ℹ️  [BCC INFO] BCC recipients will receive the SAME email`);
      console.log(`ℹ️  [BCC INFO] This is ONE request, not ${1 + bccRecipients.length} separate requests`);
    }
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    return {
      sent: true,
      id: result.data?.id,
    };

  } catch (error: any) {
    console.error(`❌ [EMAIL SEND] Failed to send ${type}:`, error.message);
    console.error('[RESEND ERROR]', error);
    console.error('[RESEND ERROR] Stack:', error.stack);
    
    // Don't throw - return error result instead
    // This prevents webhook/order flows from failing due to email issues
    return {
      sent: false,
      error: error.message,
    };
  }
}

/**
 * Helper: Send order confirmation email
 */
export async function sendOrderConfirmation(params: {
  orderId: string;
  orderNumber?: string;
  customerEmail: string;
  customerName?: string;
  customerPhone?: string;
  items: Array<{ name: string; quantity: number; price_cents: number; line_total_cents?: number }>;
  totalAmount: number;
  language?: 'de' | 'en';
  shippingAddress?: any;
  billingAddress?: any; // ← NEW: Billing address
  paymentIntentId?: string; // ← NEW: Payment intent ID
  paymentStatus?: string; // ← NEW: Payment status
  amountSubtotal?: number; // ← NEW: Subtotal
  shippingCost?: number; // ← NEW: Shipping cost
  orderDate?: Date; // ← NEW: Order timestamp
  bcc?: string | string[];
}) {
  const {
    orderId,
    orderNumber,
    customerEmail,
    customerName,
    customerPhone,
    items,
    totalAmount,
    language = 'de',
    shippingAddress,
    billingAddress, // ← NEW
    paymentIntentId, // ← NEW
    paymentStatus, // ← NEW
    amountSubtotal, // ← NEW
    shippingCost, // ← NEW
    orderDate, // ← NEW
    bcc
  } = params;

  const isGerman = language === 'de';
  
  console.log('[EMAIL DATA] Received params:', {
    orderId,
    orderNumber,
    customerName: customerName || '(fehlt)',
    customerEmail,
    customerPhone: customerPhone || '(fehlt)',
    hasShippingAddress: !!shippingAddress,
    hasBillingAddress: !!billingAddress,
    paymentIntentId: paymentIntentId || '(fehlt)',
    paymentStatus: paymentStatus || '(fehlt)',
    itemCount: items.length,
    totalAmount,
    amountSubtotal,
    shippingCost,
    orderDate: orderDate ? orderDate.toISOString() : '(fehlt)'
  });

  // ====================================================================
  // PRODUCT LABELS MAPPING (i18n for email)
  // ====================================================================
  // Map raw product names to localized display names
  // This ensures emails show correct language regardless of database/cart data
  const PRODUCT_LABELS: Record<string, { de: string; en: string }> = {
    // Standard SKUs
    'UNBREAK-GLAS-01': {
      de: 'Glashalter',
      en: 'Glass Holder'
    },
    'UNBREAK-WEIN-01': {
      de: 'Flaschenhalter',
      en: 'Bottle Holder'
    },
    // Configurator products
    'glass_configurator': {
      de: 'Glashalter Konfiguriert',
      en: 'Glass Holder Configured'
    },
    'bottle_configurator': {
      de: 'Flaschenhalter Konfiguriert',
      en: 'Bottle Holder Configured'
    },
    // Stripe naming variants (what Stripe returns in line items)
    'Glashalter Universal': {
      de: 'Glashalter',
      en: 'Glass Holder'
    },
    'Universal Glass Holder': {
      de: 'Glashalter',
      en: 'Glass Holder'
    },
    'Flaschenhalter': {
      de: 'Flaschenhalter',
      en: 'Bottle Holder'
    },
    'Bottle Holder': {
      de: 'Flaschenhalter',
      en: 'Bottle Holder'
    },
    'Glashalter Konfiguriert': {
      de: 'Glashalter Konfiguriert',
      en: 'Glass Holder Configured'
    },
    'Glass Holder Configured': {
      de: 'Glashalter Konfiguriert',
      en: 'Glass Holder Configured'
    },
    'Flaschenhalter Konfiguriert': {
      de: 'Flaschenhalter Konfiguriert',
      en: 'Bottle Holder Configured'
    },
    'Bottle Holder Configured': {
      de: 'Flaschenhalter Konfiguriert',
      en: 'Bottle Holder Configured'
    }
  };

  /**
   * Resolve localized product name from raw name
   * Priority: PRODUCT_LABELS mapping → fallback to raw name
   */
  const resolveProductName = (rawName: string, locale: 'de' | 'en'): string => {
    // Check exact match first
    if (PRODUCT_LABELS[rawName]) {
      return PRODUCT_LABELS[rawName][locale];
    }
    
    // Check partial match (case-insensitive)
    const lowerName = rawName.toLowerCase();
    for (const [key, labels] of Object.entries(PRODUCT_LABELS)) {
      if (lowerName.includes(key.toLowerCase())) {
        return labels[locale];
      }
    }
    
    // Fallback: return raw name (for unknown products)
    console.warn(`[EMAIL i18n] No translation found for product: "${rawName}" (locale: ${locale})`);
    return rawName;
  };

  // Safe currency formatter (no NaN)
  const formatCurrency = (cents: number): string => {
    if (cents === null || cents === undefined || isNaN(cents)) {
      return '—';
    }
    const formatter = new Intl.NumberFormat(isGerman ? 'de-DE' : 'en-US', {
      style: 'currency',
      currency: 'EUR',
    });
    return formatter.format(cents / 100);
  };

  // ====================================================================
  // PRICING LOGIC (CRITICAL: Prevent double-counting shipping)
  // ====================================================================
  // IMPORTANT: Checkout API sends shipping as a separate line item
  // We MUST separate products from shipping to avoid double-counting
  const productItems = items.filter(item => !item.name.toLowerCase().includes('versand') && !item.name.toLowerCase().includes('shipping'));
  const shippingItem = items.find(item => item.name.toLowerCase().includes('versand') || item.name.toLowerCase().includes('shipping'));
  
  // ====================================================================
  // LOCALIZE PRODUCT NAMES (i18n) + FIX MISSING UNIT PRICES
  // ====================================================================
  // Apply locale-aware product name resolution to all items
  // FIX: If price_cents is 0 but line_total_cents exists, calculate unit price
  const localizedProductItems = productItems.map(item => {
    const qty = item.quantity || 1;
    // Calculate price_cents from line_total if missing (logic fix: 1+0 should equal 1)
    const fixedPriceCents = item.price_cents > 0 
      ? item.price_cents 
      : (item.line_total_cents && qty > 0 ? Math.round(item.line_total_cents / qty) : 0);
    
    return {
      ...item,
      name: resolveProductName(item.name, language),
      price_cents: fixedPriceCents,
    };
  });
  
  console.log('[EMAIL i18n] Product names localized:', {
    locale: language,
    original: productItems.map(i => i.name),
    localized: localizedProductItems.map(i => i.name)
  });
  
  // GUARDRAIL: Detect if shipping is in line items
  const hasShippingLine = !!shippingItem;
  
  // Calculate from items, but use passed-in values as fallback if items empty
  const itemsSubtotal = localizedProductItems.reduce((sum, item) => sum + ((item.line_total_cents || (item.price_cents * item.quantity)) || 0), 0);
  const itemsShipping = shippingItem ? (shippingItem.line_total_cents || shippingItem.price_cents) : 0;
  
  // CRITICAL: Use amountSubtotal/shippingCost params if items calculation yields 0
  const subtotalCents = itemsSubtotal > 0 ? itemsSubtotal : (amountSubtotal || totalAmount);
  const shippingCents = itemsShipping > 0 ? itemsShipping : (shippingCost || 0);
  const orderTotalCents = totalAmount; // This is the authoritative total from Stripe

  // DEBUG LOGGING (temporary - remove after verification)
  console.log('[EMAIL PRICING DEBUG]', {
    productItems_count: localizedProductItems.length,
    hasShippingLine,
    items_subtotal: itemsSubtotal,
    items_shipping: itemsShipping,
    fallback_subtotal: amountSubtotal,
    fallback_shipping: shippingCost,
    final_subtotal_cents: subtotalCents,
    final_shipping_cents: shippingCents,
    total_cents: orderTotalCents,
    items_total_check: items.reduce((sum, item) => sum + (item.line_total_cents || 0), 0),
    // GUARDRAIL CHECK: Total should equal subtotal + shipping
    expected_total: subtotalCents + shippingCents,
    total_matches: orderTotalCents === (subtotalCents + shippingCents),
  });

  // Format items for email (products only, no shipping in list)
  const itemsText = localizedProductItems.map(item => {
    const qty = item.quantity;
    const name = item.name;
    const lineTotal = formatCurrency(item.line_total_cents || (item.price_cents * item.quantity));
    return `– ${qty} × ${name} – ${lineTotal}`;
  }).join('\n');

  // EXACT TEXTS AS PROVIDED - DO NOT MODIFY
  // Add [TEST] prefix when using Stripe Test keys
  const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || '';
  const isTestMode = publishableKey.startsWith('pk_test_');
  const testPrefix = isTestMode ? '[TEST] ' : '';
  
  const subject = isGerman
    ? `${testPrefix}UNBREAK-ONE – Neue Bestellung – ${orderNumber || orderId.substring(0, 8)}`
    : `${testPrefix}UNBREAK-ONE – New Order – ${orderNumber || orderId.substring(0, 8)}`;

  const greeting = customerName 
    ? `Hallo ${customerName},`
    : 'Hallo,';
  
  const greetingEN = customerName
    ? `Hello ${customerName},`
    : 'Hello,';

  const html = isGerman ? `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; background-color: #F7F7F7; font-family: Arial, Helvetica, sans-serif;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        
        <!-- Main Container -->
        <table role="presentation" style="max-width: 600px; width: 100%; background-color: #FFFFFF; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.08);">
          
          <!-- Header -->
          <tr>
            <td style="padding: 40px 40px 20px 40px; text-align: center; background-color: #2F6F55; border-radius: 12px 12px 0 0;">
              <h1 style="margin: 0; color: #FFFFFF; font-size: 28px; font-weight: 600; letter-spacing: 1px;">UNBREAK ONE</h1>
              <p style="margin: 10px 0 0 0; color: rgba(255,255,255,0.9); font-size: 16px;">Vielen Dank für Ihre Bestellung!</p>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 40px;">
              
              <p style="margin: 0 0 20px 0; font-size: 16px; color: #333333; line-height: 1.6;">${greeting}</p>
              
              <p style="margin: 0 0 30px 0; font-size: 15px; color: #666666; line-height: 1.6;">
                vielen Dank für Ihre Bestellung bei UNBREAK ONE.<br>
                Wir haben Ihre Zahlung erfolgreich erhalten und bereiten Ihre Bestellung nun für den Versand vor.
              </p>
              
              <!-- Order Details Box -->
              <div style="background-color: #F9F9F9; border-radius: 8px; padding: 25px; margin: 30px 0;">
                <h2 style="margin: 0 0 20px 0; color: #2F6F55; font-size: 20px; font-weight: 600;">🧾 Bestellübersicht</h2>
                
                <table style="width: 100%; margin: 0 0 20px 0;">
                  <tr>
                    <td style="padding: 8px 0; font-size: 14px; color: #666;">Bestellnummer:</td>
                    <td style="padding: 8px 0; font-size: 14px; color: #333; font-weight: 600; text-align: right;">${orderNumber || orderId.substring(0, 8)}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; font-size: 14px; color: #666;">Bestelldatum:</td>
                    <td style="padding: 8px 0; font-size: 14px; color: #333; text-align: right;">${new Date().toLocaleDateString('de-DE')}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; font-size: 14px; color: #666;">Zahlungsstatus:</td>
                    <td style="padding: 8px 0; font-size: 14px; text-align: right;"><span style="background-color: #D4EDDA; color: #155724; padding: 4px 12px; border-radius: 4px; font-weight: 600;">Bezahlt</span></td>
                  </tr>
                </table>
                
                <div style="border-top: 2px solid #E0E0E0; margin: 20px 0;"></div>
                
                <h3 style="margin: 0 0 15px 0; color: #333; font-size: 16px; font-weight: 600;">Positionen</h3>
                
${localizedProductItems.map(item => {
  const unitPrice = formatCurrency(item.price_cents);
  const lineTotal = formatCurrency(item.line_total_cents || (item.price_cents * item.quantity));
  return `                <div style="padding: 12px 0; border-bottom: 1px solid #EEEEEE;">
                  <table style="width: 100%;">
                    <tr>
                      <td style="font-size: 14px; color: #333; padding-right: 10px; white-space: nowrap;">${item.quantity} ×</td>
                      <td style="font-size: 14px; color: #333; width: 100%;">${item.name}</td>
                      <td style="font-size: 14px; color: #666; text-align: right; white-space: nowrap; padding: 0 8px;">${unitPrice}</td>
                      <td style="font-size: 14px; color: #333; text-align: right; font-weight: 600; white-space: nowrap;">${lineTotal}</td>
                    </tr>
                  </table>
                </div>
`;
}).join('')}
                
                ${shippingCents > 0 ? `<div style="padding: 12px 0;">
                  <table style="width: 100%;">
                    <tr>
                      <td style="font-size: 14px; color: #666;">Versand (DE)</td>
                      <td style="font-size: 14px; color: #333; text-align: right; font-weight: 600;">${formatCurrency(shippingCents)}</td>
                    </tr>
                  </table>
                </div>` : ''}
                
                <div style="border-top: 2px solid #2F6F55; margin: 20px 0 15px 0; padding-top: 15px;">
                  <table style="width: 100%;">
                    ${!hasShippingLine ? `<tr>
                      <td style="font-size: 14px; color: #666; padding: 5px 0;">Zwischensumme:</td>
                      <td style="font-size: 14px; color: #333; text-align: right; font-weight: 600;">${formatCurrency(subtotalCents)}</td>
                    </tr>
                    <tr>
                      <td style="font-size: 14px; color: #666; padding: 5px 0;">Versand:</td>
                      <td style="font-size: 14px; color: #333; text-align: right; font-weight: 600;">${formatCurrency(shippingCents)}</td>
                    </tr>` : ''}
                    <tr>
                      <td style="font-size: 18px; color: #2F6F55; padding: 10px 0 0 0; font-weight: 700;">Gesamtbetrag:</td>
                      <td style="font-size: 20px; color: #2F6F55; text-align: right; font-weight: 700; padding: 10px 0 0 0;">${formatCurrency(orderTotalCents)}</td>
                    </tr>
                  </table>
                </div>
              </div>
              
              <!-- Shipping Address -->
              ${shippingAddress ? `
              <div style="background-color: #F0F8FF; border-left: 4px solid #2F6F55; border-radius: 4px; padding: 20px; margin: 30px 0;">
                <h3 style="margin: 0 0 10px 0; color: #2F6F55; font-size: 16px; font-weight: 600;">📍 Lieferadresse</h3>
                <p style="margin: 3px 0; font-size: 14px; color: #333;"><strong>${shippingAddress.name || customerName || ''}</strong></p>
                <p style="margin: 3px 0; font-size: 14px; color: #666;">${shippingAddress.line1 || ''}</p>
                ${shippingAddress.line2 ? `<p style="margin: 3px 0; font-size: 14px; color: #666;">${shippingAddress.line2}</p>` : ''}
                <p style="margin: 3px 0; font-size: 14px; color: #666;">${shippingAddress.postal_code || ''} ${shippingAddress.city || ''}</p>
                ${shippingAddress.state ? `<p style="margin: 3px 0; font-size: 14px; color: #666;">${shippingAddress.state}</p>` : ''}
                <p style="margin: 3px 0; font-size: 14px; color: #333; font-weight: 600;">${shippingAddress.country || ''}</p>
              </div>
              ` : ''}
              
              <!-- Billing Address -->
              ${billingAddress ? `
              <div style="background-color: #F5F5F5; border-left: 4px solid #757575; border-radius: 4px; padding: 20px; margin: 30px 0;">
                <h3 style="margin: 0 0 10px 0; color: #333; font-size: 16px; font-weight: 600;">💳 Rechnungsadresse</h3>
                <p style="margin: 3px 0; font-size: 14px; color: #333;"><strong>${billingAddress.name || customerName || ''}</strong></p>
                <p style="margin: 3px 0; font-size: 14px; color: #666;">${billingAddress.line1 || ''}</p>
                ${billingAddress.line2 ? `<p style="margin: 3px 0; font-size: 14px; color: #666;">${billingAddress.line2}</p>` : ''}
                <p style="margin: 3px 0; font-size: 14px; color: #666;">${billingAddress.postal_code || ''} ${billingAddress.city || ''}</p>
                ${billingAddress.state ? `<p style="margin: 3px 0; font-size: 14px; color: #666;">${billingAddress.state}</p>` : ''}
                <p style="margin: 3px 0; font-size: 14px; color: #333; font-weight: 600;">${billingAddress.country || ''}</p>
              </div>
              ` : ''}
              
              <!-- Shipping Info -->
              <div style="background-color: #FFF9E6; border-left: 4px solid #FFC107; border-radius: 4px; padding: 20px; margin: 30px 0;">
                <h3 style="margin: 0 0 10px 0; color: #856404; font-size: 16px; font-weight: 600;">📦 Versand & Service</h3>
                <p style="margin: 0; font-size: 14px; color: #856404; line-height: 1.6;">
                  Sobald Ihre Bestellung versendet wurde, erhalten Sie eine separate Versandbestätigung per E-Mail.
                </p>
              </div>
              
              <p style="margin: 30px 0 10px 0; font-size: 15px; color: #666; line-height: 1.6;">
                Bei Fragen erreichen Sie uns jederzeit unter<br>
                👉 <a href="mailto:support@unbreak-one.com" style="color: #2F6F55; text-decoration: none; font-weight: 600;">support@unbreak-one.com</a>
              </p>
              
              <p style="margin: 30px 0 0 0; font-size: 15px; color: #333; line-height: 1.6;">
                Herzliche Grüße<br>
                <strong>Ihr UNBREAK ONE Team</strong>
              </p>
              
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="padding: 30px 40px; background-color: #F7F7F7; border-top: 1px solid #E0E0E0; border-radius: 0 0 12px 12px;">
              <div style="text-align: center;">
                <p style="margin: 0 0 15px 0; font-size: 16px; color: #2F6F55; font-weight: 600;">UNBREAK ONE</p>
                <p style="margin: 0 0 5px 0; font-size: 13px; color: #999;">Premium Modular Holders</p>
                <p style="margin: 0 0 15px 0; font-size: 13px; color: #999;">
                  🌐 <a href="https://unbreak-one.com" style="color: #2F6F55; text-decoration: none;">unbreak-one.com</a><br>
                  📧 <a href="mailto:support@unbreak-one.com" style="color: #2F6F55; text-decoration: none;">support@unbreak-one.com</a>
                </p>
                <p style="margin: 20px 0 10px 0; font-size: 12px; color: #999;">
                  <a href="https://unbreak-one.com/impressum" style="color: #666; text-decoration: none; margin: 0 8px;">Impressum</a> •
                  <a href="https://unbreak-one.com/datenschutz" style="color: #666; text-decoration: none; margin: 0 8px;">Datenschutz</a> •
                  <a href="https://unbreak-one.com/agb" style="color: #666; text-decoration: none; margin: 0 8px;">AGB</a>
                </p>
                <p style="margin: 15px 0 0 0; font-size: 11px; color: #AAA; font-style: italic;">
                  Diese E-Mail wurde automatisch generiert.<br>Bitte antworten Sie nicht direkt auf diese Nachricht.
                </p>
              </div>
            </td>
          </tr>
          
        </table>
        
      </td>
    </tr>
  </table>
</body>
</html>
  ` : `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; background-color: #F7F7F7; font-family: Arial, Helvetica, sans-serif;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        
        <!-- Main Container -->
        <table role="presentation" style="max-width: 600px; width: 100%; background-color: #FFFFFF; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.08);">
          
          <!-- Header -->
          <tr>
            <td style="padding: 40px 40px 20px 40px; text-align: center; background-color: #2F6F55; border-radius: 12px 12px 0 0;">
              <h1 style="margin: 0; color: #FFFFFF; font-size: 28px; font-weight: 600; letter-spacing: 1px;">UNBREAK ONE</h1>
              <p style="margin: 10px 0 0 0; color: rgba(255,255,255,0.9); font-size: 16px;">Thank you for your order!</p>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 40px;">
              
              <p style="margin: 0 0 20px 0; font-size: 16px; color: #333333; line-height: 1.6;">${greetingEN}</p>
              
              <p style="margin: 0 0 30px 0; font-size: 15px; color: #666666; line-height: 1.6;">
                Thank you for your order at UNBREAK ONE.<br>
                We have successfully received your payment and are now preparing your order for shipment.
              </p>
              
              <!-- Order Details Box -->
              <div style="background-color: #F9F9F9; border-radius: 8px; padding: 25px; margin: 30px 0;">
                <h2 style="margin: 0 0 20px 0; color: #2F6F55; font-size: 20px; font-weight: 600;">🧾 Order Summary</h2>
                
                <table style="width: 100%; margin: 0 0 20px 0;">
                  <tr>
                    <td style="padding: 8px 0; font-size: 14px; color: #666;">Order number:</td>
                    <td style="padding: 8px 0; font-size: 14px; color: #333; font-weight: 600; text-align: right;">${orderNumber || orderId.substring(0, 8)}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; font-size: 14px; color: #666;">Order date:</td>
                    <td style="padding: 8px 0; font-size: 14px; color: #333; text-align: right;">${new Date().toLocaleDateString('en-US')}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; font-size: 14px; color: #666;">Payment status:</td>
                    <td style="padding: 8px 0; font-size: 14px; text-align: right;"><span style="background-color: #D4EDDA; color: #155724; padding: 4px 12px; border-radius: 4px; font-weight: 600;">Paid</span></td>
                  </tr>
                </table>
                
                <div style="border-top: 2px solid #E0E0E0; margin: 20px 0;"></div>
                
                <h3 style="margin: 0 0 15px 0; color: #333; font-size: 16px; font-weight: 600;">Items</h3>
                
${localizedProductItems.map(item => `                <div style="padding: 12px 0; border-bottom: 1px solid #EEEEEE;">
                  <table style="width: 100%;">
                    <tr>
                      <td style="font-size: 14px; color: #333; padding-right: 10px;">${item.quantity} ×</td>
                      <td style="font-size: 14px; color: #333; width: 70%;">${item.name}</td>
                      <td style="font-size: 14px; color: #333; text-align: right; font-weight: 600;">${formatCurrency(item.line_total_cents || (item.price_cents * item.quantity))}</td>
                    </tr>
                  </table>
                </div>
`).join('')}
                
                ${shippingCents > 0 ? `<div style="padding: 12px 0;">
                  <table style="width: 100%;">
                    <tr>
                      <td style="font-size: 14px; color: #666;">Shipping (Standard)</td>
                      <td style="font-size: 14px; color: #333; text-align: right; font-weight: 600;">${formatCurrency(shippingCents)}</td>
                    </tr>
                  </table>
                </div>` : ''}
                
                <div style="border-top: 2px solid #2F6F55; margin: 20px 0 15px 0; padding-top: 15px;">
                  <table style="width: 100%;">
                    ${!hasShippingLine ? `<tr>
                      <td style="font-size: 14px; color: #666; padding: 5px 0;">Subtotal:</td>
                      <td style="font-size: 14px; color: #333; text-align: right; font-weight: 600;">${formatCurrency(subtotalCents)}</td>
                    </tr>
                    <tr>
                      <td style="font-size: 14px; color: #666; padding: 5px 0;">Shipping:</td>
                      <td style="font-size: 14px; color: #333; text-align: right; font-weight: 600;">${formatCurrency(shippingCents)}</td>
                    </tr>` : ''}
                    <tr>
                      <td style="font-size: 18px; color: #2F6F55; padding: 10px 0 0 0; font-weight: 700;">Total:</td>
                      <td style="font-size: 20px; color: #2F6F55; text-align: right; font-weight: 700; padding: 10px 0 0 0;">${formatCurrency(orderTotalCents)}</td>
                    </tr>
                  </table>
                </div>
              </div>
              
              <!-- Shipping Address -->
              ${shippingAddress ? `
              <div style="background-color: #F0F8FF; border-left: 4px solid #2F6F55; border-radius: 4px; padding: 20px; margin: 30px 0;">
                <h3 style="margin: 0 0 10px 0; color: #2F6F55; font-size: 16px; font-weight: 600;">📍 Shipping Address</h3>
                <p style="margin: 3px 0; font-size: 14px; color: #333;"><strong>${shippingAddress.name || customerName || ''}</strong></p>
                <p style="margin: 3px 0; font-size: 14px; color: #666;">${shippingAddress.line1 || ''}</p>
                ${shippingAddress.line2 ? `<p style="margin: 3px 0; font-size: 14px; color: #666;">${shippingAddress.line2}</p>` : ''}
                <p style="margin: 3px 0; font-size: 14px; color: #666;">${shippingAddress.postal_code || ''} ${shippingAddress.city || ''}</p>
                ${shippingAddress.state ? `<p style="margin: 3px 0; font-size: 14px; color: #666;">${shippingAddress.state}</p>` : ''}
                <p style="margin: 3px 0; font-size: 14px; color: #333; font-weight: 600;">${shippingAddress.country || ''}</p>
              </div>
              ` : ''}
              
              <!-- Shipping Info -->
              <div style="background-color: #FFF9E6; border-left: 4px solid #FFC107; border-radius: 4px; padding: 20px; margin: 30px 0;">
                <h3 style="margin: 0 0 10px 0; color: #856404; font-size: 16px; font-weight: 600;">📦 Shipping & Service</h3>
                <p style="margin: 0; font-size: 14px; color: #856404; line-height: 1.6;">
                  You will receive a separate shipping confirmation email once your order has been dispatched.
                </p>
              </div>
              
              <p style="margin: 30px 0 10px 0; font-size: 15px; color: #666; line-height: 1.6;">
                If you have any questions, feel free to contact us at<br>
                👉 <a href="mailto:support@unbreak-one.com" style="color: #2F6F55; text-decoration: none; font-weight: 600;">support@unbreak-one.com</a>
              </p>
              
              <p style="margin: 30px 0 0 0; font-size: 15px; color: #333; line-height: 1.6;">
                Kind regards,<br>
                <strong>Your UNBREAK ONE Team</strong>
              </p>
              
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="padding: 30px 40px; background-color: #F7F7F7; border-top: 1px solid #E0E0E0; border-radius: 0 0 12px 12px;">
              <div style="text-align: center;">
                <p style="margin: 0 0 15px 0; font-size: 16px; color: #2F6F55; font-weight: 600;">UNBREAK ONE</p>
                <p style="margin: 0 0 5px 0; font-size: 13px; color: #999;">Premium Modular Holders</p>
                <p style="margin: 0 0 15px 0; font-size: 13px; color: #999;">
                  🌐 <a href="https://unbreak-one.com" style="color: #2F6F55; text-decoration: none;">unbreak-one.com</a><br>
                  📧 <a href="mailto:support@unbreak-one.com" style="color: #2F6F55; text-decoration: none;">support@unbreak-one.com</a>
                </p>
                <p style="margin: 20px 0 10px 0; font-size: 12px; color: #999;">
                  <a href="https://unbreak-one.com/impressum" style="color: #666; text-decoration: none; margin: 0 8px;">Legal Notice</a> •
                  <a href="https://unbreak-one.com/datenschutz" style="color: #666; text-decoration: none; margin: 0 8px;">Privacy</a> •
                  <a href="https://unbreak-one.com/agb" style="color: #666; text-decoration: none; margin: 0 8px;">Terms</a>
                </p>
                <p style="margin: 15px 0 0 0; font-size: 11px; color: #AAA; font-style: italic;">
                  This email was generated automatically.<br>Please do not reply directly to this message.
                </p>
              </div>
            </td>
          </tr>
          
        </table>
        
      </td>
    </tr>
  </table>
</body>
</html>
  `;

  // Send customer email
  const customerResult = await sendEmail({
    type: 'order-confirmation',
    to: customerEmail,
    subject,
    html,
    from: 'UNBREAK ONE <no-reply@unbreak-one.com>',
    replyTo: 'support@unbreak-one.com', // ← Wichtig für Kundenantworten
    bcc, // BCC admin if provided
    meta: {
      orderId,
      orderNumber,
      totalAmount,
      language,
    },
  });

  // Send internal order notification to orders@unbreak-one.com
  try {
    const internalSubject = `${testPrefix}Neue Bestellung ${orderNumber || orderId.substring(0, 8)}`;
    const internalHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
</head>
<body style="margin: 0; padding: 20px; background-color: #F7F7F7; font-family: 'Courier New', monospace;">
  <div style="max-width: 600px; margin: 0 auto; background-color: #FFFFFF; border: 2px solid #2F6F55; border-radius: 8px; padding: 30px;">
    
    <h1 style="margin: 0 0 20px 0; font-size: 20px; color: #2F6F55; border-bottom: 2px solid #2F6F55; padding-bottom: 10px;">
      📦 Neue Bestellung eingegangen
    </h1>
    
    <table style="width: 100%; margin: 20px 0; font-size: 14px;">
      <tr>
        <td style="padding: 8px 0; color: #666; width: 140px;"><strong>Bestellnummer:</strong></td>
        <td style="padding: 8px 0; color: #333; font-weight: 600;">${orderNumber || orderId.substring(0, 8)}</td>
      </tr>
      <tr>
        <td style="padding: 8px 0; color: #666;"><strong>Datum:</strong></td>
        <td style="padding: 8px 0; color: #333;">${orderDate ? orderDate.toLocaleString('de-DE') : new Date().toLocaleString('de-DE')}</td>
      </tr>
      <tr>
        <td style="padding: 8px 0; color: #666;"><strong>Zahlungsstatus:</strong></td>
        <td style="padding: 8px 0;"><span style="background-color: #D4EDDA; color: #155724; padding: 4px 10px; border-radius: 4px; font-weight: 600; font-size: 12px;">${paymentStatus ? paymentStatus.toUpperCase() : 'BEZAHLT'}</span></td>
      </tr>
      ${paymentIntentId ? `
      <tr>
        <td style="padding: 8px 0; color: #666;"><strong>Payment Intent:</strong></td>
        <td style="padding: 8px 0; color: #888; font-size: 12px; font-family: monospace;">${paymentIntentId}</td>
      </tr>
      ` : ''}
      <tr>
        <td style="padding: 8px 0; color: #666;"><strong>Stripe Session:</strong></td>
        <td style="padding: 8px 0; color: #888; font-size: 12px; font-family: monospace;">${orderId.substring(0, 16)}...</td>
      </tr>
    </table>
    
    <div style="margin: 30px 0;">
      <h2 style="margin: 0 0 10px 0; font-size: 16px; color: #2F6F55;">👤 Kunde</h2>
      <p style="margin: 5px 0; font-size: 14px; color: #333;"><strong>${customerName || '—'}</strong></p>
      <p style="margin: 5px 0; font-size: 14px; color: #666;">${customerEmail}</p>
      ${customerPhone ? `<p style="margin: 5px 0; font-size: 14px; color: #666;">📞 ${customerPhone}</p>` : ''}
    </div>
    
    ${shippingAddress ? `
    <div style="margin: 30px 0;">
      <h2 style="margin: 0 0 10px 0; font-size: 16px; color: #2F6F55;">📍 Lieferadresse</h2>
      <p style="margin: 3px 0; font-size: 13px; color: #333;">${shippingAddress.name || customerName || ''}</p>
      <p style="margin: 3px 0; font-size: 13px; color: #333;">${shippingAddress.line1 || ''}</p>
      ${shippingAddress.line2 ? `<p style="margin: 3px 0; font-size: 13px; color: #333;">${shippingAddress.line2}</p>` : ''}
      <p style="margin: 3px 0; font-size: 13px; color: #333;">${shippingAddress.postal_code || ''} ${shippingAddress.city || ''}</p>
      <p style="margin: 3px 0; font-size: 13px; color: #333; font-weight: 600;">${shippingAddress.country || ''}</p>
    </div>
    ` : '<div style="margin: 30px 0;"><p style="color: #999;">(Lieferadresse fehlt)</p></div>'}
    
    ${billingAddress && billingAddress.line1 ? `
    <div style="margin: 30px 0;">
      <h2 style="margin: 0 0 10px 0; font-size: 16px; color: #2F6F55;">🏢 Rechnungsadresse</h2>
      <p style="margin: 3px 0; font-size: 13px; color: #333;">${customerName || ''}</p>
      <p style="margin: 3px 0; font-size: 13px; color: #333;">${billingAddress.line1 || ''}</p>
      ${billingAddress.line2 ? `<p style="margin: 3px 0; font-size: 13px; color: #333;">${billingAddress.line2}</p>` : ''}
      <p style="margin: 3px 0; font-size: 13px; color: #333;">${billingAddress.postal_code || ''} ${billingAddress.city || ''}</p>
      <p style="margin: 3px 0; font-size: 13px; color: #333; font-weight: 600;">${billingAddress.country || ''}</p>
    </div>
    ` : ''}
    
    <div style="margin: 30px 0;">
      <h2 style="margin: 0 0 10px 0; font-size: 16px; color: #2F6F55;">🛒 Positionen</h2>
      <div style="background-color: #F9F9F9; padding: 15px; border-radius: 6px; border-left: 4px solid #2F6F55;">
${localizedProductItems.map(item => {
  const unitPrice = formatCurrency(item.price_cents);
  const lineTotal = formatCurrency(item.line_total_cents || (item.price_cents * item.quantity));
  return `        <div style="padding: 8px 0; border-bottom: 1px solid #E0E0E0;">
          <table style="width: 100%;">
            <tr>
              <td style="color: #666; font-size: 13px; white-space: nowrap;">${item.quantity} ×</td>
              <td style="color: #333; font-size: 13px; padding-left: 10px;">${item.name}</td>
              <td style="color: #666; font-size: 13px; text-align: right; white-space: nowrap; padding: 0 8px;">${unitPrice}</td>
              <td style="color: #333; font-size: 13px; text-align: right; font-weight: 600; white-space: nowrap;">${lineTotal}</td>
            </tr>
          </table>
        </div>
`;
}).join('')}
      </div>
    </div>
    
    <div style="background-color: #F0F8F0; border-radius: 6px; padding: 20px; margin: 30px 0;">
      <table style="width: 100%; font-size: 14px;">
        <tr>
          <td style="padding: 5px 0; color: #666;">Zwischensumme:</td>
          <td style="padding: 5px 0; color: #333; text-align: right; font-weight: 600;">${formatCurrency(subtotalCents)}</td>
        </tr>
        <tr>
          <td style="padding: 5px 0; color: #666;">Versand:</td>
          <td style="padding: 5px 0; color: #333; text-align: right; font-weight: 600;">${formatCurrency(shippingCents)}</td>
        </tr>
        <tr style="border-top: 2px solid #2F6F55;">
          <td style="padding: 15px 0 5px 0; color: #2F6F55; font-weight: 700; font-size: 16px;">GESAMT:</td>
          <td style="padding: 15px 0 5px 0; color: #2F6F55; text-align: right; font-weight: 700; font-size: 18px;">${formatCurrency(orderTotalCents)}</td>
        </tr>
      </table>
    </div>
    
    <div style="margin: 30px 0 0 0; padding-top: 20px; border-top: 1px solid #E0E0E0;">
      <p style="margin: 5px 0; font-size: 11px; color: #999;">Order ID: ${orderId}</p>
    </div>
    
  </div>
</body>
</html>
    `;

    await sendEmail({
      type: 'system-notification',
      to: 'orders@unbreak-one.com',
      subject: internalSubject,
      html: internalHtml,
      from: 'UNBREAK ONE Shop <orders@unbreak-one.com>',
      replyTo: 'support@unbreak-one.com',
      meta: {
        orderId,
        orderNumber,
        type: 'internal-order-notification',
      },
    });

    console.log('✅ [EMAIL] Internal order notification sent to orders@unbreak-one.com');
  } catch (internalError) {
    console.error('⚠️ [EMAIL] Failed to send internal notification:', internalError.message);
    // Don't fail customer email if internal fails
  }

  return customerResult;
}
