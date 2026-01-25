# Testing Guide: FIX 4 & FIX 5

## ⚠️ WICHTIG: Browser Cache leeren!

**Vor dem Testen:**
```
Ctrl + Shift + R  (Windows/Linux)
Cmd + Shift + R   (Mac)
```

Oder über DevTools:
1. F12 → Network Tab öffnen
2. "Disable cache" aktivieren
3. Seite neu laden

---

## FIX 4: Mobile Badge Overlap (<500px)

### Test-URL
`https://www.unbreak-one.com/`

### Test-Schritte

1. **Chrome DevTools öffnen** (F12)
2. **Responsive Mode** aktivieren (Ctrl+Shift+M)
3. **Viewport einstellen:**
   - Width: 400px (oder jede Breite <500px)
   - Height: 800px

### Erwartetes Ergebnis ✅

**Vorher (Bug):**
- Badge überlappt "UNBREAK ONE" Titel
- Lesebarkeit beeinträchtigt

**Nachher (Fixed):**
```
┌─────────────────────┐
│   [Made in Germany] │  ← Badge OBERHALB
│                     │
│    UNBREAK ONE      │  ← Titel DARUNTER
│                     │
│  Magnetische...     │
└─────────────────────┘
```

**Visuell:**
- Badge ist **zentriert** über dem Titel
- 1rem Abstand zwischen Badge und Titel
- Keine Überlappung sichtbar
- Text ist vollständig lesbar

### Screenshots checken
- [ ] 375px (iPhone SE) - Badge über Titel
- [ ] 400px - Badge über Titel
- [ ] 480px - Badge über Titel
- [ ] 500px - Badge über Titel
- [ ] 768px+ - Badge rechts oben (altes Layout)

### CSS Debug (Optional)
```javascript
// In Browser Console:
const badge = document.querySelector('.badge-mig');
const container = badge.closest('.container');

console.log('Badge position:', getComputedStyle(badge).position);
console.log('Container display:', getComputedStyle(container).display);
console.log('Badge order:', getComputedStyle(badge).order);

// Sollte bei <500px zeigen:
// position: relative
// display: flex
// order: -1
```

---

## FIX 5: Language Sync (Shop ↔ Konfigurator)

### Test-Szenario 1: Konfigurator → Shop

1. **Shop öffnen** (`www.unbreak-one.com`)
   - Aktuelle Sprache: DE (default)
   
2. **Konfigurator öffnen**
   - "Jetzt individuell gestalten" klicken
   - Konfigurator lädt in DE ✅

3. **Im Konfigurator: Sprache wechseln**
   - Auf EN umschalten
   - Texte ändern sich zu Englisch ✅

4. **localStorage prüfen (DevTools Console)**
   ```javascript
   localStorage.getItem('unbreakone_lang')
   // Sollte "en" sein ✅
   ```

5. **Zurück zum Shop**
   - "Zurück" Button oder Browser Back
   - **ERWARTUNG:** Shop lädt in **EN** ✅
   - **BUG (falls nicht gefixt):** Shop springt zurück auf DE ❌

### Test-Szenario 2: Shop Reload

1. **Sprache auf EN stellen**
   ```javascript
   // In Console:
   localStorage.setItem('unbreakone_lang', 'en')
   ```

2. **Seite neu laden** (F5)

3. **ERWARTUNG:**
   - Seite lädt direkt in EN
   - Kein kurzes "Flackern" von DE → EN
   - localStorage hat Priorität ✅

### Test-Szenario 3: URL-Parameter Fallback

1. **localStorage leeren**
   ```javascript
   localStorage.removeItem('unbreakone_lang')
   ```

2. **URL mit Parameter öffnen**
   ```
   www.unbreak-one.com/?lang=en
   ```

3. **ERWARTUNG:**
   - Seite lädt in EN
   - localStorage wird auf "en" gesetzt ✅

4. **Seite neu laden (ohne ?lang=en)**
   ```
   www.unbreak-one.com/
   ```

