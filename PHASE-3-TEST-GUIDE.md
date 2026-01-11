# PHASE 3 – Checkout-Flow Test Guide

## Ziel
Verifizieren, dass der Klick "In den Warenkorb" im iframe den Stripe Checkout auslöst.

## Voraussetzungen
✅ PHASE 0: Debug-UI entfernt
✅ PHASE 1: i18n-Keys ersetzt durch echte Texte
✅ PHASE 2: Auto-Scroll funktioniert, iframe hat min-height

## Bridge v2.0 System Status
Alle Scripts sind korrekt geladen in dieser Reihenfolge:
1. `checkout.js` - Stellt `createCheckoutFromConfig()` bereit
2. `bridge-schema.js` - Message Schema
3. `bridge-debug.js` - Debug Logger
4. `bridge-debug-panel.js` - Visual Debug Panel
5. `iframe-language-bridge-v2.js` - Message Handler

## Test-Protokoll

### 1. Deployment abwarten
```
URL: https://unbreak-one.vercel.app/configurator.html
Warten: ~30 Sekunden nach letztem git push
Commit: 929f22b
```

### 2. Seite öffnen (Hard Refresh)
```
Aktion: Ctrl + Shift + R (Windows) oder Cmd + Shift + R (Mac)
Erwartung: Seite lädt frisch, keine Cache-Probleme
```

### 3. Console öffnen (TOP Context!)
```
Browser: F12 oder Rechtsklick > Untersuchen
Tab: Console
WICHTIG: Dropdown oben links auf "top" setzen (NICHT "configurator-iframe")
```

### 4. Initiale Console-Logs prüfen
```
Erwartete Ausgaben:
✅ [AUTO-SCROLL] Scrolled to configurator section
✅ [INIT] Bridge System Loading...
✅ [INIT] DOMContentLoaded - Checking Bridge availability...
✅ [INIT] Bridge Debug enabled
✅ [BRIDGE] All iframe communication handled by iframe-language-bridge-v2.js

Wenn diese Logs fehlen:
❌ Scripts nicht geladen → Hard Refresh wiederholen
❌ Falsche Console Context → Auf "top" umstellen
```

### 5. iframe Laden abwarten
```
Visuelle Prüfung:
- Loading Overlay verschwindet
- 3D-Konfigurator wird sichtbar
- Farben/Produkt interaktiv

Console:
- [3D_IFRAME_LOADED] onload event fired
- Ggf. READY Messages vom iframe
```

### 6. Konfigurator bedienen
```
Im iframe:
1. Farben auswählen (z.B. Blau + Gold)
2. Produkt drehen/ansehen
3. Button "In den Warenkorb" klicken

WICHTIG: Button ist IM iframe, nicht außerhalb!
```

### 7. Checkout-Flow beobachten

#### Console-Logs (TOP Context):
```
Erwartete Sequenz:
[BRIDGE] Message received: {...}
[BRIDGE] Validation: OK
[BRIDGE] Handler matched: UNBREAK_ADD_TO_CART
[BRIDGE] Checkout triggered
[BRIDGE] API call started: POST /api/checkout/create
[BRIDGE] API response: {...}
[BRIDGE] Redirect to Stripe...
```

#### Browser-Verhalten:
```
Erwartung:
1. Kurze Pause (API-Call)
2. Redirect zu checkout.stripe.com
3. Stripe Payment Page lädt

Falls NICHT:
❌ Keine [BRIDGE] Logs → iframe sendet nicht / falsche origin
❌ Logs stoppen bei "API call started" → Backend Error
❌ "API response" aber kein Redirect → Fehler in Session-Erstellung
```

### 8. Test-Ergebnisse dokumentieren

#### ✅ ERFOLG:
```
- Klick im iframe erkannt
- [BRIDGE] Logs komplett
- Redirect zu Stripe erfolgt
- Stripe Payment Page sichtbar

Screenshot:
1. Console mit vollständiger [BRIDGE] Log-Sequenz
2. Stripe Payment Page

→ PHASE 3 BESTANDEN
```

#### ❌ FEHLER:
```
Mögliche Probleme:

1. Keine [BRIDGE] Logs:
   - Console auf "top" setzen?
   - Scripts geladen? (Network Tab prüfen)
   - iframe origin korrekt? (unbreak-3-d-konfigurator.vercel.app)

2. Logs stoppen bei Validation:
   - Message format falsch
   - Origin nicht whitelisted
   → Debug Mode aktivieren: ?debug=1

3. API Error:
   - /api/checkout/create antwortet mit 500/400
   - Config invalid
   → Network Tab > /api/checkout/create > Response prüfen

4. Kein Redirect:
   - Session ID fehlt
   - Stripe Error
   → Console Error Message kopieren

Für alle Fehler:
→ Screenshot der Console (volle Logs)
→ Screenshot des Network Tab (/api/checkout/create)
→ Fehlermeldung kopieren
```

## Debug-Modus (bei Problemen)

### Debug Panel aktivieren:
```
URL: https://unbreak-one.vercel.app/configurator.html?debug=1

Zeigt:
- Debug Bar oben (Statistiken)
- Ctrl+Shift+D öffnet Debug Panel
- Alle Message-Flows visualisiert
- Stats: messagesReceived, checkoutTriggered, apiCalls, etc.
```

### Bridge Dump exportieren:
```javascript
// In Console (TOP Context):
window.UnbreakBridgeDebug.copyDump()

// Dann: Strg+V in Textdatei → speichern → mir senden
```

## Akzeptanzkriterien PHASE 3

- [x] Scripts korrekt geladen (checkout.js + Bridge v2.0)
- [x] Auto-Scroll funktioniert
- [x] iframe lädt und ist interaktiv
- [ ] **Klick "In den Warenkorb" triggert Checkout**
- [ ] **[BRIDGE] Logs zeigen kompletten Flow**
- [ ] **Redirect zu Stripe erfolgt**
- [ ] **Stripe Payment Page lädt**

## Nächste Schritte

### Wenn PHASE 3 ✅:
```
→ System ist produktionsbereit
→ Menüpunkt "Konfigurator" funktioniert
→ Vollständiger Checkout-Flow verifiziert
```

### Wenn PHASE 3 ❌:
```
→ Console Logs + Screenshots senden
→ Debug Dump exportieren
→ Fehler analysieren
→ Gezielten Fix implementieren
```

---

**Stand:** PHASE 2 abgeschlossen (929f22b)  
**Nächster Commit:** Nur bei Bugfixes nötig  
**Test URL:** https://unbreak-one.vercel.app/configurator.html
