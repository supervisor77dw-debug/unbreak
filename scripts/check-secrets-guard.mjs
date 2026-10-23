#!/usr/bin/env node
/**
 * Secret guard (AW-20261023-GE-CLAUDE-WEBSITE-SECURITY-001)
 *
 * 1. Fails if a NEXT_PUBLIC_* variable looks like a server secret
 *    (those values are inlined into every browser bundle).
 * 2. Fails if a JWT in a public/ file carries any role other than "anon".
 *
 * Never prints secret values. Runs in prebuild and CI.
 */
import fs from 'fs';
import path from 'path';

const errors = [];

// 1) NEXT_PUBLIC_* variables
const ALLOWED_PUBLIC = new Set([
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
  'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY',
  'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY_TEST',
  'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY_LIVE',
]);
const SECRETISH = /(SECRET|PRIVATE|PASSWORD|SERVICE|ADMIN|TOKEN|_KEY)/;
for (const name of Object.keys(process.env)) {
  if (name.startsWith('NEXT_PUBLIC_') && SECRETISH.test(name) && !ALLOWED_PUBLIC.has(name)) {
    errors.push(`${name} is set: NEXT_PUBLIC_ values are shipped to the browser. Remove it (use a server-only variable).`);
  }
}
const SECRET_VALUE = /(sb_secret_|sk_live_|sk_test_|rk_live_|whsec_|\bre_[A-Za-z0-9]{8,}_)/;
for (const [name, value] of Object.entries(process.env)) {
  if (name.startsWith('NEXT_PUBLIC_') && value && SECRET_VALUE.test(value)) {
    errors.push(`${name} contains a server secret format. Remove it.`);
  }
}

// 2) JWTs in public/
const JWT = /eyJ[A-Za-z0-9_-]{10,}\.(eyJ[A-Za-z0-9_-]{20,})\.[A-Za-z0-9_-]{20,}/g;
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(p);
    else if (/\.(html?|js|mjs|json|txt|md)$/i.test(entry.name)) {
      const text = fs.readFileSync(p, 'utf8');
      for (const m of text.matchAll(JWT)) {
        let role = '?';
        try {
          role = JSON.parse(Buffer.from(m[1], 'base64url').toString('utf8')).role || '?';
        } catch {}
        if (role !== 'anon') errors.push(`${p}: JWT with role "${role}" in a public file.`);
      }
      if (/sb_secret_[A-Za-z0-9_-]{10,}/.test(text)) errors.push(`${p}: Supabase secret key in a public file.`);
    }
  }
}
if (fs.existsSync('public')) walk('public');

if (errors.length) {
  console.error('\n❌ SECRET GUARD FAILED');
  for (const e of errors) console.error('  - ' + e);
  process.exit(1);
}
console.log('✅ Secret guard passed');
