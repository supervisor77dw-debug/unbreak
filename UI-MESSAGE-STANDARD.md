# UI-Message Standard (Shop, Production-Ready)

**Status:** ✅ IMPLEMENTIERT & DEPLOYED
**Datum:** 14. Januar 2026
**Gültigkeit:** Verbindlich für alle Shop-Frontend Messages

---

## 🎯 Grundprinzipien (Nicht verhandelbar)

1. **So wenig Meldungen wie möglich**
   - Nur wenn User-Aktion erforderlich oder wichtige Bestätigung
   - Keine Meldungen für interne Prozesse

2. **Keine technischen Begriffe**
   - ❌ API, Webhook, Trace, Snapshot, Session, Config
   - ✅ Klare, verständliche Sprache

3. **Keine Erfolgsmeldungen für Selbstverständliches**
   - ❌ "Produkt geladen", "Session gespeichert"
   - ✅ Nur wenn wirklich relevant (z.B. "Zum Warenkorb hinzugefügt")

4. **Fehler nur wenn User handeln muss**
   - ❌ Interne Server-Fehler ohne User-Kontext
   - ✅ "Bitte versuche es erneut" oder "Lade die Seite neu"

5. **DE & EN immer paarweise**
   - Jede Message hat beide Sprachen
   - Konsistenter Ton & Länge

---

## 📦 Implementierung

### **Zentrale Datei:** `lib/uiMessages.js`

```javascript
import { showUserMessage } from '../lib/uiMessages';

// Usage:
showUserMessage('addToCart', 'success', currentLang);
showUserMessage('cartLoadFailed', 'error', currentLang);
```

### **Verfügbare Messages:**

| Key | DE | EN | Typ | Dauer |
|-----|----|----|-----|-------|
| `addToCart` | Zum Warenkorb hinzugefügt | Added to cart | success | 1.5s |
| `requiredFields` | Bitte alle erforderlichen Angaben auswählen. | Please select all required options. | error | 4s |
| `configUnavailable` | Diese Konfiguration ist derzeit nicht verfügbar. | This configuration is currently unavailable. | error | 4s |
| `paymentFailed` | Die Zahlung konnte nicht abgeschlossen werden. Bitte versuche es erneut. | The payment could not be completed. Please try again. | error | 4s |
| `genericError` | Es ist ein unerwarteter Fehler aufgetreten. Bitte versuche es später erneut. | An unexpected error occurred. Please try again later. | error | 4s |
| `cartLoadFailed` | Der Warenkorb konnte nicht geladen werden. Bitte lade die Seite neu. | Cart could not be loaded. Please reload the page. | error | 4s |
| `cartAddFailed` | Produkt konnte nicht hinzugefügt werden. Bitte versuche es erneut. | Product could not be added. Please try again. | error | 4s |
| `configNotFound` | Die Konfiguration wurde nicht gefunden. | Configuration not found. | error | 4s |
| `configLoadFailed` | Die Konfiguration konnte nicht geladen werden. Bitte versuche es erneut. | Configuration could not be loaded. Please try again. | error | 4s |

---

## 🚫 VERBOTEN im Shop

Diese Meldungen dürfen **NIE** im Shop erscheinen:

- ❌ "Konfiguration gespeichert"
- ❌ "Produkt in Shop gelandet"
- ❌ "Pricing Snapshot erstellt"
- ❌ "Webhook verarbeitet"
- ❌ "Customer nicht verknüpft"
- ❌ "Legacy-Bestellung"
- ❌ "MwSt.-Ausweisung nicht verfügbar"
- ❌ "Session ID: abc123"
- ❌ "Trace ID: xyz789"
- ❌ "Coming soon" / "Englisch folgt bald"

→ Diese gehören ins **Admin-Panel** oder **Logs only**.

---

## ✅ Beispiele (Korrekte Nutzung)

### **1. Add to Cart (Optional)**
```javascript
// Nach erfolgreichem Hinzufügen zum Warenkorb
showUserMessage('addToCart', 'success', currentLang, 1500);
// → DE: "Zum Warenkorb hinzugefügt"
// → EN: "Added to cart"
// → 1.5 Sekunden, dann verschwindet

// Alternative: Gar keine Meldung (auch OK!)
// Nur Button-Feedback + Cart Count Update
```

### **2. Validierungsfehler**
```javascript
// User hat Pflichtfelder nicht ausgefüllt
showUserMessage('requiredFields', 'error', currentLang);
// → DE: "Bitte alle erforderlichen Angaben auswählen."
// → EN: "Please select all required options."
// → 4 Sekunden sichtbar
```

