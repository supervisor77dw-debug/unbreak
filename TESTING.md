# UNBREAK ONE - 3D Configurator Integration

## Test-Dokumentation

### Automatisierte Tests (Playwright)

#### Installation
```bash
npm install
npx playwright install
```

#### Tests ausführen
```bash
# Alle Tests
npm test

# Tests mit UI (interaktiv)
npm run test:ui

# Tests mit Browser-Anzeige
npm run test:headed

# Spezifischer Test
npx playwright test configurator.spec.js
```

#### Test-Coverage
- ✅ Loading Overlay erscheint beim Laden
- ✅ iframe ist initial unsichtbar (opacity: 0)
- ✅ UNBREAK_CONFIG_READY versteckt Loader und zeigt iframe
- ✅ UNBREAK_CONFIG_ERROR zeigt Fehlermeldung + Reload-Button
- ✅ UNBREAK_CONFIG_LOADING aktualisiert Progress-Bar
- ✅ Origin-Check: Fremde origins werden ignoriert
- ✅ 15s Timeout zeigt Fehlermeldung
- ✅ Reload-Button lädt iframe neu (Cache-Busting)
- ✅ Mobile Viewport (responsive)
- ✅ Debug-Mode mit ?debug=1
- ✅ Kein Memory Leak bei Navigation

---

### Manuelle Test-Checkliste

#### A) Basis-Funktionalität

**1. Initialer Seitenaufruf**
- [ ] Öffne `http://localhost:8000/configurator.html`
- [ ] Loading Overlay (weiße Card mit Logo + Spinner) erscheint
- [ ] Overlay hat dunklen Hintergrund (rgba(0,0,0,0.65))
- [ ] Text "Konfigurator wird geladen..." ist sichtbar

**2. READY Event (simuliert via Console)**
```javascript
// In Browser Console ausführen:
window.postMessage({
  type: 'UNBREAK_CONFIG_READY',
  ok: true,
  version: '1.0.0',
  ts: Date.now()
}, '*');
```
- [ ] Loading Overlay verschwindet mit Fade-out Animation
- [ ] iframe wird sichtbar (Fade-in)
- [ ] Keine Console-Fehler

**3. ERROR Event (simuliert via Console)**
```javascript
// Seite neu laden, dann:
window.postMessage({
  type: 'UNBREAK_CONFIG_ERROR',
  message: 'Testfehler: Model konnte nicht geladen werden'
}, '*');
```
- [ ] Spinner verschwindet
- [ ] Rote Fehlermeldung erscheint
- [ ] "Neu laden" Button ist sichtbar und klickbar

**4. LOADING Event mit Progress (simuliert via Console)**
```javascript
// Seite neu laden, dann mehrfach mit steigenden Werten:
window.postMessage({
  type: 'UNBREAK_CONFIG_LOADING',
  progress: 25
}, '*');

window.postMessage({
  type: 'UNBREAK_CONFIG_LOADING',
  progress: 75
}, '*');
```
- [ ] Progress-Bar erscheint unter dem Spinner
- [ ] Balken füllt sich entsprechend (25%, 75%)
- [ ] Prozentanzeige aktualisiert sich

**5. Reload-Button**
- [ ] Trigger ERROR state (siehe oben)
- [ ] Klicke "Neu laden" Button
- [ ] Loading Overlay erscheint erneut
- [ ] iframe src ändert sich (Cache-Busting mit ?t=timestamp)
- [ ] Error ist verschwunden

**6. Timeout-Fallback (15 Sekunden)**
- [ ] Seite neu laden (Strg+F5)
- [ ] Warte 15 Sekunden OHNE READY zu senden
- [ ] Nach 15s erscheint Fehlermeldung "lädt länger als erwartet"
- [ ] Reload-Button ist verfügbar

---

#### B) Responsive & Mobile

**7. Desktop (1920x1080)**
- [ ] Öffne in Chrome DevTools Device Toolbar
- [ ] Wähle "Responsive" und setze 1920x1080
- [ ] iframe Container hat min-height: 80vh
- [ ] Kein horizontales Scrolling
- [ ] Loading Overlay ist zentriert

**8. Mobile (375x667 - iPhone SE)**
- [ ] Wähle "iPhone SE" Preset
- [ ] iframe Container hat min-height: 70vh
- [ ] Loading Card passt auf Screen (kein Abschneiden)
- [ ] Debug-Log (falls aktiv) passt sich an (volle Breite)

**9. Tablet (768x1024 - iPad)**
- [ ] Wähle "iPad" Preset
- [ ] Layout funktioniert
- [ ] Touch-Events funktionieren (Reload-Button klickbar)

---

#### C) Debug-Mode

**10. Debug-Mode aktivieren**
- [ ] Öffne `http://localhost:8000/configurator.html?debug=1`
- [ ] Debug-Log erscheint unten rechts (schwarzer Container)
- [ ] "Event Log" Überschrift sichtbar
- [ ] Mindestens "INIT" Events im Log

