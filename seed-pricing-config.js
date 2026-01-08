require('dotenv').config({ path: '.env.local' });
require('dotenv').config({ path: '.env' });

const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Import pricing data from pricingConfig.js
const PRICING_VERSION = '2026-01-v1';
const BASE_PRICES = {
  glass_holder: 4990,   // €49.90
  bottle_holder: 4990,  // €49.90
};

const COLOR_UPCHARGES = {
  base: {
    green: 0,
    purple: 200,
    iceBlue: 200,
    red: 150,
    mint: 0,
  },
  arm: {
    green: 0,
    purple: 200,
    iceBlue: 200,
    red: 150,
    mint: 0,
  },
  module: {
    green: 0,
    purple: 200,
    iceBlue: 200,
    red: 150,
    mint: 0,
  },
  pattern: {
    red: 0,
    green: 0,
    purple: 200,
    iceBlue: 200,
    mint: 0,
  },
};

const FINISH_UPCHARGES = {
  matte: 0,
  glossy: 200,
  textured: 300,
  goldEdition: 1000,
};

const ARM_UPCHARGES = {
  standardArm: 0,
  premiumArm: 450,
};

const MODULE_UPCHARGES = {
  singleModule: 0,
  doubleModule: 250,
  proModule: 600,
};

const PATTERN_UPCHARGES = {
  standardPattern: 0,
  specialPattern: 300,
};

async function seedPricingConfig() {
  console.log('🌱 Seeding pricing configuration...\n');

  const variants = ['glass_holder', 'bottle_holder'];

  for (const variant of variants) {
    console.log(`📝 Processing variant: ${variant}`);

    // Check if active config already exists
    const { data: existing, error: checkError } = await supabase
      .from('pricing_configs')
      .select('*')
      .eq('variant', variant)
      .eq('active', true)
      .maybeSingle();

    if (checkError) {
      console.error(`❌ Error checking existing config: ${checkError.message}`);
      continue;
    }

    if (existing) {
      console.log(`   ⏭️  Active config already exists (id: ${existing.id})`);
      console.log(`   Version: ${existing.version}`);
      console.log(`   Base Price: ${existing.base_price_cents}¢\n`);
      continue;
    }

    // Insert new config
    const { data: newConfig, error: insertError } = await supabase
      .from('pricing_configs')
      .insert({
        variant: variant,
        base_price_cents: BASE_PRICES[variant],
        color_prices: COLOR_UPCHARGES,
        finish_prices: FINISH_UPCHARGES,
        arm_prices: ARM_UPCHARGES,
        module_prices: MODULE_UPCHARGES,
        pattern_prices: PATTERN_UPCHARGES,
        active: true,
        version: PRICING_VERSION,
      })
      .select()
      .single();

    if (insertError) {
      console.error(`   ❌ Error inserting config: ${insertError.message}\n`);
      continue;
    }

    console.log(`   ✅ Created new config (id: ${newConfig.id})`);
    console.log(`   Version: ${newConfig.version}`);
    console.log(`   Base Price: ${newConfig.base_price_cents}¢\n`);
  }

  console.log('🎉 Seeding complete!');
}

seedPricingConfig()
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  });
