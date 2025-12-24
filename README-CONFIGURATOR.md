# UNBREAK ONE - 3D Configurator Integration

## 🎯 Implementierungs-Übersicht

### Geänderte Dateien

#### 1. **configurator/configurator.js** (Hauptlogik)
- ✅ IIFE Wrapper gegen globale Scope-Pollution
- ✅ Debug-Mode mit URL-Parameter `?debug=1`
- ✅ Event-Log (max. 20 Einträge) für Debugging
- ✅ `resetStates()` Funktion für saubere State-Resets
- ✅ Message-Listener Cleanup bei `pagehide` (kein Memory Leak)
- ✅ iframe `onLoad` Fallback (3s Soft-Reload wenn kein READY)
- ✅ 15s Timeout-Fallback
- ✅ Origin-Whitelist für postMessage Security
- ✅ Robuste Event-Handler (READY/LOADING/ERROR)

#### 2. **configurator.html** (UI)
- ✅ Debug-Log Container hinzugefügt
- ✅ Event-Log mit Clear-Button

#### 3. **configurator/configurator.css** (Styling)
- ✅ Debug-Log Styles (fixed bottom-right, responsive)
- ✅ Event-Highlighting (grün/rot für success/error)
- ✅ Mobile-optimiert

#### 4. **Test-Setup** (Neu)
- ✅ `package.json` - npm scripts
- ✅ `playwright.config.js` - Playwright Konfiguration
- ✅ `tests/configurator.spec.js` - 11 E2E Tests
- ✅ `TESTING.md` - Manuelle Checkliste (20 Testfälle)

---

## 🔧 Implementierte Fixes

### 1. **iframe onLoad Fallback**
```javascript
iframe.addEventListener('load', () => {
  // Nach 3s ohne READY: Soft-Reload versuchen (nur einmal)
  if (!isReady && !iframeLoadAttempted) {
    setTimeout(() => {
      if (!isReady) {
        iframe.src = baseUrl + '?retry=' + Date.now();
      }
    }, 3000);
  }
});
```

**Warum?**
- iframe kann geladen sein, aber 3D-Model noch nicht
- Soft-Reload gibt Konfigurator zweite Chance
- Verhindert dass User 15s warten muss

### 2. **Message-Listener Cleanup**
```javascript
window.addEventListener('pagehide', () => {
  window.removeEventListener('message', messageHandler);
  clearTimeout(timeoutTimer);
  clearTimeout(iframeLoadTimer);
});
```

**Warum?**
- Verhindert Memory Leaks
- Bei Navigation zurück zur Seite: neuer Listener wird registriert
- Keine doppelten Listener

### 3. **State Reset bei Navigation**
```javascript
function resetStates() {
  isReady = false;
  // ... reset all UI states
  // ... clear timers
}
```

**Warum?**
- User navigiert weg und zurück → States müssen zurückgesetzt werden
- Verhindert dass alter State (z.B. Error) sichtbar bleibt
- Sprachwechsel triggert auch Reset

### 4. **Debug-Mode**
```javascript
// URL: ?debug=1
const DEBUG_MODE = urlParams.get('debug') === '1';

function logDebugEvent(type, message, isError) {
  eventLog.push({ timestamp, type, message, isError });
  if (DEBUG_MODE) {
    updateDebugUI(); // Zeigt Event-Log an
  }
}
```

**Warum?**
- Einfaches Debugging ohne DevTools
- Zeigt letzte 20 Events
- Timestamp + Typ + Message
- Farbcodierung (grün/rot)

### 5. **Origin-Check mit Whitelist**
```javascript
const allowedOrigins = [
  'https://unbreak-3-d-konfigurator.vercel.app',
  'http://localhost:5173',  // Vite Dev
  'http://localhost:3000'   // Alternative Dev
];

if (!allowedOrigins.includes(event.origin)) {
  return; // Ignoriere message
}
```

