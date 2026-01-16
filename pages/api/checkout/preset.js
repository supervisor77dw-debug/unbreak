import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Helper: Get origin from request (no hardcoded domains)
function getOrigin(req) {
  // 1. Try ENV variable first (most reliable for production)
  if (process.env.NEXT_PUBLIC_SITE_URL) {
    return process.env.NEXT_PUBLIC_SITE_URL;
  }
  
  // 2. Try origin header
  if (req.headers.origin) {
    return req.headers.origin;
  }
  
  // 3. Fallback: construct from host header
  const host = req.headers.host || 'localhost:3000';
  const protocol = req.headers['x-forwarded-proto'] || (host.includes('localhost') ? 'http' : 'https');
  return `${protocol}://${host}`;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { preset_id, email } = req.body;

    if (!preset_id) {
      return res.status(400).json({ error: 'preset_id is required' });
    }

    // 1. Fetch preset from database
    const { data: preset, error: presetError } = await supabase
      .from('presets')
      .select('*')
      .eq('id', preset_id)
      .eq('active', true)
      .single();

    if (presetError || !preset) {
      return res.status(404).json({ error: 'Preset not found or inactive' });
    }

    // 2. Fetch base product to get proper product details
    const { data: product, error: productError } = await supabase
      .from('products')
      .select('*')
      .eq('sku', preset.product_sku)
      .single();

    if (productError || !product) {
      return res.status(404).json({ error: 'Base product not found' });
    }

    // 3. Get user from session (if logged in)
    let userId = null;
    let customerEmail = email;

    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const { data: { user }, error: authError } = await supabase.auth.getUser(token);
      
      if (!authError && user) {
        userId = user.id;
        if (!customerEmail) {
          customerEmail = user.email;
        }
      }
    }

    // 4. Create configuration record (preset configuration)
    const { data: configuration, error: configError } = await supabase
      .from('configurations')
      .insert({
        customer_user_id: userId,
        product_sku: preset.product_sku,
        config_json: preset.config_json,
        preset_id: preset.id, // Track which preset was used
        metadata: {
          preset_title: preset.title_de,
          preset_description: preset.description_de
        }
      })
      .select()
      .single();

    if (configError) {
      console.error('Configuration creation error:', configError);
      return res.status(500).json({ error: 'Failed to create configuration' });
    }

    // 5. Create order record
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert({
        customer_user_id: userId,
        customer_email: customerEmail || null,
        configuration_id: configuration.id,
        total_amount_cents: preset.price_cents,
        currency: preset.currency || 'EUR',
        status: 'pending',
        order_type: 'preset',
        metadata: {
          preset_id: preset.id,
          preset_title: preset.title_de,
          product_sku: preset.product_sku,
          config: preset.config_json
        }
      })
      .select()
      .single();

    if (orderError) {
      console.error('Order creation error:', orderError);
      return res.status(500).json({ error: 'Failed to create order' });
    }

    // 6. Create Stripe Checkout Session
    const session = await stripe.checkout.sessions.create({
      // Payment methods: card, PayPal, SEPA, Klarna
      payment_method_types: ['card', 'sepa_debit'],
      locale: 'de', // Preset endpoint defaults to German
      line_items: [
        {
          price_data: {
            currency: preset.currency?.toLowerCase() || 'eur',
            unit_amount: preset.price_cents,
            product_data: {
              name: `UNBREAK ONE – ${preset.title_de}`,
              description: preset.description_de || `${product.name_de} (Vorkonfiguriert)`,
              images: preset.image_url ? [preset.image_url] : (product.image_url ? [product.image_url] : undefined),
            },
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${getOrigin(req)}/success.html?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${getOrigin(req)}/cancel.html`,
      customer_email: customerEmail || undefined,
      metadata: {
        order_id: order.id,
        preset_id: preset.id,
        configuration_id: configuration.id,
        type: 'preset',
        user_id: userId || 'guest',
      },
    });

    // 7. Update order with payment intent
    await supabase
      .from('orders')
      .update({
        stripe_payment_intent_id: session.payment_intent,
        stripe_checkout_session_id: session.id,
      })
      .eq('id', order.id);

    // 8. Return checkout URL
    return res.status(200).json({
      url: session.url,
      order_id: order.id,
      configuration_id: configuration.id,
      session_id: session.id,
    });

  } catch (error) {
    console.error('Preset checkout error:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  }
}
