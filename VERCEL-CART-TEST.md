# VERCEL DEPLOYMENT TEST - Multi-Item Cart

## 🎯 Ziel
Multi-Item Warenkorb auf UNBREAK-ONE (Vercel) testen ohne lokalen Server.

---

## ✅ Deployment Vorbereitung

### 1. Supabase Setup (EINMALIG)

**Führe in Supabase SQL Editor aus:**

```sql
-- 1. Webhook Logs Tabelle erstellen
-- Datei: database/webhook-logs.sql
-- Kopiere den gesamten Inhalt und führe ihn aus
```

**Verifizierung:**
```sql
-- Prüfe ob Tabelle existiert
SELECT EXISTS (
  SELECT FROM information_schema.tables 
  WHERE table_name = 'webhook_logs'
);
-- Sollte: true zurückgeben
```

### 2. Git Commit + Vercel Deploy

```bash
# Alle Änderungen committen
git add .
git commit -m "UNBREAK-ONE: Multi-Item Cart + Admin Debug Dashboard

Features:
- Multi-item cart with localStorage persistence
- Shop page with 'Add to Cart' buttons
- Cart page with quantity controls
- Checkout API supports items[] array
- Webhook logging to database (webhook_logs table)
- Admin Debug Dashboard at /admin/debug
  - Shows latest 5 orders with items JSONB
  - Shows latest 10 webhook events
  - 24h webhook statistics
  - Auto-refresh option
- Enhanced webhook with DB logging
- Idempotent webhook handling

Testing:
- Use /admin/debug to monitor orders + webhooks
- Full multi-item flow on Vercel deployment"

git push
```

**Warte auf Vercel Deployment:**
- https://vercel.com/dashboard → UNBREAK-ONE → Deployments
- Warte bis Status: "Ready" ✅

---

## 🧪 TEST-ABLAUF (Production/Preview Deployment)

### 1. Admin Debug Dashboard öffnen

**URL:** https://unbreak-one.vercel.app/admin/debug

**Erwartung:**
- ✅ Seite lädt ohne Fehler
- ✅ "Environment Check" zeigt alle ✅
- ✅ "Latest Orders" zeigt bisherige Orders (oder leer)
- ✅ "Webhook Logs" zeigt bisherige Logs (oder Hinweis wenn Tabelle fehlt)

**Falls Tabelle fehlt:**
```
"No webhook logs yet. Table might not exist - run database/webhook-logs.sql"
```
→ Gehe zu Supabase → SQL Editor → Führe `database/webhook-logs.sql` aus

---

### 2. Multi-Item Cart Test

#### 2.1 Produkte zum Warenkorb hinzufügen

1. **Öffne:** https://unbreak-one.vercel.app/shop
2. **Klicke:** "In den Warenkorb" bei **Produkt A**
   - ✅ Cart Badge erscheint: 🛒 1
3. **Klicke:** "In den Warenkorb" bei **Produkt B** (anderes Produkt!)
   - ✅ Cart Badge aktualisiert: 🛒 2

#### 2.2 Warenkorb öffnen + Menge anpassen

1. **Klicke:** Auf 🛒 Badge (oder navigiere zu `/cart`)
2. **Bei Produkt B:** Klicke `+` Button
   - ✅ Menge erhöht auf 2
   - ✅ Zwischensumme aktualisiert
3. **Verifiziere:**
   - Produkt A: Menge 1
   - Produkt B: Menge 2
   - Gesamtsumme korrekt

#### 2.3 Checkout durchführen

1. **Klicke:** "Zur Kasse"
2. **Stripe Checkout öffnet sich**
3. **Verifiziere Line Items:**
   - ✅ Produkt A: 1x [Preis]
   - ✅ Produkt B: 2x [Preis]
   - ✅ Total korrekt

4. **Ausfüllen:**
   - Email: `test@example.com`
   - Karte: `4242 4242 4242 4242`
   - Ablauf: `12/34`
   - CVC: `123`
   - Name: `Test User`

5. **Zahlung abschließen**

---

### 3. Verifizierung (KRITISCH)

#### 3.1 Success Page

**Nach Redirect zu `/success.html`:**

✅ **Erwartung:**
- Order ID angezeigt
- **Beide Produkte** in der Liste:
  - Produkt A (1x)
  - Produkt B (2x)
- Gesamtsumme korrekt
- Erfolgsmeldung

#### 3.2 Admin Debug Dashboard

**Gehe zu:** https://unbreak-one.vercel.app/admin/debug

**Klicke:** "🔄 Refresh" Button

✅ **Erwartung - Latest Orders:**
| Feld | Erwartung |
|------|-----------|
| Status | **PAID** (grün) |
| Total | Korrekte Summe (z.B. 89.70 € für 1x29.90 + 2x29.90) |
| Items | "2 item(s)" → Klicke auf Details |
| Paid At | Timestamp (nicht "Not paid") |

