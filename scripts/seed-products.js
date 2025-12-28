/**
 * UNBREAK ONE - Product Seed Script
 * Seeds initial 3 products into Supabase
 * Run: node scripts/seed-products.js
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

// Initial products data
const PRODUCTS = [
  {
    sku: 'UO-PREMIUM-SET',
    name: 'Premium Set',
    short_description_de: 'Starter-Set mit 2 Glashaltern & 1 Flaschenhalter',
    description: 'Perfektes Einsteiger-Set: 2 magnetische Weinglashalter und 1 Flaschenhalter. Made in Germany. Inkl. Montagematerial.',
    base_price_cents: 14900, // 149.00 EUR
    currency: 'EUR',
    image_url: '/images/products/premium-set.jpg',
    active: true,
    sort_order: 1,
  },
  {
    sku: 'UO-GLASS-HOLDER',
    name: 'Weinglashalter',
    short_description_de: 'Einzelner magnetischer Weinglashalter',
    description: 'Magnetischer Halter für Weingläser. Hält bis zu 3 Gläser sicher unter dem Tisch oder Regal. Made in Germany.',
    base_price_cents: 5900, // 59.00 EUR
    currency: 'EUR',
    image_url: '/images/products/glass-holder.jpg',
    active: true,
    sort_order: 2,
  },
  {
    sku: 'UO-BOTTLE-HOLDER',
    name: 'Flaschenhalter',
    short_description_de: 'Einzelner magnetischer Flaschenhalter',
    description: 'Magnetischer Halter für Weinflaschen. Platzsparende Aufbewahrung. Hält bis zu 1,5 kg sicher. Made in Germany.',
    base_price_cents: 7900, // 79.00 EUR
    currency: 'EUR',
    image_url: '/images/products/bottle-holder.jpg',
    active: true,
    sort_order: 3,
  },
];

async function seedProducts() {
  console.log('🌱 Seeding UNBREAK ONE Products...\n');

  // Validate environment
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing environment variables:');
    console.error('   SUPABASE_URL:', supabaseUrl ? '✓' : '✗');
    console.error('   SUPABASE_SERVICE_ROLE_KEY:', supabaseKey ? '✓' : '✗');
    console.error('\n💡 Set them in .env.local');
    process.exit(1);
  }

  // Create Supabase client
  const supabase = createClient(supabaseUrl, supabaseKey);

  console.log('✓ Connected to Supabase');
  console.log(`  URL: ${supabaseUrl}\n`);

  // Check if products table exists
  const { data: tables, error: tableError } = await supabase
    .from('products')
    .select('id')
    .limit(1);

  if (tableError && tableError.code === '42P01') {
    console.error('❌ Table "products" does not exist!');
    console.error('💡 Run database/schema.sql first to create the table\n');
    process.exit(1);
  }

  // Insert products
  let successCount = 0;
  let errorCount = 0;

  for (const product of PRODUCTS) {
    try {
      // Upsert (insert or update if SKU exists)
      const { data, error } = await supabase
        .from('products')
        .upsert(product, {
          onConflict: 'sku',
          returning: 'minimal',
        });

      if (error) throw error;

      console.log(`✅ ${product.sku.padEnd(20)} ${product.name} (${(product.base_price_cents / 100).toFixed(2)} EUR)`);
      successCount++;
    } catch (error) {
      console.error(`❌ ${product.sku.padEnd(20)} Error: ${error.message}`);
      errorCount++;
    }
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log(`✓ ${successCount} products seeded successfully`);
  if (errorCount > 0) {
    console.log(`✗ ${errorCount} products failed`);
  }
  console.log('='.repeat(60));

  // Verify
  console.log('\n📊 Verifying database...\n');
  const { data: allProducts, error: verifyError } = await supabase
    .from('products')
    .select('sku, name, base_price_cents, active, sort_order')
    .order('sort_order');

  if (verifyError) {
    console.error('❌ Verification failed:', verifyError.message);
  } else {
    console.table(
      allProducts.map((p) => ({
        SKU: p.sku,
        Name: p.name,
        Price: `${(p.base_price_cents / 100).toFixed(2)} EUR`,
        Active: p.active ? '✓' : '✗',
        Order: p.sort_order,
      }))
    );
  }

  console.log('\n✨ Seeding complete!\n');
  console.log('💡 Next steps:');
  console.log('   1. Visit http://localhost:3000/shop');
  console.log('   2. Products should now be visible\n');

  process.exit(errorCount > 0 ? 1 : 0);
}

// Run seed
seedProducts().catch((error) => {
  console.error('\n❌ Fatal error:', error);
  process.exit(1);
});
