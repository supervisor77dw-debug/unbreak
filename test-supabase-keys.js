// Quick test: Are Supabase environment variables loaded?
require('dotenv').config({ path: '.env.local' });

console.log('\n=== ENV VARIABLES CHECK ===\n');

console.log('SUPABASE_URL:', process.env.SUPABASE_URL?.substring(0, 30) + '...');
console.log('NEXT_PUBLIC_SUPABASE_URL:', process.env.NEXT_PUBLIC_SUPABASE_URL?.substring(0, 30) + '...');
console.log('SUPABASE_SERVICE_ROLE_KEY:', process.env.SUPABASE_SERVICE_ROLE_KEY ? 'SET (length: ' + process.env.SUPABASE_SERVICE_ROLE_KEY.length + ')' : 'MISSING');
console.log('NEXT_PUBLIC_SUPABASE_ANON_KEY:', process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? 'SET (length: ' + process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY.length + ')' : 'MISSING');

console.log('\n=== TESTING CONNECTION ===\n');

const { createClient } = require('@supabase/supabase-js');

// Test admin client
const adminClient = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

adminClient
  .from('products')
  .select('count')
  .then(({ data, error }) => {
    if (error) {
      console.error('❌ ADMIN CLIENT ERROR:', error.message);
    } else {
      console.log('✅ ADMIN CLIENT: Connected successfully');
    }
  });

// Test public client
const publicClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

publicClient
  .from('products')
  .select('count')
  .then(({ data, error }) => {
    if (error) {
      console.error('❌ PUBLIC CLIENT ERROR:', error.message);
    } else {
      console.log('✅ PUBLIC CLIENT: Connected successfully');
    }
  });
