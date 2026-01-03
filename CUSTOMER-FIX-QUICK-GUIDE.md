# 🚨 CUSTOMER MANAGEMENT - SOFORT-ANLEITUNG

## Problem identifiziert
**Customers sind leer, weil Migration 012 NIE ausgeführt wurde!**

Die customer fields (`customer_email`, `customer_name`, `stripe_customer_id`, etc.) existieren NICHT in der Production-Datenbank.

## Beweis (Diagnose-Output)

```bash
node scripts/diagnose-customers.js
```

**Ergebnis:**
```
✅ Total customers: 0

❌ customer_email - column does not exist
❌ customer_name - column does not exist
❌ customer_phone - column does not exist
❌ stripe_customer_id - column does not exist
❌ billing_address - column does not exist
```

## 3-Schritt Fix (5 Minuten)

### Schritt 1: Migration 012 ausführen (2 Min)

**Via Supabase Dashboard:**

1. Öffne: https://supabase.com/dashboard/project/qnzsdytdghfukrqpscsg/sql/new

2. Kopiere komplettes SQL aus: [MIGRATION-012-EXECUTE-NOW.md](MIGRATION-012-EXECUTE-NOW.md)

3. Paste in SQL Editor → Run

4. Verify:
   ```sql
   SELECT column_name FROM information_schema.columns 
   WHERE table_name = 'orders' 
   AND column_name IN ('customer_email', 'customer_name', 'stripe_customer_id', 'billing_address', 'customer_phone');
   ```
   
   **Expected: 5 rows (all columns present)**

### Schritt 2: Backfill ausführen (30 Sek)

```bash
node scripts/run-backfill.js
```

**Was passiert:**
- Lädt bestehende Orders (~12)
- Holt Customer-Daten von Stripe
- Erstellt Customers in DB
- Verlinkt Orders mit Customers

**Expected Output:**
```
Customers Created: 12
Orders Updated: 12
Errors: 0
```

### Schritt 3: Verify (10 Sek)

```bash
node scripts/diagnose-customers.js
```

**Expected Output:**
```
✅ Total customers: 12
✅ customer_email exists
✅ customer_name exists
✅ 12 orders with customer_email
```

**Admin Panel:**
- Gehe zu: https://unbreak-one.vercel.app/admin/customers
- Customers sollten jetzt erscheinen

## Test: Neuer Checkout (2 Min)

1. https://unbreak-one.vercel.app/konfigurator
2. Produkt konfigurieren
3. Checkout → Stripe Test Card: `4242 4242 4242 4242`
4. Nach Success:
   - Check Admin Panel → Customers (neuer Customer)
   - Check Order Details (linked to customer)

## Was wenn es nicht klappt?

**Migration nicht ausgeführt:**
```bash
# Verify in Supabase SQL Editor:
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'orders' 
AND column_name = 'customer_email';
```
- No rows? → Migration nicht gelaufen, erneut versuchen

**Backfill failed:**
- Check script output für errors
- Verify STRIPE_SECRET_KEY gesetzt ist
- Check Stripe Dashboard für session IDs

**Webhook nicht fired:**
- Stripe Dashboard → Developers → Webhooks
- Check response codes (should be 200)
- Check Events für checkout.session.completed

**Customers immer noch leer:**
- Check RLS policies: customers table readable by admin
- Check UI: `/api/admin/customers` returns data
- Check logs: Vercel → Functions → webhooks/stripe

## Dateien erstellt

1. `scripts/diagnose-customers.js` - DB diagnosis tool
2. `scripts/run-backfill.js` - Backfill runner
3. `MIGRATION-012-EXECUTE-NOW.md` - Copy-paste SQL
4. `DIAGNOSIS-CUSTOMERS-EMPTY.md` - Full analysis
5. Dieses File - Quick guide

## Code-Status

**Bereits implementiert (aber inaktiv ohne Migration):**
- ✅ Webhook synct Customers (`syncStripeCustomerToSupabase()`)
- ✅ Checkout erstellt customer fields
- ✅ Backfill-Tool (`/api/admin/customers/backfill`)
- ✅ Admin UI (`/admin/customers`)

**Fehlt nur:**
- ❌ Migration 012 auf Production ausführen

## Nächste Schritte

Nach erfolgreicher Migration + Backfill:

1. ✅ Migration 012 als "applied" markieren
2. ✅ Deployment Checklist updaten
3. ✅ Health-Check Endpoint mit migration status
4. ✅ Monitoring für customer creation

---

**TL;DR:**
```bash
# 1. Run SQL in Supabase Dashboard (see MIGRATION-012-EXECUTE-NOW.md)
# 2. Then:
node scripts/run-backfill.js
# 3. Verify:
node scripts/diagnose-customers.js
# 4. Check admin panel
open https://unbreak-one.vercel.app/admin/customers
```

**Total Zeit: ~5 Minuten bis Customers erscheinen**
