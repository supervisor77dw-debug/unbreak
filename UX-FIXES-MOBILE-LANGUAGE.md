# UX Fixes: Mobile Layout & Language Consistency

## FIX 4 — Mobile Badge Overlap (<500px)

### Problem
Bei Viewport-Breiten unter 500px überlappte der Badge-Button ("Made in Germany") den UNBREAK ONE Schriftzug.

### Lösung
```css
@media (max-width: 500px) {
  #hero .container {
    display: flex;
    flex-direction: column;
    align-items: center;
  }

  .badge-mig {
    position: relative;
    top: 0;
    right: 0;
    max-width: 80px;
    margin-bottom: 1rem;
    order: -1; /* Badge above all content */
    transform: scale(1);
  }

  .hero-content {
    order: 0;
    padding-top: 0 !important;
    text-align: center;
  }

  .hero-content h1 {
    margin-top: 0.5rem;
  }
}
```

### Ergebnis
- Badge wird **oberhalb** des UNBREAK-ONE Schriftzugs positioniert
- Vertikaler Abstand (1rem margin-bottom) verhindert Kollision
- Klare visuelle Hierarchie: Badge → Titel → Rest
- >500px: Desktop-Layout bleibt unverändert

**Datei:** `public/premium.css`

---

## FIX 5 — Sprach-Synchronisation (Shop ↔ Konfigurator)

### Problem
- Sprache wurde korrekt vom Shop → Konfigurator übernommen ✅
- Rücksprung Konfigurator → Shop übernimmt geänderte Sprache nicht ❌

### Lösung: localStorage als Single Source of Truth

#### 1. Priorität geändert in `i18n.js`
**Vorher:** URL-Parameter > localStorage > Browser  
**Neu:** **localStorage > URL-Parameter > Browser**

```javascript
async init() {
  // Check localStorage FIRST (Single Source of Truth)
  const savedLang = localStorage.getItem('unbreakone_lang');
  
  if (savedLang && ['de', 'en'].includes(savedLang)) {
    this.currentLang = savedLang; // Highest priority
  } else {
    // Fallback to URL param
    const urlParams = new URLSearchParams(window.location.search);
    const urlLang = urlParams.get('lang');
    
    if (urlLang && ['de', 'en'].includes(urlLang)) {
      this.currentLang = urlLang;
      localStorage.setItem('unbreakone_lang', urlLang);
    } else {
      // Final fallback: browser language
      const browserLang = navigator.language.split('-')[0];
      if (browserLang === 'en') {
        this.currentLang = 'en';
      }
      localStorage.setItem('unbreakone_lang', this.currentLang);
    }
  }
}
```

#### 2. Konsistenter localStorage-Key
**Einheitlicher Key:** `unbreakone_lang`  
**Verwendet in:**
- `public/i18n.js` - Hauptsystem
- `public/language-switch.js` - Sprachwechsel-UI
- `public/iframe-language-bridge-v2.js` - Shop ↔ Konfigurator Kommunikation
- `public/version.js` - Version-Badge

#### 3. Automatische Synchronisation
Beim Sprachwechsel (egal wo):
```javascript
async setLanguage(lang) {
  this.currentLang = lang;
  localStorage.setItem('unbreakone_lang', lang); // ✅ Persistent
  
  // Dispatch events
  window.dispatchEvent(new CustomEvent('languageChanged', { detail: { lang } }));
  window.dispatchEvent(new CustomEvent('i18nLanguageChanged', { detail: { lang } }));
}
```

### Ergebnis
✅ Sprachwechsel im Konfigurator → Shop lädt mit gleicher Sprache  
✅ Sprachwechsel im Shop → Konfigurator erhält korrekte Sprache  
✅ Kein sichtbares "Zurückspringen" oder Umschalten  
✅ Shop & Konfigurator wirken wie eine geschlossene Anwendung

### Testing
```javascript
// Test 1: Sprachwechsel im Shop
localStorage.getItem('unbreakone_lang') // "de"
// Switch to EN
localStorage.getItem('unbreakone_lang') // "en" ✅

// Test 2: Reload nach Sprachwechsel
window.location.reload()
// Language should be "en" ✅

// Test 3: Rücksprung vom Konfigurator
// Konfigurator: EN → Shop: EN ✅
```

---

## Deployment

**Datum:** 25. Januar 2026  
**Dateien geändert:**
- `public/premium.css` (FIX 4)
- `public/i18n.js` (FIX 5)
- `public/iframe-language-bridge-v2.js` (FIX 5)

**Branch:** master  
**Production:** www.unbreak-one.com
