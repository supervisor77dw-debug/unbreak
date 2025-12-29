#!/usr/bin/env node

/**
 * Generate runtime config for HTML files
 * Creates public/config.js with Supabase credentials
 */

const fs = require('fs');
const path = require('path');

// Load .env.local if running locally
if (!process.env.VERCEL && !process.env.CI) {
  require('dotenv').config({ path: path.join(process.cwd(), '.env.local') });
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY');
  process.exit(1);
}

const configContent = `// AUTO-GENERATED - DO NOT EDIT
// Generated at build time by scripts/generate-config.js
window.SUPABASE_CONFIG = {
  url: '${supabaseUrl}',
  anonKey: '${supabaseAnonKey}'
};
`;

const outputPath = path.join(process.cwd(), 'public', 'config.js');
fs.writeFileSync(outputPath, configContent, 'utf8');

console.log('✅ Generated public/config.js');