### **3. Checkout-Fehler**
```javascript
// Zahlung fehlgeschlagen
showUserMessage('paymentFailed', 'error', currentLang);
// → DE: "Die Zahlung konnte nicht abgeschlossen werden. Bitte versuche es erneut."
// → EN: "The payment could not be completed. Please try again."
```

### **4. Generischer Fehler**
```javascript
// Unerwarteter API-Fehler
showUserMessage('genericError', 'error', currentLang);
// → DE: "Es ist ein unerwarteter Fehler aufgetreten. Bitte versuche es später erneut."
// → EN: "An unexpected error occurred. Please try again later."
```

---

## 🎨 UI/UX Regeln

### **Toast Design:**
- **Position:** Top-right (80px from top, 20px from right)
- **Dauer:** 1.5–2s (Success), 4s (Error)
- **Animation:** Slide-in from right, slide-out after duration
- **Farben:**
  - Success: `#059669` (Grün)
  - Error: `#dc2626` (Rot)
- **Font:** System-Font, 14px, 500 weight
- **Kein Icon-Zirkus:** Nur Text, kein ✓ oder ❌ Prefix

### **Button Feedback (Add to Cart):**
```javascript
// Subtiler Checkmark statt Text
btn.textContent = '✓';
btn.style.background = '#059669';
// → Nach 1.2s zurück zum Original
```

→ **Kein Popup**, keine verbale Bestätigung nötig

---

## 📊 Migration (Alt → Neu)

| Alt (Hardcoded) | Neu (Standard) |
|-----------------|----------------|
| `showToast('❌ Konfiguration nicht gefunden', 'error')` | `showUserMessage('configNotFound', 'error', currentLang)` |
| `showToast('❌ Warenkorb konnte nicht geladen werden', 'error')` | `showUserMessage('cartLoadFailed', 'error', currentLang)` |
| `showToast('✓ In den Warenkorb gelegt', 'success')` | `showUserMessage('addToCart', 'success', currentLang, 1500)` |
| `showToast('❌ Fehler beim Hinzufügen', 'error')` | `showUserMessage('cartAddFailed', 'error', currentLang)` |
| `alert('Produkt hinzugefügt! Warenkorb: 3')` | **ENTFERNT** (Nur Button-Feedback) |

---

## 🔍 Debug-Mode

Messages erscheinen **nur in Debug-Mode** in der Console:

```javascript
// Debug aktivieren:
localStorage.setItem('U1_DEBUG', '1');
// Oder: ?debug=1 in URL

// Production (Standard):
// → Keine console.log/info/warn im Shop
// → Nur errorLog für kritische Fehler
```

---

## ✅ Abnahme-Checklist

Nach Implementierung muss der Shop erfüllen:

- [ ] ✅ Kein Popup beim Laden
- [ ] ✅ Kein Debug-Text sichtbar
- [ ] ✅ Max. 1 dezente Meldung beim Add-to-Cart (oder keine)
- [ ] ✅ Fehlertexte ruhig & verständlich (keine Tech-Begriffe)
- [ ] ✅ DE/EN konsistent (beide Sprachen vorhanden)
- [ ] ✅ Messe-tauglich, professionell, nicht "beta-haft"
- [ ] ✅ Keine "Coming soon" Messages
- [ ] ✅ Keine technischen IDs/Traces im UI

---

## 🛠️ Erweiterung

Neue Messages hinzufügen:

```javascript
// 1. In lib/uiMessages.js:
export const UI_MESSAGES = {
  // ... existing messages
  
  newMessage: {
    de: 'Deutscher Text hier',
    en: 'English text here',
  },
};

// 2. Im Shop verwenden:
showUserMessage('newMessage', 'error', currentLang);
```

**Regel:** Immer DE + EN paarweise, keine einseitigen Messages!

---

## 📝 Changelog

**v1.0.0 (14.01.2026):**
- ✅ Zentrale `lib/uiMessages.js` erstellt
- ✅ 9 Standard-Messages definiert (DE/EN)
- ✅ `pages/shop.js` migriert (alle `showToast` → `showUserMessage`)
- ✅ Verbose alerts entfernt (z.B. "Produkt hinzugefügt! Warenkorb: 3")
- ✅ Debug-System integriert (`lib/debugUtils.js`)
- ✅ Production-ready: Keine Dev-Noise mehr

---

**Deployed:** ✅ Commit `da991c1` + folgend
**Status:** Production-Ready für Messe (< 24h)
