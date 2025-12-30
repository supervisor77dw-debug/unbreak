/**
 * Admin Debug API - Get latest orders and webhook logs
 * Route: /api/admin/debug-orders
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch last 5 orders
    const { data: orders, error: ordersError } = await supabase
      .from('simple_orders')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(5);

    if (ordersError) throw ordersError;

    // Fetch last 10 webhook logs
    const { data: webhookLogs, error: logsError } = await supabase
      .from('webhook_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(10);

    // Don't fail if webhook_logs table doesn't exist yet
    const logs = logsError ? [] : webhookLogs;

    // Get webhook statistics
    const { data: webhookStats, error: statsError } = await supabase
      .from('webhook_logs')
      .select('status')
      .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

    const stats = statsError ? [] : webhookStats;
    const webhookSummary = {
      total_24h: stats.length,
      success: stats.filter(s => s.status === 'success').length,
      error: stats.filter(s => s.status === 'error').length,
      skipped: stats.filter(s => s.status === 'skipped').length,
    };

    res.status(200).json({
      success: true,
      timestamp: new Date().toISOString(),
      orders: orders || [],
      webhook_logs: logs || [],
      webhook_summary: webhookSummary,
      env_check: {
        supabase_url: !!supabaseUrl,
        supabase_service_key: !!supabaseServiceKey,
        stripe_secret: !!process.env.STRIPE_SECRET_KEY,
        stripe_webhook_secret: !!process.env.STRIPE_WEBHOOK_SECRET,
      }
    });

  } catch (error) {
    console.error('❌ [Debug API] Error:', error);
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
}
