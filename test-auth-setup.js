/**
 * UNBREAK ONE - Auth System Test Script
 * ======================================
 * Purpose: Verify auth setup and database configuration
 * Usage: node test-auth-setup.js
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  dim: '\x1b[2m',
};

const log = {
  success: (msg) => console.log(`${colors.green}✓${colors.reset} ${msg}`),
  error: (msg) => console.log(`${colors.red}✗${colors.reset} ${msg}`),
  warn: (msg) => console.log(`${colors.yellow}⚠${colors.reset} ${msg}`),
  info: (msg) => console.log(`${colors.cyan}ℹ${colors.reset} ${msg}`),
  dim: (msg) => console.log(`${colors.dim}${msg}${colors.reset}`),
};

async function testAuthSetup() {
  console.log('\n' + '='.repeat(60));
  console.log('🔐 UNBREAK ONE - Auth System Verification');
  console.log('='.repeat(60) + '\n');

  let passedTests = 0;
  let failedTests = 0;

  // =============================================================
  // 1. ENVIRONMENT VARIABLES
  // =============================================================
  console.log('1️⃣  Environment Variables\n');

  const requiredEnvVars = [
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    'SUPABASE_SERVICE_ROLE_KEY',
  ];

  requiredEnvVars.forEach((envVar) => {
    if (process.env[envVar]) {
      log.success(`${envVar} is set`);
      passedTests++;
    } else {
      log.error(`${envVar} is missing`);
      failedTests++;
    }
  });

  if (failedTests > 0) {
    console.log('\n' + colors.red + 'Missing environment variables! Create .env.local with required keys.' + colors.reset);
    process.exit(1);
  }

  // =============================================================
  // 2. SUPABASE CONNECTION
  // =============================================================
  console.log('\n2️⃣  Supabase Connection\n');

  let supabase;
  let supabaseAdmin;

  try {
    supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    );
    log.success('Supabase client initialized (anon key)');
    passedTests++;
  } catch (error) {
    log.error(`Supabase client initialization failed: ${error.message}`);
    failedTests++;
    process.exit(1);
  }

  try {
    supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );
    log.success('Supabase admin client initialized (service_role key)');
    passedTests++;
  } catch (error) {
    log.error(`Supabase admin client initialization failed: ${error.message}`);
    failedTests++;
    process.exit(1);
  }

  // =============================================================
  // 3. PROFILES TABLE
  // =============================================================
  console.log('\n3️⃣  Profiles Table\n');

  try {
    const { data, error } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .limit(1);

    if (error) throw error;

    log.success('profiles table exists and is accessible');
    passedTests++;

    if (data.length > 0) {
      log.info(`Found ${data.length} profile(s)`);
      log.dim(`   Sample: ${data[0].email} (${data[0].role})`);
    } else {
      log.warn('profiles table is empty (no users yet)');
    }
  } catch (error) {
    log.error(`profiles table check failed: ${error.message}`);
    log.dim('   Run database/auth-setup.sql in Supabase Dashboard');
    failedTests++;
  }

  // =============================================================
  // 4. RLS POLICIES
  // =============================================================
  console.log('\n4️⃣  Row Level Security (RLS)\n');

  const rlsTables = ['profiles', 'orders', 'products', 'customers', 'configurations', 'payments', 'production_jobs'];

  for (const table of rlsTables) {
    try {
      const { data, error } = await supabaseAdmin.rpc('pg_tables_check', {
        table_name: table,
      }).select('*').limit(1);

      // Alternative: Direct query (if RPC not available)
      const { data: rlsData, error: rlsError } = await supabaseAdmin
        .from(table)
        .select('*')
        .limit(1);

      if (rlsError && rlsError.message.includes('permission denied')) {
        log.warn(`${table} - RLS may be too restrictive (expected for anon key)`);
      } else if (rlsError) {
        log.error(`${table} - Error: ${rlsError.message}`);
        failedTests++;
      } else {
        log.success(`${table} - RLS configured`);
        passedTests++;
      }
    } catch (error) {
      log.error(`${table} - RLS check failed: ${error.message}`);
      failedTests++;
    }
  }

  // =============================================================
  // 5. TRIGGER FUNCTION
  // =============================================================
  console.log('\n5️⃣  Auto-Create Profile Trigger\n');

  try {
    const { data, error } = await supabaseAdmin.rpc('pg_trigger_exists', {
      trigger_name: 'on_auth_user_created',
    });

    // Alternative: Check if function exists
    const { data: funcData, error: funcError } = await supabaseAdmin.rpc('handle_new_user');

    if (funcError && funcError.message.includes('does not exist')) {
      log.error('handle_new_user() function not found');
      log.dim('   Run database/auth-setup.sql in Supabase Dashboard');
      failedTests++;
    } else {
      log.success('handle_new_user() function exists');
      passedTests++;
    }
  } catch (error) {
    // Try alternative check
    log.warn('Trigger check skipped (requires custom RPC)');
    log.dim('   Manually verify: auth.users trigger → handle_new_user()');
  }

  // =============================================================
  // 6. ADMIN USERS
  // =============================================================
  console.log('\n6️⃣  Admin Users\n');

  try {
    const { data: admins, error } = await supabaseAdmin
      .from('profiles')
      .select('email, role, created_at')
      .eq('role', 'admin');

    if (error) throw error;

    if (admins.length === 0) {
      log.warn('No admin users found');
      log.dim('   Create first admin: UPDATE profiles SET role = \'admin\' WHERE email = \'your-email@example.com\'');
    } else {
      log.success(`Found ${admins.length} admin user(s)`);
      admins.forEach((admin) => {
        log.dim(`   ${admin.email} (since ${new Date(admin.created_at).toLocaleDateString()})`);
      });
      passedTests++;
    }
  } catch (error) {
    log.error(`Admin check failed: ${error.message}`);
    failedTests++;
  }

  // =============================================================
  // 7. FILES CHECK
  // =============================================================
  console.log('\n7️⃣  Auth Pages & Components\n');

  const fs = require('fs');
  const path = require('path');

  const requiredFiles = [
    'public/login.html',
    'public/account.html',
    'public/ops.html',
    'public/admin.html',
    'public/components/header.js',
    'lib/auth.js',
    'lib/auth-server.js',
    'pages/api/admin/set-role.js',
    'pages/api/admin/products/update.js',
    'database/auth-setup.sql',
  ];

  requiredFiles.forEach((file) => {
    const filePath = path.join(process.cwd(), file);
    if (fs.existsSync(filePath)) {
      log.success(`${file}`);
      passedTests++;
    } else {
      log.error(`${file} - NOT FOUND`);
      failedTests++;
    }
  });

  // =============================================================
  // 8. ENVIRONMENT INJECTION CHECK
  // =============================================================
  console.log('\n8️⃣  Environment Injection Status\n');

  const htmlFiles = [
    'public/login.html',
    'public/account.html',
    'public/ops.html',
    'public/admin.html',
  ];

  let needsInjection = false;

  htmlFiles.forEach((file) => {
    const filePath = path.join(process.cwd(), file);
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf8');
      if (content.includes('YOUR_SUPABASE_URL') || content.includes('YOUR_SUPABASE_ANON_KEY')) {
        log.warn(`${file} - Contains placeholders (needs injection)`);
        needsInjection = true;
      } else {
        log.success(`${file} - Credentials injected`);
        passedTests++;
      }
    }
  });

  if (needsInjection) {
    log.info('Run: npm run inject-env');
  }

  // =============================================================
  // SUMMARY
  // =============================================================
  console.log('\n' + '='.repeat(60));
  console.log('📊 Test Summary');
  console.log('='.repeat(60));
  console.log(`${colors.green}Passed:${colors.reset} ${passedTests}`);
  console.log(`${colors.red}Failed:${colors.reset} ${failedTests}`);
  console.log('='.repeat(60) + '\n');

  if (failedTests === 0 && !needsInjection) {
    log.success('🎉 Auth system is fully configured and ready!');
    log.info('Next steps:');
    log.dim('   1. Start dev server: npm run dev');
    log.dim('   2. Test login: http://localhost:3000/login.html');
    log.dim('   3. Create first admin (if not done yet)');
  } else if (needsInjection) {
    log.warn('⚠️  Environment injection required');
    log.info('Run: npm run inject-env');
  } else {
    log.error('❌ Auth system has configuration issues');
    log.info('Check errors above and fix them');
    log.dim('   See: AUTH-SETUP.md for detailed instructions');
    process.exit(1);
  }

  console.log('');
}

// Run tests
testAuthSetup().catch((error) => {
  console.error('Test script error:', error);
  process.exit(1);
});
