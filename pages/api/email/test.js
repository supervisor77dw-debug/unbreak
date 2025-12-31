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
    // Call the email API
    const baseUrl = process.env.VERCEL_URL 
      ? `https://${process.env.VERCEL_URL}` 
      : 'http://localhost:3000';

    console.log('🧪 [EMAIL TEST] Calling:', `${baseUrl}/api/email/order`);
    console.log('🧪 [EMAIL TEST] Payload:', JSON.stringify(testOrderData, null, 2));

    const emailResponse = await fetch(`${baseUrl}/api/email/order`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testOrderData)
    });

    const responseText = await emailResponse.text();
    let responseData;

    try {
      responseData = JSON.parse(responseText);
    } catch (e) {
      responseData = { raw: responseText };
    }

    console.log('🧪 [EMAIL TEST] Response status:', emailResponse.status);
    console.log('🧪 [EMAIL TEST] Response data:', responseData);

    if (!emailResponse.ok) {
      return res.status(emailResponse.status).json({
        success: false,
        error: 'Email API returned error',
        status: emailResponse.status,
        response: responseData,
        testData: testOrderData,
        envCheck
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Test email sent successfully',
      emailResult: responseData,
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
