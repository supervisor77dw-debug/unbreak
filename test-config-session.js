/**
 * Test Config Session API
 * 
 * Tests the complete flow:
 * 1. POST /api/config-session - Create session
 * 2. GET /api/config-session/[sessionId] - Retrieve session
 * 3. DELETE /api/config-session/[sessionId] - Cleanup
 */

const API_BASE = 'http://localhost:3000/api';

async function testConfigSessionFlow() {
  console.log('🧪 Testing Config Session API Flow...\n');

  try {
    // Step 1: Create session
    console.log('1️⃣ Creating config session...');
    const createResponse = await fetch(`${API_BASE}/config-session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        lang: 'en',
        config: {
          product_type: 'glass_holder',
          parts: {
            base: 'black',
            holder: 'gold',
          },
          colors: {
            primary: '#000000',
            accent: '#FFD700',
          },
          quantity: 2,
          price: 9800, // 98€ for 2
        },
      }),
    });

    if (!createResponse.ok) {
      throw new Error(`Create failed: ${createResponse.status}`);
    }

    const createData = await createResponse.json();
    console.log('✅ Session created:', createData);
    
    if (!createData.ok || !createData.sessionId) {
      throw new Error('Invalid response format');
    }

    const sessionId = createData.sessionId;
    console.log(`   Session ID: ${sessionId}\n`);

    // Step 2: Retrieve session
    console.log('2️⃣ Retrieving session...');
    const getResponse = await fetch(`${API_BASE}/config-session/${sessionId}`);
    
    if (!getResponse.ok) {
      throw new Error(`Get failed: ${getResponse.status}`);
    }

    const getData = await getResponse.json();
    console.log('✅ Session retrieved:', getData);
    
    if (!getData.lang || !getData.config) {
      throw new Error('Invalid session data');
    }

    console.log(`   Language: ${getData.lang}`);
    console.log(`   Config keys: ${Object.keys(getData.config).join(', ')}\n`);

    // Step 3: Delete session
    console.log('3️⃣ Deleting session...');
    const deleteResponse = await fetch(`${API_BASE}/config-session/${sessionId}`, {
      method: 'DELETE',
    });

    if (!deleteResponse.ok) {
      throw new Error(`Delete failed: ${deleteResponse.status}`);
    }

    const deleteData = await deleteResponse.json();
    console.log('✅ Session deleted:', deleteData);
    
    if (!deleteData.success) {
      throw new Error('Delete did not succeed');
    }

    console.log('\n🎉 All tests passed!\n');

    // Step 4: Verify deletion
    console.log('4️⃣ Verifying deletion...');
    const verifyResponse = await fetch(`${API_BASE}/config-session/${sessionId}`);
    
    if (verifyResponse.status === 404) {
      console.log('✅ Session correctly deleted (404 returned)\n');
    } else {
      throw new Error('Session still exists after deletion!');
    }

    console.log('✅ Complete flow test PASSED!\n');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
  }
}

// Additional test: Optional sessionId parameter
async function testOptionalSessionId() {
  console.log('🧪 Testing optional sessionId parameter...\n');

  try {
    const customSessionId = 'test-session-123';

    console.log('1️⃣ Creating session with custom sessionId...');
    const response = await fetch(`${API_BASE}/config-session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: customSessionId,
        lang: 'de',
        config: {
          product_type: 'bottle_holder',
          quantity: 1,
        },
      }),
    });

    const data = await response.json();
    
    if (data.sessionId !== customSessionId) {
      throw new Error(`Expected sessionId ${customSessionId}, got ${data.sessionId}`);
    }

    console.log('✅ Custom sessionId accepted:', data.sessionId);

    // Cleanup
    await fetch(`${API_BASE}/config-session/${customSessionId}`, {
      method: 'DELETE',
    });

    console.log('✅ Optional sessionId test PASSED!\n');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
  }
}

// Run tests
async function runTests() {
  await testConfigSessionFlow();
  await testOptionalSessionId();
  console.log('🎊 ALL TESTS PASSED! 🎊\n');
}

runTests();
