// Test the order detail API directly
const fetch = require('node-fetch');

async function testAPI() {
  const orderId = 'd928a2ef-9922-4baf-830f-bdaca81b30bf';
  const adminKey = 'K0ZUzL5rWPxK7nmdudjVJ9mG9k9EHMXRcKUBkiAYCjw=';
  
  try {
    const res = await fetch(`https://unbreak-one.vercel.app/api/admin/orders/${orderId}`, {
      headers: {
        'x-admin-key': adminKey,
        'Cookie': 'next-auth.session-token=your-session-token' // This won't work, just testing
      }
    });
    
    console.log('Status:', res.status);
    const data = await res.json();
    
    console.log('\nResponse keys:', Object.keys(data));
    console.log('\nHas config_json:', !!data.config_json);
    console.log('config_json:', data.config_json);
    
    if (data.items?.length) {
      console.log('\nFirst item keys:', Object.keys(data.items[0]));
      console.log('First item config:', data.items[0].config);
    }
  } catch (error) {
    console.error('Error:', error.message);
  }
}

testAPI();
