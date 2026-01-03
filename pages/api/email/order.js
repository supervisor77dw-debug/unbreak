/**
 * Order Confirmation Email API (DEPRECATED - Use emailService.ts)
 * POST /api/email/order
 * 
 * NOTE: This endpoint now proxies to the central emailService
 * Direct usage is deprecated - use sendOrderConfirmation() from emailService.ts instead
 */

import { sendOrderConfirmation } from '../../../lib/email/emailService';

// In-memory store for idempotency (prevents duplicate emails)
const sentEmails = new Set();

export default async function handler(req, res) {
  // === DIAGNOSTIC LOGGING ===
  console.log('📧 [EMAIL API] Method:', req.method);
  console.log('📧 [EMAIL API] Using central emailService with kill-switch');

  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { 
      orderId, 
      orderNumber,
      customerEmail, 
      customerName,
      items, 
      totalAmount,
      language = 'de',
      shippingAddress 
    } = req.body;

    // Validation
    if (!orderId) {
      return res.status(400).json({ error: 'Missing orderId' });
    }

    if (!customerEmail) {
      return res.status(400).json({ error: 'Missing customerEmail' });
    }

    if (!items || !Array.isArray(items)) {
      return res.status(400).json({ error: 'Missing or invalid items array' });
    }

    console.log('📧 [EMAIL] Processing order:', orderId);
    console.log('📧 [EMAIL] Customer:', customerEmail);
    console.log('📧 [EMAIL] Language:', language);

    // === IDEMPOTENCY CHECK ===
    const idempotencyKey = `${orderId}-${customerEmail}`;
    if (sentEmails.has(idempotencyKey)) {
      console.log('⚠️ [EMAIL] Already sent for this order - skipping (idempotent)');
      return res.status(200).json({ 
        success: true, 
        message: 'Email already sent (idempotent)',
        skipped: true 
      });
    }

    // === SEND EMAIL VIA CENTRAL SERVICE ===
    const result = await sendOrderConfirmation({
      orderId,
      orderNumber,
      customerEmail,
      customerName,
      items,
      totalAmount,
      language,
      shippingAddress
    });

    // Mark as sent (idempotency)
    sentEmails.add(idempotencyKey);

    if (result.preview) {
      return res.status(200).json({
        success: true,
        preview: true,
        message: 'Email preview logged (EMAILS_ENABLED=false)',
      });
    }

    if (result.sent) {
      console.log('✅ [EMAIL] Order confirmation sent:', result.id);
      
      return res.status(200).json({ 
        success: true,
        emailId: result.id,
        message: 'Order confirmation email sent successfully'
      });
    }

    // Email failed
    console.error('❌ [EMAIL] Failed to send:', result.error);
    return res.status(500).json({
      error: 'Failed to send order confirmation email',
      message: result.error
    });

  } catch (error) {
    console.error('❌ [EMAIL] Failed:', error);
    console.error('❌ [EMAIL] Error details:', error.message);
    
    return res.status(500).json({ 
      error: 'Failed to send order confirmation email',
      message: error.message 
    });
  }
}

// === EMAIL TEMPLATES ===

