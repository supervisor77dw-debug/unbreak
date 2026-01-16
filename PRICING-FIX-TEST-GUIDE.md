# CRITICAL PRICING FIX - Test & Verification Guide

**Date:** January 16, 2026  
**Priority:** CRITICAL / Messe-Blocking  
**Issue:** Preis-Mismatch Cart ↔ Checkout ↔ Stripe

---

## ✅ Was wurde implementiert

### 1. Central Pricing Resolver (`lib/pricing/pricingResolver.js`)
**Single Source of Truth** für alle Produktpreise:

- **Deterministic:** Gleicher Input → Gleicher Output
- **No Silent Fallbacks:** Fail loudly wenn Preis nicht auflösbar
- **Full Audit Trail:** Log source, matched record, version

**Funktionen:**
- `resolvePriceCents(item, supabase, traceId)` - Löst Preis auf
- `validatePricing(resolvedItems, traceId)` - Harte Validierung

**Unterstützte Quellen:**
1. **Configurator:** calcConfiguredPrice() aus DB
2. **Standard Products:** products.base_price_cents aus DB
3. **Fallback:** NONE - Hard fail if unresolvable

---

### 2. Umfangreiches Logging (vor Stripe-Call)

Jeder Checkout-Request loggt jetzt **strukturiert**:

```json
{
  "step": "cart_items_received",
  "trace_id": "uuid",
  "snapshot_id": "uuid",
  "cart_items_normalized": [
    {
      "id": "product_id",
      "sku": "UNBREAK-GLAS-01",
      "quantity": 2,
      "has_config": false,
      "configured": false,
      "price_fields_present": {
        "price": false,
        "price_cents": false,
        "unit_amount": false
      }
    }
  ]
}
```

```json
{
  "step": "price_resolution_complete",
  "trace_id": "uuid",
  "items_resolved": [
    {
      "keyUsedForLookup": "product_id:abc123",
      "resolved_unit_amount_cents": 1990,
      "source": "products_table",
      "matchedRecordId": "abc123",
      "quantity": 2,
      "line_total_cents": 3980
    }
  ],
  "subtotal_cents": 3980
}
```

```json
{
  "step": "stripe_line_items_final",
  "trace_id": "uuid",
  "stripe_line_items": [
    {
      "name": "Glashalter Standard",
      "quantity": 2,
      "unit_amount": 1990,
      "currency": "eur",
      "line_total": 3980
    },
    {
      "name": "Versand (DE)",
      "quantity": 1,
      "unit_amount": 490,
      "currency": "eur",
      "line_total": 490
    }
  ],
  "stripe_total_cents": 4470,
  "currency": "EUR",
  "locale": "de"
}
```

---

### 3. Harte Validierung

**Vor Stripe-Call:**
- `resolved_unit_amount_cents` muss integer > 0
- `quantity` muss integer >= 1
- `currency` muss "EUR"
- Stripe Total muss Snapshot Total matchen

**Bei Fehler:**
```json
{
  "error": "PRICE_RESOLUTION_FAILED",
  "message": "Failed to resolve price for item: PRODUCT_NOT_FOUND",
  "error_code": "PRODUCT_NOT_FOUND",
  "product_id": "abc123",
  "sku": "UNKNOWN",
  "details": {
    "searched_by": "product_id + sku",
    "reason": "Product not found in database or inactive"
  },
  "trace_id": "uuid"
}
```

**→ Return 400 + klarer Log**  
**→ KEIN stiller Fallback!**

---

## 🧪 Repro-Tests (MUSS DER CODER LIEFERN)

### Testfall 1: Zwei unterschiedliche Standardprodukte

**Setup:**
1. Öffne https://www.unbreak-one.com/shop
2. Füge "Glashalter Standard" zum Cart hinzu
3. Füge "Flaschenhalter Premium" zum Cart hinzu
4. Klicke "Checkout"

**Erwartung:**
- Cart zeigt: Glashalter €19.90, Flaschenhalter €24.90
- Stripe Checkout zeigt: gleiche Preise
- Subtotal korrekt: €44.80

**Screenshot Requirements:**
1. Cart UI (beide Items mit Preisen)
2. Browser Console (Log mit `trace_id`)
3. Stripe Checkout (beide Items sichtbar)

**Log zu prüfen:**
- `price_resolution_complete` zeigt 2 Items
- `stripe_line_items_final` zeigt korrekte `unit_amount` für beide

---

### Testfall 2: Configurator + Standardprodukt

**Setup:**
1. Öffne https://www.unbreak-one.com/configurator
2. Konfiguriere Glashalter (Base: Schwarz, Arm: Weiß, Modul: Holz)
3. "Add to Cart"
4. Zurück zu Shop
5. Füge "Flaschenhalter Standard" hinzu
6. Klicke "Checkout"

**Erwartung:**
- Configurator-Item: Preis aus Pricing DB (z.B. €19.90 + Aufpreise)
- Standardprodukt: Preis aus products.base_price_cents
- Subtotal = Summe beider

**Screenshot Requirements:**
1. Cart UI (beide Items)
2. Console Log mit `price_resolution_complete` (zeigt 2x `source`)
3. Stripe Checkout

**Log zu prüfen:**
```json
{
  "step": "price_resolution_complete",
  "items_resolved": [
    {
      "source": "configurator_db",
      "resolved_unit_amount_cents": 1990,
      "keyUsedForLookup": "variant:schwarz"
    },
    {
      "source": "products_table",
      "resolved_unit_amount_cents": 2490,
      "keyUsedForLookup": "product_id:xyz"
    }
  ]
}
```

