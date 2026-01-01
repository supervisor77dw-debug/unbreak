/**
 * RUN SUPABASE MIGRATION 007: Thumbnail Paths
 * 
 * Usage: node run-thumbnail-migration.js
 * 
 * Kopiert SQL in Clipboard → Einfügen in Supabase SQL Editor
 */

const fs = require('fs');
const path = require('path');

const migrationPath = path.join(__dirname, 'supabase', 'migrations', '007_add_thumbnail_paths.sql');
const sql = fs.readFileSync(migrationPath, 'utf-8');

console.log('\n📋 MIGRATION SQL (kopiere das in Supabase SQL Editor):\n');
console.log('='.repeat(80));
console.log(sql);
console.log('='.repeat(80));
console.log('\n✅ Fertig! SQL in Clipboard (oder manuell kopieren)');

// Optional: In Clipboard kopieren (Windows)
if (process.platform === 'win32') {
  const proc = require('child_process').spawn('clip');
  proc.stdin.write(sql);
  proc.stdin.end();
  console.log('✅ SQL wurde in Clipboard kopiert!');
}
