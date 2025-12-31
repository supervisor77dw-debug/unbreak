// Test endpoint for email functionality
// Access: GET /api/email/test
// Use this for development testing only

export default async function handler(req, res) {
  // Only allow in development or with secret
  const isDev = process.env.NODE_ENV === 'development';
  const hasSecret = req.query.secret === process.env.EMAIL_TEST_SECRET;

  if (!isDev && !hasSecret) {
    return res.status(403).json({ error: 'Forbidden - test endpoint only available in development or with valid secret' });
  }

  console.log('🧪 [EMAIL TEST] Endpoint called');

  // Check ENV configuration
  const envCheck = {
    RESEND_API_KEY: !!process.env.RESEND_API_KEY,
    RESEND_FROM: !!process.env.RESEND_FROM,
    SHOP_OWNER_EMAIL: !!process.env.SHOP_OWNER_EMAIL,
  };

  console.log('🧪 [EMAIL TEST] ENV check:', envCheck);

  // Create test order data
  const testOrderData = {
    orderId: `test-${Date.now()}`,
    orderNumber: 'TEST12345',
    customerEmail: req.query.email || 'test@example.com', // Allow custom email via query param
    customerName: 'Test Customer',
    items: [
      {
        name: 'LED Strip White 5m',
        quantity: 2,
        price_cents: 4990
      },
      {
        name: 'LED Controller RGB',
        quantity: 1,
        price_cents: 2990
      }
    ],
    totalAmount: 12970,
    language: req.query.lang || 'de', // Allow language override
    shippingAddress: {
      name: 'Test Customer',
      line1: 'Teststraße 123',
      line2: 'Apartment 4B',
      postal_code: '12345',
      city: 'Berlin',
      country: 'DE'
    }
  };

  try {
    // Import and call email sending logic directly (avoid fetch to protected URL)
    const { Resend } = require('resend');
    const resend = new Resend(process.env.RESEND_API_KEY);

    console.log('🧪 [EMAIL TEST] Sending test email directly...');
    console.log('🧪 [EMAIL TEST] To:', testOrderData.customerEmail);
    console.log('🧪 [EMAIL TEST] Language:', testOrderData.language);

    // Build email HTML (simplified inline version)
    const emailSubject = testOrderData.language === 'de' 
      ? `Bestellbestätigung - Bestellung #${testOrderData.orderNumber}`
      : `Order Confirmation - Order #${testOrderData.orderNumber}`;

    const itemsHtml = testOrderData.items.map(item => `
      <tr>
        <td style="padding: 12px; border-bottom: 1px solid #eee;">${item.name}</td>
        <td style="padding: 12px; border-bottom: 1px solid #eee; text-align: center;">${item.quantity}</td>
        <td style="padding: 12px; border-bottom: 1px solid #eee; text-align: right;">€${(item.price_cents / 100).toFixed(2)}</td>
      </tr>
    `).join('');

    const emailHtml = `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  <h1 style="color: #0a4d4d; text-align: center;">UNBREAK ONE - ${emailSubject}</h1>
  <p>Testbestellung #${testOrderData.orderNumber}</p>
  <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
    <thead>
      <tr style="background: #f5f5f5;">
        <th style="padding: 12px; text-align: left;">Produkt</th>
        <th style="padding: 12px; text-align: center;">Anzahl</th>
        <th style="padding: 12px; text-align: right;">Preis</th>
      </tr>
    </thead>
    <tbody>${itemsHtml}</tbody>
    <tfoot>
      <tr>
        <td colspan="2" style="padding: 15px; text-align: right; font-weight: bold;">Gesamt:</td>
        <td style="padding: 15px; text-align: right; font-weight: bold; color: #0a4d4d;">€${(testOrderData.totalAmount / 100).toFixed(2)}</td>
      </tr>
    </tfoot>
  </table>
  <p style="color: #666; font-size: 14px;">Dies ist eine Test-Email von der Resend-Integration.</p>
</body>
</html>
    `;

    // Send email
    const emailResult = await resend.emails.send({
      from: process.env.RESEND_FROM,
      to: testOrderData.customerEmail,
      subject: emailSubject,
      html: emailHtml,
    });

    console.log('✅ [EMAIL TEST] Email sent successfully:', emailResult.id);

    return res.status(200).json({
      success: true,
      message: 'Test email sent successfully',
      emailResult: {
        id: emailResult.id,
        to: testOrderData.customerEmail,
        subject: emailSubject
      },
      testData: testOrderData,
      envCheck,
      instructions: {
        customEmail: 'Add ?email=your@email.com to send to a specific address',
        customLanguage: 'Add &lang=en for English email',
        example: '/api/email/test?email=you@example.com&lang=en'
      }
    });

  } catch (error) {
    console.error('🧪 [EMAIL TEST] Error:', error.message);
    console.error('🧪 [EMAIL TEST] Stack:', error.stack);

    return res.status(500).json({
      success: false,
      error: 'Test failed',
      message: error.message,
      stack: error.stack,
      testData: testOrderData,
      envCheck
    });
  }
}
