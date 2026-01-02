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
      const requestProductId = id; // CRITICAL: Lock productId from route params
      console.log('\n🔧 [PATCH START]', {
        productId: requestProductId,
        timestamp: new Date().toISOString(),
      });
      
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

      let { data: updated, error } = await supabase
        .from('products')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        console.error('❌ [ADMIN PRODUCT] Update error:', error);
        return res.status(500).json({ error: 'Failed to update product' });
      }
      
      // VERIFY: Confirm we updated the correct product
      if (updated.id !== requestProductId) {
        console.error('🚨 [CRITICAL] Product ID MISMATCH!', {
          expected: requestProductId,
          actual: updated.id,
        });
        return res.status(500).json({ error: 'Product ID mismatch - data corruption prevented' });
      }
      
      console.log('✅ [DB UPDATE] Product updated:', {
        productId: updated.id,
        sku: updated.sku,
        name: updated.name,
      });
      
      // VERIFY: Confirm we updated the correct product
      if (updated.id !== requestProductId) {
        console.error('🚨 [CRITICAL] Product ID MISMATCH!', {
          expected: requestProductId,
          actual: updated.id,
        });
        return res.status(500).json({ error: 'Product ID mismatch - data corruption prevented' });
      }
      
      console.log('✅ [DB UPDATE] Product updated:', {
        productId: updated.id,
        sku: updated.sku,
        name: updated.name,
      });

      // KRITISCH: Wenn Crop geändert wurde ODER Bild existiert aber shop_image_path fehlt → regenerate Thumbnails
      const cropChanged = (image_crop_scale !== undefined || image_crop_x !== undefined || image_crop_y !== undefined);
      const needsRegeneration = cropChanged || (!updated.shop_image_path && updated.image_path);
      
      if (needsRegeneration && updated.image_path) {
        console.log('\n🔄 [PATCH] Regenerating thumbnails for product:', updated.id, 'SKU:', updated.sku);
        if (cropChanged) {
          console.log('[ADMIN PRODUCT] Reason: Crop changed');
        }
        if (!updated.shop_image_path) {
          console.log('[ADMIN PRODUCT] Reason: shop_image_path missing - backfilling');
        }
        
        const crop = {
          scale: image_crop_scale !== undefined ? image_crop_scale : updated.image_crop_scale,
          x: image_crop_x !== undefined ? image_crop_x : updated.image_crop_x,
          y: image_crop_y !== undefined ? image_crop_y : updated.image_crop_y,
        };

        // Regenerate thumbnails + Update DB (synchron für korrekte Paths)
        // WICHTIG: 'shop' ZUERST generieren (für sofortige Preview im Admin)
        const thumbUpdates = {};
        
        for (const size of ['shop', 'thumb']) { // SHOP FIRST!
          try {
            // CRITICAL: Use requestProductId (not closure/state)
            console.log(`🖼️  [THUMBNAIL] Generating ${size} for productId:`, requestProductId);
            
            const thumbRes = await fetch(`${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/admin/products/generate-thumbnail`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                productId: requestProductId, // Use locked productId
                imagePath: updated.image_path,
                crop,
                size,
              }),
            });
            
            if (thumbRes.ok) {
              const thumbData = await thumbRes.json();
              
              // VERIFY: Path contains correct productId
              const pathContainsProductId = thumbData.thumbPath.includes(`derived/${requestProductId}/`);
              if (!pathContainsProductId) {
                console.error('🚨 [CRITICAL] Thumbnail path does NOT contain productId!', {
                  productId: requestProductId,
                  path: thumbData.thumbPath,
                });
                throw new Error('Thumbnail path corruption');
              }
              
              console.log(`✅ [THUMBNAIL] ${size} regenerated:`, {
                productId: requestProductId,
                path: thumbData.thumbPath,
              });
              
              // Sammle Paths für DB-Update
              if (size === 'thumb') thumbUpdates.thumb_path = thumbData.thumbPath;
              if (size === 'shop') thumbUpdates.shop_image_path = thumbData.thumbPath;
            } else {
              console.error(`[ADMIN PRODUCT] Thumbnail ${size} failed:`, await thumbRes.text());
            }
          } catch (err) {
            console.error(`[ADMIN PRODUCT] Thumbnail ${size} error:`, err);
          }
        }

        // Update DB mit neuen Thumbnail-Paths
        if (Object.keys(thumbUpdates).length > 0) {
          console.log('💾 [DB UPDATE] Saving thumbnail paths:', {
            productId: requestProductId,
            paths: thumbUpdates,
          });
          
          const { data: thumbUpdateResult, error: thumbError } = await supabase
            .from('products')
            .update(thumbUpdates)
            .eq('id', requestProductId) // Use locked productId
            .select();
          
          if (thumbError) {
            console.error('❌ [DB UPDATE] Failed to update thumbnail paths:', thumbError);
          } else if (!thumbUpdateResult || thumbUpdateResult.length === 0) {
            console.error('🚨 [CRITICAL] Thumbnail update affected 0 rows!', {
              productId: requestProductId,
            });
          } else {
            // VERIFY: Updated correct product
            const updatedProduct = thumbUpdateResult[0];
            if (updatedProduct.id !== requestProductId) {
              console.error('🚨 [CRITICAL] Thumbnail update hit WRONG product!', {
                expected: requestProductId,
                actual: updatedProduct.id,
              });
              throw new Error('Cross-product contamination detected');
            }
            
            console.log('✅ [DB UPDATE] Thumbnail paths saved:', {
              productId: updatedProduct.id,
              rowsAffected: thumbUpdateResult.length,
              paths: thumbUpdates,
            });
            
            // IMMUTABLE: Create new object instead of mutating
            updated = { ...updated, ...thumbUpdates };
          }
        }
      }
      
      // FINAL VERIFICATION: Ensure returned data matches request
      console.log('🎉 [PATCH SUCCESS]', {
        productId: updated.id,
        requestedId: requestProductId,
        match: updated.id === requestProductId,
        hasShopImage: !!updated.shop_image_path,
        hasThumb: !!updated.thumb_path,
      });

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
