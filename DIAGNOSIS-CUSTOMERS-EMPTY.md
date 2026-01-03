# 📊 DIAGNOSE ERGEBNIS - CUSTOMERS LEER

## Executive Summary

**ROOT CAUSE:** Migration 012 wurde NIE auf Production ausgeführt! Customer fields fehlen komplett in der Datenbank.

## A) SQL Proofs (via scripts/diagnose-customers.js)

### A1) Customers Table Count
```
✅ Total customers: 0
```

### A2) Orders Table Customer Fields  
```
❌ customer_email - column does not exist
❌ customer_name - column does not exist
❌ customer_phone - column does not exist
❌ stripe_customer_id - column does not exist
❌ billing_address - column does not exist (partially exists as shipping_address)
```

### A3) Database Schema Check
```
❌ customer_email - MISSING
❌ customer_name - MISSING
❌ customer_phone - MISSING
❌ stripe_customer_id - MISSING
✅ shipping_address - EXISTS
❌ billing_address - MISSING
```

## B) Warum ist customers leer?

**Grund 1: Migration nie ausgeführt**
- Migration file `supabase/migrations/012_extend_orders_customer_fields.sql` existiert im Code (Commit f65ba96)
- Aber: Supabase führt lokale Migrations NICHT automatisch aus
- Resultat: Die DB-Spalten wurden nie angelegt

**Grund 2: Webhook kann keine Daten speichern**
- Code in `pages/api/webhooks/stripe.js` versucht `customer_email`, `stripe_customer_id` etc. zu schreiben
- DB lehnt ab: "column does not exist"
- Webhook läuft durch (kein hard fail), aber Customer-Sync schlägt still fehl

**Grund 3: Backfill kann nicht funktionieren**
- Backfill-Tool in `pages/api/admin/customers/backfill.js` existiert
- Versucht `customer_email` etc. zu updaten
- Schlägt fehl: Spalten existieren nicht

## C) Was MUSS jetzt passieren (in dieser Reihenfolge)

### 1. MIGRATION 012 AUSFÜHREN (KRITISCH)

**Siehe:** [MIGRATION-012-EXECUTE-NOW.md](MIGRATION-012-EXECUTE-NOW.md)

**Schnellste Methode:**
1. Öffne: https://supabase.com/dashboard/project/qnzsdytdghfukrqpscsg/sql/new
2. Kopiere komplettes SQL aus `MIGRATION-012-EXECUTE-NOW.md`
3. Execute
4. Verify mit:
   ```sql
   SELECT column_name FROM information_schema.columns 
   WHERE table_name = 'orders' 
   AND column_name IN ('customer_email', 'customer_name', 'stripe_customer_id');
   ```

**Erwartetes Ergebnis:** 3 rows (alle 3 columns)

### 2. BACKFILL AUSFÜHREN

```bash
node scripts/run-backfill.js
```

**Was das macht:**
- Holt existierende Orders (bis zu 200)
- Lädt Stripe Customer-Daten via `checkout.sessions.retrieve()`
- Erstellt/updated `customers` table
- Verlinkt Orders mit Customer UUIDs
- Loggt: created, updated, errors

**Erwartetes Ergebnis:**
```
Customers Created: ~12 (basierend auf Test-Orders)
Orders Updated: ~12
Errors: 0
```

### 3. VERIFY (Diagnose erneut)

```bash
node scripts/diagnose-customers.js
```

**Erwartetes Ergebnis:**
```
✅ Total customers: 12
✅ customer_email exists
✅ customer_name exists
✅ stripe_customer_id exists
✅ 12 orders with customer_email
```

### 4. TEST ORDER (Webhook-Verification)

1. Gehe zu https://unbreak-one.vercel.app/konfigurator
2. Erstelle Test-Order
3. Complete checkout
4. Prüfe in Admin Panel → Customers
5. Neuer Customer sollte sofort erscheinen

**Wenn nicht:**
- Check Stripe Webhook Events (Dashboard → Developers → Webhooks)
- Check Vercel Logs für Webhook errors
- Check `scripts/diagnose-customers.js` für neuen customer

