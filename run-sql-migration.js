import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function runMigration() {
  console.log('🔧 Running SQL migration to add config_json column...\n');

  const sql = fs.readFileSync('./add-config-json-column.sql', 'utf8');

  const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql });

  if (error) {
    console.error('❌ Migration failed:', error);
    
    // Fallback: try direct ALTER TABLE
    console.log('\n🔄 Trying direct column add...');
    const { error: alterError } = await supabase
      .from('admin_orders')
      .select('config_json')
      .limit(1);
    
    if (alterError && alterError.message.includes('column "config_json" does not exist')) {
      console.log('✅ Column does not exist yet - this is expected.');
      console.log('⚠️  Please run this SQL manually in Supabase SQL Editor:');
      console.log('\n' + sql + '\n');
    } else {
      console.log('✅ Column may already exist or accessible.');
    }
  } else {
    console.log('✅ Migration completed successfully!', data);
  }
}

runMigration().catch(console.error);
