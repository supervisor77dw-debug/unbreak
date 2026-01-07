import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkOrder() {
  const orderId = '74aca2d4-73a0-48d5-8d82-8b0e93b01abe';

  console.log('🔍 Checking if order still exists in admin_orders...\n');

  const { data, error } = await supabase
    .from('admin_orders')
    .select('id, stripe_checkout_session_id, config_json, status_payment, email')
    .eq('id', orderId)
    .maybeSingle();

  if (error) {
    console.log('❌ Error:', error.message);
  } else if (data) {
    console.log('✅ Order EXISTS in admin_orders:');
    console.log('   Full ID:', data.id);
    console.log('   First 8:', data.id.substring(0, 8));
    console.log('   Email:', data.email);
    console.log('   Status:', data.status_payment);
    console.log('   Has config:', !!data.config_json);
  } else {
    console.log('❌ Order NOT FOUND in admin_orders!');
    console.log('   Searched for ID:', orderId);
  }
}

checkOrder().catch(console.error);
