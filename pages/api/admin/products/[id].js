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
        .from('products')
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
        name,
        description,
        sku,
        base_price_cents,
        active,
        image_url,
        image_crop_scale,
        image_crop_x,
        image_crop_y,
        badge_label,
        shipping_text,
        highlights,
      } = req.body;

      const updates = {
        updated_at: new Date().toISOString(),
      };

      if (name !== undefined) updates.name = name;
      if (description !== undefined) updates.description = description;
      if (sku !== undefined) updates.sku = sku;
      if (base_price_cents !== undefined) updates.base_price_cents = base_price_cents;
      if (active !== undefined) updates.active = active;
      if (image_url !== undefined) updates.image_url = image_url;
      if (image_crop_scale !== undefined) updates.image_crop_scale = image_crop_scale;
      if (image_crop_x !== undefined) updates.image_crop_x = image_crop_x;
      if (image_crop_y !== undefined) updates.image_crop_y = image_crop_y;
      if (badge_label !== undefined) updates.badge_label = badge_label;
      if (shipping_text !== undefined) updates.shipping_text = shipping_text;
      if (highlights !== undefined) updates.highlights = highlights;

      const { data: updated, error } = await supabase
        .from('products')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        console.error('❌ [ADMIN PRODUCT] Update error:', error);
        return res.status(500).json({ error: 'Failed to update product' });
      }

      // Wenn Crop geändert wurde UND Bild existiert → regenerate Thumbnails
      if ((image_crop_scale !== undefined || image_crop_x !== undefined || image_crop_y !== undefined) && updated.image_path) {
        console.log('[ADMIN PRODUCT] Crop changed - regenerating thumbnails...');
        
        const crop = {
          scale: image_crop_scale !== undefined ? image_crop_scale : updated.image_crop_scale,
          x: image_crop_x !== undefined ? image_crop_x : updated.image_crop_x,
          y: image_crop_y !== undefined ? image_crop_y : updated.image_crop_y,
        };

        // Regenerate thumbnails asynchronously (don't block response)
        ['thumb', 'shop'].forEach(async (size) => {
          try {
            await fetch(`${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/admin/products/generate-thumbnail`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                productId: updated.id,
                imagePath: updated.image_path,
                crop,
                size,
              }),
            });
            console.log(`[ADMIN PRODUCT] Thumbnail ${size} regenerated`);
          } catch (err) {
            console.error(`[ADMIN PRODUCT] Thumbnail ${size} error:`, err);
          }
        });
      }

      return res.status(200).json(updated);
    }

    if (req.method === 'DELETE') {
      // Delete product (or better: set active=false)
      const { error } = await supabase
        .from('products')
        .update({ active: false, updated_at: new Date().toISOString() })
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
