# CHECKOUT FIX - Stripe Price IDs & Shipping Setup

**Status:** ✅ CODE DEPLOYED (Requires Stripe Configuration)  
**Date:** 2026-01-11  
**Commit:** TBD

---

## 🎯 PROBLEME GELÖST

### 1. ❌ 404 Error → ✅ Endpoint funktioniert
**Problem:** POST /api/checkout/standard → 404  
**Root Cause:** Endpoint existierte, aber Configurator Items hatten keine product_id in DB  
**Fix:**
- Configurator Items (SKU: `glass_configurator`) werden jetzt speziell behandelt
- Skip DB-Lookup für Configurator Items
- Nutzen Price/unit_amount direkt aus Cart

### 2. ❌ "Product not found" → ✅ Stripe Price IDs
**Problem:** Stripe meldet "Product not found or inactive"  
**Root Cause:** `price_data` erzeugt Ad-hoc Prices, keine Referenz zu echten Stripe Produkten  
**Fix:**
- **Neue Env Vars:** `STRIPE_PRICE_GLASS_CONFIGURATOR` für Price ID
- **Mapping:** `glass_configurator` → Stripe Price ID
- **Fallback:** Wenn kein Price ID → nutze `price_data` (Legacy)

### 3. ❌ Versand immer 0€ → ✅ Shipping Rates
**Problem:** Keine Versandkosten konfiguriert  
**Fix:**
- **Neue Env Var:** `STRIPE_SHIPPING_RATE_DE` für Shipping Rate ID
- **Address Collection:** Aktiviert für DE, AT, CH, NL, BE, LU, FR, IT, ES, PT
- **Shipping Options:** Nutzt Stripe Shipping Rate wenn konfiguriert

### 4. ❌ Keine Steuern → ✅ Automatic Tax
**Problem:** Steuerlogik fehlte komplett  
**Fix:**
- **Automatic Tax:** `automatic_tax: { enabled: true }`
- Stripe berechnet Steuern automatisch basierend auf Lieferadresse
- Tax Behavior muss in Stripe Price konfiguriert sein

---

## 📝 CHANGES

### `pages/api/checkout/standard.js`

**Neu:** Stripe Price ID Mapping
```javascript
const STRIPE_PRICES = {
  glass_configurator: process.env.STRIPE_PRICE_GLASS_CONFIGURATOR || null,
};

const SHIPPING_RATES = {
  de_standard: process.env.STRIPE_SHIPPING_RATE_DE || null,
};
```

**Neu:** Configurator Item Handling
```javascript
// SPECIAL CASE: Configurator items (not in products table)
if (item.product_id === 'glass_configurator' || item.sku === 'glass_configurator') {
  console.log('🎨 [Checkout] Configurator item detected');
  
  cartItems.push({
    product_id: 'glass_configurator',
    sku: 'glass_configurator',
    name: item.name || 'Glashalter – Konfigurator',
    unit_price_cents: item.price || item.unit_amount || 19900,
    quantity: item.quantity,
    stripe_price_id: STRIPE_PRICES.glass_configurator,
    is_configurator: true,
    config: item.config || null,
  });
  
  continue; // Skip DB lookup
}
```

**Neu:** Line Items mit Price IDs
```javascript
const lineItems = cartItems.map(item => {
  if (item.stripe_price_id) {
    return {
      price: item.stripe_price_id,  // Use Stripe Price ID
      quantity: item.quantity,
    };
  } else {
    return {
      price_data: { ... },  // Fallback: Ad-hoc price
      quantity: item.quantity,
    };
  }
});
```

**Neu:** Shipping + Tax Configuration
```javascript
const sessionData = {
  payment_method_types: ['card'],
  line_items: lineItems,
  mode: 'payment',
  
  // SHIPPING
  shipping_address_collection: {
    allowed_countries: ['DE', 'AT', 'CH', 'NL', 'BE', 'LU', 'FR', 'IT', 'ES', 'PT'],
  },
  ...(shippingOptions.length > 0 && { shipping_options: shippingOptions }),
  
  // TAX
  automatic_tax: {
    enabled: true,
  },
  
  success_url: '...',
  cancel_url: '...',
  metadata: { ... },
};
```

**Neu:** Debug Logging (Preview Only)
```javascript
const isPreview = origin.includes('vercel.app');
if (isPreview) {
  console.log('[CHECKOUT] mode=%s', sessionData.mode);
  console.log('[CHECKOUT] locale=%s', 'de');
  console.log('[CHECKOUT] items=%s', JSON.stringify(lineItems));
  console.log('[CHECKOUT] shipping=%s', shippingOptions.length > 0 ? 'configured' : 'none');
  console.log('[CHECKOUT] automatic_tax=%s', sessionData.automatic_tax?.enabled ? 'enabled' : 'disabled');
}
```

