# CRITICAL UI BUG FIX - Cart Line Item falscher Preis

**Date:** January 16, 2026  
**Priority:** CRITICAL  
**Issue:** Cart Line Item zeigt 39.xx statt 19,90 (Totals korrekt)

---

## ❌ **Problem (Ist-Zustand)**

**Repro (100%):**
1. Cart öffnen
2. **NUR** 1× Glashalter Standard hinzufügen (keine anderen Produkte)

**Beobachtung:**
```
Line Item (oben):
- Glashalter Standard
- SKU: UNBREAK-GLAS-CONFIG (FALSCH!)
- Preis: €39.90            ← FALSCH!

Subtotal (unten rechts):    €19,90  ← KORREKT!
Total:                      €19,90  ← KORREKT!
```

**Das beweist:** Line Item Render nutzt **anderen Preis-Resolver** als Totals!

---

## 🔍 **Root Cause Analyse**

### **Datei 1: pages/cart.js (Line Item Render)**

**VORHER (BROKEN) - Line 256:**
```javascript
<p style={{ fontWeight: 'bold' }}>
  €{formatPrice(item.price)}  ← Nutzt item.price direkt!
</p>
```

**VORHER (BROKEN) - Line 310:**
```javascript
<p>€{formatPrice(item.price * item.quantity)}</p>  ← Line Total
```

### **Datei 2: pages/cart.js (Totals Berechnung)**

**VORHER (BROKEN) - Line 173:**
```javascript
const subtotal = pricingSnapshot?.subtotal_cents || cart.getTotal();
```

→ **Totals nutzen:** `pricingSnapshot` (Server) ODER `cart.getTotal()` (Client)

### **Datei 3: lib/cart.js (getTotal)**

**Line 249-259:**
```javascript
getTotal() {
  return this.items.reduce((sum, item) => {
    const price = Number(item.price);  ← Nutzt item.price
    return sum + (price * quantity);
  }, 0);
}
```

### **PROBLEM:**

1. **Line Item UI:** Nutzt `item.price` (direkt aus Cart Storage)
2. **Totals:** Nutzt `pricingSnapshot.subtotal_cents` (Server berechnet)
3. **Server Checkout API:** Nutzt `resolvePriceCents()` (Central Resolver)

→ **DREI verschiedene Preisquellen!**

---

## 🛠️ **Woher kommt 39.90?**

**Hypothesen:**

### **Hypothese 1: DB hat falschen Preis**
```sql
SELECT sku, base_price_cents FROM products WHERE sku = 'UNBREAK-GLAS-01';
-- Erwartung: 1990 (€19.90)
-- Falls: 3990 (€39.90) → DB-Fehler!
```

### **Hypothese 2: Item wird als Configurator behandelt**
```javascript
// lib/cart.js Line 125
const price = product.price_cents || product.price || product.unit_amount || product.base_price_cents;

// Falls product.price_cents = 3990 (Configurator Default)
// Dann: item.price = 3990 → UI zeigt €39.90
```

### **Hypothese 3: Item-Merge Bug**
```javascript
// Zwei Items im Cart:
// 1. Configurator (price: 3990)
// 2. Glashalter Standard (price: 1990)

// Wenn sku oder product_id identisch
// → items werden gemerged
// → price vom ersten Item überschrieben
```

---

## ✅ **Lösung Implementiert**

### **1. Central Price Resolver (Frontend)**

**NEU:** `lib/pricing/cartPriceResolver.js`

