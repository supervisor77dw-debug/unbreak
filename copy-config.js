require('dotenv').config({path:'.env.local'});
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function copyConfig() {
  const sourceId = 'd928a2ef-9922-4baf-830f-bdaca81b30bf'; // Has config_json
  const targetId = '6c3b5387-e0cd-42b1-8371-fa5b7cf9cd62'; // Exists in Prisma
  
  // Get source config
  const { data: source } = await supabase
    .from('simple_orders')
    .select('config_json')
    .eq('id', sourceId)
    .single();
  
  if (!source?.config_json) {
    console.log('❌ Source has no config_json');
    return;
  }
  
  console.log('✅ Source config_json:', source.config_json);
  
  // Check if target exists in Supabase
  const { data: target } = await supabase
    .from('simple_orders')
    .select('id')
    .eq('id', targetId)
    .maybeSingle();
  
  if (!target) {
    console.log(`\n❌ Target order ${targetId.substring(0,8)} not in simple_orders`);
    console.log('Cannot copy - order only in Prisma');
    console.log('\n📋 SOLUTION: Create new order via Checkout flow');
    return;
  }
  
  // Update target with source config
  const { error } = await supabase
    .from('simple_orders')
    .update({ config_json: source.config_json })
    .eq('id', targetId);
  
  if (error) {
    console.log('❌ Error:', error.message);
  } else {
    console.log(`\n✅ Copied config_json to order ${targetId.substring(0,8)}`);
    console.log(`🔗 https://unbreak-one.vercel.app/admin/orders/${targetId}`);
  }
}

copyConfig();
