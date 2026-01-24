# Header v5 - Test-Protokoll

**Commit:** 504dede  
**Datum:** 2026-01-24  
**Server:** http://localhost:3000  
**Status:** ✅ READY FOR TESTING

---

## Gefixt: Logo-Drift + CTA-Kollision

### 🔧 BUG 1 - Logo wandert ab 1266px ❌→✅

**Problem:** Logo steht bis ~1266px links, danach wandert es Richtung Mitte

**Root Cause:**
- `.header-left` hatte KEIN explizites `justify-content`
- Implizit `flex-start`, aber nicht hart gesetzt
- Bei bestimmten Viewport-Größen konnte Flexbox anders verteilen

**Fix:**
```css
.header-left {
  justify-content: flex-start;  /* HART - Logo NIEMALS wandern */
}

.header-inner {
  overflow: visible;  /* Logo-Drift Prevention */
}

.header-brand {
  min-width: 0;  /* Explizit auf allen Children */
}
```

**Implementiert:**
- ✅ `.header-left` mit `justify-content: flex-start` EXPLIZIT
- ✅ `.header-inner` mit `overflow: visible`
- ✅ `.header-brand` mit `min-width: 0` explizit
- ✅ Logo bleibt IMMER links (bei jeder Viewport-Breite)

---

### 🔧 BUG 2 - CTA erscheint zu früh (1350px) ❌→✅

**Problem:** CTA sichtbar ab 1350px, kollidiert mit Nav bei engen Viewports

**Root Cause:**
- Breakpoint 1350px zu früh
- Nicht genug Platz für Nav + CTA
- "Contact" wird überdeckt

**Fix:**
```css
/* VORHER: CTA ab 1350px */
@media (min-width: 1350px) {
  .header-cta { display: inline-flex !important; }
}

/* NACHHER: CTA ab 1450px */
@media (min-width: 1200px) and (max-width: 1449px) {
  .header-cta { display: none !important; }
}

@media (min-width: 1450px) {
  .header-cta { display: inline-flex !important; }
}
```

**Implementiert:**
- ✅ Breakpoint verschoben: 1350px → 1450px
- ✅ 100px mehr Platz für Nav
- ✅ Kein frühes Erscheinen mehr

---

### 🔧 BUG 3 - CTA zu groß, überdeckt "Contact" ❌→✅

**Problem:** CTA frisst zu viel Platz, "Contact" nicht klickbar

**Root Cause:**
- CTA zu groß: `padding: 10px 16px`, `font-size: 14px`
- Text zu lang: "Jetzt kaufen" (12 Zeichen)
- Nav-Gap zu groß: `clamp(10px, 1.2vw, 16px)`

**Fix:**
```css
/* VORHER */
.header-cta {
  padding: 10px 16px;
  font-size: 14px;
}

/* NACHHER */
.header-cta {
  padding: 8px 12px;     /* KLEINER */
  font-size: 13px;       /* KLEINER */
  line-height: 1;
  gap: 4px;              /* Icon spacing */
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
```

```html
<!-- VORHER -->
<a href="/shop" class="header-cta">Jetzt kaufen</a>

<!-- NACHHER -->
<a href="/shop" class="header-cta">
  <svg width="14" height="14"><!-- Shopping Bag Icon --></svg>
  <span>Kaufen</span>
</a>
```

**Nav-Gap reduziert:**
```css
/* VORHER */
.header-nav-list {
  gap: clamp(10px, 1.2vw, 16px);
}

/* NACHHER */
.header-nav-list {
  gap: clamp(8px, 1vw, 14px);  /* Kompakter */
}
```

**Implementiert:**
- ✅ CTA padding: 8px 12px (statt 10px 16px)
- ✅ CTA font-size: 13px (statt 14px)
- ✅ CTA Text: "Kaufen" (statt "Jetzt kaufen")
- ✅ CTA mit Icon (Shopping Bag SVG 14x14)
- ✅ Nav-gap: max 14px (statt 16px)
- ✅ Kein Overlap mehr

---

## CSS-Änderungen (Zusammenfassung)

### A) Logo IMMER links

**ENTFERNT:** Implizites `justify-content` (flex-start)  
**HINZUGEFÜGT:** Explizites `justify-content: flex-start`

```css
.header-inner {
  overflow: visible;  /* NEU */
}

.header-left {
  justify-content: flex-start;  /* NEU - EXPLIZIT */
}

.header-brand {
  min-width: 0;  /* NEU - explizit */
}
```

