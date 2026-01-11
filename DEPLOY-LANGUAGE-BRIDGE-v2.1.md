# 🚀 IFRAME LANGUAGE BRIDGE v2.1.0 - DEPLOY GUIDE

**Status:** ✅ Ready to Deploy  
**Version:** 2.1.0  
**Datum:** 2026-01-10

---

## 📦 Geänderte Dateien

### Core Files (Backend)
- ✅ `public/lib/bridge-schema.js` - Event `SET_LOCALE_ACK` hinzugefügt
- ✅ `public/lib/bridge-debug.js` - Language tracking properties
- ✅ `public/iframe-language-bridge-v2.js` - Retry-Logik implementiert

### Integration Files (Frontend)
- ✅ `public/configurator.html` - Version auf v2.1.0 aktualisiert
- ✅ `public/configurator-backup.html` - Version auf v2.1.0 aktualisiert

### Documentation
- ✅ `IFRAME-LANGUAGE-RETRY-GUIDE.md` - Vollständige Dokumentation
- ✅ `test-language-bridge.html` - Lokaler Test

---

## 🔄 Deployment Steps

### 1. Lokaler Test (Optional)
```bash
# Test-Seite im Browser öffnen
start test-language-bridge.html
```

### 2. Vercel Deployment

#### Option A: Git Push (Empfohlen)
```bash
# Änderungen committen
git add public/lib/bridge-schema.js
git add public/lib/bridge-debug.js
git add public/iframe-language-bridge-v2.js
git add public/configurator.html
git add public/configurator-backup.html
git add IFRAME-LANGUAGE-RETRY-GUIDE.md
git add test-language-bridge.html

git commit -m "feat: Add retry logic to iframe language bridge v2.1.0

- Implement retry strategy: 10 attempts @ 2s timeout
- Reduce warn-noise in production (console.log instead of console.warn)
- Support multiple ACK formats (LANG_ACK, SET_LOCALE_ACK, SET_LOCALE)
- Add debug tracking (lastLangSent, lastAckReceived, retries)
- Update cache-busting version to 2.1.0"

git push origin main
```

#### Option B: Vercel CLI
```bash
# Deploy direkt
vercel --prod
```

### 3. Browser Cache leeren

**Nach dem Deployment:**

#### Chrome/Edge
```
Strg + Shift + Delete
→ "Cached images and files" auswählen
→ "Clear data"
```

#### Oder Hard Reload
```
Strg + Shift + R
```

#### Oder URL-Parameter
```
https://unbreak-one.vercel.app/configurator?v=2.1.0
```

---

## ✅ Verification Checklist

### Nach Deployment prüfen:

- [ ] **1. Homepage laden:** https://unbreak-one.vercel.app/configurator
- [ ] **2. Console öffnen:** F12 → Console Tab
- [ ] **3. Keine alten Warnungen:**
  ```
  ❌ NICHT: iframe-language-bridge-v2.js?v=2.0.1:105
  ✅ SOLLTE: iframe-language-bridge-v2.js?v=2.1.0:...
  ```
- [ ] **4. Sprache wechseln:** DE ↔️ EN Button klicken
- [ ] **5. Console prüfen:**
  ```javascript
  // ERWARTETE AUSGABE (wenn iframe antwortet):
  [LANG][PARENT→IFRAME] en
  [LANG][ACK] ✅ Confirmed in 150ms (after 0 retries)
  
  // ODER (wenn iframe NICHT antwortet - PRODUCTION):
  [LANG][PARENT→IFRAME] en
  [LANG][RETRY] en attempt 1/10
  [LANG][RETRY] en attempt 2/10
  // ... nur console.log(), keine gelben Warnungen!
  ```

### Debug Mode Test

- [ ] **6. Debug aktivieren:** URL mit `?debug=1`
  ```
  https://unbreak-one.vercel.app/configurator?debug=1
  ```
- [ ] **7. Debug Dump abrufen:**
  ```javascript
  window.UnbreakBridgeDebug.getDump()
  ```