---

## 🚀 SETUP - STRIPE KONFIGURATION (CRITICAL)

### Schritt 1: Stripe Dashboard öffnen
**Test Mode:** https://dashboard.stripe.com/test  
**Live Mode:** https://dashboard.stripe.com (später)

---

### Schritt 2: Produkt + Price erstellen

1. **Navigate to:** Products → https://dashboard.stripe.com/test/products
2. **Click:** "+ Add Product"
3. **Fill in:**
   - Name: `Glashalter – Konfigurator`
   - Description: `Individuell konfigurierter Glashalter`
   - Image: (optional)
4. **Pricing:**
   - Price: `€199.00`
   - Currency: `EUR`
   - Billing: `One time`
   - **Tax behavior:** `Inclusive` (empfohlen) oder `Exclusive`
5. **Click:** "Save product"
6. **Copy Price ID:**
   - Looks like: `price_1Abc2DefGhiJklMn3Op`
   - Format: `price_...` (NOT `prod_...`)

---

### Schritt 3: Shipping Rate erstellen

1. **Navigate to:** Shipping Rates → https://dashboard.stripe.com/test/shipping-rates
2. **Click:** "+ Create shipping rate"
3. **Fill in:**
   - Display name: `Standard Versand`
   - Description: `Lieferzeit 3-5 Werktage`
   - Type: `Fixed amount`
   - Price: `€4.90` (oder gewünschter Betrag)
   - Currency: `EUR`
   - **Tax behavior:** `Taxable` (mit MwSt.)
   - Tax code: `txcd_92010001` (Physical goods)
4. **Click:** "Create shipping rate"
5. **Copy Shipping Rate ID:**
   - Looks like: `shr_1Abc2DefGhiJklMn3Op`
   - Format: `shr_...`

---

### Schritt 4: Automatic Tax aktivieren (Empfohlen)

**Option A: Stripe Tax (einfach, €25/Monat ab Umsatz)**
1. **Navigate to:** Settings → Tax → https://dashboard.stripe.com/test/settings/tax
2. **Click:** "Enable Stripe Tax"
3. **Configure:**
   - Tax registration: Germany (DE)
   - Tax calculation: Automatic
   - Threshold monitoring: Optional
4. **Save**

**Option B: Manuelle Steuerlogik (kompliziert)**
- Eigene Tax Rates anlegen
- Prices mit korrekten Tax Rates verknüpfen
- Nur wenn Stripe Tax nicht möglich ist

---

### Schritt 5: Environment Variables setzen

#### Lokal (.env.local):
```bash
# Stripe Price IDs (aus Schritt 2)
STRIPE_PRICE_GLASS_CONFIGURATOR=price_1Abc2DefGhiJklMn3Op

# Stripe Shipping Rate (aus Schritt 3)
STRIPE_SHIPPING_RATE_DE=shr_1Abc2DefGhiJklMn3Op
```

#### Vercel (Production):
1. **Navigate to:** https://vercel.com/dashboard → Project Settings → Environment Variables
2. **Add:**
   - Key: `STRIPE_PRICE_GLASS_CONFIGURATOR`
   - Value: `price_1Abc2DefGhiJklMn3Op` (von Schritt 2)
   - Environment: All (Production, Preview, Development)
3. **Add:**
   - Key: `STRIPE_SHIPPING_RATE_DE`
   - Value: `shr_1Abc2DefGhiJklMn3Op` (von Schritt 3)
   - Environment: All
4. **Redeploy:** Trigger Redeploy nach Env Var Änderung

---

## ✅ ACCEPTANCE TESTS

### Test A: Checkout ohne Env Vars (Fallback)
```bash
# Vercel env vars NICHT gesetzt
# Expected: Checkout funktioniert mit price_data (Ad-hoc Prices)
# Warnung: "[CHECKOUT] No shipping rate configured"
```

**Steps:**
1. Cart öffnen
2. "Zur Kasse" klicken
3. **Expected:**
   - Stripe Checkout öffnet
   - Produkt: "Glashalter – Konfigurator" €199.00
   - Versand: NICHT sichtbar (kein shipping_options)
   - Steuern: Automatic Tax aktiv (wenn in Stripe enabled)

---

