/**
 * API Route: /api/config
 * Returns Supabase configuration for client-side use
 */

export default function handler(req, res) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return res.status(500).json({ 
      error: 'Missing Supabase configuration' 
    });
  }

  // Return as JavaScript that sets window.SUPABASE_CONFIG
  res.setHeader('Content-Type', 'application/javascript');
  res.status(200).send(`window.SUPABASE_CONFIG = {
  url: '${supabaseUrl}',
  anonKey: '${supabaseAnonKey}'
};`);
}
