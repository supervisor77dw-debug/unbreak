# KONFIGURATOR & CHECKOUT - TEST-ANLEITUNG

## VORAUSSETZUNGEN

### 1. Migration 013 ausführen
```bash
# In Supabase Dashboard > SQL Editor
# Datei: supabase/migrations/013_add_config_to_simple_orders.sql
# ODER via psql:
psql <your-connection-string> < supabase/migrations/013_add_config_to_simple_orders.sql
```

**Verifikation:**
```sql
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'simple_orders' 
AND table_schema = 'public'
ORDER BY ordinal_position;
```

Erwartete neue Spalten:
- ✅ `items` (jsonb)
- ✅ `config_json` (jsonb)
- ✅ `preview_image_url` (text)
- ✅ `bom_json` (jsonb)
- ✅ `price_breakdown_json` (jsonb)
- ✅ `metadata` (jsonb)
- ✅ `stripe_checkout_session_id` (text)

### 2. Deployment Status prüfen
```bash
# Check Vercel deployment
# https://vercel.com/supervisor77dw-debug/unbreak-one
# Letzter Commit: d681b5b (Konfigurator fixes)
```

---

## TEST 1: KONFIGURATOR - EINGELOGGTER USER

### Schritte:
1. **Login:** https://unbreak-one.vercel.app/admin/login
   - Email: dein-admin@email.com
   - Passwort: [Admin-Passwort]

2. **Konfigurator öffnen:** https://unbreak-one.vercel.app/configurator

3. **Scroll-Test:**
   - ✅ Seite ist vollständig scrollbar
   - ✅ "Jetzt kaufen" Button ist sichtbar und erreichbar
   - ✅ Kein Overlay/Fixed-Element blockiert Content

4. **Konfigurator bedienen:**
   - Warte bis iframe geladen
   - (Optional) Wähle Farbe/Finish im 3D-Viewer
   - Öffne Browser Console (F12)

5. **Button-Test: "Jetzt kaufen"**
   - Click "🛒 Jetzt kaufen"
   - **Erwartete Console-Logs:**
     ```
     💳 [BUY_NOW] Button clicked!
     🛍️ [CHECKOUT] buyConfigured called with: {...}
     🛒 [CHECKOUT] Button disabled, showing loading...
     🛒 [CHECKOUT] Using SKU: UNBREAK-GLAS-01
     🛒 [CHECKOUT] Calling /api/checkout/create...
     ```

6. **API-Aufruf prüfen:**
   - Network Tab: POST `/api/checkout/create`
   - Status: **200 OK**
   - Response Body:
     ```json
     {
       "success": true,
       "checkout_url": "https://checkout.stripe.com/c/pay/...",
       "order_id": "uuid...",
       "session_id": "cs_test_...",
       "total_cents": 9900
     }
     ```

7. **Stripe Checkout:**
   - Redirect zu Stripe
   - Formular ausgefüllt:
     - Email: test@example.com
     - Name: Max Mustermann
     - Card: 4242 4242 4242 4242
     - Exp: 12/34, CVC: 123
   - **Submit Payment**

8. **Success Page:**
   - URL: `/success?session_id=cs_test_...&order_id=uuid`
   - ✅ Bestellbestätigung angezeigt
   - ✅ Order ID sichtbar

9. **Datenbank-Verifikation:**
   ```sql
   SELECT 
     id,
     status,
     customer_email,
     customer_name,
     stripe_customer_id,
     config_json,
     items,
     total_amount_cents
   FROM simple_orders
   WHERE id = 'uuid-from-success-page'
   ORDER BY created_at DESC
   LIMIT 1;
   ```
   
   **Erwartete Werte:**
   - ✅ `status = 'paid'` (nach Webhook)
   - ✅ `customer_email = 'test@example.com'`
   - ✅ `customer_name = 'Max Mustermann'`
   - ✅ `stripe_customer_id = 'cus_...'` (nach Webhook)
   - ✅ `config_json` enthält `{ "color": "petrol", "finish": "matte", ... }`
   - ✅ `items[0].config` enthält Konfiguration

10. **Admin Panel - Order Details:**
    - https://unbreak-one.vercel.app/admin/orders
    - Finde die neue Order (nach Email oder ID)
    - Click auf Order
    - **Erwartete Sections:**
      - ✅ **Kunde:** Email, Name, Stripe Customer ID
      - ✅ **🎨 Konfigurator-Konfiguration:** 
        - Farbe mit Swatch
        - Finish
        - JSON Download-Button
      - ✅ **Summen:** Zwischensumme, Versand, MwSt., Gesamt

