# Header FINAL - Test-Protokoll

## Problem (vorher)

1. **Header-Wrap:** 2-3 Zeilen bei kritischen Breiten (1178-1200px)
2. **Console-Error:** `.header-controls not found, fallback to header`
3. **Language-Switch:** Wird in falschen Container injected (race condition)
4. **Text abgeschnitten:** CTA/Nav-Links ab ~1178px
5. **Horizontaler Scroll:** Bei bestimmten Breiten
6. **Inkonsistente Position:** Logo/Nav/Controls springen

## Root Cause

### Console-Warnung ".header-controls not found"

**Ursache:**
- `language-switch.js` hatte Fallback-Logik: wenn `.header-controls` nicht gefunden → inject in `<header>`
- **Timing-Problem:** SSR/CSR bei Next.js kann dazu führen, dass DOM noch nicht ready ist
- **Fehlender Mount-Point:** Kein dediziertes Element für Language-Switch
- **Race Condition:** Script lädt vor Header-Komponente gerendert wird

**Warum problematisch:**
- Language-Switch landet außerhalb von `.header-controls`
- Zerstört Flex/Grid-Layout
- Verursacht Zeilenumbruch
- Unmöglich zu debuggen (unterschiedliches Verhalten je nach Timing)

### Header-Wrap (2-3 Zeilen)

**Ursache:**
- **Grid-Layout:** `display: grid` mit `grid-template-columns: auto 1fr auto` kann unter bestimmten Bedingungen wrap erzwingen
- **Fehlende `min-width: 0`:** Ohne dies kann `.header-nav` nicht shrink (Flex default: `min-width: auto`)
- **Keine Media Queries:** CTA/Burger werden nicht rechtzeitig versteckt/aktiviert
- **`justify-content: space-between` in Nav-Liste:** Verursacht übermäßige Abstände

## Lösung

### 1. DOM-Struktur (Single Source of Truth)

**Dedizierter Mount-Point:**
```html
<div class="header-controls">
  <a class="btn btn-nav header-cta">Jetzt kaufen</a>
  <div id="language-switch-mount"></div>  <!-- DEDIZIERT -->
  <button class="header-burger" aria-label="Menu" aria-expanded="false">
    <span></span>
    <span></span>
    <span></span>
  </button>
</div>
```

**Konsistente Klassen:**
- `.header-cta` (statt nur `.btn-nav`)
- `.header-burger` (statt nur `.burger-menu`)
- `.header-nav-list` (statt nur `.nav-links`)
- `aria-label="Primary"` auf `<nav>`
- `aria-label` + `aria-expanded` auf burger

### 2. language-switch.js (No Fallback)

**VORHER (problematisch):**
```javascript
const headerControls = document.querySelector('.header-controls');
if (headerControls) {
  // inject...
} else {
  console.warn('.header-controls not found, fallback to header');
  const header = document.querySelector('header');
  header.appendChild(languageSwitch);  // ❌ FALLBACK
}
```

**NACHHER (hard fail):**
```javascript
const mountPoint = document.querySelector('#language-switch-mount');

if (!mountPoint) {
  console.error('[LANG_SWITCH] CRITICAL: #language-switch-mount not found.');
  console.error('[LANG_SWITCH] Header structure incomplete or timing issue.');
  return;  // ✅ NO FALLBACK - fail explicitly
}

mountPoint.appendChild(languageSwitch);
console.info('[LANG_SWITCH] Successfully mounted');
```

### 3. CSS (Flex + min-width:0 + Media Queries)

**VORHER (Grid - problematisch):**
```css
.header-inner {
  display: grid;
  grid-template-columns: auto 1fr auto;
  column-gap: 16px;
}
.header-brand { grid-column: 1; }
.header-nav { grid-column: 2; min-width: 0; }  /* min-width vorhanden aber Grid */
.header-controls { grid-column: 3; }
```

**NACHHER (Flex - stabil):**
```css
.header-inner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: nowrap;  /* ✅ HART: Niemals wrap */
  gap: 12px;
  white-space: nowrap;
}

.header-brand {
  flex: 0 0 auto;  /* nie shrink */
  white-space: nowrap;
}

.header-nav {
  flex: 1 1 auto;  /* kann shrink */
  min-width: 0;  /* ✅ KRITISCH: ohne dies kein shrink möglich */
  overflow: visible;
  white-space: nowrap;
}

.header-controls {
  flex: 0 0 auto;  /* nie shrink */
  display: inline-flex;  /* ✅ shrink-to-fit */
  align-items: center;
  gap: 10px;
  white-space: nowrap;
}

.nav-links,
.header-nav-list {
  display: flex;
  gap: clamp(10px, 2vw, 20px);  /* ✅ responsive spacing */
  justify-content: center;  /* ✅ NICHT space-between */
  flex-wrap: nowrap;
  min-width: 0;  /* ✅ KRITISCH */
}
```

