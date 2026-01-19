import { requireAuth } from '../../../lib/auth-helpers';
import { createClient } from '@supabase/supabase-js';
import { logDataSourceFingerprint } from '../../../lib/dataSourceFingerprint';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  // Log data source fingerprint
  logDataSourceFingerprint('products_api', {
    readTables: ['products'],
    writeTables: req.method === 'GET' ? [] : ['products'],
  });

  const user = await requireAuth(req, res);
  if (!user) {
    console.error('❌ [ADMIN PRODUCTS] No user authenticated');
    return res.status(401).json({ error: 'Unauthorized' });
  }

  console.log('✅ [ADMIN PRODUCTS] User authenticated:', user.email, 'Role:', user.role);

  // Only ADMIN can access products
  if (user.role !== 'ADMIN') {
    console.error('❌ [ADMIN PRODUCTS] Access denied for role:', user.role);
    return res.status(403).json({ error: 'Forbidden - ADMIN role required' });
  }

  try {
    if (req.method === 'GET') {
      const { search, active } = req.query;

      let query = supabase
        .from('products')
        .select('*')
        .order('created_at', { ascending: false });

      // Filter by search
      if (search) {
        query = query.or(`name.ilike.%${search}%,sku.ilike.%${search}%,description.ilike.%${search}%`);
      }

      // Filter by active status
      if (active !== undefined) {
        query = query.eq('active', active === 'true');
      }

      const { data: products, error } = await query;

      if (error) {
        console.error('❌ [ADMIN PRODUCTS] Error:', error);
        return res.status(500).json({ error: 'Failed to fetch products' });
      }

      return res.status(200).json({ products: products || [] });
    }

    if (req.method === 'POST') {
      // Create new product
      const {
        name,
        description,
        sku,
        base_price_cents,
        active,
        image_url,
        badge_label,
        short_description_de,
        short_description_en,
        shipping_text,
        highlights,
      } = req.body;

      if (!name || !sku) {
        return res.status(400).json({ error: 'name and sku are required' });
      }

      const newProduct = {
        name,
        description: description || null,
        sku,
        base_price_cents: base_price_cents || 0,
        active: active ?? true,
        image_url: image_url || null,
        image_crop_scale: 1.0,
        image_crop_x: 0,
        image_crop_y: 0,
        badge_label: badge_label || null,
        // TEMPORARY: Commented out until schema is fixed
        // short_description_de: short_description_de || null,
        // short_description_en: short_description_en || null,
        shipping_text: shipping_text || 'Versand 3–5 Tage',
        highlights: highlights || [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const { data: product, error } = await supabase
        .from('products')
        .insert(newProduct)
        .select()
        .single();

      if (error) {
        console.error('❌ [ADMIN PRODUCTS] Create error:', error);
        return res.status(500).json({ error: 'Failed to create product' });
      }

      return res.status(201).json(product);
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('❌ [ADMIN PRODUCTS] Error:', error);
    return res.status(500).json({ error: 'Failed to fetch products' });
  }
}