**Warum?**
- Sicherheit: Nur vertrauenswürdige origins
- Verhindert XSS/Injection
- Development + Production origins

### 6. **Responsive iframe Container**
```css
.viewer-wrapper-fullwidth {
  min-height: 80vh; /* Desktop */
}

@media (max-width: 768px) {
  .viewer-wrapper-fullwidth {
    min-height: 70vh; /* Mobile */
  }
}
```

**Warum?**
- Stellt sicher dass iframe immer sichtbare Höhe hat
- Verhindert "0px height" Bug
- Keine overflow-Clips

---

## 📊 Event-Logik Flow

```
1. Page Load
   ↓
2. DOMContentLoaded
   ↓
3. resetStates() → Alle States zurücksetzen
   ↓
4. iframe beginnt zu laden
   ↓
5. Loading Overlay sichtbar (opacity: 1, initial state)
   iframe unsichtbar (opacity: 0)
   ↓
6. Start 15s Timeout Timer
   ↓
7. iframe onLoad Event (nach ~2s)
   ↓
8. Start 3s Soft-Reload Timer
   ↓
   
─── SCENARIO A: READY empfangen (ideal) ───
9a. UNBREAK_CONFIG_READY empfangen
   ↓
10a. hideLoading()
   ↓
11a. Loading Overlay fade-out (400ms)
   iframe fade-in (300ms)
   ↓
12a. Clear Timers
   ↓
13a. ✅ DONE

─── SCENARIO B: ERROR empfangen ───
9b. UNBREAK_CONFIG_ERROR empfangen
   ↓
10b. showError(message)
   ↓
11b. Spinner verstecken, Error anzeigen
   ↓
12b. Reload-Button sichtbar
   ↓
13b. User klickt Reload → resetStates() → GOTO 3

─── SCENARIO C: Timeout (15s) ───
9c. Keine Message empfangen, 15s vergangen
   ↓
10c. showError('lädt länger als erwartet')
   ↓
11c. Reload-Button sichtbar
   ↓
12c. User klickt Reload → resetStates() → GOTO 3

─── SCENARIO D: Soft-Reload (3s nach onLoad) ───
9d. iframe geladen, aber kein READY nach 3s
   ↓
10d. iframe.src = baseUrl + '?retry=' + timestamp
   ↓
11d. iframe lädt neu → GOTO 4
```

---

## 🧪 Tests

### Automatisierte Tests (Playwright)

**Installation:**
```bash
npm install
npx playwright install
```

**Ausführen:**
```bash
# Alle Tests
npm test

# Mit UI (interaktiv)
npm run test:ui

# Mit Browser-Anzeige
npm run test:headed
```

**Test-Coverage (11 Tests):**
1. ✅ Loading Overlay erscheint beim Laden
2. ✅ iframe ist initial unsichtbar (opacity: 0)
3. ✅ READY versteckt Loader und zeigt iframe
4. ✅ ERROR zeigt Fehlermeldung + Reload-Button
5. ✅ LOADING aktualisiert Progress-Bar
6. ✅ Origin-Check ignoriert fremde origins
7. ✅ 15s Timeout zeigt Fehlermeldung
8. ✅ Reload-Button lädt iframe neu (Cache-Busting)
9. ✅ Mobile Viewport (responsive)
10. ✅ Debug-Mode mit ?debug=1
11. ✅ Kein Memory Leak bei Navigation

### Manuelle Tests

Siehe **TESTING.md** für detaillierte Checkliste (20 Testfälle).

**Schnelltest:**
```javascript
// Browser Console öffnen auf http://localhost:8000/configurator.html

// Test 1: READY
window.postMessage({ type: 'UNBREAK_CONFIG_READY', ok: true }, '*');
// → Loader verschwindet, iframe sichtbar

// Test 2: ERROR (Seite neu laden zuerst)
window.postMessage({ type: 'UNBREAK_CONFIG_ERROR', message: 'Test' }, '*');
// → Error anzeigen, Reload-Button

// Test 3: LOADING
window.postMessage({ type: 'UNBREAK_CONFIG_LOADING', progress: 50 }, '*');
// → Progress-Bar zeigt 50%

// Test 4: Debug-Mode
// URL: ?debug=1
// → Debug-Log unten rechts sichtbar
```