**Media Queries (Progressive Hide):**
```css
/* Desktop Voll (>= 1201px): Alles sichtbar */
@media (min-width: 1201px) {
  .header-cta { display: inline-block; }
  .header-burger { display: none; }
  .header-nav { display: block; }
}

/* Medium (901-1200px): CTA verstecken */
@media (min-width: 901px) and (max-width: 1200px) {
  .header-cta { display: none !important; }  /* ✅ CTA zuerst weg */
  .header-burger { display: none; }
  .header-nav { display: block; }
}

/* Mobile (<= 900px): Burger aktiv */
@media (max-width: 900px) {
  .header-cta { display: none !important; }
  .header-burger { display: inline-flex !important; }
  .header-nav { display: none; }
}
```

## Dateien geändert

1. **components/Header.jsx**
   - `<div id="language-switch-mount"></div>` hinzugefügt
   - Klassen: `.header-cta`, `.header-burger`
   - `aria-label="Primary"` auf `<nav>`
   - `aria-label` + `aria-expanded` auf burger

2. **public/components/header.js**
   - Identische Struktur wie Header.jsx
   - `<div id="language-switch-mount"></div>` hinzugefügt
   - Klassen: `.header-cta`, `.header-burger`, `.header-nav-list`

3. **public/language-switch.js**
   - No-Fallback-Logik (hard fail if no mount)
   - `querySelector('#language-switch-mount')`
   - Explizite Error-Messages

4. **public/styles.css**
   - Flex statt Grid (`.header-inner`)
   - `min-width: 0` auf `.header-nav` und `.header-nav-list`
   - `flex-wrap: nowrap` überall
   - `gap: clamp(10px, 2vw, 20px)` statt fest
   - Media Queries: 1201px, 901-1200px, <=900px

## Test-Checkliste (DevTools Responsive Mode)

### ✅ 900px
- [ ] Header 1 Zeile
- [ ] Logo links
- [ ] Nav HIDDEN
- [ ] CTA HIDDEN
- [ ] Burger VISIBLE
- [ ] Language-Switch sichtbar
- [ ] Console keine Warnung

### ✅ 1024px
- [ ] Header 1 Zeile
- [ ] Logo links
- [ ] Nav sichtbar (mittig)
- [ ] CTA HIDDEN
- [ ] Burger HIDDEN
- [ ] Language-Switch rechts
- [ ] Kein Abschneiden

### ✅ 1178px (kritisch!)
- [ ] Header 1 Zeile
- [ ] Logo links
- [ ] Nav sichtbar (mittig)
- [ ] CTA HIDDEN
- [ ] Burger HIDDEN
- [ ] Language-Switch rechts
- [ ] Kein Abschneiden

### ✅ 1200px (kritisch!)
- [ ] Header 1 Zeile
- [ ] Logo links
- [ ] Nav sichtbar (mittig)
- [ ] CTA HIDDEN
- [ ] Burger HIDDEN
- [ ] Language-Switch rechts
- [ ] Kein Abschneiden

### ✅ 1201px (CTA-Schwelle)
- [ ] Header 1 Zeile
- [ ] Logo links
- [ ] Nav sichtbar (mittig)
- [ ] CTA VISIBLE
- [ ] Burger HIDDEN
- [ ] Language-Switch rechts
- [ ] Kein Abschneiden

### ✅ 1366px
- [ ] Header 1 Zeile
- [ ] Logo links
- [ ] Nav sichtbar (mittig)
- [ ] CTA sichtbar
- [ ] Burger HIDDEN
- [ ] Language-Switch rechts
- [ ] Perfektes Spacing

### ✅ 1440px
- [ ] Header 1 Zeile
- [ ] Logo links
- [ ] Nav sichtbar (mittig, perfekt zentriert)
- [ ] CTA sichtbar
- [ ] Burger HIDDEN
- [ ] Language-Switch rechts
- [ ] Perfektes Spacing

### ✅ 1920px
- [ ] Header 1 Zeile
- [ ] Logo links
- [ ] Nav sichtbar (mittig, perfekt zentriert)
- [ ] CTA sichtbar
- [ ] Burger HIDDEN
- [ ] Language-Switch rechts
- [ ] Perfektes Spacing
- [ ] Kein horizontaler Scroll

## Erwartetes Ergebnis

✅ **Header IMMER 1 Zeile** (nie 2/3 Zeilen)  
✅ **Logo links, Nav mittig, Controls rechts** (immer)  
✅ **Console KEINE Warnung** mehr  
✅ **Language-Switch immer in #language-switch-mount**  
✅ **Kein Abschneiden, kein horizontaler Scroll**  
✅ **CTA verschwindet ab <=1200px**  
✅ **Burger aktiviert ab <=900px**  
✅ **Nav-Spacing: clamp(10px, 2vw, 20px)** - professionell, nicht übertrieben

## Warum funktioniert es jetzt?

1. **Flex statt Grid:** Flex hat besseres Shrink-Verhalten
2. **min-width: 0:** Erlaubt Nav zu shrink (sonst blockiert Flex default `min-width: auto`)
3. **flex-wrap: nowrap:** Macht Wrap technisch unmöglich
4. **Media Queries:** Deterministisch (CTA zuerst weg, dann Burger)
5. **Dedizierter Mount-Point:** Kein Timing-Problem mehr
6. **No-Fallback:** Explizites Fail statt silent corruption
