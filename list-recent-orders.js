import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function listOrders() {
  console.log('📋 Listing all orders in admin_orders (last 10)...\n');

  const { data, error } = await supabase
    .from('admin_orders')
    .select('id, email, status_payment, created_at, config_json')
    .order('created_at', { ascending: false })
    .limit(10);

  if (error) {
    console.log('❌ Error:', error.message);
  } else if (data && data.length > 0) {
    console.log(`✅ Found ${data.length} orders:\n`);
    data.forEach((order, idx) => {
      console.log(`${idx + 1}. ID: ${order.id}`);
      console.log(`   First 8: ${order.id.substring(0, 8)}`);
      console.log(`   Email: ${order.email}`);
      console.log(`   Status: ${order.status_payment}`);
      console.log(`   Created: ${order.created_at}`);
      console.log(`   Has config: ${!!order.config_json}`);
      console.log('');
    });
  } else {
    console.log('❌ No orders found!');
  }
}

listOrders().catch(console.error);
