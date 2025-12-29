/**
 * API Route: /api/config
 * Returns Supabase configuration for client-side use
 */

export default function handler(req, res) {
  res.setHeader('Content-Type', 'application/javascript');
  res.send(
    `window.SUPABASE_CONFIG = {
      url: "${process.env.NEXT_PUBLIC_SUPABASE_URL}",
      anonKey: "${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}"
    };`
  );
}
