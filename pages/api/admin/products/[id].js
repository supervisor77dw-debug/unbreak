import { requireAuth } from '../../../../lib/auth-helpers';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  const { id } = req.query;

  const user = await requireAuth(req, res);
  if (!user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // Only ADMIN can manage products
  if (user.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Forbidden - ADMIN role required' });
  }

  try {
    if (req.method === 'GET') {
      // Fetch single product
      const { data: product, error } = await supabase
        .from('shop_products')
        .select('*')
        .eq('id', id)
        .single();

      if (error) {
        console.error('❌ [ADMIN PRODUCT] Error:', error);
        return res.status(404).json({ error: 'Product not found' });
      }

      return res.status(200).json(product);
    }

    if (req.method === 'PATCH') {
      // Update product
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

      const updates = {
        updated_at: new Date().toISOString(),
      };

      if (name_de !== undefined) updates.name_de = name_de;
      if (name_en !== undefined) updates.name_en = name_en;
      if (description_de !== undefined) updates.description_de = description_de;
      if (description_en !== undefined) updates.description_en = description_en;
      if (sku !== undefined) updates.sku = sku;
      if (base_price_cents !== undefined) updates.base_price_cents = base_price_cents;
      if (stock_quantity !== undefined) updates.stock_quantity = stock_quantity;
      if (active !== undefined) updates.active = active;
      if (image_url !== undefined) updates.image_url = image_url;

      const { data: updated, error } = await supabase
        .from('shop_products')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        console.error('❌ [ADMIN PRODUCT] Update error:', error);
        return res.status(500).json({ error: 'Failed to update product' });
      }

      return res.status(200).json(updated);
    }

    if (req.method === 'DELETE') {
      // Delete product
      const { error } = await supabase
        .from('shop_products')
        .delete()
        .eq('id', id);

      if (error) {
        console.error('❌ [ADMIN PRODUCT] Delete error:', error);
        return res.status(500).json({ error: 'Failed to delete product' });
      }

      return res.status(200).json({ message: 'Product deleted' });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('❌ [ADMIN PRODUCT] Error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