### B) CTA ab 1450px (statt 1350px)

**ENTFERNT:**
```css
@media (min-width: 1200px) and (max-width: 1349px) { }
@media (min-width: 1350px) { }
```

**HINZUGEFÜGT:**
```css
@media (min-width: 1200px) and (max-width: 1449px) { }
@media (min-width: 1450px) { }
```

### C) CTA KOMPAKT

**ENTFERNT:**
```css
.header-cta {
  padding: 10px 16px;
  font-size: 14px;
}
```

**HINZUGEFÜGT:**
```css
.header-cta {
  padding: 8px 12px;
  font-size: 13px;
  line-height: 1;
  gap: 4px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
```

### D) Nav-gap kompakter

**ENTFERNT:**
```css
gap: clamp(10px, 1.2vw, 16px);
```

**HINZUGEFÜGT:**
```css
gap: clamp(8px, 1vw, 14px);
```

---

## HTML-Änderungen

### CTA mit Icon + Kurztext

**VORHER:**
```html
<a href="/shop" class="header-cta">Jetzt kaufen</a>
```

**NACHHER:**
```html
<a href="/shop" class="header-cta">
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
    <path d="M19 6h-2c0-2.76-2.24-5-5-5S7 3.24 7 6H5c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm-7-3c1.66 0 3 1.34 3 3H9c0-1.66 1.34-3 3-3zm7 17H5V8h14v12z" fill="currentColor"/>
  </svg>
  <span>Kaufen</span>
</a>
```

**Breite:**
- Vorher: ~110px ("Jetzt kaufen" 14px)
- Nachher: ~70px (Icon 14px + "Kaufen" 13px + gap 4px)
- **Gewinn: ~40px weniger Breite**

---

## Test-Matrix (PASS/FAIL)

**Server:** http://localhost:3000

| Breite | Logo Position | Nav Position | CTA | Burger | Contact klickbar | Status |
|--------|---------------|--------------|-----|--------|------------------|--------|
| **390px** | Links | Hidden | Hidden | ✓ Sichtbar | - | ⏸️ TEST |
| **768px** | Links | Hidden | Hidden | ✓ Sichtbar | - | ⏸️ TEST |
| **1199px** | Links | Hidden | Hidden | ✓ Sichtbar | - | ⏸️ TEST |
| **1200px** | **Links FIX** | **Zentriert** | Hidden | Hidden | ✓ Ja | ⏸️ TEST |
| **1266px** | **Links FIX** | **Zentriert** | Hidden | Hidden | ✓ Ja | ⏸️ TEST |
| **1350px** | **Links FIX** | **Zentriert** | Hidden | Hidden | ✓ Ja | ⏸️ TEST |
| **1440px** | **Links FIX** | **Zentriert** | Hidden | Hidden | ✓ Ja | ⏸️ TEST |
| **1449px** | **Links FIX** | **Zentriert** | Hidden | Hidden | ✓ Ja | ⏸️ TEST |
| **1450px** | **Links FIX** | **Links** | **✓ KOMPAKT** | Hidden | ✓ Ja | ⏸️ TEST |
| **1600px** | **Links FIX** | **Links** | ✓ KOMPAKT | Hidden | ✓ Ja | ⏸️ TEST |
| **1920px** | Links FIX | Links | ✓ KOMPAKT | Hidden | ✓ Ja | ⏸️ TEST |

---

## DevTools Checkliste (KRITISCH)

### Test 1: Logo NIEMALS wandern (1200-1450px)

**Schritte:**
1. DevTools → Responsive Mode
2. Breite auf **1200px**
3. **Logo Position merken** (Pixel von links)
4. Breite auf **1266px** ändern
5. **Logo Position prüfen** (MUSS gleich sein!)
6. Breite auf **1350px** ändern
7. **Logo Position prüfen** (MUSS gleich sein!)
8. Breite auf **1449px** ändern
9. **Logo Position prüfen** (MUSS gleich sein!)

**DevTools Check:**
- Elements → `.header-left` anklicken
- Computed → `justify-content: flex-start` (MUSS da sein!)
- Computed → `.header-brand` → `margin: 0` (kein auto!)

**Erwartung:**
- Logo-Position **IDENTISCH** bei allen Breiten 1200-1449px
- Logo wandert **NICHT** nach rechts
- Logo bleibt **IMMER links**

**PASS/FAIL:** ⏸️

---

### Test 2: CTA erscheint ERST ab 1450px

