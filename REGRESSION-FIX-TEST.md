# Regression Fix - Test Checkliste

**Datum:** 2026-01-11  
**Fixes:** Language Switch + Checkout Regression

---

## ✅ TEIL 1: Language Switch Test

### Test-Schritte:

1. **Seite laden**
   ```
   https://unbreak-one.vercel.app/configurator
   ```

2. **Console öffnen** (F12)

3. **Initial-Zustand prüfen**
   - iFrame sollte auf DE sein
   - Console Log: `[PARENT][LANG] Sending language to iframe: de`
   - Console Log: `[PARENT][LANG] Message structure:` mit `event` + `type`

4. **Sprache auf EN switchen**
   - DE/EN Button in Header klicken

5. **Erwartete Console Logs (innerhalb 1-2s):**
   ```
   [PARENT][LANG] Sending language to iframe: en
   [PARENT][LANG] Message structure: {
     event: "UNBREAK_SET_LANG",
     type: "UNBREAK_SET_LANG",
     lang: "en",
     correlationId: "msg_..."
   }
   [PARENT][MSG_IN] Message received: { ... }
   [PARENT][LANG][ACK] ✅ ACK received from iframe
   [PARENT][LANG][ACK] ✅ Confirmed in Xms (after 0 retries)
   [PARENT][LANG][ACK] ✅ Language synchronized: en
   ```

6. **Visuell prüfen:**
   - ✅ iFrame UI wechselt auf Englisch
   - ✅ Keine `[LANG][RETRY]` Messages
   - ✅ Keine `[LANG][NO_ACK] Max retries reached`

### ❌ Fehlerfall:

Wenn immer noch `[LANG][NO_ACK]` erscheint:
```
Problem: iframe sendet kein ACK zurück
→ Prüfe im iframe Code ob message listener existiert
→ Prüfe ob iframe auf 'type' oder 'event' prüft (wir senden jetzt BEIDE)
```

---

## ✅ TEIL 2: Checkout / Add-to-Cart Test

### Test-Schritte:

1. **Seite laden**
   ```
   https://unbreak-one.vercel.app/configurator
   ```

2. **Console öffnen** (F12)

3. **Farben auswählen**
   - Mindestens alle 4 Farben setzen (Base, Arm, Module, Pattern)
   
4. **Config-Change Logs prüfen:**
   ```
   [PARENT][MSG_IN] Message received: { event: "UNBREAK_CONFIG_CHANGED", ... }
   [PARENT][BRIDGE] Message validation: ✅
   ```

5. **"In den Warenkorb" im iFrame klicken**

6. **Erwartete Console Logs:**
   ```
   [PARENT][MSG_IN] Message received: {
     event: "UNBREAK_ADD_TO_CART",
     type: "UNBREAK_ADD_TO_CART",
     ...
   }
   [PARENT][CART] *** ADD_TO_CART received ***
   
   ┌─────────────────┬────────────────────┐
   │ SKU             │ UNBREAK-GLAS-01   │
   │ Variant         │ glass_holder      │
   │ Base Color      │ mint              │
   │ Arm Color       │ green             │
   │ Module Color    │ black             │
   │ Pattern Color   │ red               │
   │ Finish          │ matte             │
   │ Quantity        │ 1                 │
   │ Language        │ de                │
   │ Price           │ 4900              │
   └─────────────────┴────────────────────┘
   
   [PARENT][CHECKOUT] ✅ Calling createCheckoutFromConfig...
   [PARENT][CHECKOUT] ✅ Checkout URL received: https://checkout.stripe.com/...
   [PARENT][STRIPE] 🔄 Redirecting to: https://checkout.stripe.com/...
   ```

7. **Network Tab prüfen:**
   - ✅ POST Request zu `/api/checkout/create` 
   - ✅ Status 200 oder 302 (Redirect)
   - ✅ Response enthält `checkout_url`

8. **Visuell prüfen:**
   - ✅ Browser redirected zu Stripe Checkout
   - ✅ Produkt-Details korrekt (Farben, Preis)

### ❌ Fehlerfall A: "Config gespeichert" + Stopp

