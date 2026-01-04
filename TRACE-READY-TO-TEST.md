# 🎯 E2E TRACE SYSTEM - READY TO TEST

## ✅ IMPLEMENTATION COMPLETE

Alle Code-Änderungen wurden erfolgreich implementiert. Das Trace-System ist vollständig integriert.

### Implementierte Komponenten

#### 1. Client-Side ✅
- [x] `public/configurator/trace-system.js` - Komplettes Trace-Framework
- [x] `public/configurator.html` - Script eingebunden
- [x] `public/checkout.js` - Vollständige Integration
  - Trace-ID Generierung
  - Config Snapshot Logging
  - API Call Logging
  - Response/Error Logging
  - Redirect Logging

#### 2. Server-Side ✅
- [x] `pages/api/checkout/create.js` - Trace Integration
  - trace_id Extraktion (Header + Body)
  - CHECKOUT_API_IN Logging
  - trace_id in Order speichern
  - ORDER_CREATED Logging
  - trace_id in Stripe Metadata
  - STRIPE_SESSION_CREATED Logging

- [x] `pages/api/webhooks/stripe.js` - Trace Integration
  - trace_id Extraktion aus Event Metadata
  - WEBHOOK_IN Logging
  - WEBHOOK_SESSION_DATA Logging
  - CUSTOMER_SYNC_START Logging
  - CUSTOMER_UPSERT_SUCCESS/ERROR Logging
  - ORDER_CUSTOMER_LINK_SUCCESS/ERROR Logging

#### 3. Database Schema ✅
- [x] `database/add-trace-id.sql` - Migration erstellt
  - Fügt `trace_id` zu `orders` hinzu
  - Fügt `trace_id` zu `simple_orders` hinzu
  - Indexe für Performance

---

## 🚀 DEPLOYMENT STEPS

### SCHRITT 1: Database Migrations (KRITISCH)

**Öffne Supabase Dashboard → SQL Editor**

#### A) Trace-ID Spalten hinzufügen
```bash
# File: database/add-trace-id.sql
```
Führe diese Migration aus, um `trace_id` Spalten zu beiden Order-Tabellen hinzuzufügen.

#### B) Fehlende Customer-Spalten hinzufügen
```bash
# File: database/RUN-THIS-NOW-complete-simple-orders-fix.sql
```
Führe diese Migration aus, um alle 13 fehlenden Spalten hinzuzufügen (customer_id, config_json, etc.).

**Verification:**
```sql
-- Check trace_id exists
SELECT column_name 
FROM information_schema.columns 
WHERE table_name = 'simple_orders' 
  AND column_name = 'trace_id';

-- Check customer columns exist
SELECT column_name 
FROM information_schema.columns 
WHERE table_name = 'simple_orders' 
  AND column_name IN ('customer_id', 'config_json', 'trace_id');
```

---

### SCHRITT 2: ENV Keys aktualisieren (KRITISCH)

**Du hast aktuell TRUNCATED/INVALID Keys in `.env.local`**

