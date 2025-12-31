require('dotenv').config({path:'.env.local', quiet:true});
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function getOrderStructure() {
  const { data, error } = await supabase
    .from('orders')
    .select('*')
    .limit(1);
  
  if (data && data.length > 0) {
    console.log('Orders table columns:');
    console.log(Object.keys(data[0]));
    console.log('\nSample data:');
    console.log(JSON.stringify(data[0], null, 2));
    
    // Get customer too
    if (data[0].customer_id) {
      const { data: customer } = await supabase
        .from('customers')
        .select('*')
        .eq('id', data[0].customer_id)
        .single();
      
      if (customer) {
        console.log('\n\nCustomer table columns:');
        console.log(Object.keys(customer));
        console.log('\nSample data:');
        console.log(JSON.stringify(customer, null, 2));
      }
    }
    
    // Get configuration
    if (data[0].configuration_id) {
      const { data: config } = await supabase
        .from('configurations')
        .select('*')
        .eq('id', data[0].configuration_id)
        .single();
      
      if (config) {
        console.log('\n\nConfiguration table columns:');
        console.log(Object.keys(config));
        console.log('\nSample data:');
        console.log(JSON.stringify(config, null, 2));
      }
    }
  }
}

getOrderStructure().then(() => process.exit(0));
