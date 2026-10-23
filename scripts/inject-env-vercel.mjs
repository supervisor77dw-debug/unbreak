#!/usr/bin/env node
/**
 * Runs scripts/inject-env.js only on Vercel builds, so local builds never
 * write key values into tracked files under public/.
 * public/*.html keep YOUR_SUPABASE_URL / YOUR_SUPABASE_ANON_KEY placeholders in Git;
 * the publishable (anon) key comes from NEXT_PUBLIC_SUPABASE_ANON_KEY at build time.
 */
import { createRequire } from 'module';

if (process.env.VERCEL === '1') {
  createRequire(import.meta.url)('./inject-env.js');
} else {
  console.log('⏭️  inject-env skipped (not a Vercel build)');
}