- [ ] **8. Werte prüfen:**
  ```javascript
  {
    lastLangSent: { lang: "en", retryCount: 0, ... },
    lastAckReceived: { event: "UNBREAK_LANG_ACK", ... },
    retries: 0,
    lastOrigin: "https://unbreak-3-d-konfigurator.vercel.app"
  }
  ```

---

## 🎯 Expected Behavior

### ✅ ERFOLG (iframe antwortet)
```
[LANG][PARENT→IFRAME] en
[LANG][ACK] ✅ Confirmed in 150ms (after 0 retries)
[LANG] ✅ Language synchronized: en
```
- Sprache wechselt in 1-2s
- Keine Warnungen
- `retries: 0` im Debug Dump

### ⚠️ RETRY (iframe langsam)
```
[LANG][PARENT→IFRAME] en
[LANG][RETRY] en attempt 1/10
[LANG][RETRY] en attempt 2/10
[LANG][ACK] ✅ Confirmed in 4500ms (after 2 retries)
```
- Sprache wechselt nach mehreren Versuchen
- In PROD: Nur `console.log()` - keine gelben Warnungen
- `retries: 2` im Debug Dump

### ❌ TIMEOUT (iframe antwortet nie)
```
[LANG][PARENT→IFRAME] en
[LANG][RETRY] en attempt 1/10
[LANG][RETRY] en attempt 2/10
...
[LANG][RETRY] en attempt 10/10
[LANG][NO_ACK] Max retries reached for language: en
```
- **In PROD:** Nur `console.log()` - stiller Abbruch
- **In DEBUG:** `console.warn()` nach letztem Versuch
- `retries: 10` im Debug Dump

---

## 🐛 Troubleshooting

### Problem: Alte Version lädt (v2.0.1 statt v2.1.0)

**Lösung:**
```javascript
// Browser Cache leeren
Strg + Shift + Delete

// Oder Hard Reload
Strg + Shift + R

// Oder URL mit timestamp
https://unbreak-one.vercel.app/configurator?t=20260110
```

### Problem: Warnungen erscheinen immer noch

**Prüfen:**
```javascript
// 1. Version in Console prüfen
// Sollte zeigen: iframe-language-bridge-v2.js?v=2.1.0

// 2. Code-Version prüfen
console.log(window.UnbreakBridgeDebug);
// Sollte haben: lastLangSent, lastAckReceived, langRetries

// 3. Deployment Status prüfen
vercel ls
```

### Problem: iframe antwortet nicht

**Das ist OK!** Die Retry-Logik fängt das ab:
- 10 Retries à 2s = max 20s Wartezeit
- In PROD: Stiller Abbruch ohne gelbe Warnungen
- iframe muss noch implementiert werden (siehe Guide)

---

## 📋 Rollback Plan

Falls etwas schiefgeht:

```bash
# Git Rollback
git revert HEAD
git push origin main

# Oder manuell Version zurücksetzen
# In configurator.html:
<script src="/iframe-language-bridge-v2.js?v=2.0.0"></script>
```

---

## 📞 Support

**Debug Dump erstellen:**
```javascript
window.UnbreakBridgeDebug.copyDump()
```

**Console Logs exportieren:**
```javascript
// Rechtsklick in Console → "Save as..."
```

**Vercel Logs prüfen:**
```bash
vercel logs
```

---

## ✅ Deploy Checklist

- [x] Code implementiert
- [x] Tests erstellt
- [x] Dokumentation geschrieben
- [x] Cache-Busting Version erhöht (2.0.1 → 2.1.0)
- [ ] Git commit & push
- [ ] Vercel Deployment
- [ ] Browser Cache leeren
- [ ] Functionality testen
- [ ] Debug Dump verifizieren

---

**Ready to Deploy:** ✅ YES  
**Breaking Changes:** ❌ NO  
**Backward Compatible:** ✅ YES  

**Deploy Time:** ~2 Minuten  
**Test Time:** ~5 Minuten  
**Total:** ~7 Minuten

🚀 **LET'S GO!**
