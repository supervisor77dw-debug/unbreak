// Migration Helper: Add image_updated_at column
// Run this to generate SQL for Supabase Dashboard

const fs = require('fs');
const path = require('path');

const migrationFile = path.join(__dirname, 'supabase', 'migrations', '006_add_image_updated_at.sql');
const sql = fs.readFileSync(migrationFile, 'utf-8');

console.log('\n📋 KOPIERE DIESE SQL IN SUPABASE DASHBOARD:\n');
console.log('=' .repeat(60));
console.log(sql);
console.log('=' .repeat(60));
console.log('\n✅ SCHRITTE:');
console.log('1. Öffne: https://supabase.com/dashboard/project/<project>/sql');
console.log('2. Kopiere die SQL oben');
console.log('3. Klicke "Run"');
console.log('4. Verifiziere: Table Editor → products → Spalte "image_updated_at" vorhanden\n');

// Copy to clipboard (Windows PowerShell)
require('child_process').exec(`echo "${sql.replace(/"/g, '\\"')}" | clip`, (err) => {
  if (!err) console.log('💾 SQL wurde in Zwischenablage kopiert!\n');
});
