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
      return process.env.EMAIL_FROM_ORDERS || process.env.RESEND_FROM || 'orders@unbreak.one';
    
    case 'support-ticket':
      return process.env.EMAIL_FROM_SUPPORT || process.env.RESEND_FROM || 'support@unbreak.one';
    
    case 'account-verification':
    case 'password-reset':
    case 'system-notification':
      return process.env.EMAIL_FROM_NO_REPLY || process.env.RESEND_FROM || 'no-reply@unbreak.one';
    
    case 'test':
      return process.env.RESEND_FROM || 'test@unbreak.one';
    
    default:
      return process.env.RESEND_FROM || 'no-reply@unbreak.one';
  }
}

/**
 * Get default REPLY-TO address based on email type
 */
function getDefaultReplyTo(type: EmailType): string | undefined {
  // Order emails should have replies go to support
  if (['order-confirmation', 'order-shipped', 'payment-received'].includes(type)) {
    return process.env.EMAIL_FROM_SUPPORT || 'support@unbreak.one';
  }
  
  // Support tickets should reply to support
  if (type === 'support-ticket') {
    return process.env.EMAIL_FROM_SUPPORT || 'support@unbreak.one';
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

    // Check for API key
    if (!process.env.RESEND_API_KEY) {
      throw new Error('[EMAIL] RESEND_API_KEY not configured');
    }

    // Initialize Resend (only when actually sending)
    const resend = new Resend(process.env.RESEND_API_KEY);

    // Send email
    const result = await resend.emails.send({
      from: finalFrom,
      to: recipients,
      subject,
      html,
      text: finalText,
      ...(finalReplyTo && { replyTo: finalReplyTo }),
    });

    // Check for error response
    if (result.error) {
      console.error(`❌ [EMAIL SEND] Resend API error:`, result.error);
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
  items: Array<{ name: string; quantity: number; price_cents: number }>;
  totalAmount: number;
  language?: 'de' | 'en';
  shippingAddress?: any;
}) {
  const {
    orderId,
    orderNumber,
    customerEmail,
    customerName,
    items,
    totalAmount,
    language = 'de',
    shippingAddress
  } = params;

  const isGerman = language === 'de';

  // Build email HTML (simplified - move full template to separate file later)
  const itemsHtml = items.map(item => `
    <tr>
      <td style="padding: 12px; border-bottom: 1px solid #eee;">${item.name}</td>
      <td style="padding: 12px; border-bottom: 1px solid #eee; text-align: center;">${item.quantity}</td>
      <td style="padding: 12px; border-bottom: 1px solid #eee; text-align: right;">€${(item.price_cents / 100).toFixed(2)}</td>
    </tr>
  `).join('');

  const greeting = isGerman 
    ? `Hallo${customerName ? ' ' + customerName : ''},`
    : `Hello${customerName ? ' ' + customerName : ''},`;

  const thankYou = isGerman
    ? 'Vielen Dank für Ihre Bestellung!'
    : 'Thank you for your order!';

  const subject = isGerman
    ? `Bestellbestätigung - Bestellung #${orderNumber || orderId.substring(0, 8)}`
    : `Order Confirmation - Order #${orderNumber || orderId.substring(0, 8)}`;

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: #f9f9f9;">
  <div style="background: white; padding: 40px; border-radius: 8px;">
    <h1 style="color: #0a4d4d; text-align: center; margin-bottom: 10px;">UNBREAK ONE</h1>
    <p style="text-align: center; color: #666; margin-bottom: 30px;">${thankYou}</p>
    
    <p style="font-size: 16px;">${greeting}</p>
    <p>${isGerman ? 'Wir haben Ihre Bestellung erhalten und werden sie schnellstmöglich bearbeiten.' : 'We have received your order and will process it as soon as possible.'}</p>
    
    <h2 style="color: #0a4d4d; margin-top: 30px;">${isGerman ? 'Bestellübersicht' : 'Order Summary'}</h2>
    <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
      <thead>
        <tr style="background: #f5f5f5;">
          <th style="padding: 12px; text-align: left;">${isGerman ? 'Produkt' : 'Product'}</th>
          <th style="padding: 12px; text-align: center;">${isGerman ? 'Anzahl' : 'Quantity'}</th>
          <th style="padding: 12px; text-align: right;">${isGerman ? 'Preis' : 'Price'}</th>
        </tr>
      </thead>
      <tbody>${itemsHtml}</tbody>
      <tfoot>
        <tr>
          <td colspan="2" style="padding: 15px; text-align: right; font-weight: bold;">${isGerman ? 'Gesamt:' : 'Total:'}</td>
          <td style="padding: 15px; text-align: right; font-weight: bold; color: #0a4d4d; font-size: 18px;">€${(totalAmount / 100).toFixed(2)}</td>
        </tr>
      </tfoot>
    </table>
    
    ${shippingAddress ? `
    <h3 style="color: #0a4d4d; margin-top: 30px;">${isGerman ? 'Lieferadresse' : 'Shipping Address'}</h3>
    <p style="margin: 5px 0;">${shippingAddress.name || customerName || ''}</p>
    <p style="margin: 5px 0;">${shippingAddress.line1 || ''}</p>
    ${shippingAddress.line2 ? `<p style="margin: 5px 0;">${shippingAddress.line2}</p>` : ''}
    <p style="margin: 5px 0;">${shippingAddress.postal_code || ''} ${shippingAddress.city || ''}</p>
    <p style="margin: 5px 0;">${shippingAddress.country || ''}</p>
    ` : ''}
    
    <p style="margin-top: 40px; color: #666; font-size: 14px;">
      ${isGerman ? 'Bei Fragen kontaktieren Sie uns gerne unter' : 'If you have any questions, please contact us at'} 
      <a href="mailto:support@unbreak.one" style="color: #0a4d4d;">support@unbreak.one</a>
    </p>
  </div>
</body>
</html>
  `;

  return sendEmail({
    type: 'order-confirmation',
    to: customerEmail,
    subject,
    html,
    meta: {
      orderId,
      orderNumber,
      totalAmount,
      language,
    },
  });
}