---

### Testfall 3: Error Case - Inaktives Produkt

**Setup:**
1. In Supabase: Setze ein Produkt auf `active = false`
2. Versuche dieses Produkt zum Cart hinzuzufügen (via direktem API-Call)
3. Klicke "Checkout"

**Erwartung:**
- **Checkout BLOCKIERT**
- Error: `PRICE_RESOLUTION_FAILED`
- Status: 400
- Klarer Log-Eintrag mit `PRODUCT_NOT_FOUND`

**Screenshot Requirements:**
1. Browser Console (Error Response)
2. Server Logs (Log-Eintrag mit `trace_id`)

---

## 📊 Log-Analyse (So debuggen)

### 1. Request-ID finden
Jeder Request hat eine `trace_id`. Suche in Logs:
```bash
grep "trace_id.*abc-123-xyz" logs/vercel.log
```

### 2. Pricing-Flow nachvollziehen
Für einen Request, schaue dir an:
1. `cart_items_received` - Was kam rein?
2. `price_resolution_complete` - Was wurde resolved?
3. `stripe_line_items_final` - Was geht an Stripe?

### 3. Mismatch diagnostizieren
Wenn Cart €39.90 zeigt, aber Stripe €19.90:
- Prüfe `resolved_unit_amount_cents` in `price_resolution_complete`
- Prüfe `unit_amount` in `stripe_line_items_final`
- Sind sie gleich? → Cart UI hat Bug
- Sind sie unterschiedlich? → Pricing Resolver hat Bug

---

## 🔧 Root Causes (wurden gefixt)

### ❌ VORHER (Broken)

**Problem 1: Zwei Preisfelder gemischt**
```javascript
// cart.js (Frontend)
price: product.price_cents || product.base_price_cents
→ speichert in cents

// Cart UI
€{formatPrice(item.price)} 
→ formatiert cents → EUR (OK)

// Checkout API (Backend)
const price = product.base_price_cents; // IMMER aus DB
→ ignoriert Frontend-Preis (OK, ist Security)

// ABER: Cart UI zeigt manchmal falschen Wert,
// weil Frontend-Item.price inkonsistent war
```

**Problem 2: SKU/ID Collision?**
→ **NICHT der Fall!** Backend nutzt immer `product_id` als Primary Key.

**Problem 3: Admin-Channel liefert falsche Zuordnung?**
→ **GELÖST!** Central Resolver nutzt deterministischen Lookup:
  1. `product_id` (primary)
  2. `sku` (fallback)
  3. Fail if not found (kein silent fallback!)

### ✅ NACHHER (Fixed)

**Central Pricing Resolver:**
```javascript
// SINGLE function für ALLE Preise
const result = await resolvePriceCents(item, supabase, traceId);

// Result:
{
  success: true,
  unit_amount_cents: 1990, // IMMER cents, IMMER integer
  source: "products_table", // oder "configurator_db"
  matchedKey: "product_id:abc123",
  details: { sku, name, active }
}
```

**Harte Validierung:**
```javascript
// KEIN stiller Fallback
if (!result.success) {
  return 400 + CLEAR ERROR MESSAGE
}

// Stripe Total muss Snapshot matchen
if (stripe_total !== snapshot_total) {
  return 500 + PRICING_VERIFICATION_FAILED
}
```

---

## 📝 Acceptance Criteria (Definition of Done)

- [x] **Central Pricing Resolver** implementiert
- [x] **Ein Preis pro Item** (unit_amount_cents)
- [x] **Subtotal = Sum(unit × qty) + Versand** konsistent
- [x] **Preise aus genauer EINER Source** (Resolver)
- [x] **Kein stiller Fallback** (hard fail bei Unklarheit)
- [x] **Umfangreiches Logging** vor Stripe-Call
- [ ] **Testfall 1** durchgeführt + Screenshots
- [ ] **Testfall 2** durchgeführt + Screenshots
- [ ] **Testfall 3** durchgeführt + Screenshots
- [ ] **Log-Auszüge** mit Request-ID gesammelt

---

## 🚀 Deployment

**Branch:** master  
**Commit:** [pending]  
**Tag:** [pending after tests]

**Nächste Schritte:**
1. ✅ Code committed
2. ⏳ Tests durchführen (Testfall 1-3)
3. ⏳ Screenshots sammeln
4. ⏳ Log-Auszüge extrahieren
5. ⏳ Tag erstellen (z.B. `v1.2-pricing-fix`)
6. ⏳ Production Deploy

---

## 📞 Support / Debugging

**Bei Pricing-Problemen:**
1. Hole Request-ID aus Response (`trace_id`)
2. Suche Logs: `grep "trace_id.*<ID>" ...`
3. Prüfe `price_resolution_complete` Step
4. Vergleiche mit `stripe_line_items_final`

**Häufige Fehler:**
- `PRODUCT_NOT_FOUND` → Produkt inaktiv oder ID falsch
- `CONFIGURATOR_PRICE_INVALID` → Pricing Config fehlt in DB
- `PRICE_VALIDATION_FAILED` → Preis ist 0 oder negativ
- `PRICING_VERIFICATION_FAILED` → Stripe Total ≠ Snapshot (BUG!)

**Eskalation:**
→ Bei `PRICING_VERIFICATION_FAILED` SOFORT debuggen!  
→ Das bedeutet Cart UI vs Backend sind out-of-sync.