## D) UI Check

**File:** `pages/admin/customers/index.jsx` (oder ähnlich)

**Zu prüfen:**
- Query: `supabase.from('customers').select('*')`
- Keine falschen Filter wie `.eq('is_deleted', false)` (field existiert nicht)
- RLS Policy erlaubt admin read

**File:** `pages/api/admin/customers.js`

```javascript
const { data, error } = await supabaseAdmin
  .from('customers')
  .select(`
    id,
    email,
    name,
    phone,
    stripe_customer_id,
    shipping_address,
    billing_address,
    created_at
  `)
  .order('created_at', { ascending: false });
```

## E) Akzeptanzkriterium (PROOF OF FIX)

Nach Ausführung aller Schritte:

```bash
node scripts/diagnose-customers.js
```

**MUSS zeigen:**

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 CUSTOMER DIAGNOSIS - UNBREAK-ONE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🔍 A1) Customers Table Count:
✅ Total customers: 12 (oder mehr)

📋 Sample Customers:
1. kunde@example.com | Max Mustermann | Stripe: cus_xxx
2. ...

🔍 A2) Orders Table Customer Fields:
✅ Total orders: 12
   - With stripe_customer_id: 12
   - With customer_email: 12
   - With customer_name: 12

🔍 D) Database Schema Check:
✅ customer_email
✅ customer_name
✅ customer_phone
✅ stripe_customer_id
✅ billing_address
✅ shipping_address

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ DIAGNOSIS COMPLETE - ALL SYSTEMS OPERATIONAL
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

## F) Nächster Test-Checkout (Live-Verification)

1. Shop öffnen: https://unbreak-one.vercel.app/konfigurator
2. Produkt konfigurieren + checkout
3. Stripe Test Payment: `4242 4242 4242 4242`, 12/34, 123
4. Nach Success:
   - Webhook fired (check Stripe Dashboard)
   - Customer in DB (check `/admin/customers`)
   - Order linked to customer (check order details)

## G) Was wenn es immer noch nicht klappt?

**Checklist:**
- [ ] Migration 012 wirklich ausgeführt? (verify via SQL)
- [ ] Backfill wirklich gelaufen? (check logs)
- [ ] Webhook Endpoint erreichbar? (check Stripe Dashboard)
- [ ] STRIPE_WEBHOOK_SECRET korrekt? (check Vercel ENV)
- [ ] Service Role Key gesetzt? (webhook needs admin rights)
- [ ] RLS Policies erlauben inserts? (customers table)

**Debug Webhook:**
```javascript
// In pages/api/webhooks/stripe.js
console.log('[WEBHOOK DEBUG] Event:', event.type);
console.log('[WEBHOOK DEBUG] Customer ID:', session.customer);
console.log('[WEBHOOK DEBUG] Customer Email:', session.customer_details?.email);
console.log('[WEBHOOK DEBUG] Supabase Insert Result:', customerInsertError || 'SUCCESS');
```

**Deploy changes:**
```bash
git add pages/api/webhooks/stripe.js
git commit -m "DEBUG: Add webhook customer sync logging"
git push origin master
```

**Check Vercel Logs:**
- Gehe zu: https://vercel.com/your-project/logs
- Filter: `[WEBHOOK DEBUG]`
- Verify customer data is received and inserted

---

## TL;DR - Sofort-Anleitung

```bash
# 1. Migration ausführen (MANUAL via Supabase Dashboard)
# Siehe: MIGRATION-012-EXECUTE-NOW.md

# 2. Backfill
node scripts/run-backfill.js

# 3. Verify
node scripts/diagnose-customers.js

# 4. Test-Order erstellen (via Browser)
# https://unbreak-one.vercel.app/konfigurator
```

**Expected Timeline:**
- Migration: 2 Minuten (manual copy-paste)
- Backfill: 30 Sekunden (automatic)
- Verify: 10 Sekunden (diagnostic script)
- Test: 2 Minuten (checkout flow)

**Total: ~5 Minuten bis customers erscheinen**