**11. Events im Debug-Log**
```javascript
// Verschiedene Events senden:
window.postMessage({ type: 'UNBREAK_CONFIG_LOADING', progress: 50 }, '*');
window.postMessage({ type: 'UNBREAK_CONFIG_READY', ok: true }, '*');
```
- [ ] Jedes Event erscheint im Log mit Timestamp
- [ ] LOADING Events sind grün
- [ ] ERROR Events sind rot
- [ ] Log scrollt automatisch nach unten

**12. Clear Log Button**
- [ ] Klicke "Clear Log" Button
- [ ] Alle Events werden gelöscht
- [ ] Neue Events erscheinen weiterhin

---

#### D) Sicherheit & Origin-Check

**13. Origin-Whitelist**
```javascript
// Fremde Origin (wird ignoriert):
const event = new MessageEvent('message', {
  data: { type: 'UNBREAK_CONFIG_READY', ok: true },
  origin: 'https://evil-site.com'
});
window.dispatchEvent(event);
```
- [ ] Öffne Browser Console
- [ ] Message wird ignoriert (Console: "unknown origin ignored")
- [ ] Loading Overlay bleibt sichtbar
- [ ] Keine Änderungen am State

**14. Erlaubte Origins (localhost Development)**
```javascript
// Lokale origin (wird akzeptiert):
const event = new MessageEvent('message', {
  data: { type: 'UNBREAK_CONFIG_READY', ok: true },
  origin: 'http://localhost:5173'
});
window.dispatchEvent(event);
```
- [ ] Message wird akzeptiert
- [ ] Loading Overlay verschwindet
- [ ] iframe wird sichtbar

---

#### E) Navigation & Memory Leaks

**15. Navigation weg/zurück**
- [ ] Öffne Konfigurator-Seite
- [ ] Navigiere zu `/index.html` (über Navigation)
- [ ] Navigiere zurück zu `/configurator.html`
- [ ] Loading Overlay erscheint erneut (States wurden resettet)
- [ ] Keine doppelten Console-Logs (Listener nicht doppelt)

**16. Hard Refresh**
- [ ] Auf Konfigurator-Seite: Strg+F5 (Hard Refresh)
- [ ] Alles lädt neu
- [ ] Loading Overlay erscheint
- [ ] Keine JavaScript-Fehler in Console

**17. Browser Back/Forward**
- [ ] Navigiere: Index → Konfigurator → Index
- [ ] Nutze Browser "Zurück" Button → Konfigurator
- [ ] States sollten korrekt zurückgesetzt sein
- [ ] Nutze Browser "Vorwärts" Button → Index
- [ ] Keine Memory Leaks (prüfe in Chrome DevTools > Memory)

---

#### F) Edge Cases

**18. Mehrfache READY Messages**
```javascript
// Sende READY mehrfach:
window.postMessage({ type: 'UNBREAK_CONFIG_READY', ok: true }, '*');
window.postMessage({ type: 'UNBREAK_CONFIG_READY', ok: true }, '*');
```
- [ ] Loader verschwindet nur einmal
- [ ] Keine Fehler in Console
- [ ] Timers werden korrekt gecleaned

**19. READY nach ERROR**
```javascript
// Erst ERROR, dann READY:
window.postMessage({ type: 'UNBREAK_CONFIG_ERROR', message: 'Error' }, '*');
window.postMessage({ type: 'UNBREAK_CONFIG_READY', ok: true }, '*');
```
- [ ] Erst Fehlermeldung, dann verschwindet sie
- [ ] iframe wird sichtbar
- [ ] Kein Error State mehr

**20. Iframe Load Event (ohne postMessage)**
- [ ] Seite laden
- [ ] Warte auf iframe "load" Event (ca. 3s nach dem Event)
- [ ] Wenn kein READY kam: Soft-Reload wird versucht (iframe src ändert sich)
- [ ] Console zeigt "Kein READY nach 3s, versuche Soft-Reload"

---

### Erfolgskriterien

✅ **Alle Tests bestehen**
✅ **Keine Console-Errors**
✅ **Kein Memory Leak (Listener werden entfernt)**
✅ **Responsive funktioniert (Desktop/Mobile/Tablet)**
✅ **Debug-Mode funktioniert**
✅ **Origin-Check blockiert fremde Websites**
✅ **Timeout-Fallback greift nach 15s**
✅ **Reload-Button funktioniert**

---

### Debugging-Tipps

**Problem: Loader hängt**
1. Prüfe Browser Console auf Fehler
2. Aktiviere Debug-Mode (?debug=1)
3. Prüfe ob READY Message empfangen wird
4. Prüfe iframe src (lädt es überhaupt?)
5. Prüfe Network Tab: CORS-Fehler?

**Problem: iframe nicht sichtbar**
1. Prüfe CSS: opacity sollte 1 sein bei .ready
2. Prüfe ob .ready Klasse gesetzt wurde
3. Prüfe z-index Konflikte
4. Prüfe min-height vom Container

**Problem: Messages werden ignoriert**
1. Prüfe origin in Console-Log
2. Ist origin in allowedOrigins?
3. Ist event.data.type korrekt?

**Problem: Tests schlagen fehl**
1. Prüfe ob Server läuft (localhost:8000)
2. `npx playwright install` ausführen
3. Prüfe Playwright Config (Port, baseURL)
4. Tests einzeln ausführen für Details