**Items Details:**
```json
[
  {
    "id": "uuid-produkt-a",
    "sku": "SKU-XXX",
    "name": "Produkt A Name",
    "quantity": 1,
    "price_cents": 2990
  },
  {
    "id": "uuid-produkt-b",
    "sku": "SKU-YYY",
    "name": "Produkt B Name",
    "quantity": 2,
    "price_cents": 2990
  }
]
```

✅ **Erwartung - Webhook Logs:**
| Feld | Erwartung |
|------|-----------|
| Status | **SUCCESS** (grün) |
| Event Type | `checkout.session.completed` |
| Rows Affected | 1 |
| Error | ✓ (kein Fehler) |

---

### 4. Vercel Logs Verifizierung

**Gehe zu:** https://vercel.com/dashboard → UNBREAK-ONE → Logs

**Filter:** Letzte 1 Stunde

**Suche nach:**
```
[WEBHOOK HIT] Method: POST
[SIGNATURE] Verified OK
[SESSION] ID: cs_test_...
[DB UPDATE] Complete - Rows affected: 1
[ORDER] <id> paid
[WEBHOOK LOG] Event logged successfully
```

✅ **Erwartung:**
- Alle Marker vorhanden
- `rowCount=1` (nicht 0)
- Kein `❌` Error Marker

---

### 5. Stripe Dashboard Verifizierung

**Gehe zu:** https://dashboard.stripe.com/test/webhooks

**Klicke:** Auf deinen Webhook Endpoint
**Tab:** "Recent deliveries"

✅ **Erwartung:**
- Neuester Event: `checkout.session.completed`
- Status: **200 OK** ✅
- Response: `{"received":true,"event":"checkout.session.completed"}`
- Kein ❌ oder Retry

---

## 🎯 Erfolgs-Kriterien

✅ **Test erfolgreich wenn:**

1. **Cart Functionality:**
   - [x] 2 verschiedene Produkte hinzugefügt
   - [x] Menge geändert (1 und 2)
   - [x] Cart Badge aktualisiert live
   - [x] Cart Page zeigt korrekte Summen

2. **Checkout:**
   - [x] Stripe Session zeigt beide Line Items
   - [x] Mengen korrekt (1x und 2x)
   - [x] Zahlung erfolgreich

3. **Success Page:**
   - [x] Beide Produkte angezeigt
   - [x] Order ID sichtbar

4. **Database (Admin Debug):**
   - [x] Order Status = `paid`
   - [x] `paid_at` ist gesetzt (nicht NULL)
   - [x] `items` JSONB enthält 2 Objekte
   - [x] Total Amount korrekt

5. **Webhook:**
   - [x] Webhook Log Status = `success`
   - [x] `rows_affected = 1`
   - [x] Kein Error Message

6. **Vercel Logs:**
   - [x] `[WEBHOOK HIT] POST` vorhanden
   - [x] `[SIGNATURE] Verified OK` vorhanden
   - [x] `[DB UPDATE] rowCount=1` vorhanden
   - [x] Keine ❌ Errors

7. **Stripe:**
   - [x] Webhook Delivery 200 OK
   - [x] Kein Retry nötig

---

## 🚨 Troubleshooting

### Problem: "Invalid API key" in Admin Debug

**Lösung:**
1. Gehe zu Vercel Dashboard → UNBREAK-ONE → Settings → Environment Variables
2. Prüfe:
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `STRIPE_SECRET_KEY`
   - `STRIPE_WEBHOOK_SECRET`
3. Falls Keys fehlen/falsch: Aktualisieren + Redeploy

### Problem: Webhook Logs leer / "Table doesn't exist"

**Lösung:**
1. Supabase → SQL Editor
2. Führe aus: `database/webhook-logs.sql`
3. Refresh Admin Debug Dashboard

### Problem: Order bleibt "pending"

**Diagnose in Admin Debug:**
- Prüfe Webhook Logs → Status?
- Falls `error`: Lese Error Message
- Falls keine Logs: Webhook kommt nicht an

**Check:**
1. Stripe Dashboard → Webhooks → URL korrekt?
   - Muss: `https://unbreak-one.vercel.app/api/webhooks/stripe`
2. Vercel Logs → `[WEBHOOK HIT]` vorhanden?
3. Stripe → Recent Deliveries → 200 OK?

### Problem: Items sind NULL statt JSONB Array

**Ursache:** Alte Checkout-Version

**Lösung:**
- Neue Order erstellen (neuer Checkout)
- Alte Orders haben kein `items[]` Support

---

## 📊 Nächste Schritte nach erfolgreichem Test

- [ ] Email-Benachrichtigung nach Bestellung
- [ ] Admin Order Management UI
- [ ] Product Images in Cart
- [ ] "Continue Shopping" Button
- [ ] Order History für Kunden
- [ ] Inventory Management