11. **Admin Panel - Customers:**
    - https://unbreak-one.vercel.app/admin/customers
    - ✅ Customer "test@example.com" existiert
    - ✅ Total Orders: 1
    - ✅ Total Spent: 99.00 EUR

---

## TEST 2: KONFIGURATOR - GUEST CHECKOUT

### Schritte:
1. **Logout** (falls eingeloggt)
2. **Konfigurator öffnen:** https://unbreak-one.vercel.app/configurator (Incognito-Modus empfohlen)

3. **Button-Test: "Jetzt kaufen"**
   - Warte bis iframe geladen
   - Click "🛒 Jetzt kaufen"
   - **Erwartete Console-Logs:**
     ```
     💳 [BUY_NOW] Button clicked! { userId: 'guest', ... }
     ```

4. **Stripe Checkout:**
   - Email: guest@example.com
   - Name: Guest User
   - Card: 4242 4242 4242 4242
   - **Submit Payment**

5. **Success Page:**
   - ✅ Bestellbestätigung für Guest

6. **Datenbank-Verifikation:**
   ```sql
   SELECT *
   FROM simple_orders
   WHERE customer_email = 'guest@example.com'
   ORDER BY created_at DESC
   LIMIT 1;
   ```
   
   **Erwartete Werte:**
   - ✅ `status = 'paid'`
   - ✅ `customer_email = 'guest@example.com'`
   - ✅ `customer_name = 'Guest User'`
   - ✅ `customer_id IS NULL` (Guest hat keinen Account)
   - ✅ `stripe_customer_id` vorhanden (Stripe erstellt Customer automatisch)
   - ✅ `config_json` vorhanden

7. **Admin Panel:**
   - Order sichtbar in `/admin/orders`
   - Customer "guest@example.com" in `/admin/customers`

---

## TEST 3: ADD TO CART (SHOP)

**⚠️ HINWEIS:** Add to Cart funktioniert derzeit nur mit data-checkout="add-to-cart" Attribut.

### Voraussetzung:
Button in HTML muss folgendes Attribut haben:
```html
<button data-checkout="add-to-cart">In den Warenkorb</button>
```

### Schritte:
1. **Konfigurator öffnen**
2. **Console prüfen:**
   ```
   🔧 [INIT] Found add-to-cart buttons: X
   ```
   Falls 0: Button hat falsches data-checkout Attribut

3. **Button klicken:**
   ```
   🛒 [CART] Add to cart button clicked
   🛒 [ADD_TO_CART] Button clicked!
   ✅ [ADD_TO_CART] Item added to cart { cartSize: 1 }
   ```

4. **localStorage prüfen (Console):**
   ```javascript
   JSON.parse(localStorage.getItem('unbreak_cart'))
   ```
   Output:
   ```json
   [
     {
       "id": 1704567890123,
       "product_sku": "UNBREAK-GLAS-01",
       "config": { "color": "petrol", "finish": "matte" },
       "quantity": 1,
       "added_at": "2026-01-04T..."
     }
   ]
   ```

5. **Button Feedback:**
   - ✅ Button zeigt "⏳ Wird hinzugefügt..."
   - ✅ Nach 2s: "✓ Hinzugefügt!"
   - ✅ Dann zurück zu "In den Warenkorb"

---

## TEST 4: CUSTOMER BACKFILL (BESTEHENDE ORDERS)

**Für Orders die VOR dem Fix erstellt wurden:**

### Schritte:
1. **Backfill-Script ausführen:**
   ```bash
   node scripts/backfill-customers.js
   ```

2. **Erwartete Output:**
   ```
   🚀 Starting customer data backfill...
   📊 Found X orders needing customer data

   📦 Processing order abc12345...
      Created: 2026-01-03...
      Status: paid
      Stripe Session: cs_test_...
      ✅ Retrieved Stripe session
      Customer Email: test@example.com
      Customer Name: Test User
      ✅ Customer upserted: def67890...
      ✅ Order updated with customer data

   ✅ Backfill complete!
      Total orders processed: X
      ✅ Synced: X
      ❌ Failed: 0
      ⏭️  Skipped: 0
   ```

