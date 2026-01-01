#!/usr/bin/env node

/**
 * Supabase Migration Helper
 * Zeigt die SQL-Migration an und gibt Anleitung zur Ausführung
 */

const fs = require('fs');
const path = require('path');

console.log('╔═══════════════════════════════════════════════════════════════════╗');
console.log('║  📦 SUPABASE MIGRATION - Product Image Crop System                ║');
console.log('╚═══════════════════════════════════════════════════════════════════╝\n');

// Read migration file
const migrationPath = path.join(__dirname, 'supabase/migrations/005_add_image_focus.sql');

if (!fs.existsSync(migrationPath)) {
  console.error('❌ Migration file not found:', migrationPath);
  process.exit(1);
}

const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

console.log('📋 SCHRITT-FÜR-SCHRITT ANLEITUNG:\n');
console.log('1️⃣  Öffne Supabase Dashboard');
console.log('   → https://supabase.com/dashboard\n');

console.log('2️⃣  Wähle dein Projekt aus\n');

console.log('3️⃣  Navigiere zu: SQL Editor (linkes Menü)\n');

console.log('4️⃣  Klicke auf: "+ New query" oder nutze den Editor\n');

console.log('5️⃣  Kopiere die folgende SQL und füge sie ein:\n');
console.log('─'.repeat(70));
console.log(migrationSQL);
console.log('─'.repeat(70));
console.log('');

console.log('6️⃣  Klicke auf "RUN" (unten rechts im Editor)\n');

console.log('7️⃣  Überprüfe das Ergebnis:');
console.log('   ✅ Erfolgreich: "Success. No rows returned"');
console.log('   ❌ Fehler: Lies die Fehlermeldung und prüfe, ob Migration bereits lief\n');

console.log('8️⃣  Verifiziere die Spalten:');
console.log('   → Gehe zu: Table Editor → products');
console.log('   → Prüfe ob Spalten existieren:');
console.log('      • image_crop_scale (real/float)');
console.log('      • image_crop_x (int4/integer)');
console.log('      • image_crop_y (int4/integer)\n');

console.log('9️⃣  Teste ein Produkt:');
console.log('   → Wähle ein Produkt aus');
console.log('   → Prüfe Werte: scale=1.0, x=0, y=0 (Defaults)\n');

console.log('═'.repeat(70));
console.log('✅ NACH DER MIGRATION:\n');
console.log('1. Gehe zu: https://deine-app.vercel.app/backend/products');
console.log('2. Bearbeite ein Produkt');
console.log('3. Teste Zoom-Slider und Drag-Funktion');
console.log('4. Speichere und prüfe ob Werte persistiert werden\n');

console.log('💡 TIPP: Die SQL ist auch in der Datei:');
console.log('   ' + migrationPath + '\n');

// Option: SQL in Zwischenablage kopieren (Windows)
console.log('📋 SQL in Zwischenablage kopieren? (nur Windows)');
console.log('   Führe aus: Get-Content supabase\\migrations\\005_add_image_focus.sql | Set-Clipboard');
console.log('');
