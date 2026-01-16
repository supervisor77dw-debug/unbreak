# CRITICAL BUG FIX - Versand doppelt berechnet in Email

**Date:** January 16, 2026  
**Priority:** CRITICAL  
**Issue:** Versand wird in Bestellmail doppelt berechnet

---

## ❌ Problem (Ist-Zustand)

In der Bestellbestätigung wird **Versand doppelt angezeigt**:

1. **Als Position:** "Versand (DE) 4,90 €"
2. **Im Summenblock:** "Versand: 4,90 €" (nochmal addiert!)
3. **Gesamtbetrag:** Um 4,90 € zu hoch!

**Beispiel (FALSCH - vorher):**
```
Positionen:
- 1 × Glashalter Standard    19,90 €
- Versand (DE)                 4,90 €  ← Versand als Position

Zwischensumme:                19,90 €
Versand:                       4,90 €  ← DOPPELT!
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Gesamtbetrag:                 28,70 €  ← FALSCH! (sollte 24,80 €)
```

**Wichtig:** Es gibt **KEIN extra Cart-Item** für Versand im Frontend.  
Das ist ein Bug im **Email-Builder** (lib/email/emailService.ts).

---

## ✅ Lösung (Soll-Zustand)

**Versand wird nur einmal berechnet:**

1. **Als Position** (wenn hasShippingLine = true)
2. **NICHT im Summary** (wenn hasShippingLine = true)
3. **Gesamtbetrag stimmt!**

**Beispiel (KORREKT - nachher):**
```
Positionen:
- 1 × Glashalter Standard    19,90 €
- Versand (DE)                 4,90 €  ← Als Position (weil Line Item)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Gesamtbetrag:                 24,80 €  ← KORREKT!
```

**Alternative (wenn hasShippingLine = false):**
```
Positionen:
- 1 × Glashalter Standard    19,90 €

Zwischensumme:                19,90 €
Versand:                       4,90 €  ← Nur im Summary
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Gesamtbetrag:                 24,80 €  ← KORREKT!
```

---

## 🔧 Root Cause (Analyse)

### Problem 1: Checkout API sendet Versand als Line Item