```
[PARENT][CART] *** ADD_TO_CART received ***
[PARENT][CHECKOUT] ❌ UnbreakCheckout.createCheckoutFromConfig not available!

Problem: checkout.js nicht geladen oder falsche Reihenfolge
→ Prüfe configurator.html: checkout.js VOR iframe-language-bridge-v2.js
→ Prüfe Console: "UnbreakCheckout available: object"
```

### ❌ Fehlerfall B: Checkout API Error

```
[PARENT][CHECKOUT] ❌ Error: ...
[PARENT][CHECKOUT] ❌ Stack: ...

Problem: Backend API Fehler
→ Prüfe Network Tab: Request Payload korrekt?
→ Prüfe Response: Error Message?
→ Prüfe Backend Logs (Vercel)
```

---

## ✅ TEIL 3: Config Changed Test (kein Checkout)

### Test-Schritte:

1. **Farbe ändern** (nicht "In den Warenkorb" klicken)

2. **Erwartete Console Logs:**
   ```
   [PARENT][MSG_IN] Message received: {
     event: "UNBREAK_CONFIG_CHANGED",
     ...
   }
   ```

3. **Kein Checkout:**
   - ✅ KEIN `[PARENT][CART]` Log
   - ✅ KEIN `[PARENT][CHECKOUT]` Log
   - ✅ Kein Redirect

---

## 🔍 Debug Commands

### Check if Systems Ready:
```javascript
// In Browser Console:

// 1. Checkout System
console.log('UnbreakCheckout:', typeof window.UnbreakCheckout);
console.log('createCheckoutFromConfig:', typeof window.UnbreakCheckout?.createCheckoutFromConfig);

// 2. Bridge System
console.log('ConfiguratorBridge:', typeof window.ConfiguratorBridge);
const bridge = window.getConfiguratorBridge?.();
console.log('Bridge instance:', bridge);
console.log('Bridge ready:', bridge?.isReady());

// 3. Last Messages
console.log('Last config:', bridge?.lastConfig);
console.log('Last lang sent:', window.UnbreakBridgeDebug?.lastLangSent);
console.log('Last ACK:', window.UnbreakBridgeDebug?.lastAckReceived);
```

### Force Language Switch (Manual Test):
```javascript
// Trigger language change manually
document.dispatchEvent(new CustomEvent('languageChanged', {
  detail: { language: 'en' }
}));
```

### Get Full Debug Dump:
```javascript
window.UnbreakBridgeDebug.getDump();
window.UnbreakBridgeDebug.copyDump(); // Copy to clipboard
```

---

## 📊 Success Criteria

### TEIL 1: Language ✅
- [ ] Switch DE→EN: iFrame wechselt sichtbar innerhalb 1-2s
- [ ] Console: ACK received within 1s
- [ ] Keine Retry-Messages
- [ ] Keine NO_ACK Messages

### TEIL 2: Checkout ✅
- [ ] Config Change: Logs erscheinen, KEIN Checkout
- [ ] Add to Cart: Vollständige Log-Chain sichtbar
- [ ] Network: POST /api/checkout/create mit Status 200
- [ ] Browser: Redirect zu Stripe Checkout
- [ ] Stripe: Korrekte Produkt-Details (Farben, Preis)

### TEIL 3: Keine Alerts ✅
- [ ] Keine `alert()` Popups während normalem Flow
- [ ] Nur `console.log/info/warn` für Debugging

---

## 🚀 Deployment

Änderungen wurden committed:
```bash
git commit -m "fix: Language + Checkout regression

TEIL 1 - Language Communication:
- Send BOTH type + event fields for compatibility
- Accept BOTH on receive (normalize)
- Clear logging which field was checked
- ACK within 1s, no retries

TEIL 2 - Checkout Regression:
- Clear log chain: MSG_IN → BRIDGE → CART → CHECKOUT → STRIPE
- console.table() for config details
- Removed alert() spam
- Better error messages

TEIL 3 - Test Guide included"
```

Nach Deployment:
1. Hard Reload: `Strg + Shift + R`
2. Run Test Checkliste
3. Report Results

---

**Status:** 🟡 Pending Testing  
**Expected:** 🟢 All Green after Deploy