1. **Öffne Vercel Dashboard** → Project Settings → Environment Variables
2. **Kopiere VOLLSTÄNDIGE Werte:**
   - `SUPABASE_SERVICE_ROLE_KEY` (sollte 200+ chars sein, startet mit `eyJ...`)
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` (sollte 200+ chars sein, startet mit `eyJ...`)
   - Alle anderen Keys

3. **Füge in `.env.local` ein** (komplett ersetzen, nicht kürzen!)

4. **Validierung:**
```bash
node scripts/print-env-health.js
```
Sollte zeigen: "All 16 variables OK"

```bash
node scripts/test-supabase-connection.js
```
Sollte zeigen: "✅ Connection successful"

---

## 🧪 TESTING WORKFLOW

### Phase 1: Lokaler Test

#### 1. Dev Server starten
```bash
npm run dev
```

#### 2. Configurator mit Trace öffnen
```
http://localhost:3000/configurator.html?trace=1
```

**Du solltest sehen:**
- Schwarzes Debug-Panel (unten rechts)
- "Current Trace ID: [UUID]"
- "Export Logs" Button

#### 3. Checkout durchführen

**Actions:**
1. Wähle Farben (z.B. Base: Graphite, Top: Anthracite)
2. Klicke "Jetzt kaufen"
3. Stripe Checkout öffnet sich
4. **BEVOR du zahlst:** Klicke "Export Logs" im Debug Panel
5. Zahle mit Test-Karte: `4242 4242 4242 4242`, Datum: 12/34, CVV: 123
6. Warte auf Redirect zu Success-Page

**Erwartete Browser Console Logs:**
```
[TRACE] checkout_page_load - {...}
[TRACE] checkout_configured - {trace_id: "abc-123..."}
[TRACE] CHECKOUT_CONFIG_SNAPSHOT - {color: "graphite", ...}
[TRACE] CHECKOUT_API_CALL - {endpoint: "/api/checkout/create", ...}
[TRACE] CHECKOUT_API_SUCCESS - {order_id: "...", has_checkout_url: true}
[TRACE] CHECKOUT_REDIRECT - {url: "https://checkout.stripe.com...", ...}
```

---

### Phase 2: Server Logs prüfen

#### Vercel Function Logs
**Öffne:** Vercel Dashboard → Deployments → [Latest] → Functions

**Suche nach trace_id:**
Filter logs by: `[TRACE]`

**Erwartete Server Logs:**
```
[TRACE] CHECKOUT_API_IN - {trace_id: "abc-123...", has_config: true, ...}
[TRACE] ORDER_CREATED - {trace_id: "abc-123...", order_id: "...", config_color: "graphite", ...}
[TRACE] STRIPE_SESSION_CREATED - {trace_id: "abc-123...", session_id: "cs_...", ...}

[TRACE] WEBHOOK_IN - {trace_id: "abc-123...", event_type: "checkout.session.completed", ...}
[TRACE] WEBHOOK_SESSION_DATA - {trace_id: "abc-123...", email: "test@example.com", ...}
[TRACE] CUSTOMER_SYNC_START - {trace_id: "abc-123...", stripe_customer_id: "cus_...", ...}
[TRACE] CUSTOMER_UPSERT_SUCCESS - {trace_id: "abc-123...", customer_id: "...", ...}
[TRACE] ORDER_CUSTOMER_LINK_SUCCESS - {trace_id: "abc-123...", order_id: "...", customer_id: "..."}
```

---

### Phase 3: Database Verification

#### SQL Queries in Supabase Dashboard

**1. Finde Order by trace_id:**
```sql
SELECT 
  id,
  trace_id,
  status,
  customer_email,
  customer_name,
  customer_id,
  config_json->>'color' as single_color,
  config_json->>'colors' as colors_object,
  jsonb_pretty(config_json) as full_config,
  created_at
FROM public.simple_orders
WHERE trace_id = '<PASTE_YOUR_TRACE_ID_HERE>'
ORDER BY created_at DESC;
```

**Expected Result:**
- `trace_id` = deine UUID
- `customer_email` = test email
- `customer_id` = NOT NULL (UUID)
- `config_json` enthält NICHT "petrol" (sondern gewählte Farben)

**2. Check Customer wurde erstellt:**
```sql
SELECT 
  id,
  email,
  name,
  stripe_customer_id,
  created_at
FROM public.customers
WHERE email = '<TEST_EMAIL_FROM_CHECKOUT>'
ORDER BY created_at DESC
LIMIT 5;
```

**Expected Result:**
- Mindestens 1 Row
- `stripe_customer_id` = "cus_..." (von Stripe)
- `email` = deine Test-Email

**3. Check Order → Customer Link:**
```sql
SELECT 
  o.id as order_id,
  o.trace_id,
  o.customer_email,
  o.customer_id,
  c.email as customer_table_email,
  c.stripe_customer_id,
  c.name
