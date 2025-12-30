import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { session_id } = req.query;

  if (!session_id) {
    console.warn('⚠️ [Verify] No session_id provided');
    return res.status(400).json({ error: 'session_id required' });
  }

  console.log('🔍 [Verify] Looking up order by session_id:', session_id);

  try {
    const { data: order, error } = await supabase
      .from('simple_orders')
      .select('*')
      .eq('stripe_session_id', session_id)
      .single();

    if (error) {
      console.error('❌ [Verify] Order lookup failed:', error.message);
      console.error('❌ [Verify] Error code:', error.code);
      return res.status(404).json({ 
        error: 'Order not found',
        session_id: session_id
      });
    }

    if (!order) {
      console.error('❌ [Verify] No order found for session:', session_id);
      return res.status(404).json({ 
        error: 'Order not found',
        session_id: session_id
      });
    }

    console.log('✅ [Verify] Order found:', order.id);
    console.log('✅ [Verify] Status:', order.status);
    console.log('✅ [Verify] Total:', order.total_amount_cents);
    console.log('✅ [Verify] Items:', order.items ? `${order.items.length} items` : 'No items (legacy)');

    // Format items for frontend
    let formattedItems = [];
    if (order.items && Array.isArray(order.items)) {
      formattedItems = order.items.map(item => ({
        name: item.name,
        quantity: item.quantity,
        unit_price_cents: item.price_cents || item.unit_price_cents,
      }));
    }

    return res.status(200).json({
      order_id: order.id,
      status: order.status,
      total_amount_cents: order.total_amount_cents,
      items: formattedItems,
      created_at: order.created_at,
      paid_at: order.paid_at,
    });

  } catch (error) {
    console.error('❌ [Verify] Unexpected error:', error);
    console.error('❌ [Verify] Stack:', error.stack);
    return res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  }
}