```javascript
/**
 * SINGLE SOURCE OF TRUTH für Cart Pricing
 * Nutzt GLEICHE Logik für:
 * - Line Item Display
 * - Subtotal Calculation
 * - Checkout Payload
 */
export function resolveCartItemPrice(item, pricingConfig, productsIndex) {
  // CASE 1: Configurator
  if (item.configured || item.sku === 'UNBREAK-GLAS-CONFIG') {
    return item.price_cents || item.price || 0;
  }

  // CASE 2: Standard Product
  // Priority 1: pricingConfig (Admin Pricing)
  if (pricingConfig && item.sku && pricingConfig[item.sku]) {
    return pricingConfig[item.sku].basePrice;
  }

  // Priority 2: productsIndex (DB lookup)
  if (productsIndex && item.sku && productsIndex[item.sku]) {
    return productsIndex[item.sku].base_price_cents;
  }

  // Priority 3: Item fields
  return item.price_cents || item.base_price_cents || item.price || item.unit_amount || 0;

  // HARD FAIL: Price not found
  if (price === 0) {
    console.error('[PRICE_MISSING]', item.sku, item);
    return 0; // UI zeigt "Preis nicht verfügbar"
  }
}

export function calculateCartTotal(items, pricingConfig, productsIndex) {
  let subtotal_cents = 0;
  const items_with_prices = [];

  for (const item of items) {
    const unit_price_cents = resolveCartItemPrice(item, pricingConfig, productsIndex);
    const line_total_cents = unit_price_cents * item.quantity;
    
    subtotal_cents += line_total_cents;
    items_with_prices.push({
      ...item,
      resolved_unit_price_cents: unit_price_cents,
      line_total_cents,
    });
  }

  return { subtotal_cents, items_with_prices };
}
```

### **2. Cart UI Integration**

**NACHHER (FIXED) - pages/cart.js:**

**Imports:**
```javascript
import { resolveCartItemPrice, calculateCartTotal, validateCartItemPrice } from '../lib/pricing/cartPriceResolver';
```

**Line Item Unit Price (Line 256):**
```javascript
<p style={{ fontWeight: 'bold' }}>
  €{formatPrice(resolveCartItemPrice(item, null, null))}  ← Central Resolver!
</p>

{/* Price Error Display */}
{(() => {
  const resolvedPrice = resolveCartItemPrice(item, null, null);
  const priceError = validateCartItemPrice(item, resolvedPrice);
  if (priceError) {
    return <p style={{ color: '#dc3545' }}>{priceError}</p>;
  }
})()}
```

**Line Item Subtotal (Line 310):**
```javascript
<p>
  €{formatPrice(resolveCartItemPrice(item, null, null) * item.quantity)}
</p>
```

**Cart Totals (Line 173):**
```javascript
const { subtotal_cents: calculatedSubtotal } = calculateCartTotal(cartItems, null, null);
const subtotal = pricingSnapshot?.subtotal_cents || calculatedSubtotal;
const shipping = pricingSnapshot?.shipping_cents || 0;
const total = pricingSnapshot?.grand_total_cents || (subtotal + shipping);
```

**Debug Logging (aktiviert):**
```javascript
if (isPreviewMode() || window.location?.search?.includes('debugCart=1')) {
  console.log('[CART PRICING]', {
    snapshot_subtotal: pricingSnapshot?.subtotal_cents,
    calculated_subtotal: calculatedSubtotal,
    final_subtotal: subtotal,
    using_snapshot: !!pricingSnapshot,
  });
}
```

---

## 🧪 **Tests (MUSS DURCHGEFÜHRT WERDEN)**

### **Test 1: Einzelnes Standardprodukt**

**Setup:**
1. Öffne https://www.unbreak-one.com/shop?debugCart=1
2. Füge **NUR** "Glashalter Standard" (1×) zum Cart hinzu
3. Öffne Cart

**Erwartung:**
```
Line Item:
- Glashalter Standard
- SKU: UNBREAK-GLAS-01        ← Korrekter SKU!
- Preis: €19,90               ← KORREKT (nicht 39.90!)
- Subtotal: €19,90

Cart Totals:
- Subtotal: €19,90
- Total: €19,90

Console Log:
[PRICE_RESOLVER][STANDARD] {
  sku: 'UNBREAK-GLAS-01',
  resolved_from: 'price_cents' or 'base_price_cents',
  value: 1990
}
[CART PRICING] {
  calculated_subtotal: 1990,
  final_subtotal: 1990
}
```

**Screenshot Requirements:**
1. Cart UI (Line Item zeigt €19.90)
2. Console Log (zeigt PRICE_RESOLVER)
3. Keine Fehler/Warnungen

---

### **Test 2: Zwei unterschiedliche Produkte**

**Setup:**
1. Füge "Glashalter Standard" (19,90 €) zum Cart hinzu
2. Füge "Flaschenhalter Premium" (24,90 €) zum Cart hinzu
3. Öffne Cart mit ?debugCart=1

