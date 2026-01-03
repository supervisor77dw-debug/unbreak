# Customer Management Backfill - Run Guide

## ZWECK
Dieses Tool synchronisiert bestehende Orders zu Customers in der Datenbank.

## WAS ES TUT
1. Findet alle Orders ohne `stripe_customer_id` oder `customer_email`
2. Holt Kundendaten aus Stripe (via Checkout Sessions oder Payment Intents)
3. Erstellt/aktualisiert Customers in Supabase
4. Verlinkt Orders mit Customers
5. Aktualisiert Order-Felder (customer_email, customer_name, addresses, etc.)

## VORAUSSETZUNGEN
- Admin-Login im Admin Panel
- Stripe API Key korrekt konfiguriert
- Supabase Service Role Key korrekt konfiguriert
- Migration 012 wurde ausgeführt (siehe unten)

## SCHRITT 1: Migration ausführen

### Lokale Entwicklung (psql):
```bash
# Verbinden zu Supabase DB
psql "postgresql://postgres:[PASSWORD]@[PROJECT-REF].supabase.co:5432/postgres"

# Migration ausführen
\i supabase/migrations/012_extend_orders_customer_fields.sql
```

### Oder via Supabase Dashboard:
1. Gehe zu https://app.supabase.com/project/[PROJECT-ID]/editor
2. Öffne SQL Editor
3. Kopiere Inhalt von `supabase/migrations/012_extend_orders_customer_fields.sql`
4. Führe aus (Run)

## SCHRITT 2: Backfill ausführen

### Via Browser (empfohlen):
1. Login ins Admin Panel: https://your-domain.com/admin/login
2. Öffne Browser DevTools (F12)
3. Gehe zu Console Tab
4. Führe aus:

```javascript
fetch('/api/admin/customers/backfill', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  credentials: 'include'
})
.then(r => r.json())
.then(data => {
  console.log('✅ Backfill Complete!');
  console.log(`📊 Total orders: ${data.stats.totalOrders}`);
  console.log(`✅ Processed: ${data.stats.ordersProcessed}`);
  console.log(`👤 Customers created: ${data.stats.customersCreated}`);
  console.log(`👤 Customers updated: ${data.stats.customersUpdated}`);
  console.log(`📝 Orders updated: ${data.stats.ordersUpdated}`);
  console.log(`❌ Errors: ${data.stats.errors.length}`);
  if (data.errors) {
    console.error('Errors:', data.errors);
  }
})
.catch(err => console.error('❌ Backfill failed:', err));
```

### Via cURL (Alternative):
```bash
# Session Cookie aus Browser kopieren (DevTools → Application → Cookies → next-auth.session-token)
curl -X POST https://your-domain.com/api/admin/customers/backfill \
  -H "Cookie: next-auth.session-token=YOUR_SESSION_TOKEN" \
  -H "Content-Type: application/json"
```

## SCHRITT 3: Ergebnisse prüfen

### Customers Admin Panel:
1. Gehe zu https://your-domain.com/admin/customers
2. Prüfe, dass Kunden erscheinen
3. Öffne einen Kunden → sollte Orders zeigen

### Datenbank-Check (SQL):
```sql
-- Wie viele Customers haben wir?
SELECT COUNT(*) FROM customers;

-- Wie viele Orders haben Customer-Daten?
SELECT 
  COUNT(*) as total,
  COUNT(stripe_customer_id) as with_stripe_id,
  COUNT(customer_email) as with_email,
  COUNT(customer_id) as linked_to_customer
FROM orders;

-- Customers mit Orders
SELECT 
  c.email,
  c.name,
  c.total_orders,
  c.total_spent_cents / 100 as total_spent_eur
FROM customers c
WHERE c.total_orders > 0
ORDER BY c.total_spent_cents DESC;
```

## TROUBLESHOOTING

### "No orders need backfill"
- Alle Orders haben bereits customer_email oder stripe_customer_id
- Das ist OK! Bedeutet, dass Webhook korrekt funktioniert

### "Unauthorized - Admin only"
- Session abgelaufen → Neu einloggen
- Benutzer hat nicht ADMIN role → Nur ADMIN darf backfill ausführen

### "Stripe session fetch failed"
- Stripe Session ist älter als 30 Tage → Stripe löscht alte Sessions
- Fallback zu Payment Intent wird versucht
- Wenn beides fehlt: Order wird übersprungen

### Errors Array nicht leer
- Prüfe `data.errors` in der Response
- Typische Fehler:
  - Stripe API nicht erreichbar
  - Session/PaymentIntent nicht gefunden
  - Keine Customer-Daten verfügbar

## WIEDERHOLBARKEIT
- **IDEMPOTENT**: Kann mehrfach ausgeführt werden
- Bestehende Customers werden aktualisiert (nicht dupliziert)
- Limit: 100 Orders pro Run (Performance-Schutz)
- Bei mehr als 100 Orders: Mehrfach ausführen

## NACH DEM BACKFILL

### Neue Orders:
- Webhook synct automatisch → kein manueller Backfill nötig
- Checkout Sessions erstellen Stripe Customers → `customer_creation: 'always'`
- Webhook speichert Customer-Daten in Supabase

### Customer Stats (automatisch):
- `total_orders` wird via Database Trigger aktualisiert
- `total_spent_cents` wird berechnet
- `last_order_at` wird gesetzt

## ROLLBACK (falls nötig)
```sql
-- Customers-Verknüpfungen entfernen (VORSICHT!)
UPDATE orders SET customer_id = NULL, stripe_customer_id = NULL, customer_email = NULL;
UPDATE simple_orders SET customer_id = NULL, stripe_customer_id = NULL, customer_email = NULL;

-- Customers löschen (NUR wenn komplett neu starten!)
TRUNCATE TABLE customers CASCADE;
```

## MONITORING
```sql
-- Letzte Webhook Events prüfen
SELECT * FROM webhook_logs ORDER BY created_at DESC LIMIT 20;

-- Customer Sync Status prüfen
SELECT 
  status,
  COUNT(*) as count,
  MAX(created_at) as last_event
FROM webhook_logs
WHERE event_type = 'checkout.session.completed'
GROUP BY status;
```

## SUPPORT
- Logs in Vercel Functions Dashboard
- Supabase Logs in Supabase Dashboard
- Bei Problemen: Webhook-Logs Tabelle prüfen
