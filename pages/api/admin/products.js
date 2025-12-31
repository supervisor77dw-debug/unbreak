import { requireAuth } from '../../../lib/auth-helpers';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
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
        .from('shop_products')
        .select('*')
        .order('created_at', { ascending: false });

      // Filter by search
      if (search) {
        query = query.or(`name_de.ilike.%${search}%,name_en.ilike.%${search}%,sku.ilike.%${search}%`);
      }

      // Filter by active status
      if (active !== undefined) {
        query = query.eq('active', active === 'true');
      }

      const { data: products, error } = await query;

      if (error) {
        console.error('❌ [ADMIN PRODUCTS] Supabase Error:', JSON.stringify(error, null, 2));
        console.error('❌ [ADMIN PRODUCTS] Error details:', {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code
        });
        
        // If table doesn't exist, return empty array for now
        if (error.code === '42P01' || error.message?.includes('does not exist')) {
          console.log('⚠️ [ADMIN PRODUCTS] Table shop_products does not exist, returning empty array');
          return res.status(200).json({ products: [] });
        }
        
        return res.status(500).json({ 
          error: 'Failed to fetch products',
          details: error.message 
        });
      }

      return res.status(200).json({ products: products || [] });
    }

    if (req.method === 'POST') {
      // Create new product
      const {
        name_de,
        name_en,
        description_de,
        description_en,
        sku,
        base_price_cents,
        stock_quantity,
        active,
        image_url,
      } = req.body;

      if (!name_de) {
        return res.status(400).json({ error: 'name_de is required' });
      }

      const newProduct = {
        name_de,
        name_en: name_en || null,
        description_de: description_de || null,
        description_en: description_en || null,
        sku: sku || null,
        base_price_cents: base_price_cents || 0,
        stock_quantity: stock_quantity || 0,
        active: active ?? true,
        image_url: image_url || null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const { data: product, error } = await supabase
        .from('shop_products')
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