FROM public.simple_orders o
LEFT JOIN public.customers c ON o.customer_id = c.id
WHERE o.trace_id = '<YOUR_TRACE_ID>'
ORDER BY o.created_at DESC;
```

**Expected Result:**
- `customer_id` = NOT NULL
- `customer_table_email` = matches `customer_email`
- `stripe_customer_id` = "cus_..."

---

### Phase 4: Stripe Dashboard Verification

#### 1. Öffne Stripe Dashboard
**Test Mode** → Events → Suche nach "checkout.session.completed"

#### 2. Klicke neuesten Event
**Prüfe Metadata:**
```json
{
  "trace_id": "abc-123...",
  "order_id": "...",
  "product_sku": "...",
  "config_json": "{...}"
}
```

**Screenshot:** Event Details mit Metadata

#### 3. Webhook Delivery prüfen
Events → [Your Event] → Webhooks → Suche nach deinem Webhook Endpoint

**Expected:**
- Status: ✅ Succeeded
- Response Code: 200
- Response Body: `{"received": true, "trace_id": "abc-123..."}`

**Screenshot:** Webhook Response

---

## 📸 DELIVERABLES CHECKLIST

Nach erfolgreichem Test sammle:

### 1. Browser Artifacts
- [ ] Exported trace logs JSON file (von "Export Logs" Button)
- [ ] Browser Console Screenshot (alle [TRACE] logs sichtbar)
- [ ] Network Tab Screenshot (POST /api/checkout/create mit trace_id header)

### 2. Server Logs
- [ ] Vercel Function Logs Screenshot (gefiltert nach trace_id)
- [ ] Alle [TRACE] Events sichtbar (API IN → ORDER CREATED → WEBHOOK → CUSTOMER SYNC)

### 3. Database Proofs
- [ ] SQL Result: Order by trace_id (zeigt korrekte Farben, customer_id)
- [ ] SQL Result: Customer by email (zeigt Stripe Customer ID)
- [ ] SQL Result: Join Order + Customer (zeigt vollständige Verknüpfung)

### 4. Stripe Evidence
- [ ] Stripe Event Screenshot (checkout.session.completed mit trace_id in metadata)
- [ ] Webhook Delivery Screenshot (200 OK, trace_id in response)

### 5. Test Documentation
- [ ] Repro-Schritte (nummeriert 1-10)
- [ ] Trace ID dokumentiert
- [ ] Test Email dokumentiert
- [ ] Timestamp dokumentiert

---

## 🐛 DEBUGGING GUIDE

### Problem 1: Colors still "Petrol"

**Check:**
1. Browser logs: Was zeigt `CHECKOUT_CONFIG_SNAPSHOT`?
   - Wenn korrekt → Problem ist server-side
   - Wenn "petrol" → Problem ist client-side (configurator state)

2. Server logs: Was zeigt `ORDER_CREATED`?
   ```
   config_color: "petrol" ← PROBLEM
   config_colors: {...}    ← Check this object
   ```

3. Database: Query `config_json`
   ```sql
   SELECT 
     trace_id,
     config_json->>'color' as single_color,
     config_json->'colors' as colors_object
   FROM simple_orders 
   WHERE trace_id = 'xxx';
   ```

**Solution Path:**
- Falls Browser = korrekt, Server = petrol → Problem in checkout.js (config override)
- Falls Browser = petrol → Problem in configurator.js (state nicht aktualisiert)

---

### Problem 2: Customer not created

**Check:**
1. Server logs: Suche `CUSTOMER_SYNC_START`
   - Nicht gefunden? → Webhook nie angekommen
   - Gefunden? → Weiter zu 2

2. Server logs: Suche `CUSTOMER_UPSERT_ERROR`
   - Gefunden? → Lies error message
   - Common: "column does not exist" → Migration nicht gelaufen

3. Database: Check RLS Policies
   ```sql
   SELECT * FROM pg_policies 
   WHERE tablename = 'customers';
   ```

**Solution Path:**
- Webhook nicht angekommen → Check Stripe Webhook Settings
- Column error → Run `RUN-THIS-NOW-complete-simple-orders-fix.sql`
- RLS error → Update Policy: `CREATE POLICY ... FOR INSERT ... USING (true)`

---

### Problem 3: trace_id = NULL in database

**Check:**
1. Migration gelaufen?
   ```sql
   SELECT column_name 
   FROM information_schema.columns 
   WHERE table_name = 'simple_orders' 
     AND column_name = 'trace_id';
   ```
   
2. Server logs: Was zeigt `CHECKOUT_API_IN`?
   - Kein trace_id? → Client sendet nicht

3. Browser Network Tab:
   - Request Headers: `X-Trace-ID` vorhanden?
   - Request Body: `trace_id` vorhanden?

**Solution Path:**
- Column fehlt → Run `database/add-trace-id.sql`
- Header fehlt → Check checkout.js Zeile ~230
- Body fehlt → Check checkout.js Zeile ~235

---

## 🎯 SUCCESS CRITERIA

Ein **erfolgreicher** Trace zeigt:

### Client ✅
- [ ] Debug UI sichtbar mit UUID
- [ ] Config Snapshot mit korrekten Farben
- [ ] API Call logged
- [ ] Response logged
- [ ] Redirect logged
- [ ] Export funktioniert (JSON Download)

### Server ✅
- [ ] CHECKOUT_API_IN mit trace_id
- [ ] ORDER_CREATED mit korrektem config_json
- [ ] STRIPE_SESSION_CREATED mit trace_id
- [ ] WEBHOOK_IN mit trace_id (aus metadata)
- [ ] CUSTOMER_UPSERT_SUCCESS
- [ ] ORDER_CUSTOMER_LINK_SUCCESS

### Database ✅
- [ ] Order exists mit trace_id
- [ ] config_json zeigt NICHT "petrol" (sondern gewählte Farben)
- [ ] customer_id ist NOT NULL
- [ ] Customer Row existiert in customers table
- [ ] customer_email matches

### Stripe ✅
- [ ] Event Metadata enthält trace_id
- [ ] Webhook Delivery = 200 OK
- [ ] Webhook Response enthält trace_id

---

## 🚨 CRITICAL BLOCKERS

**BEFORE TESTING - Diese müssen erledigt sein:**

### 1. Database Migrations ❌
**Status:** Nicht ausgeführt
**Action:** Run beide SQL files in Supabase Dashboard
```
database/add-trace-id.sql
database/RUN-THIS-NOW-complete-simple-orders-fix.sql
```

### 2. ENV Keys ❌
**Status:** Truncated/Invalid (41 chars statt 200+)
**Action:** Copy COMPLETE keys from Vercel to .env.local

### 3. Local Dev Server ❓
**Action:** 
```bash
npm run dev
```
Server muss auf Port 3000 laufen.

---

## 📚 REFERENCE FILES

### Implementation Guides
- `TRACE-IMPLEMENTATION-GUIDE.md` - Komplette 7-Phasen Anleitung
- `TRACE-QUICK-START.md` - Diese Datei (Quick Reference)
- `ENV_TEMPLATE.local.txt` - ENV Variables Template

### Code Files (Modified)
- `public/configurator/trace-system.js` - Client Trace Library
- `public/checkout.js` - Client Integration
- `pages/api/checkout/create.js` - Server Integration
- `pages/api/webhooks/stripe.js` - Webhook Integration

### Database Files
- `database/add-trace-id.sql` - Trace ID Migration
- `database/RUN-THIS-NOW-complete-simple-orders-fix.sql` - Complete Schema Fix

### Tools
- `scripts/print-env-health.js` - ENV Validation (ohne Secrets zu leaken)
- `scripts/test-supabase-connection.js` - Connection Test

---

## 🎬 NEXT STEPS

1. **RUN MIGRATIONS** (5 min)
   - Supabase Dashboard → SQL Editor
   - Execute both migration files
   - Verify with SELECT queries

2. **FIX ENV KEYS** (5 min)
   - Vercel Dashboard → Copy keys
   - Paste into .env.local
   - Run print-env-health.js

3. **START DEV SERVER** (1 min)
   ```bash
   npm run dev
   ```

4. **PERFORM TEST CHECKOUT** (10 min)
   - Open configurator?trace=1
   - Change colors
   - Complete checkout
   - Export logs BEFORE redirect

5. **COLLECT EVIDENCE** (15 min)
   - Browser logs + export
   - Vercel logs (filter by trace_id)
   - SQL queries (3 queries above)
   - Stripe screenshots (event + webhook)

6. **DOCUMENT RESULTS** (10 min)
   - Create `logs/trace-[trace_id].md`
   - Include all screenshots
   - Numbered repro steps
   - Pass/Fail for each criterion

---

**Total Time to Full Test:** ~45 minutes (inkl. Setup)

**Bei Problemen:** Siehe "DEBUGGING GUIDE" Abschnitt oben.