function buildEmailHtml({ orderId, orderNumber, customerName, items, totalAmount, language, shippingAddress }) {
  const isGerman = language === 'de';
  
  // Texts
  const texts = {
    greeting: isGerman 
      ? `Hallo${customerName ? ' ' + customerName : ''},` 
      : `Hello${customerName ? ' ' + customerName : ''},`,
    thanks: isGerman 
      ? 'Vielen Dank für Ihre Bestellung! Wir haben Ihre Zahlung erhalten und werden Ihre Bestellung schnellstmöglich bearbeiten.' 
      : 'Thank you for your order! We have received your payment and will process your order as soon as possible.',
    orderDetails: isGerman ? 'Bestelldetails' : 'Order Details',
    orderNumber: isGerman ? 'Bestellnummer' : 'Order Number',
    product: isGerman ? 'Produkt' : 'Product',
    quantity: isGerman ? 'Anzahl' : 'Quantity',
    price: isGerman ? 'Preis' : 'Price',
    total: isGerman ? 'Gesamt' : 'Total',
    shippingAddressTitle: isGerman ? 'Lieferadresse' : 'Shipping Address',
    nextSteps: isGerman ? 'Wie geht es weiter?' : 'What happens next?',
    nextStepsText: isGerman 
      ? 'Wir werden Ihre Bestellung innerhalb der nächsten 1-2 Werktage versenden. Sie erhalten eine separate E-Mail mit der Sendungsverfolgungsnummer.' 
      : 'We will ship your order within the next 1-2 business days. You will receive a separate email with the tracking number.',
    questions: isGerman ? 'Fragen?' : 'Questions?',
    questionsText: isGerman 
      ? 'Bei Fragen zu Ihrer Bestellung kontaktieren Sie uns gerne.' 
      : 'If you have any questions about your order, feel free to contact us.',
    support: isGerman ? 'Unser Support-Team hilft Ihnen gerne weiter!' : 'Our support team is happy to help!',
    footer: isGerman 
      ? 'Mit freundlichen Grüßen,<br>Ihr UNBREAK ONE Team' 
      : 'Best regards,<br>Your UNBREAK ONE Team'
  };

  // Format items table
  const itemsHtml = items.map(item => `
    <tr>
      <td style="padding: 12px; border-bottom: 1px solid #eee;">${item.name || item.product_name || 'Product'}</td>
      <td style="padding: 12px; border-bottom: 1px solid #eee; text-align: center;">${item.quantity || 1}</td>
      <td style="padding: 12px; border-bottom: 1px solid #eee; text-align: right;">${formatPrice(item.price_cents || 0)}</td>
    </tr>
  `).join('');

  // Format shipping address
  const shippingHtml = shippingAddress ? `
    <div style="margin-top: 30px; padding: 20px; background-color: #f9f9f9; border-radius: 8px;">
      <h3 style="margin: 0 0 15px 0; color: #333; font-size: 16px;">${texts.shippingAddressTitle}</h3>
      <p style="margin: 0; line-height: 1.6; color: #555;">
        ${shippingAddress.name || ''}<br>
        ${shippingAddress.line1 || ''}<br>
        ${shippingAddress.line2 ? shippingAddress.line2 + '<br>' : ''}
        ${shippingAddress.postal_code || ''} ${shippingAddress.city || ''}<br>
        ${shippingAddress.country || ''}
      </p>
    </div>
  ` : '';

  return `
<!DOCTYPE html>
<html lang="${isGerman ? 'de' : 'en'}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${texts.orderNumber} ${orderNumber || orderId}</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  
  <!-- Header -->
  <div style="text-align: center; margin-bottom: 40px;">
    <h1 style="color: #0a4d4d; margin: 0; font-size: 28px;">UNBREAK ONE</h1>
    <p style="color: #666; margin: 5px 0 0 0;">${texts.orderDetails}</p>
  </div>

  <!-- Main Content -->
  <div style="background-color: #ffffff; border-radius: 8px; padding: 30px; border: 1px solid #e0e0e0;">
    
    <p style="font-size: 16px; margin: 0 0 10px 0;">${texts.greeting}</p>
    
    <p style="margin: 0 0 30px 0; color: #555;">${texts.thanks}</p>

    <!-- Order Number -->
    <div style="background-color: #f0f8f8; padding: 15px; border-radius: 6px; margin-bottom: 30px;">
      <p style="margin: 0; font-size: 14px; color: #666;">${texts.orderNumber}:</p>
      <p style="margin: 5px 0 0 0; font-size: 20px; font-weight: bold; color: #0a4d4d;">#${orderNumber || orderId}</p>
    </div>

    <!-- Items Table -->
    <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
      <thead>
        <tr style="background-color: #f5f5f5;">
          <th style="padding: 12px; text-align: left; border-bottom: 2px solid #ddd;">${texts.product}</th>
          <th style="padding: 12px; text-align: center; border-bottom: 2px solid #ddd;">${texts.quantity}</th>
          <th style="padding: 12px; text-align: right; border-bottom: 2px solid #ddd;">${texts.price}</th>
        </tr>
      </thead>
      <tbody>
        ${itemsHtml}
      </tbody>
      <tfoot>
        <tr>
          <td colspan="2" style="padding: 15px 12px; text-align: right; font-weight: bold; font-size: 16px;">${texts.total}:</td>
          <td style="padding: 15px 12px; text-align: right; font-weight: bold; font-size: 16px; color: #0a4d4d;">${formatPrice(totalAmount)}</td>
        </tr>
      </tfoot>
    </table>

    ${shippingHtml}

    <!-- Next Steps -->
    <div style="margin-top: 30px; padding: 20px; background-color: #fff8e6; border-left: 4px solid #ffc107; border-radius: 4px;">
      <h3 style="margin: 0 0 10px 0; color: #333; font-size: 16px;">${texts.nextSteps}</h3>
      <p style="margin: 0; color: #555;">${texts.nextStepsText}</p>
    </div>

    <!-- Support -->
    <div style="margin-top: 30px; text-align: center; padding-top: 20px; border-top: 1px solid #eee;">
      <p style="margin: 0 0 5px 0; font-weight: bold; color: #333;">${texts.questions}</p>
      <p style="margin: 0; color: #666; font-size: 14px;">${texts.questionsText}</p>
      <p style="margin: 15px 0 0 0; color: #0a4d4d; font-size: 14px;">${texts.support}</p>
    </div>

  </div>

  <!-- Footer -->
  <div style="text-align: center; margin-top: 30px; color: #999; font-size: 12px;">
    <p style="margin: 0;">${texts.footer}</p>
  </div>

</body>
</html>
  `;
}

