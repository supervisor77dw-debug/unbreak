/**
 * ADMIN API: Shipping Rates
 * 
 * SSOT: Supabase Direct (shipping_rates table)
 * Migrated from Prisma to Supabase Direct (2026-01-19)
 * Reason: Prisma pooler unreachable locally
 */

import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]';
import { createClient } from '@supabase/supabase-js';
import { logDataSourceFingerprint } from '../../../lib/dataSourceFingerprint';

// Supabase Admin Client
const supabaseAdmin = createClient(
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

export default async function handler(req, res) {
  // Log SSOT fingerprint
  logDataSourceFingerprint('admin_shipping_rates', {
    readTables: req.method === 'GET' ? ['shipping_rates (Supabase)'] : [],
    writeTables: ['PUT', 'POST', 'DELETE'].includes(req.method) ? ['shipping_rates (Supabase)'] : [],
    note: 'SSOT: shipping_rates table via Supabase Direct',
  });

  const session = await getServerSession(req, res, authOptions);

  if (!session?.user || session.user.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Forbidden' });
  }

  // GET - List all shipping rates
  if (req.method === 'GET') {
    try {
      const { data: rates, error } = await supabaseAdmin
        .from('shipping_rates')
        .select('*')
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: true });

      if (error) throw error;

      // Map snake_case to camelCase for frontend compatibility
      const mappedRates = (rates || []).map(r => ({
        id: r.id,
        countryCode: r.country_code,
        labelDe: r.label_de,
        labelEn: r.label_en,
        priceNet: r.price_net,
        active: r.active,
        sortOrder: r.sort_order,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
      }));

      console.log(`✅ [SHIPPING API] Returned ${mappedRates.length} rates`);
      return res.status(200).json(mappedRates);
    } catch (error) {
      console.error('[API] Error fetching shipping rates:', error);
      return res.status(500).json({ error: 'Failed to fetch shipping rates' });
    }
  }

  // POST - Create new shipping rate
  if (req.method === 'POST') {
    try {
      const { countryCode, labelDe, labelEn, priceNet, active, sortOrder } = req.body;

      const { data: rate, error } = await supabaseAdmin
        .from('shipping_rates')
        .insert({
          country_code: countryCode,
          label_de: labelDe,
          label_en: labelEn,
          price_net: parseInt(priceNet) || 0,
          active: active !== false,
          sort_order: parseInt(sortOrder) || 0,
        })
        .select()
        .single();

      if (error) throw error;

      // Map to camelCase
      const mapped = {
        id: rate.id,
        countryCode: rate.country_code,
        labelDe: rate.label_de,
        labelEn: rate.label_en,
        priceNet: rate.price_net,
        active: rate.active,
        sortOrder: rate.sort_order,
        createdAt: rate.created_at,
        updatedAt: rate.updated_at,
      };

      console.log(`✅ [SHIPPING API] Created rate: ${countryCode}`);
      return res.status(201).json(mapped);
    } catch (error) {
      console.error('[API] Error creating shipping rate:', error);
      return res.status(500).json({ error: 'Failed to create shipping rate' });
    }
  }

  // PUT - Update shipping rate
  if (req.method === 'PUT') {
    try {
      const { id, countryCode, labelDe, labelEn, priceNet, active, sortOrder } = req.body;

      const { data: rate, error } = await supabaseAdmin
        .from('shipping_rates')
        .update({
          country_code: countryCode,
          label_de: labelDe,
          label_en: labelEn,
          price_net: parseInt(priceNet) || 0,
          active: active !== false,
          sort_order: parseInt(sortOrder) || 0,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      // Map to camelCase
      const mapped = {
        id: rate.id,
        countryCode: rate.country_code,
        labelDe: rate.label_de,
        labelEn: rate.label_en,
        priceNet: rate.price_net,
        active: rate.active,
        sortOrder: rate.sort_order,
        createdAt: rate.created_at,
        updatedAt: rate.updated_at,
      };

      console.log(`✅ [SHIPPING API] Updated rate: ${countryCode}`);
      return res.status(200).json(mapped);
    } catch (error) {
      console.error('[API] Error updating shipping rate:', error);
      return res.status(500).json({ error: 'Failed to update shipping rate' });
    }
  }

  // DELETE - Delete shipping rate
  if (req.method === 'DELETE') {
    try {
      const { id } = req.query;

      const { error } = await supabaseAdmin
        .from('shipping_rates')
        .delete()
        .eq('id', id);

      if (error) throw error;

      console.log(`✅ [SHIPPING API] Deleted rate: ${id}`);
      return res.status(200).json({ success: true });
    } catch (error) {
      console.error('[API] Error deleting shipping rate:', error);
      return res.status(500).json({ error: 'Failed to delete shipping rate' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
