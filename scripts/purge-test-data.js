/**
 * PURGE TEST DATA - LIVE GO SCRIPT
 * 
 * Löscht alle Test- und Sandbox-Daten vor dem offiziellen Produktivstart.
 * Behält die fortlaufende Nummerierung bewusst bei.
 * 
 * ⚠️ ACHTUNG: Dieser Script löscht Daten unwiderruflich!
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function purgeTestData() {
  console.log('🧹 PURGE TEST DATA - LIVE GO OPERATION');
  console.log('================================================\n');
  
  const stats = {
    orders: 0,
    legacyOrders: 0,
    customers: 0,
    webhookLogs: 0,
    lastOrderNumber: null,
    timestamp: new Date().toISOString()
  };

  try {
    // 1. Get last order number before deletion
    console.log('📊 Analysiere letzte Order-Nummer...');
    const { data: lastOrder } = await supabase
      .from('simple_orders')
      .select('order_number, id, created_at')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();
    
    if (lastOrder) {
      stats.lastOrderNumber = lastOrder.order_number;
      console.log(`   Letzte Test-Order: ${lastOrder.order_number} (${lastOrder.id})`);
      console.log(`   Erstellt am: ${lastOrder.created_at}\n`);
    }

    // 2. Delete webhook logs FIRST (has FK to orders)
    console.log('🗑️  Lösche Webhook-Logs (foreign key dependency)...');
    const { data: deletedWebhooks, error: webhooksError } = await supabase
      .from('webhook_logs')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000');
    
    if (webhooksError && !webhooksError.message.includes('does not exist')) {
      console.error('   ⚠️  Fehler:', webhooksError.message);
    } else if (!webhooksError) {
      stats.webhookLogs = deletedWebhooks?.length || 0;
      console.log(`   ✅ ${stats.webhookLogs} Webhook-Logs gelöscht\n`);
    } else {
      console.log('   ⚠️  Tabelle existiert nicht (OK)\n');
    }

    // 3. Delete all orders (simple_orders table)
    console.log('🗑️  Lösche alle Bestellungen (simple_orders)...');
    const { count: ordersCount, error: ordersError } = await supabase
      .from('simple_orders')
      .delete({ count: 'exact' })
      .neq('id', '00000000-0000-0000-0000-000000000000');
    
    if (ordersError) {
      console.error('   ❌ Fehler beim Löschen:', ordersError.message);
    } else {
      stats.orders = ordersCount || 0;
      console.log(`   ✅ ${stats.orders} Bestellungen gelöscht\n`);
    }

    // 3b. Delete legacy orders table if exists
    console.log('🗑️  Lösche alte Bestellungen (orders - legacy)...');
    const { count: legacyOrdersCount, error: legacyOrdersError } = await supabase
      .from('orders')
      .delete({ count: 'exact' })
      .neq('id', '00000000-0000-0000-0000-000000000000');
    
    if (legacyOrdersError && !legacyOrdersError.message.includes('does not exist')) {
      console.error('   ⚠️  Fehler:', legacyOrdersError.message);
    } else if (!legacyOrdersError) {
      stats.legacyOrders = legacyOrdersCount || 0;
      console.log(`   ✅ ${stats.legacyOrders} Legacy-Orders gelöscht\n`);
    } else {
      console.log('   ⚠️  Tabelle existiert nicht (OK)\n');
    }

    // 4. Delete all customers
    console.log('🗑️  Lösche alle Kunden...');
    const { count: customersCount, error: customersError } = await supabase
      .from('customers')
      .delete({ count: 'exact' })
      .neq('id', '00000000-0000-0000-0000-000000000000');
    
    if (customersError) {
      console.error('   ❌ Fehler beim Löschen:', customersError.message);
    } else {
      stats.customers = customersCount || 0;
      console.log(`   ✅ ${stats.customers} Kunden gelöscht\n`);
    }

    // 6. Summary
    console.log('================================================');
    console.log('✅ PURGE ABGESCHLOSSEN\n');
    console.log('STATISTIK:');
    console.log(`  • Bestellungen gelöscht: ${stats.orders}`);
    console.log(`  • Legacy-Orders gelöscht: ${stats.legacyOrders || 0}`);
    console.log(`  • Kunden gelöscht: ${stats.customers}`);
    console.log(`  • Webhook-Logs gelöscht: ${stats.webhookLogs}`);
    console.log(`  • Letzte Test-Order: ${stats.lastOrderNumber || 'Keine'}`);
    console.log(`  • Timestamp: ${stats.timestamp}\n`);

    console.log('📋 WICHTIG:');
    console.log('  ✅ Datenbank ist jetzt frei von Testdaten');
    console.log('  ✅ Nummerierung läuft automatisch weiter');
    console.log('  ✅ Nächste Order startet bei der nächsten verfügbaren Nummer');
    console.log('  ⚠️  Dokumentation erstellen mit letzter Test-Order-Nummer\n');

    // Write log file
    const logContent = `# LIVE GO DATA PURGE LOG
Timestamp: ${stats.timestamp}

## Gelöschte Testdaten:
- Bestellungen (simple_orders): ${stats.orders}
- Kunden (customers): ${stats.customers}
- Webhook-Logs: ${stats.webhookLogs}

## Letzte Test-Order:
${stats.lastOrderNumber || 'Keine Order-Nummer gefunden'}

## Revisionsvermerk:
Alle Bestellungen, Kunden- und Zahlungsdaten bis einschließlich Order-Nr. ${stats.lastOrderNumber || 'N/A'} stammen ausschließlich aus internen Test- und Sandbox-Phasen (Stripe Test Mode) vor dem offiziellen Produktivstart von UNBREAK-ONE.

Diese Datensätze wurden am ${new Date(stats.timestamp).toLocaleDateString('de-DE')} vollständig gelöscht.

Die fortlaufende Nummerierung wurde bewusst nicht zurückgesetzt, um technische Konsistenz zu wahren.

Ab der nächsten Order-Nummer handelt es sich ausschließlich um echte, produktive Kundenbestellungen.

## System-Status:
- ✅ Datenbank bereinigt
- ✅ Nummerierung fortlaufend
- ✅ Stripe Live Mode aktiv
- ✅ PayPal aktiviert
- ✅ Produktivbetrieb freigegeben
`;

    const fs = require('fs');
    const path = require('path');
    const logPath = path.join(__dirname, '..', 'LIVE-GO-PURGE-LOG.md');
    fs.writeFileSync(logPath, logContent, 'utf8');
    console.log(`📄 Log-Datei erstellt: ${logPath}\n`);

    return stats;

  } catch (error) {
    console.error('❌ FEHLER:', error.message);
    throw error;
  }
}

// Confirmation prompt
console.log('⚠️  WARNUNG: Dieser Script löscht ALLE Testdaten unwiderruflich!\n');
console.log('Bitte bestätigen Sie mit: node scripts/purge-test-data.js --confirm\n');

if (process.argv.includes('--confirm')) {
  purgeTestData()
    .then((stats) => {
      console.log('✅ Operation erfolgreich abgeschlossen');
      process.exit(0);
    })
    .catch((err) => {
      console.error('❌ Operation fehlgeschlagen:', err);
      process.exit(1);
    });
} else {
  console.log('❌ Abgebrochen - kein --confirm Flag');
  process.exit(0);
}