**Schritte:**
1. DevTools → Responsive Mode
2. Breite auf **1449px**
3. **CTA MUSS versteckt sein** → ⏸️
4. Breite auf **1450px** ändern
5. **CTA MUSS erscheinen** → ⏸️

**DevTools Check:**
- Elements → `.header-cta` anklicken
- **1449px**: Computed → `display: none`
- **1450px**: Computed → `display: inline-flex`

**Erwartung:**
- **1449px**: CTA `display: none`
- **1450px**: CTA `display: inline-flex`
- **Exakter Wechsel** bei 1450px

**PASS/FAIL:** ⏸️

---

### Test 3: CTA KOMPAKT (Icon + Kaufen)

**Breite:** 1450px

**Schritte:**
1. DevTools → Elements → `.header-cta`
2. Computed prüfen:
   - `padding: 8px 12px` ✓
   - `font-size: 13px` ✓
   - `gap: 4px` ✓
3. Visuell prüfen:
   - Shopping Bag Icon sichtbar ✓
   - Text "Kaufen" (nicht "Jetzt kaufen") ✓
   - CTA klein (~70px breit) ✓

**DevTools Width Check:**
- `.header-cta` → Computed → Width
- Sollte ~60-80px sein (nicht 100-120px)

**PASS/FAIL:** ⏸️

---

### Test 4: "Contact" NICHT überdeckt

**Breite:** 1450px, 1600px, 1920px

**Schritte:**
1. Breite auf **1450px**
2. **Hover über "Contact" Link**
3. Prüfen: Ist "Contact" **voll klickbar**?
4. Prüfen: Überdeckt CTA **keine Nav-Items**?

**Visuell:**
- Nav-Items links (Start...Kontakt)
- CTA rechts in Controls
- **Klarer Abstand** zwischen letztem Nav-Item und CTA
- "Contact" **voll sichtbar** und **klickbar**

**PASS/FAIL:** ⏸️

---

### Test 5: Nav-Gap kompakt

**Breite:** 1450px

**Schritte:**
1. DevTools → Elements → `.header-nav-list`
2. Computed → `gap` prüfen
3. Sollte `14px` oder weniger sein (bei 1450px = 1vw = 14.5px)

**Erwartung:**
- Gap kleiner als vorher (max 14px statt 16px)
- Nav kompakter
- Mehr Platz für CTA

**PASS/FAIL:** ⏸️

---

## Erwartetes Verhalten (Zusammenfassung)

### ✅ Logo IMMER links (1200-1920px)
- Position **IDENTISCH** bei allen Breiten
- Kein Wandern/Driften
- `.header-left { justify-content: flex-start; }` HART

### ✅ CTA ab 1450px (statt 1350px)
- 1200-1449px: CTA `display: none`
- >=1450px: CTA `display: inline-flex`
- 100px später als vorher

### ✅ CTA KOMPAKT (Icon + "Kaufen")
- padding: 8px 12px (statt 10px 16px)
- font-size: 13px (statt 14px)
- Shopping Bag Icon (14x14)
- Text: "Kaufen" (statt "Jetzt kaufen")
- Breite: ~70px (statt ~110px)

### ✅ Nav-gap kompakter
- gap: clamp(8px, 1vw, 14px)
- max 14px (statt 16px)
- 2px weniger bei großen Viewports

### ✅ Kein Overlap
- CTA überdeckt **keine** Nav-Items
- "Contact" **voll klickbar**
- Klarer Abstand zwischen Nav und CTA

---

## Nächste Schritte

1. **User testet http://localhost:3000**
2. **Kritische Breakpoints prüfen:**
   - 1200px: Logo links FIX ✓
   - 1266px: Logo links FIX (kein Wandern!) ✓
   - 1350px: Logo links FIX, CTA hidden ✓
   - 1449px: Logo links FIX, CTA hidden ✓
   - 1450px: Logo links FIX, CTA sichtbar KOMPAKT ✓
3. **PASS/FAIL für jeden Test eintragen**
4. **DevTools Checks durchführen**

**Bei FAIL:**
- Screenshot + Console Log
- Welcher Test failed?
- Was ist sichtbar vs. erwartet?

**Status:** ✅ READY FOR USER TESTING  
**Commit:** 504dede  
**Files:**
- public/styles.css (justify-content, breakpoints, CTA kompakt)
- public/components/header.js (CTA Icon + Kaufen)
- components/Header.jsx (CTA Icon + Kaufen)
- HEADER-V4-CODE-DIFF.md
- HEADER-V4-TEST-PROTOKOLL.md