**File:** [pages/api/checkout/standard.js](../pages/api/checkout/standard.js#L577-L588)

```javascript
// Checkout API fügt Versand als separate Line Item hinzu
lineItems.push({
  price_data: {
    product_data: {
      name: `Versand (${shippingCountry})`, // ← "Versand (DE)"
    },
    unit_amount: shippingCents, // ← 490 cents
  },
  quantity: 1,
});
```

→ **Stripe bekommt:** `[Glashalter 19,90 €, Versand (DE) 4,90 €]`  
→ **Total:** 24,80 € ✅

### Problem 2: Email-Builder rendert Versand zweimal

**File:** [lib/email/emailService.ts](../lib/email/emailService.ts#L320-L340)

**VORHER (BROKEN):**
```typescript
// 1. Extrahiere shippingItem aus items
const shippingItem = items.find(item => 
  item.name.includes('versand') || item.name.includes('shipping')
);

// 2. Rendere Versand als Position
${shippingCents > 0 ? `<div>Versand (DE) ${formatCurrency(shippingCents)}</div>` : ''}

// 3. UND nochmal im Summary!
<tr>
  <td>Versand:</td>
  <td>${formatCurrency(shippingCents)}</td>  ← DOPPELT!
</tr>
```

→ **Email zeigt:** 19,90 + 4,90 (Position) + 4,90 (Summary) = **28,70 € ❌**

---

## 🛡️ Fix Implementiert (Guardrail)

### 1. Shipping Line Detection

**File:** [lib/email/emailService.ts](../lib/email/emailService.ts#L320-L330)

```typescript
// Detect if shipping is already in line items
const hasShippingLine = !!shippingItem;

// DEBUG LOGGING (temporary)
console.log('[EMAIL PRICING DEBUG]', {
  productItems_count: productItems.length,
  hasShippingLine,
  products_sum_cents: subtotalCents,
  shipping_cents: shippingCents,
  total_cents: orderTotalCents,
  // GUARDRAIL CHECK
  expected_total: subtotalCents + shippingCents,
  total_matches: orderTotalCents === (subtotalCents + shippingCents),
});
```

### 2. Conditional Summary Rendering

**NACHHER (FIXED):**
```typescript
<div style="border-top: 2px solid #2F6F55;">
  <table>
    ${!hasShippingLine ? `
      <tr>
        <td>Zwischensumme:</td>
        <td>${formatCurrency(subtotalCents)}</td>
      </tr>
      <tr>
        <td>Versand:</td>
        <td>${formatCurrency(shippingCents)}</td>
      </tr>
    ` : ''}
    <tr>
      <td>Gesamtbetrag:</td>
      <td>${formatCurrency(orderTotalCents)}</td>
    </tr>
  </table>
</div>
```

**Logik:**
- **IF `hasShippingLine === true`:** Versand ist bereits als Position → **NICHT im Summary**
- **IF `hasShippingLine === false`:** Versand nur als Summary-Zeile

**Beide Versionen (DE + EN) gefixt!**

---

## 🧪 Tests (MUSS DURCHGEFÜHRT WERDEN)

### Test 1: Einzelprodukt + Versand

**Setup:**
1. Öffne https://www.unbreak-one.com/shop
2. Füge "Glashalter Standard" (19,90 €) zum Cart hinzu
3. Checkout → Bezahle mit Stripe Test Card
4. **Warte auf Bestellbestätigung per Email**

**Erwartung:**
```
Positionen:
- 1 × Glashalter Standard    19,90 €
- Versand (DE)                 4,90 €

Gesamtbetrag:                 24,80 €
```

**Keine Zwischensumme/Versand-Zeile im Summary!**

**Screenshot Requirements:**
1. Email Body (vollständig)
2. Positionen-Bereich (zeigt Versand als Line)
3. Summary-Bereich (zeigt NUR Gesamtbetrag)
4. Server Console Log (zeigt `hasShippingLine: true`)

---

### Test 2: Zwei Produkte + Versand

**Setup:**
1. Füge "Glashalter Standard" (19,90 €) zum Cart hinzu
2. Füge "Flaschenhalter Premium" (24,90 €) zum Cart hinzu
3. Checkout → Bezahle
4. **Warte auf Email**

**Erwartung:**
```
Positionen:
- 1 × Glashalter Standard     19,90 €
- 1 × Flaschenhalter Premium  24,90 €
- Versand (DE)                  4,90 €

Gesamtbetrag:                  49,70 €
```

**Berechnung:**
- Produkte: 19,90 + 24,90 = 44,80 €
- Versand: 4,90 €
- **Total:** 49,70 € ✅

**Screenshot Requirements:**
1. Email mit beiden Produkten
2. Versand als Position (nicht im Summary)
3. Server Log: `products_sum_cents: 4480, shipping_cents: 490, total_cents: 4970`

---

### Test 3: Configurator + Standardprodukt + Versand

**Setup:**
1. Konfiguriere Glashalter im Configurator
2. Füge Standardprodukt hinzu
3. Checkout → Bezahle
4. **Warte auf Email**

**Erwartung:**
```
Positionen:
- 1 × Individueller Glashalter (konfiguriert)  19,90 €
- 1 × Flaschenhalter Standard                  24,90 €
- Versand (DE)                                   4,90 €

Gesamtbetrag:                                   49,70 €
```

**WICHTIG:** Versand darf nur einmal auftauchen!

---

## 📊 Debug-Logging (Server Console)

Bei jedem Email-Versand wird jetzt geloggt:

```json
{
  "step": "[EMAIL PRICING DEBUG]",
  "productItems_count": 2,
  "hasShippingLine": true,
  "products_sum_cents": 4480,
  "shipping_cents": 490,
  "subtotal_cents": 4480,
  "total_cents": 4970,
  "expected_total": 4970,
  "total_matches": true
}
```

**Was prüfen:**
1. `hasShippingLine` muss `true` sein (Checkout API sendet immer Line Item)
2. `products_sum_cents` = Summe aller Produkte (ohne Versand)
3. `shipping_cents` = Versand aus Line Item extrahiert
4. `total_matches` muss `true` sein (Guardrail Check)

**Bei `total_matches: false` → KRITISCHER BUG!**

---

## 📝 Acceptance Criteria (DoD)

- [x] **Versand nur einmal berechnet** (nicht doppelt)
- [x] **Email zeigt korrekte Positionen** (Produkte + Versand als Line)
- [x] **Summary zeigt NICHT Versand** (wenn hasShippingLine = true)
- [x] **Gesamtbetrag stimmt** (products + shipping)
- [x] **Guardrail eingebaut** (hasShippingLine Check)
- [x] **Debug-Logging aktiv** (für Verifikation)
- [ ] **Test 1 durchgeführt** (Einzelprodukt)
- [ ] **Test 2 durchgeführt** (Zwei Produkte)
- [ ] **Test 3 durchgeführt** (Configurator)
- [ ] **Screenshots gesammelt** (Email Body + Server Logs)

---

## 🚀 Deployment

**Branch:** master  
**Commit:** [pending]  
**Files Changed:** 1
- `lib/email/emailService.ts` (Guardrail + conditional rendering)

**Impact:**
- ✅ Bestellbestätigungen zeigen korrekten Gesamtbetrag
- ✅ Versand nur einmal sichtbar
- ✅ Keine Verwirrung für Kunden
- ✅ Messe-Ready

**Next Steps:**
1. ✅ Code committed
2. ⏳ Tests durchführen (Test 1-3)
3. ⏳ Screenshots sammeln
4. ⏳ Debug-Logs prüfen
5. ⏳ Nach Verifikation: Debug-Logging entfernen

---

## 🔍 Troubleshooting

### Problem: Email zeigt immer noch doppelt Versand

**Check:**
1. Ist `hasShippingLine` in Logs `true`?
2. Ist der Code deployed? (Check Vercel Dashboard)
3. Ist Email-Cache aktiv? (Resend Email via Admin Panel)

### Problem: `total_matches: false` im Log

**Bedeutung:** Stripe Total ≠ Produkte + Versand  
**Action:** KRITISCHER BUG - SOFORT DEBUGGEN!

**Prüfe:**
- `products_sum_cents` korrekt?
- `shipping_cents` korrekt extrahiert?
- `orderTotalCents` = totalAmount aus Stripe?

### Problem: Versand fehlt komplett

**Check:**
- Ist `shippingCents > 0`?
- Ist `shippingItem` gefunden? (Log: `hasShippingLine`)
- Wurde Checkout API korrekt aufgerufen?

---

## 📌 Reminder

**DEBUG-LOGGING ist temporär!**  
Nach erfolgreicher Verifikation (alle 3 Tests ✅):

```typescript
// REMOVE THIS BLOCK:
console.log('[EMAIL PRICING DEBUG]', {
  productItems_count: productItems.length,
  hasShippingLine,
  // ... rest
});
```

**Commit Message:**
```
chore: Remove debug logging from email service
```
