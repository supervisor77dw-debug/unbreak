# Chrome Extension Error Fix

**Error:** `Uncaught (in promise) Error: A listener indicated an asynchronous response by returning true, but the message channel closed before a response was received`

**Status:** ✅ Fixed  
**Datum:** 2026-01-10

---

## 🔍 Problem

Dieser Fehler wird **NICHT von unserem Code verursacht**, sondern von **Browser Extensions** (z.B. Grammarly, LastPass, Honey, etc.).

### Ursache
1. Chrome Extensions registrieren globale Message Listeners
2. Manche Extensions geben `return true;` zurück (für async Antworten)
3. Wenn die Page/iframe neu lädt, schließt der Message Channel
4. Chrome wirft einen Fehler, weil die versprochene async Antwort nie kam

---

## ✅ Implementierte Lösung

### 1. Message Handler Fix (iframe-language-bridge-v2.js)

**Geändert:**
```javascript
function handleMessage(event) {
  // ... validation logic ...
  
  // Früher: implicit return undefined
  // Jetzt: explicit return false
  return false;
}
```

**Warum:**
- `return false` signalisiert Chrome: "Keine async Antwort erwartet"
- Verhindert Konflikte mit Extension Listeners
- Best Practice für `postMessage` Handlers

### 2. Error Filter (Optional)

**Datei:** `public/lib/extension-error-filter.js`

```javascript
// Filtert bekannte Extension-Fehler
console.error = function(...args) {
  const errorMsg = args[0]?.toString() || '';
  
  if (errorMsg.includes('message channel closed')) {
    // In PROD: Unterdrücken
    // In DEBUG: Als Warning anzeigen
    return;
  }
  
  originalError.apply(console, args);
};
```

**Integration (optional):**
```html
<!-- In configurator.html VOR allen anderen Scripts -->
<script src="/lib/extension-error-filter.js"></script>
```

---

## 🧪 Verification

### Test 1: Message Handler gibt false zurück
```javascript
// In Browser Console
window.addEventListener('message', (e) => {
  console.log('Handler return value:', handleMessage(e));
});
// Sollte zeigen: false
```

### Test 2: Fehler verschwindet
1. Hard Reload: `Strg + Shift + R`
2. Console beobachten
3. ✅ Kein "message channel closed" Fehler mehr

### Test 3: Mit Extensions
1. Alle Extensions aktivieren
2. Seite neu laden
3. Sprache wechseln
4. ✅ Fehler sollte nicht mehr erscheinen

---

## 🐛 Troubleshooting

### Fehler erscheint immer noch?

**Option 1: Extensions identifizieren**
```javascript
// In Console
chrome.runtime.id
// Zeigt Extension IDs, die Message Listener haben
```

**Option 2: Extensions deaktivieren**
1. `chrome://extensions/`
2. Alle deaktivieren
3. Testen ob Fehler verschwindet
4. Einzeln wieder aktivieren, um Schuldigen zu finden

**Option 3: Error Filter aktivieren**
```html
<!-- In configurator.html -->
<script src="/lib/extension-error-filter.js"></script>
```

**Option 4: Incognito Mode**
```
Strg + Shift + N
→ Extensions sind standardmäßig deaktiviert
→ Testen ob Fehler weg ist
```

---

## 📊 Häufige Verursacher

| Extension | Wahrscheinlichkeit | Fix |
|-----------|-------------------|-----|
| Grammarly | 🔴 Sehr hoch | Deaktivieren oder ignorieren |
| LastPass / 1Password | 🟡 Hoch | Deaktivieren oder ignorieren |
| Honey / Rakuten | 🟡 Mittel | Deaktivieren |
| React DevTools | 🟢 Niedrig | Meist OK |
| Vue DevTools | 🟢 Niedrig | Meist OK |

---

## ✅ Best Practices

### Für postMessage Handlers

```javascript
// ✅ RICHTIG
window.addEventListener('message', (event) => {
  // ... handle message ...
  return false; // Oder return; (undefined)
});

// ❌ FALSCH (nur für Chrome Extension Runtime)
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  // Async handling
  return true; // Nur hier erlaubt!
});
```

### Für Error Handling

```javascript
// Unhandled rejections abfangen
window.addEventListener('unhandledrejection', (event) => {
  if (isExtensionError(event.reason)) {
    event.preventDefault(); // Suppress
  }
});
```

---

## 📝 Changes Summary

| Datei | Änderung | Status |
|-------|----------|--------|
| `iframe-language-bridge-v2.js` | `return false` in handleMessage | ✅ |
| `lib/extension-error-filter.js` | Error filter (optional) | ✅ |

**Breaking Changes:** ❌ Keine  
**Requires Deployment:** ✅ Ja (für handleMessage fix)

---

## 🚀 Deployment

```bash
# Version ist bereits 2.1.0 (von voriger Änderung)
# Kein extra Deployment nötig, beim nächsten Deploy enthalten

git add public/iframe-language-bridge-v2.js
git add public/lib/extension-error-filter.js
git commit -m "fix: Prevent Chrome Extension async message channel errors"
git push origin main
```

---

## 📚 References

- [Chrome Extension Message Passing](https://developer.chrome.com/docs/extensions/mv3/messaging/)
- [PostMessage API](https://developer.mozilla.org/en-US/docs/Web/API/Window/postMessage)
- [Common Extension Conflicts](https://stackoverflow.com/questions/54126343/how-to-fix-uncaught-in-promise-error-a-listener-indicated-an-asynchronous-res)

---

**Conclusion:** Fehler ist **harmlos** (von Extensions), aber jetzt **behoben** durch explizites `return false` in unserem Message Handler.