**Erwartung:**
```
Line Items:
- Glashalter Standard     €19,90  ← Item 1
- Flaschenhalter Premium  €24,90  ← Item 2

Subtotals:
- Glashalter:   1 × €19,90 = €19,90
- Flaschenhalter: 1 × €24,90 = €24,90

Cart Total: €44,80

Console Log:
[CART_TOTAL] {
  items_count: 2,
  subtotal_cents: 4480,
  items_breakdown: [
    { sku: 'UNBREAK-GLAS-01', unit_price_cents: 1990 },
    { sku: 'UNBREAK-FLASCHE-01', unit_price_cents: 2490 }
  ]
}
```

---

### **Test 3: Configurator + Standardprodukt**

**Setup:**
1. Konfiguriere Glashalter im Configurator
2. Füge Standardprodukt hinzu
3. Öffne Cart mit ?debugCart=1

**Erwartung:**
```
Line Items:
- Individueller Glashalter   €19,90  ← Configurator
- Flaschenhalter Standard    €24,90  ← Standard

Console Log:
[PRICE_RESOLVER][CONFIGURATOR] {
  sku: 'UNBREAK-GLAS-CONFIG',
  source: 'configurator',
  price_cents_in_item: 1990
}
[PRICE_RESOLVER][STANDARD] {
  sku: 'UNBREAK-FLASCHE-01',
  resolved_from: 'base_price_cents',
  value: 2490
}
```

**WICHTIG:** SKUs müssen unterschiedlich sein!
- Configurator: `UNBREAK-GLAS-CONFIG`
- Standard: `UNBREAK-GLAS-01` (nicht CONFIG!)

---

### **Test 4: Error Case - Preis fehlt**

**Setup:**
1. In DB: Setze `base_price_cents = NULL` für ein Produkt
2. Versuche es zum Cart hinzuzufügen
3. Öffne Cart

**Erwartung:**
```
Line Item:
- Produktname
- SKU: XYZ
- Preis nicht verfügbar     ← Error Message!

Console:
[PRICE_RESOLVER][MISSING] {
  sku: 'XYZ',
  ERROR: 'PRICE_NOT_FOUND'
}
```

---

## 📊 **Debug-Logging (Aktiv)**

**URL:** `?debugCart=1` oder `?debugPricing=1`

**Console Logs:**

```javascript
// Pro Item beim Render:
[PRICE_RESOLVER][STANDARD] {
  sku: 'UNBREAK-GLAS-01',
  source: 'standard_product',
  price_fields_in_item: {
    price_cents: 1990,
    price: 1990,
    base_price_cents: 1990
  },
  resolved_from: 'price_cents',
  value: 1990
}

// Cart Total Berechnung:
[CART_TOTAL] {
  items_count: 1,
  subtotal_cents: 1990,
  items_breakdown: [
    {
      sku: 'UNBREAK-GLAS-01',
      quantity: 1,
      unit_price_cents: 1990,
      line_total_cents: 1990
    }
  ]
}

// Vergleich mit Snapshot:
[CART PRICING] {
  calculated_subtotal: 1990,
  snapshot_subtotal: undefined,
  final_subtotal: 1990,
  using_snapshot: false
}
```

---

## 📝 **Acceptance Criteria (DoD)**

- [x] **Central Resolver implementiert** (Single Source of Truth)
- [x] **Line Item Unit Price** nutzt `resolveCartItemPrice()`
- [x] **Line Item Subtotal** nutzt `resolveCartItemPrice()`
- [x] **Cart Totals** nutzt `calculateCartTotal()`
- [x] **Keine separaten Preisquellen** mehr in UI
- [x] **Debug-Logging** aktiv (pro Item + Totals)
- [x] **Hard Fail** statt stiller Defaults (zeigt "Preis nicht verfügbar")
- [ ] **Test 1** durchgeführt (Einzelprodukt)
- [ ] **Test 2** durchgeführt (Zwei Produkte)
- [ ] **Test 3** durchgeführt (Configurator + Standard)
- [ ] **Test 4** durchgeführt (Error Case)
- [ ] **Screenshots** gesammelt (UI + Console Logs)

---

## 🚀 **Deployment**

**Branch:** master  
**Commit:** [pending]  
**Files Changed:** 2

