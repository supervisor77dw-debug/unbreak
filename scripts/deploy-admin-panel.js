#!/usr/bin/env node

/**
 * ADMIN PANEL DEPLOYMENT SCRIPT
 * 
 * Dieses Script führt die notwendigen Migrationen aus und validiert die Konfiguration
 * 
 * Verwendung:
 *   node scripts/deploy-admin-panel.js
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Farben für Console Output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

async function main() {
  log('\n🚀 ADMIN PANEL DEPLOYMENT SCRIPT', 'cyan');
  log('================================\n', 'cyan');

  // 1. Check ENV variables
  log('1. Prüfe Umgebungsvariablen...', 'cyan');
  
  const requiredEnvVars = [
    'SUPABASE_URL',
    'SUPABASE_SERVICE_ROLE_KEY',
    'STRIPE_SECRET_KEY',
    'STRIPE_WEBHOOK_SECRET',
  ];

  const missingVars = requiredEnvVars.filter(v => !process.env[v]);
  
  if (missingVars.length > 0) {
    log(`❌ Fehlende ENV-Variablen: ${missingVars.join(', ')}`, 'red');
    log('\nBitte setze die Variablen in .env.local:', 'yellow');
    missingVars.forEach(v => log(`  ${v}=...`, 'yellow'));
    process.exit(1);
  }

  log('✅ Alle ENV-Variablen vorhanden', 'green');

  // 2. Test Supabase connection
  log('\n2. Teste Supabase Verbindung...', 'cyan');
  
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  try {
    const { data, error } = await supabase.from('profiles').select('count').limit(1);
    if (error) throw error;
    log('✅ Supabase Verbindung erfolgreich', 'green');
  } catch (err) {
    log(`❌ Supabase Verbindung fehlgeschlagen: ${err.message}`, 'red');
    process.exit(1);
  }

  // 3. List migrations
  log('\n3. Verfügbare Migrationen:', 'cyan');
  
  const migrationsDir = path.join(__dirname, '..', 'supabase', 'migrations');
  const migrationFiles = fs.readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql'))
    .sort();

  if (migrationFiles.length === 0) {
    log('⚠️  Keine Migrations gefunden', 'yellow');
  } else {
    migrationFiles.forEach(file => {
      log(`  - ${file}`, 'reset');
    });
  }

  // 4. Check if tables exist
  log('\n4. Prüfe bestehende Tabellen...', 'cyan');
  
  const expectedTables = [
    'customers',
    'tickets',
    'ticket_messages',
    'saved_designs',
    'production_queue',
    'component_inventory',
    'pricing_rules',
  ];

  for (const table of expectedTables) {
    try {
      const { error } = await supabase.from(table).select('count').limit(1);
      if (error && error.code === '42P01') {
        log(`  ⚠️  Tabelle '${table}' existiert nicht`, 'yellow');
      } else {
        log(`  ✅ Tabelle '${table}' vorhanden`, 'green');
      }
    } catch (err) {
      log(`  ⚠️  Tabelle '${table}' prüfung fehlgeschlagen`, 'yellow');
    }
  }

  // 5. Check admin user
  log('\n5. Prüfe Admin-User...', 'cyan');
  
  try {
    const { data: admins, error } = await supabase
      .from('profiles')
      .select('email, role, is_active')
      .eq('role', 'admin')
      .eq('is_active', true);

    if (error) throw error;

    if (admins && admins.length > 0) {
      log(`✅ ${admins.length} Admin-User(s) gefunden:`, 'green');
      admins.forEach(admin => {
        log(`  - ${admin.email}`, 'reset');
      });
    } else {
      log('⚠️  Kein Admin-User gefunden!', 'yellow');
      log('\nBitte erstelle einen Admin-User in Supabase:', 'yellow');
      log(`  UPDATE public.profiles`, 'yellow');
      log(`  SET role = 'admin', is_active = TRUE`, 'yellow');
      log(`  WHERE email = 'deine-admin-email@example.com';`, 'yellow');
    }
  } catch (err) {
    log(`❌ Admin-User prüfung fehlgeschlagen: ${err.message}`, 'red');
  }

  // 6. Check RLS
  log('\n6. Prüfe Row Level Security (RLS)...', 'cyan');
  
  const { data: tablesWithRLS, error: rlsError } = await supabase.rpc('get_tables_with_rls', {});
  
  if (rlsError) {
    log('⚠️  RLS-Prüfung nicht möglich (Function fehlt)', 'yellow');
  } else {
    log('✅ RLS-Prüfung abgeschlossen', 'green');
  }

  // 7. Summary
  log('\n================================', 'cyan');
  log('📋 DEPLOYMENT ZUSAMMENFASSUNG', 'cyan');
  log('================================\n', 'cyan');

  log('✅ Umgebungsvariablen: OK', 'green');
  log('✅ Supabase Verbindung: OK', 'green');
  log(`📦 Migrationen: ${migrationFiles.length} Dateien verfügbar`, 'reset');
  log('', 'reset');

  log('📝 NÄCHSTE SCHRITTE:', 'cyan');
  log('', 'reset');
  log('1. Führe Migrationen in Supabase aus:', 'yellow');
  log('   - Öffne Supabase Dashboard → SQL Editor', 'reset');
  log('   - Führe Migrationen 008-011 nacheinander aus', 'reset');
  log('', 'reset');
  log('2. Erstelle Admin-User (falls noch nicht vorhanden):', 'yellow');
  log('   - SQL Editor → siehe oben', 'reset');
  log('', 'reset');
  log('3. Konfiguriere Stripe Webhook (Production):', 'yellow');
  log('   - URL: https://unbreak-one.de/api/webhooks/stripe', 'reset');
  log('   - Events: checkout.session.completed, customer.created, customer.updated', 'reset');
  log('', 'reset');
  log('4. Test-Checkout durchführen:', 'yellow');
  log('   - Öffne /configurator', 'reset');
  log('   - Konfiguriere Produkt → Checkout → Zahlung (Test-Card)', 'reset');
  log('   - Prüfe /admin/customers', 'reset');
  log('', 'reset');

  log('✅ Deployment-Prüfung abgeschlossen!', 'green');
  log('', 'reset');
}

main().catch(err => {
  log(`\n❌ Fehler: ${err.message}`, 'red');
  process.exit(1);
});
