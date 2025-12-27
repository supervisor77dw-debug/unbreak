// =====================================================
// Database Setup Verification Script
// =====================================================
// Prüft ob alle Tabellen, Seed-Daten und RLS Policies
// korrekt in Supabase angelegt wurden
// =====================================================

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testDatabaseSetup() {
  console.log('\n🔍 SUPABASE DATABASE VERIFICATION\n');
  console.log('='.repeat(60));
  
  let allTestsPassed = true;

  // =====================================================
  // 1. CONNECTION TEST
  // =====================================================
  console.log('\n📡 Testing Connection...');
  try {
    const { data, error } = await supabase
      .from('products')
      .select('count')
      .limit(1);
    
    if (error) {
      console.log('❌ Connection failed:', error.message);
      allTestsPassed = false;
      return;
    }
    console.log('✅ Connection successful!');
  } catch (err) {
    console.log('❌ Connection error:', err.message);
    allTestsPassed = false;
    return;
  }

  // =====================================================
  // 2. TABLE STRUCTURE TEST
  // =====================================================
  console.log('\n📋 Checking Tables...');
  
  const requiredTables = [
    'products',
    'product_options',
    'configurations',
    'customers',
    'orders',
    'payments',
    'production_jobs'
  ];

  for (const tableName of requiredTables) {
    try {
      const { data, error } = await supabase
        .from(tableName)
        .select('*')
        .limit(1);
      
      if (error) {
        console.log(`❌ Table '${tableName}': ${error.message}`);
        allTestsPassed = false;
      } else {
        console.log(`✅ Table '${tableName}' exists`);
      }
    } catch (err) {
      console.log(`❌ Table '${tableName}': ${err.message}`);
      allTestsPassed = false;
    }
  }

  // =====================================================
  // 3. SEED DATA TEST
  // =====================================================
  console.log('\n🌱 Checking Seed Data...');
  
  try {
    const { data: products, error: productsError } = await supabase
      .from('products')
      .select('*');
    
    if (productsError) {
      console.log('❌ Failed to fetch products:', productsError.message);
      allTestsPassed = false;
    } else {
      console.log(`✅ Products: ${products.length} found`);
      
      console.log('✅ Found products:');
      products.forEach(p => {
        console.log(`   - ${p.sku}: ${p.name_de} (€${(p.base_price / 100).toFixed(2)})`);
      });
      
      if (products.length < 4) {
        console.log('⚠️  Expected at least 4 products, found', products.length);
        allTestsPassed = false;
      }
    }
  } catch (err) {
    console.log('❌ Seed data check failed:', err.message);
    allTestsPassed = false;
  }

  // =====================================================
  // 4. PRODUCT OPTIONS TEST
  // =====================================================
  console.log('\n🎨 Checking Product Options...');
  
  try {
    const { data: options, error: optionsError } = await supabase
      .from('product_options')
      .select('*');
    
    if (optionsError) {
      console.log('❌ Failed to fetch options:', optionsError.message);
      allTestsPassed = false;
    } else {
      console.log(`✅ Product Options: ${options.length} found`);
      
      const optionsByType = options.reduce((acc, opt) => {
        acc[opt.option_type] = (acc[opt.option_type] || 0) + 1;
        return acc;
      }, {});
      
      console.log('   Option breakdown:');
      Object.entries(optionsByType).forEach(([type, count]) => {
        console.log(`   - ${type}: ${count} options`);
      });
    }
  } catch (err) {
    console.log('❌ Product options check failed:', err.message);
    allTestsPassed = false;
  }

  // =====================================================
  // 5. HELPER FUNCTIONS TEST
  // =====================================================
  console.log('\n⚙️  Testing Helper Functions...');
  
  try {
    // Test order number generation
    const { data: orderNumber, error: fnError } = await supabase
      .rpc('generate_order_number');
    
    if (fnError) {
      console.log('❌ generate_order_number() failed:', fnError.message);
      allTestsPassed = false;
    } else if (!orderNumber || !orderNumber.match(/^UB-\d{8}-[A-F0-9]{4}$/)) {
      console.log('❌ Invalid order number format:', orderNumber);
      console.log('   Expected format: UB-YYYYMMDD-XXXX (e.g., UB-20251227-A1B2)');
      allTestsPassed = false;
    } else {
      console.log(`✅ generate_order_number() works: ${orderNumber}`);
    }
  } catch (err) {
    console.log('❌ Helper function test failed:', err.message);
    allTestsPassed = false;
  }

  // =====================================================
  // 6. RLS POLICIES TEST (READ ACCESS)
  // =====================================================
  console.log('\n🔒 Checking RLS Policies...');
  
  try {
    // Test public read access to products (should work)
    const publicClient = createClient(
      process.env.SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    );
    
    const { data: publicProducts, error: publicError } = await publicClient
      .from('products')
      .select('*')
      .limit(1);
    
    if (publicError) {
      console.log('❌ RLS: Public read access to products failed:', publicError.message);
      allTestsPassed = false;
    } else {
      console.log('✅ RLS: Public can read products');
    }

    // Test public write access to products (should fail)
    const { error: writeError } = await publicClient
      .from('products')
      .insert({ sku: 'TEST', name_de: 'Test', base_price: 1000 });
    
    if (writeError) {
      console.log('✅ RLS: Public cannot write products (expected)');
    } else {
      console.log('⚠️  RLS: Public CAN write products (security risk!)');
      allTestsPassed = false;
      
      // Cleanup test product
      await supabase.from('products').delete().eq('sku', 'TEST');
    }
  } catch (err) {
    console.log('❌ RLS test failed:', err.message);
    allTestsPassed = false;
  }

  // =====================================================
  // FINAL SUMMARY
  // =====================================================
  console.log('\n' + '='.repeat(60));
  
  if (allTestsPassed) {
    console.log('\n✅ ALL TESTS PASSED! Database setup is correct.\n');
    console.log('🚀 Next steps:');
    console.log('   1. Run: npm run dev');
    console.log('   2. Open: http://localhost:3000/configurator.html');
    console.log('   3. Test checkout with card: 4242 4242 4242 4242\n');
  } else {
    console.log('\n❌ SOME TESTS FAILED! Please review errors above.\n');
    console.log('📖 Check SETUP-ECOMMERCE.md for troubleshooting.\n');
  }
  
  console.log('='.repeat(60) + '\n');
}

// Run verification
testDatabaseSetup().catch(err => {
  console.error('\n💥 Fatal error:', err);
  process.exit(1);
});
