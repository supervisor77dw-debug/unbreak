import { requireAuth } from '../../../lib/auth-helpers';
import { getSupabaseAdmin } from '../../../lib/supabase';
import { logDataSourceFingerprint } from '../../../lib/dataSourceFingerprint';

export default async function handler(req, res) {
  // Log data source fingerprint
  logDataSourceFingerprint('admin_stats_api', {
    readTables: ['simple_orders', 'tickets'],
    writeTables: [],
  });

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const user = await requireAuth(req, res);
  if (!user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const supabase = getSupabaseAdmin();

  try {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterdayStart = new Date(todayStart);
    yesterdayStart.setDate(yesterdayStart.getDate() - 1);

    console.log('[ADMIN STATS] Fetching statistics from simple_orders...');

    // Orders today
    const { count: ordersToday } = await supabase
      .from('simple_orders')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', todayStart.toISOString());
    console.log('[ADMIN STATS] Orders today:', ordersToday);

    // Orders yesterday
    const { count: ordersYesterday } = await supabase
      .from('simple_orders')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', yesterdayStart.toISOString())
      .lt('created_at', todayStart.toISOString());
    console.log('[ADMIN STATS] Orders yesterday:', ordersYesterday);

    // Open tickets (placeholder - tickets table may not exist)
    let openTickets = 0;
    let newTicketsToday = 0;
    try {
      const { count: ticketCount } = await supabase
        .from('tickets')
        .select('*', { count: 'exact', head: true })
        .in('status', ['OPEN', 'IN_PROGRESS']);
      openTickets = ticketCount || 0;

      const { count: newTicketCount } = await supabase
        .from('tickets')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', todayStart.toISOString());
      newTicketsToday = newTicketCount || 0;
      console.log('[ADMIN STATS] Tickets - open:', openTickets, 'new today:', newTicketsToday);
    } catch (err) {
      console.log('[ADMIN STATS] Tickets table not available');
    }

    // Revenue today (paid orders - status='paid' OR paid_at IS NOT NULL)
    const { data: revenueOrdersToday } = await supabase
      .from('simple_orders')
      .select('total_amount_cents, status, paid_at')
      .gte('created_at', todayStart.toISOString());
    // Filter for paid orders (status='paid' or has paid_at timestamp)
    const paidOrdersToday = (revenueOrdersToday || []).filter(o => 
      o.status === 'paid' || o.paid_at !== null
    );
    const revenueToday = paidOrdersToday.reduce((sum, order) => sum + (order.total_amount_cents || 0), 0);
    console.log('[ADMIN STATS] Revenue today:', revenueToday, `(${paidOrdersToday.length} paid orders)`);

    // Revenue yesterday
    const { data: revenueOrdersYesterday } = await supabase
      .from('simple_orders')
      .select('total_amount_cents, status, paid_at')
      .gte('created_at', yesterdayStart.toISOString())
      .lt('created_at', todayStart.toISOString());
    const paidOrdersYesterday = (revenueOrdersYesterday || []).filter(o =>
      o.status === 'paid' || o.paid_at !== null
    );
    const revenueYesterday = paidOrdersYesterday.reduce((sum, order) => sum + (order.total_amount_cents || 0), 0);
    console.log('[ADMIN STATS] Revenue yesterday:', revenueYesterday, `(${paidOrdersYesterday.length} paid orders)`);

    // Pending orders (fulfillment_status = 'pending' or 'processing')
    const { count: pendingOrders } = await supabase
      .from('simple_orders')
      .select('*', { count: 'exact', head: true })
      .in('fulfillment_status', ['pending', 'processing', null]);
    console.log('[ADMIN STATS] Pending orders:', pendingOrders);

    // Calculate changes
    const ordersChange = ordersYesterday > 0 
      ? Math.round(((ordersToday - ordersYesterday) / ordersYesterday) * 100)
      : 0;

    const revenueChange = revenueYesterday > 0
      ? Math.round(((revenueToday - revenueYesterday) / revenueYesterday) * 100)
      : 0;

    console.log('[ADMIN STATS] Success - returning stats');

    res.status(200).json({
      ordersToday: ordersToday || 0,
      ordersChange,
      openTickets,
      ticketsChange: newTicketsToday,
      revenueToday,
      revenueChange,
      pendingOrders: pendingOrders || 0
    });

  } catch (error) {
    console.error('❌ [ADMIN STATS] Error:', {
      message: error.message,
      stack: error.stack,
    });
    res.status(500).json({ 
      error: 'Failed to fetch statistics',
      message: error.message,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
}
