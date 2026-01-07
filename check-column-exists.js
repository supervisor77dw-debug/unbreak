import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkColumn() {
  console.log('🔍 Checking if config_json column exists in admin_orders...\n');

  const { data, error } = await supabase
    .from('admin_orders')
    .select('id, config_json')
    .limit(1);

  if (error) {
    if (error.message.includes('column "config_json" does not exist')) {
      console.log('❌ Column config_json does NOT exist in admin_orders table');
      console.log('\n📋 Please run this SQL manually in Supabase SQL Editor:\n');
      console.log('ALTER TABLE public.admin_orders ADD COLUMN config_json JSONB;\n');
    } else {
      console.log('❌ Error:', error);
    }
  } else {
    console.log('✅ Column config_json EXISTS in admin_orders table!');
    console.log('Sample data:', data);
  }
}

checkColumn().catch(console.error);
