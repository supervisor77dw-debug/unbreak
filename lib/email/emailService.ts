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
  // 3. KILL-SWITCH CHECK
  // ========================================
  
  const emailsEnabled = process.env.EMAILS_ENABLED === 'true';

  if (!emailsEnabled) {
    // PREVIEW MODE - Log instead of sending
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📧 [EMAIL PREVIEW] Email sending is DISABLED');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`📧 [EMAIL PREVIEW] Type:      ${type}`);
    console.log(`📧 [EMAIL PREVIEW] To:        ${Array.isArray(to) ? to.join(', ') : to}`);
    console.log(`📧 [EMAIL PREVIEW] From:      ${finalFrom}`);
    if (finalReplyTo) {
      console.log(`📧 [EMAIL PREVIEW] Reply-To:  ${finalReplyTo}`);
    }
    console.log(`📧 [EMAIL PREVIEW] Subject:   ${subject}`);
    console.log(`📧 [EMAIL PREVIEW] Preview:   ${getTextPreview(html, 150)}`);
    
    if (Object.keys(meta).length > 0) {
      console.log(`📧 [EMAIL PREVIEW] Meta:      ${JSON.stringify(meta, null, 2)}`);
    }
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('ℹ️  [EMAIL PREVIEW] To enable sending: Set EMAILS_ENABLED=true');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    return {
      preview: true,
    };
  }

  // ========================================
  // 4. SEND VIA RESEND (only if enabled)
  // ========================================
  
  try {
    console.log(`📧 [EMAIL SEND] Sending ${type} to ${Array.isArray(to) ? to.join(', ') : to}`);
    if (bcc) {
      console.log(`📧 [EMAIL SEND] BCC: ${Array.isArray(bcc) ? bcc.join(', ') : bcc}`);
    }

    // Check for API key
    if (!process.env.RESEND_API_KEY) {
      throw new Error('[EMAIL] RESEND_API_KEY not configured');
    }

    // Initialize Resend (only when actually sending)
    const resend = new Resend(process.env.RESEND_API_KEY);

    // Prepare BCC recipients
    const bccRecipients = bcc ? (Array.isArray(bcc) ? bcc : [bcc]) : undefined;

    console.log('[RESEND CALL] Sending email...');
    console.log('[RESEND CALL] To:', recipients);
    console.log('[RESEND CALL] BCC:', bccRecipients);
    console.log('[RESEND CALL] Subject:', subject);

    // Send email
    const result = await resend.emails.send({
      from: finalFrom,
      to: recipients,
      subject,
      html,
      text: finalText,
      ...(finalReplyTo && { replyTo: finalReplyTo }),
      ...(bccRecipients && { bcc: bccRecipients }),
    });

    console.log('[RESEND RESULT]', result);

    // Check for error response
    if (result.error) {
      console.error(`❌ [EMAIL SEND] Resend API error:`, result.error);
      console.error('[RESEND ERROR]', result.error);
      return {
        sent: false,
        error: result.error.message || 'Unknown Resend API error',
      };
    }

    console.log(`✅ [EMAIL SEND] Success - ID: ${result.data?.id}`);

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
  items: Array<{ name: string; quantity: number; price_cents: number; line_total_cents?: number }>;
  totalAmount: number;
  language?: 'de' | 'en';
  shippingAddress?: any;
  bcc?: string | string[]; // ← NEW: BCC support for admin@unbreak-one.com
}) {
  const {
    orderId,
    orderNumber,
    customerEmail,
    customerName,
    items,
    totalAmount,
    language = 'de',
    shippingAddress,
    bcc // ← NEW
  } = params;

  const isGerman = language === 'de';

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
  
  // GUARDRAIL: Detect if shipping is in line items
  const hasShippingLine = !!shippingItem;
  
  const subtotalCents = productItems.reduce((sum, item) => sum + ((item.line_total_cents || (item.price_cents * item.quantity)) || 0), 0);
  const shippingCents = shippingItem ? (shippingItem.line_total_cents || shippingItem.price_cents) : 0;
  const orderTotalCents = totalAmount; // This is the authoritative total from Stripe

  // DEBUG LOGGING (temporary - remove after verification)
  console.log('[EMAIL PRICING DEBUG]', {
    productItems_count: productItems.length,
    hasShippingLine,
    products_sum_cents: productItems.reduce((sum, item) => sum + ((item.line_total_cents || (item.price_cents * item.quantity)) || 0), 0),
    shipping_cents: shippingCents,
    subtotal_cents: subtotalCents,
    total_cents: orderTotalCents,
    items_total_check: items.reduce((sum, item) => sum + (item.line_total_cents || 0), 0),
    // GUARDRAIL CHECK: Total should equal subtotal + shipping
    expected_total: subtotalCents + shippingCents,
    total_matches: orderTotalCents === (subtotalCents + shippingCents),
  });

  // Format items for email (products only, no shipping in list)
  const itemsText = productItems.map(item => {
    const qty = item.quantity;
    const name = item.name;
    const lineTotal = formatCurrency(item.line_total_cents || (item.price_cents * item.quantity));
    return `– ${qty} × ${name} – ${lineTotal}`;
  }).join('\n');

  // EXACT TEXTS AS PROVIDED - DO NOT MODIFY
  
  const subject = isGerman
    ? `Bestellbestätigung ${orderNumber || orderId.substring(0, 8)} – UNBREAK ONE`
    : `Order confirmation ${orderNumber || orderId.substring(0, 8)} – UNBREAK ONE`;

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
                
${productItems.map(item => `                <div style="padding: 12px 0; border-bottom: 1px solid #EEEEEE;">
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
                
${productItems.map(item => `                <div style="padding: 12px 0; border-bottom: 1px solid #EEEEEE;">
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
    const internalSubject = `Neue Bestellung ${orderNumber || orderId.substring(0, 8)}`;
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
        <td style="padding: 8px 0; color: #333;">${new Date().toLocaleString('de-DE')}</td>
      </tr>
      <tr>
        <td style="padding: 8px 0; color: #666;"><strong>Zahlungsstatus:</strong></td>
        <td style="padding: 8px 0;"><span style="background-color: #D4EDDA; color: #155724; padding: 4px 10px; border-radius: 4px; font-weight: 600; font-size: 12px;">BEZAHLT</span></td>
      </tr>
    </table>
    
    <div style="margin: 30px 0;">
      <h2 style="margin: 0 0 10px 0; font-size: 16px; color: #2F6F55;">👤 Kunde</h2>
      <p style="margin: 5px 0; font-size: 14px; color: #333;"><strong>${customerName || '—'}</strong></p>
      <p style="margin: 5px 0; font-size: 14px; color: #666;">${customerEmail}</p>
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
    ` : ''}
    
    <div style="margin: 30px 0;">
      <h2 style="margin: 0 0 10px 0; font-size: 16px; color: #2F6F55;">🛒 Positionen</h2>
      <div style="background-color: #F9F9F9; padding: 15px; border-radius: 6px; border-left: 4px solid #2F6F55;">
${productItems.map(item => `        <div style="padding: 8px 0; border-bottom: 1px solid #E0E0E0;">
          <span style="color: #666; font-size: 13px;">${item.quantity} ×</span>
          <span style="color: #333; font-size: 13px; margin-left: 10px;">${item.name}</span>
          <span style="color: #333; font-size: 13px; float: right; font-weight: 600;">${formatCurrency(item.line_total_cents || (item.price_cents * item.quantity))}</span>
        </div>
`).join('')}
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
