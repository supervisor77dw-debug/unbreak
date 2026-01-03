/**
 * RUN BACKFILL: Populate customers from existing orders
 * 
 * Calls POST /api/admin/customers/backfill
 * Requires admin login
 */

import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '..', '.env.local') });

const baseUrl = process.env.NEXTAUTH_URL || 'https://unbreak-one.vercel.app';
const adminEmail = process.env.ADMIN_SEED_EMAIL || 'admin@unbreak-one.com';
const adminPassword = process.env.ADMIN_SEED_PASSWORD;

if (!adminPassword) {
  console.error('❌ ADMIN_SEED_PASSWORD not found in .env.local');
  process.exit(1);
}

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('🔄 CUSTOMER BACKFILL - UNBREAK-ONE');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

async function runBackfill() {
  
  // Step 1: Login as admin
  console.log('🔐 Step 1: Authenticating as admin...');
  console.log(`   Email: ${adminEmail}`);
  console.log(`   URL: ${baseUrl}/api/auth/callback/credentials\n`);
  
  const loginResponse = await fetch(`${baseUrl}/api/auth/callback/credentials`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email: adminEmail,
      password: adminPassword,
      redirect: false,
    }),
  });

  if (!loginResponse.ok) {
    const errorText = await loginResponse.text();
    console.error('❌ Login failed:', loginResponse.status, errorText);
    console.error('\n⚠️  Check ADMIN_SEED_EMAIL and ADMIN_SEED_PASSWORD in .env.local\n');
    process.exit(1);
  }

  const loginData = await loginResponse.json();
  
  // Extract session cookie
  const cookies = loginResponse.headers.get('set-cookie');
  if (!cookies) {
    console.error('❌ No session cookie received');
    console.error('Login response:', loginData);
    process.exit(1);
  }

  console.log('✅ Authenticated\n');

  // Step 2: Call backfill endpoint
  console.log('🔄 Step 2: Running backfill...');
  console.log(`   Endpoint: ${baseUrl}/api/admin/customers/backfill\n`);

  const backfillResponse = await fetch(`${baseUrl}/api/admin/customers/backfill`, {
    method: 'POST',
    headers: {
      'Cookie': cookies,
      'Content-Type': 'application/json',
    },
  });

  if (!backfillResponse.ok) {
    const errorText = await backfillResponse.text();
    console.error('❌ Backfill failed:', backfillResponse.status);
    console.error('Response:', errorText);
    process.exit(1);
  }

  const result = await backfillResponse.json();

  console.log('✅ Backfill complete!\n');

  // Step 3: Display results
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📊 BACKFILL RESULTS');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  if (result.stats) {
    const stats = result.stats;
    console.log(`Total Orders Found:       ${stats.totalOrders || 0}`);
    console.log(`Orders Processed:         ${stats.ordersProcessed || 0}`);
    console.log(`Customers Created:        ${stats.customersCreated || 0}`);
    console.log(`Customers Updated:        ${stats.customersUpdated || 0}`);
    console.log(`Orders Updated:           ${stats.ordersUpdated || 0}`);
    console.log(`Errors:                   ${stats.errors?.length || 0}`);
    console.log('');

    if (stats.errors && stats.errors.length > 0) {
      console.log('⚠️  Errors encountered:');
      stats.errors.forEach((err, i) => {
        console.log(`   ${i + 1}. Order ${err.orderId}: ${err.error}`);
      });
      console.log('');
    }
  } else {
    console.log('Result:', result);
  }

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  if (result.success) {
    console.log('✅ SUCCESS');
    console.log('');
    console.log('Next steps:');
    console.log('1. Verify customers in admin panel: /admin/customers');
    console.log('2. Run diagnosis: node scripts/diagnose-customers.js');
    console.log('3. Create test order to verify webhook sync');
    console.log('');
  } else {
    console.log('⚠️  Backfill completed with warnings');
    console.log('');
  }
}

runBackfill()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('❌ Backfill script failed:', err);
    process.exit(1);
  });
