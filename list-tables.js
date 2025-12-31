require('dotenv').config({path:'.env.local', quiet:true});
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function listTables() {
  // Query the information schema to get all tables in public schema
  const { data, error } = await supabase.rpc('execute_sql', {
    query: `
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
      ORDER BY table_name;
    `
  });
  
  if (error) {
    // Fallback: Try to query each known table
    console.log('RPC not available, checking known tables...\n');
    
    const tablesToCheck = [
      'orders',
      'simple_orders',
      'customers',
      'configurations',
      'products',
      'admin_orders',
      'admin_customers',
      'admin_users'
    ];
    
    for (const table of tablesToCheck) {
      const { data, error } = await supabase
        .from(table)
        .select('*')
        .limit(1);
      
      if (!error) {
        console.log(`✅ Table exists: ${table}`);
      } else if (error.code === '42P01') {
        console.log(`❌ Table NOT found: ${table}`);
      } else {
        console.log(`⚠️  Table ${table}: ${error.message}`);
      }
    }
  } else {
    console.log('Tables in public schema:');
    console.log(data);
  }
}

listTables().then(() => process.exit(0));