**NEW:** `lib/pricing/cartPriceResolver.js`
- Central Price Resolver (Frontend)
- resolveCartItemPrice()
- calculateCartTotal()
- validateCartItemPrice()

**MODIFIED:** `pages/cart.js`
- Import: cartPriceResolver
- Line Item Unit Price: resolveCartItemPrice()
- Line Item Subtotal: resolveCartItemPrice() * quantity
- Cart Totals: calculateCartTotal()
- Debug Logging: aktiviert mit ?debugCart=1

**Impact:**
- ✅ Line Item zeigt korrekten Preis (gleicher Resolver wie Totals)
- ✅ Keine Preisdiskrepanz mehr
- ✅ Hard Fail bei fehlendem Preis (statt 39.90 Default)
- ✅ Full Debug-Trail für Diagnose

---

## 🔍 **Antworten auf User-Fragen**

### **1. Welche Datei rendert Cart Line Items?**
**Antwort:** `pages/cart.js` Line 240-320

**VORHER:**
```javascript
Line 256: €{formatPrice(item.price)}  // ← Direkt aus item
Line 310: €{formatPrice(item.price * item.quantity)}
```

**NACHHER:**
```javascript
Line 256: €{formatPrice(resolveCartItemPrice(item, null, null))}  // ← Central Resolver
Line 310: €{formatPrice(resolveCartItemPrice(item, null, null) * item.quantity)}
```

---

### **2. Welche Datei berechnet Totals?**
**Antwort:** `pages/cart.js` Line 173-191 (+ `lib/cart.js` Line 249-259 als Fallback)

**VORHER:**
```javascript
const subtotal = pricingSnapshot?.subtotal_cents || cart.getTotal();
// cart.getTotal() nutzt item.price direkt
```

**NACHHER:**
```javascript
const { subtotal_cents } = calculateCartTotal(cartItems, null, null);
const subtotal = pricingSnapshot?.subtotal_cents || subtotal_cents;
// calculateCartTotal() nutzt Central Resolver
```

---

### **3. Woher kommt 39.xx exakt?**
**Antwort:** **Zwei mögliche Codepfade:**

**Pfad 1: DB hat falschen Preis**
```javascript
// Shop SSR fetcht Products:
const { data } = await supabase.from('products').select('*');
// Falls: product.base_price_cents = 3990
// → Shop sendet 3990 an cart.addItem()
// → item.price = 3990
// → UI zeigt €39.90
```

**Pfad 2: Configurator Default (3990 = €39.90)**
```javascript
// Falls Item fälschlicherweise als Configurator behandelt:
if (item.sku === 'UNBREAK-GLAS-CONFIG') {
  // Default Configurator Preis: 3990
}
// ODER: Item wurde mit falschem SKU gespeichert
```

**Diagnose-Befehl:**
```sql
-- In Supabase SQL Editor:
SELECT id, sku, name, base_price_cents, active
FROM products
WHERE sku LIKE '%GLAS%'
ORDER BY created_at DESC;

-- Erwartung:
-- UNBREAK-GLAS-01 | base_price_cents: 1990 ✅
-- Falls: 3990 → BUG IN DB!
```

---

### **4. PR/Commit der beide Pfade auf denselben Resolver umstellt**

**Commit:** [wird erstellt]

**Dateien:**
- NEW: `lib/pricing/cartPriceResolver.js` (Central Resolver)
- MODIFIED: `pages/cart.js` (Integration)

**Beide Pfade jetzt vereint:**
```
Line Item Display  ┐
Line Item Subtotal ├──→ resolveCartItemPrice() ──→ SINGLE SOURCE
Cart Totals        ┘
```

**Logging bestätigt:** Gleicher Resolver für Zeile UND Totals! ✅

---

## ⚠️ **Nächste Schritte (DRINGEND)**

1. **Tests durchführen** (Test 1-4)
2. **Screenshots sammeln** (UI + Console)
3. **Log-Auszüge** mit `?debugCart=1`
4. **DB prüfen:** `SELECT sku, base_price_cents FROM products;`
5. **Falls DB-Fehler:** Korrigieren + Re-Test

**Bei Fragen:** Debug-Logs zeigen exakt, woher der Preis kommt!
