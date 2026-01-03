# ADMIN-PANEL FINALISIERUNG – TESTING & DEPLOYMENT GUIDE

**Projekt:** UNBREAK ONE Admin Panel  
**Datum:** 2026-01-03  
**Status:** Priorität 1 (Customers) ✅ Implementiert

---

## 📋 Implementierungs-Übersicht

### ✅ ABGESCHLOSSEN (Priorität 1 – Customers)

#### 1. Datenbank-Migrationen
- `008_create_customers_extended.sql` – Customers Tabelle mit Stripe Sync
- `009_extend_profiles_rbac.sql` – RBAC mit Rollen (admin, ops, support, designer, finance)
- `010_create_tickets_system.sql` – Tickets & Messages
- `011_create_configurator_backoffice.sql` – Designs, Production Queue, Components, Pricing

#### 2. Stripe Integration
- **Checkout Session** (`pages/api/checkout/create.js`)
  - `customer_creation: 'always'` → Kunden werden immer in Stripe erstellt
  - `customer_email` wird gesetzt
  - `customer_id` in metadata für Webhook-Sync

- **Webhook Handler** (`pages/api/webhooks/stripe.js`)
  - `checkout.session.completed` → Sync Customer zu Supabase
  - `customer.created` → Upsert in Supabase
  - `customer.updated` → Update in Supabase
  - Idempotente Verarbeitung (duplikatsicher)

#### 3. Admin API Endpoints
- `GET /api/admin/customers` – Liste mit Suche, Pagination, Sortierung
- `GET /api/admin/customers/[id]` – Detail mit Order-Historie + Tickets
- `PATCH /api/admin/customers/[id]` – Update Customer Daten

#### 4. Admin UI (React)
- `/admin/customers` – Liste mit Filter, Suche, Pagination
- `/admin/customers/[id]` – Detail-Seite mit Tabs (Orders, Tickets)

#### 5. Auth Helpers
- `requireAdminAuth()` – Neue Supabase-basierte Auth mit Rollen-Check
- RLS Policies in allen Tabellen implementiert

---

## 🧪 TESTING GUIDE

### **Test 1: Datenbank-Migrationen ausführen**

```bash
# Im Projekt-Verzeichnis
cd c:\Users\dirk\Dropbox\projekte\Antigravity\Unbreak_One

# Migrationen ausführen (via Supabase CLI oder manuell)
# Option 1: Supabase CLI (empfohlen)
supabase db push

# Option 2: Manuell in Supabase Dashboard → SQL Editor
# Führe Migrationen 008-011 nacheinander aus
```

**Erwartetes Ergebnis:**
- ✅ Tabellen `customers`, `tickets`, `ticket_messages`, `saved_designs`, `production_queue`, `component_inventory`, `pricing_rules` existieren
- ✅ `profiles` Tabelle hat neue Spalten: `display_name`, `is_active`, `last_login_at`
- ✅ RLS Policies sind aktiv

**Validierung:**
```sql
-- In Supabase SQL Editor
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN ('customers', 'tickets', 'ticket_messages', 'saved_designs', 'production_queue');

-- Check RLS
SELECT tablename, rowsecurity FROM pg_tables 
WHERE schemaname = 'public' AND tablename = 'customers';
-- Erwartung: rowsecurity = true
```

---

### **Test 2: Admin-User erstellen**

```sql
-- In Supabase SQL Editor
-- WICHTIG: Ersetze 'admin@unbreak-one.de' mit deiner echten Admin-Email

-- 1. Prüfe ob User existiert
SELECT id, email FROM auth.users WHERE email = 'admin@unbreak-one.de';

-- 2. Falls User existiert, mache ihn zum Admin
UPDATE public.profiles
SET 
  role = 'admin',
  display_name = 'System Admin',
  is_active = TRUE,
  updated_at = NOW()
WHERE id = (SELECT id FROM auth.users WHERE email = 'admin@unbreak-one.de');

-- 3. Validierung
SELECT email, role, is_active, display_name 
FROM public.profiles 
WHERE role = 'admin';
```

**Erwartetes Ergebnis:**
- ✅ Dein User hat `role = 'admin'`
- ✅ `is_active = TRUE`

---

### **Test 3: Test-Checkout → Customer wird erstellt**

**Schritt 1: Test-Bestellung durchführen**

1. Öffne UNBREAK ONE Konfigurator: `http://localhost:3000/configurator`
2. Wähle Produkt (z.B. UNBREAK Glas-Set)
3. Konfiguriere Komponenten (Material, Finish, etc.)
4. Klicke "In den Warenkorb"
5. Gehe zu Checkout
6. Nutze Test-Email: `test-customer@example.com`
7. Nutze Stripe Test Card: `4242 4242 4242 4242`, Expiry: `12/34`, CVC: `123`
8. Schließe Zahlung ab

**Schritt 2: Prüfe Stripe Dashboard**

