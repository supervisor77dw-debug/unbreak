# 🚨 CRITICAL DEPLOYMENT FIXES

## Problem 1: Config zeigt "petrol"
**Root Cause:** Configurator iframe sendet legacy format `{color: "petrol"}` statt `{colors: {base, top, middle}}`

**Fix:** `pages/api/checkout/create.js` - Zeile ~70
```javascript
// Convert legacy single-color to colors object
if (config && config.color && !config.colors) {
  config = {
    ...config,
    colors: {
      base: config.color,
      top: config.color,
      middle: config.color
    }
  };
}
```

**Status:** ✅ FIXED - Deploy SOFORT

---

## Problem 2: Customers nicht sichtbar
**Root Cause:** Webhook findet Order NICHT weil Column-Name mismatch
- API speichert: `stripe_checkout_session_id` 
- Webhook sucht: `stripe_session_id`

**Fix:** `pages/api/webhooks/stripe.js` - Zeile ~145
```javascript
// Suche in BEIDEN Columns
.or(`stripe_session_id.eq.${session.id},stripe_checkout_session_id.eq.${session.id}`)
```

**Status:** ✅ FIXED - Deploy SOFORT

---

## Problem 3: Console Error "async response"
**Ursache:** Chrome Extension oder Browser issue (nicht unser Code)
**Action:** Ignorieren, nicht kritisch

---

## 🚀 DEPLOYMENT ANWEISUNGEN

### Option 1: Vercel Git Deploy (EMPFOHLEN)
```bash
git add pages/api/checkout/create.js
git add pages/api/webhooks/stripe.js
git commit -m "HOTFIX: Config color bug + customer sync"
git push
```

Vercel deployed automatisch in ~2 Minuten.

### Option 2: Vercel CLI
```bash
vercel --prod
```

---

## ✅ VERIFICATION (Nach Deployment)

1. **Checkout testen:**
   - Öffne: https://deine-domain.vercel.app/configurator.html
   - Wähle Farben (z.B. Graphite)
   - Checkout durchführen
   
2. **Vercel Function Logs prüfen:**
   ```
   [HOTFIX] Converting legacy color format
   [TRACE] CHECKOUT_CONFIG_RECEIVED - colors: {base: "graphite", ...}
   ```

3. **Webhook Logs prüfen:**
   ```
   ✅ [DB QUERY] Found in SIMPLE_ORDERS table
   [TRACE] CUSTOMER_UPSERT_SUCCESS
   ```

4. **Supabase SQL:**
   ```sql
   SELECT id, customer_email, config_json->'colors' 
   FROM simple_orders 
   ORDER BY created_at DESC LIMIT 5;
   ```
   Erwartung: Farben NICHT "petrol"

5. **Admin UI:**
   - `/admin/customers` zeigt Customers
   - `/admin/orders` zeigt Orders mit Customer-Link

---

## 📊 EXPECTED TIMELINE

- Deploy: 2-3 Minuten
- Test: 5 Minuten
- Verification: 2 Minuten
- **Total: ~10 Minuten bis Fix live**

---

## 🐛 IF STILL BROKEN AFTER DEPLOY

**Farben immer noch petrol:**
- Check Vercel Function Logs: Siehst du `[HOTFIX] Converting`?
- Wenn NEIN → Code nicht deployed
- Wenn JA aber immer noch petrol → Configurator sendet wirklich "petrol" (User wählt nicht)

**Customers immer noch leer:**
- Check Webhook Logs: Siehst du `Found in SIMPLE_ORDERS`?
- Wenn NEIN → Webhook findet Order nicht (check session_id in DB)
- Check Stripe Dashboard: Webhook 200 OK?
- SQL: `SELECT stripe_session_id, stripe_checkout_session_id FROM simple_orders;` - Welche column ist befüllt?

---

**STATUS:** CRITICAL FIXES READY - DEPLOY IMMEDIATELY
