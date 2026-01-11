# Homepage Konfigurator UI - Status Update

## ✅ Fix 1/3: Ready Badge entfernt (DEPLOYED)

**Commit:** `6e433a7`  
**Deployed:** https://unbreak-one.vercel.app/configurator.html

### Änderung:
- Ready Badge (`✓ Ready`) nur noch mit `?debug=1` sichtbar
- Production: KEIN Badge mehr im UI
- Debug mode: Badge wie vorher verfügbar

### Test:
```
URL: https://unbreak-one.vercel.app/configurator.html
Erwartung: KEIN "Ready" Badge sichtbar

URL: https://unbreak-one.vercel.app/configurator.html?debug=1
Erwartung: "✓ Ready" Badge oben rechts
```

---

## ✅ Fix 2/3: Language Sync (BEREITS IMPLEMENTIERT)

**Status:** Keine Änderung nötig - System bereits komplett

### Implementierung:
Bridge v2.0 in `iframe-language-bridge-v2.js` enthält bereits:

1. **Initial Language Send:**
   ```javascript
   // Sendet Sprache beim Laden (500ms delay)
   setTimeout(() => sendLanguageToIframe(currentLang), 500);
   ```

2. **Language Change Listener:**
   ```javascript
   // Reagiert auf i18n languageChanged Event
   document.addEventListener('languageChanged', function(e) {
       const newLang = e.detail?.language || getCurrentLanguage();
       sendLanguageToIframe(newLang);
   });
   ```

3. **Handshake Protocol:**
   ```javascript
   // Beim READY signal vom iframe -> sende Language nochmal
   function handleIframeReady(message) {
       sendToIframe(EventTypes.PARENT_HELLO, {
           locale: currentLang,  // <- Sprache im Handshake
           parentVersion: '2.0.0'
       });
   }
   ```

4. **Security:**
   ```javascript
   // Origin check in bridge-schema.js
   AllowedOrigins: [
       'https://unbreak-one.vercel.app',
       'https://unbreak-3-d-konfigurator.vercel.app',
       /^https:\/\/unbreak-[a-z0-9-]+\.vercel\.app$/
   ]
   
   // targetOrigin exakt gesetzt
   iframe.contentWindow.postMessage(message, iframeOrigin);
   ```

5. **Message Payload:**
   ```javascript
   {
       event: "UNBREAK_PARENT_HELLO",
       payload: {
           locale: "de" | "en",
           parentVersion: "2.0.0"
       }
   }
   ```

### Test:
```
1. Öffne: https://unbreak-one.vercel.app/configurator.html
2. Console (TOP context): Suche nach [BRIDGE] Language messages
3. Erwartung: "Sending PARENT_HELLO with locale: de"
4. Wechsel: DE → EN oben rechts
5. Erwartung: "languageChanged event → sending to iframe: en"
6. iframe UI: Buttons/Labels sollten Sprache wechseln
```

