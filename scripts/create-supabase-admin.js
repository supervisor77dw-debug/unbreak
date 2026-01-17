/**
 * Create Admin User in Supabase Auth
 * Bypasses Prisma - works directly with Supabase
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function createAdmin() {
  const email = 'admin@unbreak-one.com';
  const password = 'changeMe123!';

  console.log('🔐 Creating admin user in Supabase...');
  console.log('📧 Email:', email);
  console.log('🔒 Password:', password);

  try {
    // Create user in Supabase Auth
    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        role: 'ADMIN',
        name: 'Admin'
      }
    });

    if (error) {
      if (error.message.includes('already registered')) {
        console.log('⚠️  Admin user already exists');
        console.log('🔄 Attempting to update password...');
        
        // Get user by email
        const { data: users } = await supabase.auth.admin.listUsers();
        const existingUser = users.users.find(u => u.email === email);
        
        if (existingUser) {
          const { error: updateError } = await supabase.auth.admin.updateUserById(
            existingUser.id,
            { password }
          );
          
          if (updateError) {
            throw updateError;
          }
          
          console.log('✅ Password updated successfully!');
        }
      } else {
        throw error;
      }
    } else {
      console.log('✅ Admin user created successfully!');
      console.log('👤 User ID:', data.user.id);
    }

    console.log('\n📋 LOGIN CREDENTIALS:');
    console.log('  Email:', email);
    console.log('  Password:', password);
    console.log('\n🔗 Login at: https://www.unbreak-one.com/admin/login');
    console.log('\n⚠️  WICHTIG: Ändere das Passwort nach dem ersten Login!');

  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
}

createAdmin();
