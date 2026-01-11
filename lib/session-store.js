/**
 * Shared Session Store for Config Session API
 * 
 * Uses Supabase for persistent storage (required for Vercel serverless)
 * Replaces in-memory Map which doesn't work across function invocations
 */

import { getSupabasePublic } from './supabase';

const TTL_MS = 2 * 60 * 60 * 1000; // 2 hours (increased from 45min)

/**
 * Save session to database
 * @param {string} sessionId - Unique session identifier
 * @param {object} data - Session data { lang, config, createdAt, expiresAt }
 * @returns {Promise<boolean>} Success
 */
export async function saveSession(sessionId, data) {
  try {
    const supabase = getSupabasePublic();
    
    const { error } = await supabase
      .from('config_sessions')
      .insert({
        session_id: sessionId,
        lang: data.lang || 'de',
        config: data.config,
        created_at: data.createdAt || new Date().toISOString(),
        expires_at: new Date(data.expiresAt || Date.now() + TTL_MS).toISOString(),
      });
    
    if (error) {
      console.error('[SESSION_STORE][SAVE] Error:', error);
      return false;
    }
    
    console.log('[SESSION_STORE][SAVE] Saved sessionId=', sessionId);
    return true;
  } catch (error) {
    console.error('[SESSION_STORE][SAVE] Exception:', error);
    return false;
  }
}

/**
 * Get session from database
 * @param {string} sessionId - Session identifier
 * @returns {Promise<object|null>} Session data or null
 */
export async function getSession(sessionId) {
  try {
    const supabase = getSupabasePublic();
    
    const { data, error } = await supabase
      .from('config_sessions')
      .select('*')
      .eq('session_id', sessionId)
      .gt('expires_at', new Date().toISOString())
      .single();
    
    if (error) {
      if (error.code === 'PGRST116') {
        // Not found
        console.log('[SESSION_STORE][GET] Not found: sessionId=', sessionId);
        return null;
      }
      console.error('[SESSION_STORE][GET] Error:', error);
      return null;
    }
    
    console.log('[SESSION_STORE][GET] Found sessionId=', sessionId);
    
    // Return in expected format
    return {
      lang: data.lang,
      config: data.config,
      createdAt: data.created_at,
      expiresAt: new Date(data.expires_at).getTime(),
    };
  } catch (error) {
    console.error('[SESSION_STORE][GET] Exception:', error);
    return null;
  }
}

/**
 * Delete session from database
 * @param {string} sessionId - Session identifier
 * @returns {Promise<boolean>} Success
 */
export async function deleteSession(sessionId) {
  try {
    const supabase = getSupabasePublic();
    
    const { error } = await supabase
      .from('config_sessions')
      .delete()
      .eq('session_id', sessionId);
    
    if (error) {
      console.error('[SESSION_STORE][DELETE] Error:', error);
      return false;
    }
    
    console.log('[SESSION_STORE][DELETE] Deleted sessionId=', sessionId);
    return true;
  } catch (error) {
    console.error('[SESSION_STORE][DELETE] Exception:', error);
    return false;
  }
}

/**
 * Check if session exists
 * @param {string} sessionId - Session identifier
 * @returns {Promise<boolean>}
 */
export async function hasSession(sessionId) {
  const session = await getSession(sessionId);
  return session !== null;
}

/**
 * Get TTL in milliseconds
 */
export function getTTL() {
  return TTL_MS;
}

/**
 * Get store stats (for debugging)
 */
export async function getStoreStats() {
  try {
    const supabase = getSupabasePublic();
    
    const now = new Date().toISOString();
    
    const { count: total } = await supabase
      .from('config_sessions')
      .select('*', { count: 'exact', head: true });
    
    const { count: active } = await supabase
      .from('config_sessions')
      .select('*', { count: 'exact', head: true })
      .gt('expires_at', now);
    
    const expired = (total || 0) - (active || 0);
    
    return {
      total: total || 0,
      active: active || 0,
      expired,
    };
  } catch (error) {
    console.error('[SESSION_STORE][STATS] Error:', error);
    return { total: 0, active: 0, expired: 0 };
  }
}

// Backward compatibility exports
export function getSessionStore() {
  // Return object with Map-like interface
  return {
    async get(sessionId) {
      return await getSession(sessionId);
    },
    async set(sessionId, data) {
      return await saveSession(sessionId, data);
    },
    async has(sessionId) {
      return await hasSession(sessionId);
    },
    async delete(sessionId) {
      return await deleteSession(sessionId);
    },
  };
}