3. **Admin Panel prüfen:**
   - Orders sollten jetzt Customer anzeigen
   - Customers-Seite sollte alle Customers enthalten

---

## FEHLERSUCHE

### Problem: "Jetzt kaufen" Button keine Reaktion

**Checks:**
1. **Console:**
   ```
   🔧 [INIT] Found configured buttons: X
   ```
   Falls 0: Button fehlt `data-checkout="configured"` Attribut

2. **Button-Binding prüfen:**
   ```javascript
   // In Console:
   document.querySelector('[data-checkout="configured"]').dataset.bound
   // Sollte '1' sein
   ```

3. **Scroll-Problem:**
   - Öffne Konfigurator
   - Scroll nach unten
   - Button sollte sichtbar sein
   - Falls nicht: CSS-Höhe prüfen (body/html overflow)

### Problem: API 500 Error

**Checks:**
1. **Migration 013 ausgeführt?**
   ```sql
   SELECT column_name FROM information_schema.columns 
   WHERE table_name = 'simple_orders' AND column_name = 'items';
   ```
   Falls leer: Migration fehlt!

2. **API Error Log (Vercel):**
   - https://vercel.com → Functions → Logs
   - Suche nach `/api/checkout/create`
   - Error Message prüfen

3. **Stripe Keys:**
   ```bash
   # Check .env.local
   STRIPE_SECRET_KEY=sk_test_...
   NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
   ```

### Problem: Order hat keine customer_id

**Checks:**
1. **Webhook funktioniert?**
   - Stripe Dashboard → Webhooks
   - Event `checkout.session.completed`
   - Response: 200 OK?

2. **Webhook Environment:**
   ```bash
   # Vercel Environment Variables
   STRIPE_WEBHOOK_SECRET=whsec_...
   SUPABASE_SERVICE_ROLE_KEY=eyJh...
   ```

3. **Manual Backfill:**
   ```bash
   node scripts/backfill-customers.js
   ```

### Problem: Config fehlt in Order Details

**Checks:**
1. **Migration 013:**
   - Spalte `config_json` existiert?
   - API speichert Config korrekt?

2. **API Log:**
   ```
   ⚠️ [Order] Config columns not available (migration 013 not run yet)
   ```
   → Migration ausführen!

3. **Für ALT-Orders:**
   - Vor Migration erstellt
   - Config nicht rekonstruierbar
   - Markierung "Alt-Order ohne Config" OK

---

## AKZEPTANZKRITERIEN - CHECKLISTE

### ✅ TEIL 1: UI/Scroll/Buttons
- [ ] Konfigurator ist bis zum Button scrollbar
- [ ] "In den Warenkorb" Button ist klickbar
- [ ] "Jetzt kaufen" Button ist klickbar
- [ ] Console-Logs bei jedem Klick

### ✅ TEIL 2: Order Creation
- [ ] API `/api/checkout/create` returned 200
- [ ] Order in `simple_orders` angelegt
- [ ] Redirect zu Stripe Checkout funktioniert
- [ ] Success Page wird nach Payment angezeigt

### ✅ TEIL 3: Customer Sync
- [ ] Webhook verarbeitet `checkout.session.completed`
- [ ] Customer in `customers` Tabelle erstellt
- [ ] Order hat `customer_id` + `stripe_customer_id`
- [ ] Customers in Admin Panel sichtbar

### ✅ TEIL 4: Config-Daten
- [ ] `config_json` in Order gespeichert (nach Migration)
- [ ] Admin Order Detail zeigt Farbe + Finish
- [ ] JSON Download funktioniert
- [ ] Preview Image (falls vorhanden)

### ✅ TEIL 5: Backfill
- [ ] Backfill-Script läuft ohne Fehler
- [ ] Alte Orders haben jetzt Customer-Link
- [ ] Admin Panel zeigt Customer für alte Orders

---

## SUPPORT

Bei Problemen:
1. **Console-Logs prüfen** (Browser F12)
2. **Vercel Function Logs** (https://vercel.com)
3. **Supabase Logs** (Dashboard → Logs)
4. **Stripe Dashboard** (Webhooks, Events)

**Kritische Logs:**
- `💳 [BUY_NOW] Button clicked!` → Button funktioniert
- `✅ [DB UPDATE] Complete` → Webhook speichert Order
- `✅ [CUSTOMER SYNC] Customer synced` → Customer erstellt