**WICHTIG:** Damit das funktioniert, muss der **iframe** (https://unbreak-3-d-konfigurator.vercel.app) auf das `PARENT_HELLO` Event reagieren und seine UI aktualisieren. Wenn der iframe das nicht tut, ist das ein Problem im iframe-Code, NICHT in unserem Parent.

---

## ⚠️ Fix 3/3: Popup "In den Warenkorb! Konfiguration gespeichert"

### Analyse:

**Popup-Quellen in Parent-Code:**
1. ❌ Keine alert() bei Success in configurator.html
2. ❌ Keine alert() bei Success in iframe-language-bridge-v2.js
3. ✅ Nur alerts bei FEHLERN (z.B. API Error, Config invalid)
4. ✅ Kein alert('Konfiguration gespeichert') im Parent-Code

**Conclusion:** Das Popup kommt NICHT vom Parent-Code, sondern:
- **Option A:** Vom iframe selbst (https://unbreak-3-d-konfigurator.vercel.app)
- **Option B:** Von einem Browser-Feature (z.B. beforeunload handler)
- **Option C:** Von einem Service Worker / Extension

### Debugging:

1. **Popup Screenshot bitte:**
   - Exakter Text des Popups
   - Browser (Chrome/Firefox/Safari?)
   - Erscheint bei jedem Klick oder nur manchmal?

2. **Console Check:**
   ```javascript
   // In Browser Console (TOP context):
   // Check for beforeunload handlers
   window.onbeforeunload
   
   // Check for alert overrides
   console.log(alert.toString())
   ```

3. **Network Tab:**
   - Öffne DevTools → Network
   - Klick "In den Warenkorb"
   - Erscheint Popup BEVOR oder NACH API-Call?
   - Wird redirect zu Stripe blockiert?

### Mögliche Lösungen:

**Falls Popup vom iframe kommt:**
```javascript
// Im iframe-Code (unbreak-3-d-konfigurator.vercel.app):
// ENTFERNEN:
alert('In den Warenkorb! Konfiguration gespeichert');

// ERSETZEN MIT:
console.log('[3D] Konfiguration gesendet:', config);
// Oder toast notification statt alert
```

**Falls beforeunload Handler:**
```javascript
// In configurator.html ENTFERNEN:
window.onbeforeunload = function() {
    return "..."; // <- verhindert redirect
};
```

---

## Test-Protokoll

### Akzeptanztest A: Ready Badge
- [ ] URL: /configurator.html
- [ ] KEIN "Ready" Badge sichtbar
- [ ] Screenshot: Seite ohne Badge

### Akzeptanztest B: Popup
- [ ] URL: /configurator.html
- [ ] Klick "In den Warenkorb" im iframe
- [ ] KEIN Popup erscheint
- [ ] Redirect zu Stripe erfolgt sofort

### Akzeptanztest C: Language Sync
- [ ] URL: /configurator.html
- [ ] iframe lädt (3D Konfigurator sichtbar)
- [ ] Buttons im iframe zeigen deutsche Texte
- [ ] Klick DE→EN oben rechts
- [ ] Buttons im iframe wechseln zu englischen Texten
- [ ] Console zeigt: [BRIDGE] language messages

---

## Nächste Schritte

1. **Warte 30s für Vercel deployment** (Commit 6e433a7)
2. **Test Ready Badge:** https://unbreak-one.vercel.app/configurator.html
3. **Test Popup:** Klick "In den Warenkorb" - erscheint Popup?
4. **Test Language Sync:** DE/EN Switch - reagiert iframe?
5. **Berichte:**
   - Ready Badge: weg? ✅/❌
   - Popup: noch da? wenn ja → Screenshot
   - Language: funktioniert? wenn nein → Console logs

---

## Debug-Hilfe

### Falls Popup immer noch erscheint:

```javascript
// Browser Console (TOP context):

// 1. Override alert temporär
const originalAlert = window.alert;
window.alert = function(...args) {
    console.error('[ALERT INTERCEPTED]', args);
    console.trace(); // Zeigt Stacktrace wo alert() aufgerufen wird
    // originalAlert(...args); // Auskommentiert = kein Popup
};

// 2. Check iframe window
const iframe = document.getElementById('configurator-iframe');
console.log('iframe alert:', iframe.contentWindow.alert.toString());
```

### Falls Language Sync nicht funktioniert:

```javascript
// Browser Console (TOP context):

// 1. Manual trigger
window.iframeBridge?.setLanguage('en');

// 2. Check current state
console.log('Current lang:', window.iframeBridge?.getCurrentLanguage());
console.log('Handshake complete:', window.iframeBridge?.isHandshakeComplete());

// 3. Watch messages
window.addEventListener('message', (e) => {
    if (e.data?.event?.includes('LANG') || e.data?.type?.includes('lang')) {
        console.log('[LANG MESSAGE]', e.data);
    }
});
```

---

**Status:**
- ✅ Fix 1/3: Ready Badge (DEPLOYED)
- ✅ Fix 2/3: Language Sync (BEREITS VORHANDEN)
- ⏳ Fix 3/3: Popup (BENÖTIGT DEBUG INFO)