1. Öffne [Stripe Dashboard](https://dashboard.stripe.com/test/customers)
2. Suche nach `test-customer@example.com`
3. **Erwartung:** ✅ Customer existiert mit Session verknüpft

**Schritt 3: Prüfe Supabase (Webhook-Sync)**

```sql
-- In Supabase SQL Editor
SELECT * FROM public.customers 
WHERE email = 'test-customer@example.com';

-- Erwartetes Ergebnis:
-- - email: test-customer@example.com
-- - stripe_customer_id: cus_xxxxx (von Stripe)
-- - default_shipping: {JSONB Adresse}
-- - created_at: aktuelles Datum
```

**Erwartetes Ergebnis:**
- ✅ Customer in Supabase vorhanden
- ✅ `stripe_customer_id` ist gesetzt
- ✅ `default_shipping` enthält Adresse

---

### **Test 4: Order ist mit Customer verknüpft**

```sql
-- In Supabase SQL Editor
SELECT 
  o.id,
  o.order_number,
  o.customer_id,
  o.stripe_customer_id,
  o.status,
  o.total_cents,
  c.email AS customer_email
FROM public.orders o
LEFT JOIN public.customers c ON o.customer_id = c.id
WHERE o.stripe_checkout_session_id LIKE 'cs_%'
ORDER BY o.created_at DESC
LIMIT 5;
```

**Erwartetes Ergebnis:**
- ✅ `customer_id` ist UUID (nicht NULL)
- ✅ `stripe_customer_id` entspricht Stripe
- ✅ `customer_email` zeigt Email des Kunden

---

### **Test 5: Admin UI - Customers Liste**

1. Login als Admin: `http://localhost:3000/admin/login`
2. Navigiere zu: `http://localhost:3000/admin/customers`

**Erwartetes Ergebnis:**
- ✅ Liste zeigt Test-Customer (`test-customer@example.com`)
- ✅ Spalten: Email, Name, Telefon, Stripe ID, Bestellungen, Umsatz, Letzte Bestellung
- ✅ Suche funktioniert (Email-Suche)
- ✅ Pagination funktioniert (falls >50 Kunden)

---

### **Test 6: Admin UI - Customer Detail**

1. Klicke auf "Details →" bei Test-Customer
2. URL: `http://localhost:3000/admin/customers/{customer-id}`

**Erwartetes Ergebnis:**
- ✅ Customer Info Cards zeigen:
  - Email, Telefon, Stripe ID
  - Anzahl Bestellungen
  - Gesamtumsatz
  - Kunde seit Datum
- ✅ Standard-Lieferadresse wird angezeigt (falls vorhanden)
- ✅ Tab "Bestellungen" zeigt Order-Historie
- ✅ Jede Order hat Link zu `/admin/orders/{order-id}`

---

### **Test 7: Webhook Logs prüfen**

```bash
# Terminal (Dev-Server muss laufen)
npm run dev

# In separatem Terminal: Webhook Events simulieren (falls nötig)
# Oder echte Events via Stripe CLI:
stripe listen --forward-to localhost:3000/api/webhooks/stripe
```

**Server-Logs prüfen:**
```
✅ [SIGNATURE] Verified OK
✅ [EVENT] Type: checkout.session.completed
✅ [CUSTOMER SYNC] Customer synced - ID: {uuid}
✅ [DB UPDATE] Order linked to customer
```

---

## 🚨 FEHLERBEHANDLUNG

### **Problem: Customers laden nicht (404 oder 500)**

**Diagnose:**
```sql
-- Prüfe ob customers Tabelle existiert
SELECT COUNT(*) FROM public.customers;

-- Prüfe RLS
SELECT tablename, rowsecurity FROM pg_tables 
WHERE tablename = 'customers';
```

**Lösung:**
- Migration `008_create_customers_extended.sql` ausführen
- RLS Policy prüfen: Admin-User muss Rolle 'admin', 'ops' oder 'support' haben

---

### **Problem: Stripe Customer wird nicht erstellt**

**Diagnose:**
1. Prüfe Stripe Dashboard → Customers (Test Mode)
2. Prüfe Server-Logs während Checkout

**Lösung:**
- Stelle sicher `customer_creation: 'always'` in `pages/api/checkout/create.js`
- Prüfe `STRIPE_SECRET_KEY` in `.env.local`

---

### **Problem: Webhook schlägt fehl (Signature Error)**

**Diagnose:**
```bash
# Server-Logs zeigen:
❌ [SIGNATURE] Verification FAILED: ...
```

**Lösung:**
```bash
# Prüfe STRIPE_WEBHOOK_SECRET in .env.local
cat .env.local | grep STRIPE_WEBHOOK_SECRET

# Falls leer: Generiere neuen Secret in Stripe Dashboard → Webhooks
# Oder nutze Stripe CLI:
stripe listen --print-secret
# Kopiere whsec_... in .env.local
```

---

### **Problem: Unauthorized (401) beim API-Aufruf**

**Diagnose:**
- API antwortet mit `{ error: 'Unauthorized' }`

**Lösung:**
```sql
-- Prüfe User-Rolle
SELECT email, role, is_active FROM public.profiles 
WHERE email = '{deine-admin-email}';

-- Falls role != 'admin':
UPDATE public.profiles 
SET role = 'admin', is_active = TRUE 
WHERE email = '{deine-admin-email}';
```

---

## 📦 DEPLOYMENT CHECKLIST

### **Vor Deployment:**

- [ ] Alle Migrationen in Production Supabase ausgeführt
- [ ] Admin-User in Production erstellt (`role = 'admin'`)
- [ ] ENV-Variablen gesetzt:
  ```
  STRIPE_SECRET_KEY=sk_live_xxx
  STRIPE_WEBHOOK_SECRET=whsec_xxx
  SUPABASE_URL=https://xxx.supabase.co
  SUPABASE_SERVICE_ROLE_KEY=eyJxxx
  ```
- [ ] Stripe Webhook Endpoint erstellt:
  - URL: `https://unbreak-one.de/api/webhooks/stripe`
  - Events: `checkout.session.completed`, `customer.created`, `customer.updated`
- [ ] Test-Checkout in Production durchgeführt
- [ ] Webhook Logs geprüft (Supabase → Database → `webhook_logs`)

---

### **Nach Deployment:**

- [ ] Production-Checkout getestet (echte Email, Test-Card)
- [ ] Customer erscheint in `/admin/customers`
- [ ] Order ist mit Customer verknüpft
- [ ] Webhook-Logs zeigen Success

---

## 🔐 SICHERHEIT

### **RLS Policies aktiv:**
```sql
-- Validierung
SELECT tablename, rowsecurity FROM pg_tables 
WHERE schemaname = 'public' 
  AND tablename IN ('customers', 'tickets', 'profiles', 'saved_designs');

-- Erwartung: Alle rowsecurity = true
```

### **Admin-Zugriff beschränkt:**
- ✅ Nur User mit `role IN ('admin', 'ops', 'support')` sehen Customers
- ✅ Nur `role = 'admin'` kann Users verwalten
- ✅ Nur `role IN ('admin', 'finance')` kann Pricing bearbeiten

### **Stripe Webhook Secret:**
- ✅ Webhook-Signatur wird IMMER validiert
- ✅ Keine Requests ohne gültige Signatur verarbeitet

---

## 📊 METRIKEN (Optional)

### **Customer Stats:**
```sql
SELECT 
  COUNT(*) AS total_customers,
  COUNT(CASE WHEN stripe_customer_id IS NOT NULL THEN 1 END) AS with_stripe,
  COUNT(CASE WHEN total_orders > 0 THEN 1 END) AS with_orders,
  SUM(total_orders) AS total_orders,
  SUM(total_spent_cents) / 100 AS total_revenue_eur
FROM public.customers;
```

### **Top Customers:**
```sql
SELECT 
  email,
  name,
  total_orders,
  total_spent_cents / 100 AS total_spent_eur,
  last_order_at
FROM public.customers
ORDER BY total_spent_cents DESC
LIMIT 10;
```

---

## 🚀 NÄCHSTE SCHRITTE (Optional)

### **Priorität 2 - Users/RBAC** (Noch NICHT implementiert)
- API: `/api/admin/users` (GET, POST, PATCH, DELETE)
- API: `/api/admin/users/invite` (Invite per Email)
- UI: `/admin/users` (Liste + Rollen-Management)

### **Priorität 3 - Tickets** (Noch NICHT implementiert)
- API: `/api/admin/tickets` (CRUD)
- API: `/api/admin/tickets/[id]/messages` (Thread)
- UI: `/admin/tickets` (Liste + Detail + Thread)

### **Priorität 4 - Backoffice** (Noch NICHT implementiert)
- UI: `/admin/designs` (Saved Designs)
- UI: `/admin/production` (Production Queue)
- UI: `/admin/components` (Inventory)
- UI: `/admin/pricing` (Pricing Rules)

---

## 📞 SUPPORT

**Bei Problemen:**
1. Prüfe Server-Logs (`npm run dev`)
2. Prüfe Supabase Logs (Dashboard → Logs → API/Webhooks)
3. Prüfe Stripe Webhooks (Dashboard → Webhooks → Event Log)

**SQL Debug:**
```sql
-- Letzte 10 Webhook Events
SELECT * FROM public.webhook_logs 
ORDER BY created_at DESC 
LIMIT 10;

-- Customers ohne Stripe ID
SELECT * FROM public.customers 
WHERE stripe_customer_id IS NULL;

-- Orders ohne Customer
SELECT * FROM public.orders 
WHERE customer_id IS NULL;
```

---

**Ende des Testing Guides**  
Status: Priorität 1 (Customers) ✅ Vollständig implementiert und testbereit