function buildOwnerNotificationHtml({ orderId, orderNumber, customerEmail, customerName, items, totalAmount, shippingAddress }) {
  const itemsList = items.map(item => 
    `<li>${item.quantity || 1}x ${item.name || item.product_name || 'Product'} - ${formatPrice(item.price_cents || 0)}</li>`
  ).join('');

  const shippingHtml = shippingAddress ? `
    <h3>Lieferadresse:</h3>
    <p>
      ${shippingAddress.name || ''}<br>
      ${shippingAddress.line1 || ''}<br>
      ${shippingAddress.line2 ? shippingAddress.line2 + '<br>' : ''}
      ${shippingAddress.postal_code || ''} ${shippingAddress.city || ''}<br>
      ${shippingAddress.country || ''}
    </p>
  ` : '';

  return `
<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Neue Bestellung #${orderNumber || orderId}</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  
  <div style="background-color: #0a4d4d; color: white; padding: 20px; border-radius: 8px 8px 0 0;">
    <h1 style="margin: 0; font-size: 24px;">🛒 Neue Bestellung eingegangen!</h1>
  </div>

  <div style="background-color: #ffffff; border: 1px solid #e0e0e0; border-top: none; border-radius: 0 0 8px 8px; padding: 30px;">
    
    <h2 style="color: #0a4d4d; margin: 0 0 20px 0;">Bestellung #${orderNumber || orderId}</h2>

    <p><strong>Kunde:</strong> ${customerName || 'Unbekannt'}</p>
    <p><strong>E-Mail:</strong> ${customerEmail}</p>
    <p><strong>Gesamt:</strong> ${formatPrice(totalAmount)}</p>

    <h3>Bestellte Produkte:</h3>
    <ul>
      ${itemsList}
    </ul>

    ${shippingHtml}

    <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
    
    <p style="color: #666; font-size: 14px; margin: 0;">
      Diese E-Mail wurde automatisch generiert. Bestellungs-ID: ${orderId}
    </p>

  </div>

</body>
</html>
  `;
}

function formatPrice(cents) {
  const euros = (cents / 100).toFixed(2);
  return `€${euros}`;
}