---

## 🐛 Debugging

### Debug-Mode aktivieren
```
http://localhost:8000/configurator.html?debug=1
```

**Was wird angezeigt:**
- Event-Log (letzte 20 Events)
- Timestamp für jedes Event
- Event-Typ (MESSAGE, READY, ERROR, LOADING, etc.)
- Farbcodierung (grün = success, rot = error)
- Clear-Button zum Löschen

### Console-Logs
```javascript
// Alle wichtigen Events werden geloggt:
console.log('Configurator loaded, waiting for UNBREAK_CONFIG_READY...');
console.log('✓ UNBREAK_CONFIG_READY received', data);
console.log('⏳ UNBREAK_CONFIG_LOADING:', progress);
console.log('✗ UNBREAK_CONFIG_ERROR:', message);
console.log('⚠️ Message from unknown origin ignored:', origin);
```

### Häufige Probleme

**Problem: Loader hängt**
- Prüfe Browser Console auf Fehler
- Aktiviere Debug-Mode (?debug=1)
- Prüfe ob READY empfangen wird
- Warte 3s → Soft-Reload sollte triggern
- Warte 15s → Timeout sollte triggern

**Problem: iframe nicht sichtbar**
- Prüfe CSS: `.ready` Klasse gesetzt?
- Prüfe opacity in DevTools (sollte 1 sein)
- Prüfe z-index Konflikte
- Prüfe Container min-height

**Problem: Messages werden ignoriert**
- Prüfe origin in Console
- Ist origin in `allowedOrigins`?
- Ist `event.data.type` korrekt?

---

## 📚 Wichtige Kommentare im Code

### Origin-Check (configurator.js)
```javascript
/**
 * Warum Origin-Check?
 * - Sicherheit: Nur der echte Konfigurator darf Befehle senden
 * - Verhindert XSS/Injection von fremden Websites
 */
```

### iframe Visibility (configurator.js)
```javascript
// iframe sichtbar machen (opacity 1, pointer-events auto)
// Warum? iframe ist initial unsichtbar, damit User nicht 
// leeren/nicht-geladenen Konfigurator sieht
```

### Cleanup (configurator.js)
```javascript
/**
 * Cleanup: Message-Listener entfernen bei pageHide
 * Verhindert Memory Leaks und doppelte Listener
 */
window.addEventListener('pagehide', () => {
  window.removeEventListener('message', messageHandler);
});
```

---

## ✅ Checkliste vor Deployment

- [ ] `npm test` läuft ohne Fehler
- [ ] Manuelle Tests durchgeführt (siehe TESTING.md)
- [ ] Debug-Mode getestet (?debug=1)
- [ ] Mobile/Tablet getestet
- [ ] Browser-Kompatibilität (Chrome, Firefox, Safari)
- [ ] CORS-Config auf Vercel geprüft
- [ ] Origin-Whitelist aktualisiert (Production URL)
- [ ] Performance: Lighthouse Score > 90
- [ ] Keine Console-Errors
- [ ] Memory Leaks geprüft (Chrome DevTools)

---

## 🚀 Nächste Schritte

1. **Tests ausführen:** `npm test`
2. **Manuelle Tests:** Siehe TESTING.md
3. **Debug-Mode testen:** `?debug=1`
4. **Origin-Whitelist anpassen:** Falls andere URLs benötigt
5. **Deployment:** Vercel/Netlify/etc.

**Wichtig:** Der 3D-Konfigurator selbst muss die Messages senden! Siehe Commit-Message für Code-Beispiele.
