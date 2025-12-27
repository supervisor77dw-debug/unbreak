/**
 * UNBREAK ONE - Admin API: Update Product
 * ========================================
 * Purpose: Allow admins to update product details
 * Security: Requires admin role, uses service_role key
 * Route: POST /api/admin/products/update
 */

import { requireRole } from '../../../../lib/auth-server.js';
import { supabaseAdmin } from '../../../../lib/auth-server.js';

export default async function handler(req, res) {
  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Verify admin authentication
    const { user, profile, error: authError } = await requireRole(req, res, ['admin']);

    if (authError) {
      // Response already sent by requireRole middleware
      return;
    }

    // Get request body
    const { 
      productId, 
      name_de, 
      name_en,
      description_de, 
      description_en,
      base_price_cents,
      active
    } = req.body;

    // Validate input
    if (!productId) {
      return res.status(400).json({ 
        error: 'Missing required field: productId'
      });
    }

    // Build update object (only include provided fields)
    const updates = {
      updated_at: new Date().toISOString()
    };

    if (name_de !== undefined) updates.name_de = name_de;
    if (name_en !== undefined) updates.name_en = name_en;
    if (description_de !== undefined) updates.description_de = description_de;
    if (description_en !== undefined) updates.description_en = description_en;
    if (active !== undefined) updates.active = active;

    // Price validation (if provided)
    if (base_price_cents !== undefined) {
      const price = parseInt(base_price_cents);
      if (isNaN(price) || price < 0) {
        return res.status(400).json({ 
          error: 'Invalid base_price_cents - must be a positive integer'
        });
      }
      updates.base_price_cents = price;
    }

    // Check if product exists
    const { data: existingProduct, error: checkError } = await supabaseAdmin
      .from('products')
      .select('id, sku')
      .eq('id', productId)
      .single();

    if (checkError || !existingProduct) {
      return res.status(404).json({ 
        error: 'Product not found',
        productId
      });
    }

    // Update product
    const { data: updatedProduct, error: updateError } = await supabaseAdmin
      .from('products')
      .update(updates)
      .eq('id', productId)
      .select()
      .single();

    if (updateError) {
      console.error('Product update error:', updateError);
      return res.status(500).json({ 
        error: 'Failed to update product',
        details: updateError.message
      });
    }

    // Success
    return res.status(200).json({
      success: true,
      message: `Product ${existingProduct.sku} updated successfully`,
      product: updatedProduct
    });

  } catch (error) {
    console.error('Update product API error:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  }
}
