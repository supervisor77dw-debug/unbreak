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

  // Calculate totals
  const subtotalCents = items.reduce((sum, item) => sum + ((item.line_total_cents || (item.price_cents * item.quantity)) || 0), 0);
  const shippingCents = 0; // Shipping included in totalAmount
  const orderTotalCents = totalAmount;

  // Format items for email
  const itemsText = items.map(item => {
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
<head><meta charset="UTF-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: #f5f5f5; line-height: 1.6;">
  <div style="background: white; padding: 40px; border-radius: 8px;">
    <h1 style="color: #0a4d4d; font-size: 24px; margin: 0 0 10px 0; text-align: center;">UNBREAK ONE</h1>
    <p style="text-align: center; color: #666; font-size: 14px; margin: 0 0 30px 0;">Vielen Dank für Ihre Bestellung!</p>
    
    <p style="margin: 0 0 15px 0;">${greeting}</p>
    
    <p style="margin: 0 0 30px 0;">vielen Dank für Ihre Bestellung bei UNBREAK ONE.<br>
    Wir haben Ihre Bestellung erfolgreich erhalten und werden diese nun weiter bearbeiten.</p>
    
    <h2 style="color: #0a4d4d; font-size: 18px; margin: 30px 0 15px 0;">Bestellübersicht</h2>
    
    <div style="background: #f9f9f9; padding: 20px; border-radius: 6px; margin: 20px 0; white-space: pre-line; font-family: monospace; font-size: 13px;">
${itemsText}
    </div>
    
    <div style="margin: 20px 0; padding: 15px 0; border-top: 1px solid #eee;">
      <p style="margin: 5px 0;"><strong>Zwischensumme:</strong> ${formatCurrency(subtotalCents)}</p>
      <p style="margin: 5px 0;"><strong>Versand:</strong> ${formatCurrency(shippingCents)}</p>
      <p style="margin: 15px 0 0 0; font-size: 18px;"><strong>Gesamtbetrag:</strong> ${formatCurrency(orderTotalCents)}</p>
    </div>
    
    <div style="background: #d4edda; border-left: 4px solid #28a745; padding: 15px; margin: 20px 0; border-radius: 4px;">
      <p style="margin: 0; color: #155724;"><strong>Zahlungsstatus:</strong> Bezahlt</p>
    </div>
    
    <p style="margin: 30px 0;">Sobald Ihre Bestellung versendet wird, erhalten Sie eine weitere Benachrichtigung.</p>
    
    <p style="margin: 30px 0;">Bei Fragen erreichen Sie uns jederzeit unter<br>
    <a href="mailto:support@unbreak-one.com" style="color: #0a4d4d;">support@unbreak-one.com</a></p>
    
    <p style="margin: 30px 0 10px 0;">Mit freundlichen Grüßen<br>UNBREAK ONE</p>
    
    <p style="margin: 30px 0 0 0; padding-top: 20px; border-top: 1px solid #eee; font-size: 12px; color: #999;">
    Dies ist eine automatisch erstellte E-Mail. Bitte antworten Sie nicht direkt auf diese Nachricht.
    </p>
  </div>
</body>
</html>
  ` : `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: #f5f5f5; line-height: 1.6;">
  <div style="background: white; padding: 40px; border-radius: 8px;">
    <h1 style="color: #0a4d4d; font-size: 24px; margin: 0 0 10px 0; text-align: center;">UNBREAK ONE</h1>
    <p style="text-align: center; color: #666; font-size: 14px; margin: 0 0 30px 0;">Thank you for your order!</p>
    
    <p style="margin: 0 0 15px 0;">${greetingEN}</p>
    
    <p style="margin: 0 0 30px 0;">thank you for your order at UNBREAK ONE.<br>
    We have successfully received your order and will now process it.</p>
    
    <h2 style="color: #0a4d4d; font-size: 18px; margin: 30px 0 15px 0;">Order summary</h2>
    
    <div style="background: #f9f9f9; padding: 20px; border-radius: 6px; margin: 20px 0; white-space: pre-line; font-family: monospace; font-size: 13px;">
${itemsText}
    </div>
    
    <div style="margin: 20px 0; padding: 15px 0; border-top: 1px solid #eee;">
      <p style="margin: 5px 0;"><strong>Subtotal:</strong> ${formatCurrency(subtotalCents)}</p>
      <p style="margin: 5px 0;"><strong>Shipping:</strong> ${formatCurrency(shippingCents)}</p>
      <p style="margin: 15px 0 0 0; font-size: 18px;"><strong>Total:</strong> ${formatCurrency(orderTotalCents)}</p>
    </div>
    
    <div style="background: #d4edda; border-left: 4px solid #28a745; padding: 15px; margin: 20px 0; border-radius: 4px;">
      <p style="margin: 0; color: #155724;"><strong>Payment status:</strong> Paid</p>
    </div>
    
    <p style="margin: 30px 0;">You will receive another notification once your order has been shipped.</p>
    
    <p style="margin: 30px 0;">If you have any questions, please contact us at<br>
    <a href="mailto:support@unbreak-one.com" style="color: #0a4d4d;">support@unbreak-one.com</a></p>
    
    <p style="margin: 30px 0 10px 0;">Kind regards,<br>UNBREAK ONE</p>
    
    <p style="margin: 30px 0 0 0; padding-top: 20px; border-top: 1px solid #eee; font-size: 12px; color: #999;">
    This email was generated automatically. Please do not reply directly.
    </p>
  </div>
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
    replyTo: 'support@unbreak-one.com',
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
    const internalSubject = `Neue Bestellung ${orderNumber || orderId.substring(0, 8)} – UNBREAK ONE`;
    const internalHtml = `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="font-family: monospace; max-width: 600px; margin: 0 auto; padding: 20px; background: #f5f5f5; line-height: 1.6;">
  <div style="background: white; padding: 40px; border-radius: 8px;">
    <h1 style="font-size: 20px; margin: 0 0 20px 0;">Neue Bestellung eingegangen.</h1>
    
    <p style="margin: 5px 0;"><strong>Bestellnummer:</strong> ${orderNumber || orderId.substring(0, 8)}</p>
    <p style="margin: 5px 0;"><strong>Datum:</strong> ${new Date().toLocaleString('de-DE')}</p>
    <p style="margin: 5px 0;"><strong>Zahlungsstatus:</strong> Bezahlt</p>
    
    <h2 style="font-size: 16px; margin: 30px 0 10px 0;">Kunde:</h2>
    <p style="margin: 5px 0;">${customerName || '—'}</p>
    <p style="margin: 5px 0;">${customerEmail}</p>
    
    ${shippingAddress ? `
    <h2 style="font-size: 16px; margin: 30px 0 10px 0;">Lieferadresse:</h2>
    <p style="margin: 5px 0;">${shippingAddress.name || customerName || ''}</p>
    <p style="margin: 5px 0;">${shippingAddress.line1 || ''}</p>
    ${shippingAddress.line2 ? `<p style="margin: 5px 0;">${shippingAddress.line2}</p>` : ''}
    <p style="margin: 5px 0;">${shippingAddress.postal_code || ''} ${shippingAddress.city || ''}</p>
    <p style="margin: 5px 0;">${shippingAddress.country || ''}</p>
    ` : ''}
    
    <h2 style="font-size: 16px; margin: 30px 0 10px 0;">Positionen:</h2>
    <div style="background: #f9f9f9; padding: 15px; border-radius: 4px; white-space: pre-line;">
${itemsText}
    </div>
    
    <div style="margin: 20px 0; padding: 15px; background: #f9f9f9; border-radius: 4px;">
      <p style="margin: 5px 0;"><strong>Zwischensumme:</strong> ${formatCurrency(subtotalCents)}</p>
      <p style="margin: 5px 0;"><strong>Versand:</strong> ${formatCurrency(shippingCents)}</p>
      <p style="margin: 10px 0 0 0; font-size: 16px;"><strong>Gesamt:</strong> ${formatCurrency(orderTotalCents)}</p>
    </div>
    
    <h2 style="font-size: 14px; margin: 30px 0 10px 0; color: #666;">Technische Details:</h2>
    <p style="margin: 5px 0; font-size: 12px; color: #999;">Order ID: ${orderId}</p>
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
