import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkSchema() {
  const query = `
    SELECT column_name, data_type
    FROM information_schema.columns
    WHERE table_schema='public' AND table_name IN ('orders','simple_orders')
    ORDER BY table_name, ordinal_position;
  `;

  const { data, error } = await supabase.rpc('exec_sql', { sql_query: query });

  if (error) {
    // Try direct query instead
    console.log('\n🔍 CHECKING SCHEMA:\n');
    
    const { data: ordersSchema, error: e1 } = await supabase
      .from('orders')
      .select('*')
      .limit(0);
    
    const { data: simpleSchema, error: e2 } = await supabase
      .from('simple_orders')
      .select('*')
      .limit(0);
    
    if (e1) console.log('ORDERS table error:', e1.message);
    if (e2) console.log('SIMPLE_ORDERS table error:', e2.message);
    
    // Get one row to see structure
    const { data: sample } = await supabase
      .from('simple_orders')
      .select('*')
      .limit(1)
      .single();
    
    if (sample) {
      console.log('\nSIMPLE_ORDERS columns:');
      Object.keys(sample).sort().forEach(col => {
        console.log(`  - ${col}: ${typeof sample[col]}`);
      });
    }
  } else {
    console.log('\n📊 SCHEMA RESULT:\n');
    console.table(data);
  }
}

checkSchema().catch(console.error);
