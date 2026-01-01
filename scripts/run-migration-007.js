/**
 * Run Supabase Migration 007 - Add Thumbnail Paths
 * 
 * This script copies the SQL to your clipboard.
 * Then paste it into Supabase Dashboard → SQL Editor → Run
 */

const fs = require('fs');
const path = require('path');
const clipboardy = require('clipboardy');

const migrationPath = path.join(__dirname, '..', 'supabase', 'migrations', '007_add_thumbnail_paths.sql');
const sql = fs.readFileSync(migrationPath, 'utf8');

console.log('📋 Migration 007 SQL:\n');
console.log('─'.repeat(60));
console.log(sql);
console.log('─'.repeat(60));

// Try to copy to clipboard
try {
  clipboardy.writeSync(sql);
  console.log('\n✅ SQL copied to clipboard!');
  console.log('\n📌 Next steps:');
  console.log('1. Open Supabase Dashboard: https://supabase.com/dashboard');
  console.log('2. Go to: SQL Editor');
  console.log('3. Paste the SQL (Ctrl+V)');
  console.log('4. Click "Run"');
  console.log('5. Then run: node scripts/backfill-thumbnails.js\n');
} catch (err) {
  console.log('\n⚠️  Could not copy to clipboard (clipboardy not installed)');
  console.log('📋 Please copy the SQL above manually and paste it into Supabase Dashboard → SQL Editor\n');
}