5. **ERWARTUNG:**
   - Seite bleibt in EN (aus localStorage) ✅

### Test-Szenario 4: Priorität testen

1. **Setup:**
   ```javascript
   localStorage.setItem('unbreakone_lang', 'en')
   ```

2. **URL mit DE-Parameter öffnen:**
   ```
   www.unbreak-one.com/?lang=de
   ```

3. **ERWARTUNG (NEW):**
   - Seite lädt in **EN** (localStorage gewinnt) ✅
   - URL-Parameter wird ignoriert ✅

4. **Alte Logik (vor FIX 5):**
   - Seite würde in **DE** laden (URL-Parameter gewinnt) ❌

### localStorage Debug

```javascript
// Browser Console:

// Aktuelle Sprache prüfen
window.i18n?.getCurrentLanguage()

// localStorage Key prüfen
localStorage.getItem('unbreakone_lang')

// Sprache manuell setzen
localStorage.setItem('unbreakone_lang', 'en')
window.location.reload()

// Alle Language-bezogenen Keys anzeigen
Object.keys(localStorage).filter(k => k.includes('lang'))
```

### Event Listener Test

```javascript
// Im Shop - Event Listener testen:
window.addEventListener('languageChanged', (e) => {
  console.log('✅ Language changed to:', e.detail.lang);
  console.log('✅ localStorage:', localStorage.getItem('unbreakone_lang'));
});

// Sprache wechseln und Console beobachten
```

---

## Acceptance Criteria

### FIX 4 (Mobile Badge) ✅
- [ ] Badge bei <500px OBERHALB des Titels
- [ ] Kein Overlap mit "UNBREAK ONE"
- [ ] Badge zentriert
- [ ] Desktop-Layout (>500px) unverändert

### FIX 5 (Language Sync) ✅
- [ ] Sprachwechsel im Konfigurator persistiert beim Zurück-Navigieren
- [ ] localStorage hat höchste Priorität
- [ ] Kein sichtbares "Umspringen" der Sprache beim Reload
- [ ] Shop & Konfigurator wirken wie eine einzige App

---

## Troubleshooting

### FIX 4 funktioniert nicht?
```bash
# Prüfen ob premium.min.css geladen wird:
# DevTools → Network → Filter "premium"
# Sollte zeigen: premium.min.css?v=2.0.5

# Falls v2.0.4 oder älter:
# → Hard Refresh (Ctrl+Shift+R)
# → Vercel Cache kann bis zu 60s dauern
```

### FIX 5 funktioniert nicht?
```javascript
// 1. localStorage Key prüfen:
localStorage.getItem('unbreakone_lang')
// Sollte "de" oder "en" sein

// 2. i18n.js Version prüfen:
// DevTools → Sources → i18n.js
// Erste Zeile sollte Kommentar mit FIX 5 enthalten

// 3. Priority-Logik testen:
localStorage.setItem('unbreakone_lang', 'en')
window.location.href = '/?lang=de'
// Nach Reload sollte EN aktiv sein (localStorage gewinnt)
```

### Beide Fixes nicht sichtbar?
1. **Vercel Deployment prüfen:**
   - GitHub Commit gepusht?
   - Vercel Auto-Deploy erfolgreich?
   - Deployment-Log checken

2. **Browser Cache:**
   - DevTools → Application → Clear Storage → Clear site data
   - Inkognito-Modus testen

3. **CDN Cache:**
   - Vercel Edge Cache kann bis zu 60 Sekunden dauern
   - Warten und erneut testen

---

## Expected Timeline

- **Deployment:** Sofort nach `git push`
- **Vercel Build:** ~30-60 Sekunden
- **CDN Propagation:** ~60 Sekunden
- **Total:** ~2 Minuten bis live

**Nach 2 Minuten:**
- Hard Refresh (Ctrl+Shift+R)
- Beide Fixes sollten aktiv sein
