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
  const formatCurrency = (cents: number, locale: string = 'de-DE'): string => {
    if (cents === null || cents === undefined || isNaN(cents)) {
      return '—';
    }
    const formatter = new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: 'EUR',
    });
    return formatter.format(cents / 100);
  };

  const currencyLocale = isGerman ? 'de-DE' : 'en-US';

  // Build email HTML - Professional template
  const itemsHtml = items.map(item => {
    const unitPrice = formatCurrency(item.price_cents, currencyLocale);
    const lineTotal = formatCurrency(item.line_total_cents || (item.price_cents * item.quantity), currencyLocale);
    
    return `
    <tr>
      <td style="padding: 12px; border-bottom: 1px solid #eee;">${item.name}</td>
      <td style="padding: 12px; border-bottom: 1px solid #eee; text-align: center;">${item.quantity}</td>
      <td style="padding: 12px; border-bottom: 1px solid #eee; text-align: right;">${unitPrice}</td>
      <td style="padding: 12px; border-bottom: 1px solid #eee; text-align: right;">${lineTotal}</td>
    </tr>`;
  }).join('');

  const greeting = isGerman 
    ? `Hallo${customerName ? ' ' + customerName : ''},`
    : `Hello${customerName ? ' ' + customerName : ''},`;

  const thankYou = isGerman
    ? 'Vielen Dank für Ihre Bestellung!'
    : 'Thank you for your order!';

  const subject = isGerman
    ? `Bestellbestätigung ${orderNumber || orderId.substring(0, 8)} – UNBREAK ONE`
    : `Order confirmation ${orderNumber || orderId.substring(0, 8)} – UNBREAK ONE`;

  const confirmationText = isGerman
    ? 'Wir haben Ihre Bestellung erhalten und bestätigen den erfolgreichen Zahlungseingang.'
    : 'We have received your order and confirm that payment was successful.';

  const shippingNote = isGerman
    ? 'Sie erhalten eine separate E-Mail, sobald Ihre Bestellung versendet wurde.'
    : 'You will receive a separate email once your order has been shipped.';

  const paymentStatus = isGerman ? 'Bezahlt' : 'Paid';
  const contactText = isGerman
    ? 'Bei Fragen kontaktieren Sie uns gerne unter'
    : 'If you have any questions, please contact us at';

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: #f5f5f5;">
  <div style="background: white; padding: 40px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
    <div style="text-align: center; margin-bottom: 30px;">
      <h1 style="color: #0a4d4d; font-size: 28px; margin: 0 0 10px 0; font-weight: 600;">UNBREAK ONE</h1>
      <p style="color: #666; font-size: 14px; margin: 0;">${thankYou}</p>
    </div>
    
    <div style="background: #f9f9f9; padding: 20px; border-radius: 6px; margin-bottom: 30px;">
      <p style="margin: 0 0 8px 0; font-size: 14px; color: #666;">${isGerman ? 'Bestellnummer' : 'Order number'}</p>
      <p style="margin: 0; font-size: 20px; font-weight: 600; color: #0a4d4d;">${orderNumber || orderId.substring(0, 8)}</p>
    </div>
    
    <p style="font-size: 16px; line-height: 24px; color: #333;">${greeting}</p>
    <p style="font-size: 14px; line-height: 22px; color: #666; margin-bottom: 30px;">${confirmationText}</p>
    
    <h2 style="color: #0a4d4d; font-size: 18px; margin: 30px 0 15px 0; font-weight: 600;">${isGerman ? 'Bestellübersicht' : 'Order Summary'}</h2>
    <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
      <thead>
        <tr style="background: #f5f5f5; border-bottom: 2px solid #0a4d4d;">
          <th style="padding: 12px; text-align: left; font-size: 13px; font-weight: 600; color: #666;">${isGerman ? 'Produkt' : 'Product'}</th>
          <th style="padding: 12px; text-align: center; font-size: 13px; font-weight: 600; color: #666;">${isGerman ? 'Menge' : 'Qty'}</th>
          <th style="padding: 12px; text-align: right; font-size: 13px; font-weight: 600; color: #666;">${isGerman ? 'Einzelpreis' : 'Unit Price'}</th>
          <th style="padding: 12px; text-align: right; font-size: 13px; font-weight: 600; color: #666;">${isGerman ? 'Summe' : 'Total'}</th>
        </tr>
      </thead>
      <tbody>${itemsHtml}</tbody>
      <tfoot>
        <tr style="border-top: 2px solid #0a4d4d;">
          <td colspan="3" style="padding: 15px; text-align: right; font-weight: 600; font-size: 16px; color: #333;">${isGerman ? 'Gesamtbetrag:' : 'Total Amount:'}</td>
          <td style="padding: 15px; text-align: right; font-weight: 700; color: #0a4d4d; font-size: 20px;">${formatCurrency(totalAmount, currencyLocale)}</td>
        </tr>
        <tr>
          <td colspan="3" style="padding: 8px 15px; text-align: right; font-size: 14px; color: #666;">${isGerman ? 'Zahlungsstatus:' : 'Payment Status:'}</td>
          <td style="padding: 8px 15px; text-align: right; font-size: 14px; color: #28a745; font-weight: 600;">✓ ${paymentStatus}</td>
        </tr>
      </tfoot>
    </table>
    
    ${shippingAddress ? `
    <div style="margin-top: 30px; padding: 20px; background: #f9f9f9; border-radius: 6px;">
      <h3 style="color: #0a4d4d; font-size: 16px; margin: 0 0 15px 0; font-weight: 600;">${isGerman ? 'Lieferadresse' : 'Shipping Address'}</h3>
      <p style="margin: 0 0 5px 0; color: #333;">${shippingAddress.name || customerName || ''}</p>
      <p style="margin: 0 0 5px 0; color: #666;">${shippingAddress.line1 || ''}</p>
      ${shippingAddress.line2 ? `<p style="margin: 0 0 5px 0; color: #666;">${shippingAddress.line2}</p>` : ''}
      <p style="margin: 0; color: #666;">${shippingAddress.postal_code || ''} ${shippingAddress.city || ''}</p>
      <p style="margin: 0; color: #666;">${shippingAddress.country || ''}</p>
    </div>
    ` : ''}
    
    <div style="margin-top: 30px; padding: 20px; background: #fff3cd; border-left: 4px solid #ffc107; border-radius: 4px;">
      <p style="margin: 0; font-size: 14px; color: #856404;">
        <strong>${isGerman ? '📦 Versand' : '📦 Shipping'}:</strong> ${shippingNote}
      </p>
    </div>
    
    <div style="margin-top: 40px; padding-top: 30px; border-top: 1px solid #eee; text-align: center;">
      <p style="margin: 0 0 10px 0; color: #666; font-size: 14px;">
        ${contactText} <a href="mailto:support@unbreak-one.com" style="color: #0a4d4d; text-decoration: none; font-weight: 600;">support@unbreak-one.com</a>
      </p>
      <p style="margin: 20px 0 0 0; color: #999; font-size: 12px;">
        © ${new Date().getFullYear()} UNBREAK ONE · <a href="https://www.unbreak-one.com/impressum" style="color: #999; text-decoration: none;">Impressum</a>
      </p>
    </div>
  </div>
</body>
</html>
  `;

  return sendEmail({
    type: 'order-confirmation',
    to: customerEmail,
    subject,
    html,
    bcc, // ← NEW: Pass BCC through
    meta: {
      orderId,
      orderNumber,
      totalAmount,
      language,
    },
  });
}