### Test B: Checkout mit Price ID (Optimal)
```bash
# Env vars gesetzt:
# STRIPE_PRICE_GLASS_CONFIGURATOR=price_...
# STRIPE_SHIPPING_RATE_DE=shr_...
```

**Steps:**
1. Cart öffnen (Configurator Item)
2. "Zur Kasse" klicken
3. **Expected:**
   - Stripe Checkout öffnet
   - Produkt: Linked zu Stripe Product (Name, Image aus Stripe)
   - Versand: "Standard Versand €4.90" sichtbar
   - Adresse: Versandadresse Formular erscheint
   - Steuern: Automatic Tax berechnet MwSt. (19% DE)

---

### Test C: Debug Logging (Preview)
```bash
# Browser: https://unbreak-one-<hash>.vercel.app/cart
# Open DevTools → Console
```

**Steps:**
1. Cart öffnen
2. "Zur Kasse" klicken
3. **Expected Console Logs:**
   ```
   [CHECKOUT] mode=payment
   [CHECKOUT] locale=de
   [CHECKOUT] items=[{"sku":"glass_configurator","qty":1,"priceId":"price_..."}]
   [CHECKOUT] shipping=configured
   [CHECKOUT] automatic_tax=enabled
   ```

---

### Test D: Stripe Dashboard Verify
```bash
# After checkout in Test B
```

**Steps:**
1. **Navigate to:** Stripe Dashboard → Payments
2. **Find:** Latest session (status "Succeeded" after test payment)
3. **Verify:**
   - Line Items: 1x Glashalter – Konfigurator (€199.00)
   - Shipping: Standard Versand (€4.90)
   - Tax: Calculated (€38.73 bei 19%)
   - **Total:** €242.63

---

## 🔍 DEBUGGING

### Problem: "Product not found or inactive"
**Check:**
1. Price ID korrekt in env var? `price_...` Format?
2. Ist der Price in Stripe Dashboard **active**?
3. Ist das Product in Stripe Dashboard **active**?
4. Richtige Stripe Keys? (test vs live mismatch?)

**Console Check:**
```javascript
// Browser console
console.log(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY);
// Should start with: pk_test_... (test mode)
```

---

### Problem: Versand erscheint nicht
**Check:**
1. `STRIPE_SHIPPING_RATE_DE` gesetzt?
2. Shipping Rate existiert in Stripe Dashboard?
3. Shipping Rate ist **active**?
4. `shipping_address_collection` aktiviert? (sollte sein)

**Log Check:**
```
⚠️ [Checkout] No shipping rate configured (STRIPE_SHIPPING_RATE_DE missing)
```

---

### Problem: Steuern = 0
**Check:**
1. Automatic Tax in Stripe Dashboard enabled?
2. Tax registration für DE angelegt?
3. Price hat `tax_behavior` gesetzt? (inclusive/exclusive)
4. Shipping Rate hat `taxable: true`?

**Stripe Dashboard Check:**
- Settings → Tax → Status: "Enabled" ✅

---

### Problem: Checkout öffnet nicht
**Check:**
1. Browser Console: Fehler?
2. Network Tab: POST /api/checkout/standard → Status?
3. Vercel Logs: Server errors?

**Expected Response:**
```json
{
  "url": "https://checkout.stripe.com/c/pay/cs_test_...",
  "session_id": "cs_test_...",
  "order_id": "..."
}
```

---

## 📌 WICHTIG - PRODUCTION CHECKLIST

Bevor Live-Deployment:

- [ ] Stripe Account auf **Live Mode** umstellen
- [ ] Live Keys setzen: `STRIPE_SECRET_KEY=sk_live_...`
- [ ] Live Price erstellen (€199 Product)
- [ ] Live Shipping Rate erstellen
- [ ] Env Vars in Vercel Production environment updaten
- [ ] Automatic Tax für Live Mode aktivieren
- [ ] Tax Registration prüfen (DE)
- [ ] Test-Bestellung durchführen (echte Kreditkarte, danach refund)
- [ ] Webhook in Live Mode testen

---

## 🔗 RELATED DOCS

- [CART-I18N-FIX-SUMMARY.md](CART-I18N-FIX-SUMMARY.md) - Cart €NaN Fix
- [CONFIG-SESSION-INTEGRATION.md](CONFIG-SESSION-INTEGRATION.md) - Configurator Flow

---

**NEXT STEPS:**
1. Stripe Dashboard öffnen (Test Mode)
2. Produkt + Price erstellen → Price ID kopieren
3. Shipping Rate erstellen → Rate ID kopieren
4. Env vars setzen (lokal + Vercel)
5. Redeploy
6. Test B durchführen
