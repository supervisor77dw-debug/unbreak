require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

async function addBundles() {
  console.log(' Adding bundle products to Supabase...\n');

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error(' Missing credentials');
    console.log('URL:', supabaseUrl ? '' : '');
    console.log('Key:', supabaseKey ? '' : '');
    return;
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  const newProducts = [
    {
      sku: 'UO-BUNDLE-GASTRO',
      name: 'Gastro Edition',
      short_description_de: '4 Glashalter & 2 Flaschenhalter für die professionelle Gastronomie',
      description: 'Komplettes Gastro-Set: 4 magnetische Weinglashalter und 2 Flaschenhalter. Ideal für Restaurants und Bars. Made in Germany. Inkl. Montagematerial.',
      base_price_cents: 29900,
      currency: 'EUR',
      image_url: '/images/products/premium-set.jpg',
      active: true,
      sort_order: 4
    },
    {
      sku: 'UO-BUNDLE-STARTER',
      name: 'Starter Bundle',
      short_description_de: '2 Glashalter für den perfekten Einstieg',
      description: 'Kompaktes Starter-Set: 2 magnetische Weinglashalter. Perfekt für kleine Küchen oder als Geschenk. Made in Germany. Inkl. Montagematerial.',
      base_price_cents: 10900,
      currency: 'EUR',
      image_url: '/images/products/glass-holder.jpg',
      active: true,
      sort_order: 5
    }
  ];

  for (const product of newProducts) {
    console.log(` Adding ${product.name}...`);
    
    const { data, error } = await supabase
      .from('products')
      .upsert(product, { onConflict: 'sku' })
      .select();

    if (error) {
      console.error(` Error adding ${product.sku}:`, error);
    } else {
      console.log(` ${product.name} added/updated (${product.base_price_cents / 100} EUR)`);
    }
  }

  // Verify all products
  console.log('\n Current products in database:\n');
  const { data: allProducts, error: fetchError } = await supabase
    .from('products')
    .select('sku, name, base_price_cents, active, sort_order')
    .order('sort_order', { ascending: true });

  if (fetchError) {
    console.error(' Error fetching products:', fetchError);
  } else {
    console.table(allProducts.map(p => ({
      SKU: p.sku,
      Name: p.name,
      'Preis (EUR)': (p.base_price_cents / 100).toFixed(2),
      Active: p.active ? '' : '',
      Order: p.sort_order
    })));
  }

  console.log('\n Bundle products setup complete!\n');
}

addBundles().catch(console.error);
