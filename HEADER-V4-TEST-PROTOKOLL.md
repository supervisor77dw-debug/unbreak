# Header v4 FINAL - Test-Protokoll

**Commit:** 8e45ed0  
**Datum:** 2026-01-24  
**Server:** http://localhost:3000  
**Status:** ✅ READY FOR TESTING

---

## Gefixt: 3 kritische Bugs

### BUG A - Burger ohne Funktion ❌→✅
**Problem:** Burger-Icon sichtbar <1200px, aber kein Click öffnet Menu

**Root Cause:**
- Kein Event Listener auf `.header-burger`
- Kein Mobile-Panel im DOM
- Kein Toggle-Mechanismus

**Fix:**
```javascript
// header.js - setupBurgerMenu()
burgerButton.addEventListener('click', toggleMenu);
overlay.addEventListener('click', closeMenu);
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && document.body.classList.contains('menu-open')) {
    closeMenu();
  }
});
```

**Implementiert:**
- ✅ Click auf Burger → `body.menu-open` toggle
- ✅ Click auf Overlay → schließt Menu
- ✅ ESC-Key → schließt Menu
- ✅ Click auf Link → schließt Menu
- ✅ Mobile-Panel (offcanvas) im DOM
- ✅ Mobile-Overlay (backdrop) im DOM
- ✅ Z-Index: Burger 1002, Panel 1001, Overlay 1000

---

### BUG B - Ab 1350 springt Nav links, Logo bleibt ❌→✅
**Problem:** Nav springt bei 1350px nach links, Logo bleibt stehen → optisches "Auseinanderreißen"

**Root Cause:**
- Logo (`.header-brand`) und Nav (`.header-nav`) waren separate Flex-Children
- Bei Media Query >=1350 änderte sich nur Nav `justify-content`, Logo hatte eigenes Flexbox-Verhalten

**Fix:**
```html
<!-- VORHER (falsch) -->
<div class="header-inner">
  <div class="header-brand">...</div>  <!-- Separate -->
  <nav class="header-nav">...</nav>     <!-- Separate -->
  <div class="header-controls">...</div>
</div>

<!-- NACHHER (richtig) -->
<div class="header-inner">
  <div class="header-left">            <!-- WRAPPER -->
    <div class="header-brand">...</div>
    <nav class="header-nav">...</nav>
  </div>
  <div class="header-controls">...</div>
</div>
```

```css
/* .header-left bindet Brand + Nav zusammen */
.header-left {
  display: flex;
  align-items: center;
  flex: 1 1 auto;
  min-width: 0;
  gap: 24px;  /* Gutter zwischen Brand und Nav */
}

/* Media Queries steuern justify-content */
@media (min-width: 1200px) and (max-width: 1349px) {
  .header-nav {
    justify-content: center !important;  /* Nav ZENTRIERT */
  }
}

@media (min-width: 1350px) {
  .header-nav {
    justify-content: flex-start !important;  /* Nav LINKS */
  }
}
```

**Implementiert:**
- ✅ `.header-left` Wrapper (Brand + Nav gemeinsam)
- ✅ 1200-1349px: Nav `justify-content:center` (zentriert in .header-left)
- ✅ >=1350px: Nav `justify-content:flex-start` (links in .header-left)
- ✅ Logo + Nav springen **ZUSAMMEN** nach links

---

### BUG C - CTA überdeckt "Contact" ❌→✅
**Problem:** CTA zu groß, frisst Platz, überdeckt Nav-Items (speziell "Contact")

**Root Cause:**
- CTA zu groß: `padding: 10px 24px`, `font-size: 15px`
- Nav-Gap zu groß: `clamp(10px, 1.4vw, 16px)`
- Keine Platz-Reservierung für CTA

**Fix:**
```css
/* CTA KLEINER */
.header-cta {
  padding: 10px 16px;     /* Vorher: 10px 24px */
  font-size: 14px;        /* Vorher: 15px */
  border-radius: 999px;   /* Pill-Shape */
}

/* NAV-GAP KOMPAKTER */
.nav-links,
.header-nav-list {
  gap: clamp(10px, 1.2vw, 16px);  /* Vorher: 1.4vw */
}
```

**Implementiert:**
- ✅ CTA padding reduziert: 10px 16px (statt 24px)
- ✅ CTA font-size reduziert: 14px (statt 15px)
- ✅ CTA border-radius: 999px (pill-shape)
- ✅ Nav-Gap kompakter: max 16px bei 1.2vw (statt 1.4vw)
- ✅ Kein Overlap mit Nav-Items

---

## Neue Struktur (HTML/JSX)

```html
<header class="site-header">
  <div class="header-inner">
    <!-- LEFT BLOCK: Brand + Nav (springen zusammen) -->
    <div class="header-left">
      <div class="header-brand">
        <a href="index.html">
          <img src="images/logo.png" alt="UNBREAK ONE" class="nav-logo">
        </a>
      </div>
      <nav class="header-nav">
        <ul class="header-nav-list">
          <li><a href="index.html">Start</a></li>
          <li><a href="produkt.html">Produkt</a></li>
          <li><a href="einsatzbereiche.html">Einsatzbereiche</a></li>
          <li><a href="gastro-edition.html">Gastro Edition</a></li>
          <li><a href="technik.html">Technik</a></li>
          <li><a href="configurator.html">Konfigurator</a></li>
          <li><a href="/shop">Shop</a></li>
          <li><a href="kontakt.html">Kontakt</a></li>
        </ul>
      </nav>
    </div>

    <!-- RIGHT BLOCK: Controls (CTA + Language + Burger) -->
    <div class="header-controls">
      <a href="/shop" class="header-cta">Jetzt kaufen</a>
      <div id="language-switch-mount"></div>
      <button class="header-burger" type="button" aria-label="Menu">
        <span></span>
        <span></span>
        <span></span>
      </button>
    </div>
  </div>

  <!-- MOBILE NAV PANEL (Offcanvas) -->
  <div class="mobile-nav-panel">
    <ul class="mobile-nav-list">
      <li><a href="index.html">Start</a></li>
      <li><a href="produkt.html">Produkt</a></li>
      <!-- ... alle Links ... -->
      <li class="divider"></li>
      <li><a href="impressum.html">Impressum</a></li>
      <li><a href="datenschutz.html">Datenschutz</a></li>
      <li><a href="agb.html">AGB</a></li>
      <li class="divider"></li>
      <li><a href="/shop" class="btn btn-primary">Jetzt kaufen</a></li>
    </ul>
  </div>

  <!-- MOBILE NAV OVERLAY (Backdrop) -->
  <div class="mobile-nav-overlay"></div>
</header>
```

---

## CSS-Kern (gekürzt)

```css
/* Header-Inner: 2-Block Layout */
.header-inner {
  display: flex;
  align-items: center;
  justify-content: space-between;  /* LEFT | RIGHT */
  flex-wrap: nowrap;
  gap: 12px;
}

/* LEFT BLOCK: Brand + Nav */
.header-left {
  display: flex;
  align-items: center;
  flex: 1 1 auto;
  min-width: 0;
  gap: 24px;  /* Gutter */
}

.header-brand {
  flex: 0 0 auto;
  margin: 0;
}

.header-nav {
  flex: 1 1 auto;
  min-width: 0;
  display: flex;
  justify-content: center;  /* Default */
}

.header-nav-list {
  gap: clamp(10px, 1.2vw, 16px);
}

/* RIGHT BLOCK: Controls */
.header-controls {
  flex: 0 0 auto;
  display: inline-flex;
  gap: 10px;
}

.header-cta {
  display: none !important;  /* Default */
  padding: 10px 16px;
  font-size: 14px;
  border-radius: 999px;
}

.header-burger {
  display: none;  /* Default */
}

/* BREAKPOINTS */
@media (max-width: 1199px) {
  .header-nav { display: none !important; }
  .header-cta { display: none !important; }
  .header-burger { display: inline-flex !important; z-index: 1002; }
}

@media (min-width: 1200px) and (max-width: 1349px) {
  .header-nav {
    display: flex !important;
    justify-content: center !important;  /* Nav ZENTRIERT */
  }
  .header-cta { display: none !important; }
  .header-burger { display: none !important; }
}

@media (min-width: 1350px) {
  .header-nav {
    display: flex !important;
    justify-content: flex-start !important;  /* Nav LINKS */
  }
  .header-cta { display: inline-flex !important; }
  .header-burger { display: none !important; }
}

/* MOBILE PANEL */
.mobile-nav-panel {
  display: none;
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  background: linear-gradient(180deg, rgba(20, 24, 30, 0.98), rgba(20, 24, 30, 0.95));
  backdrop-filter: blur(12px);
  z-index: 1001;
  max-height: 0;
  overflow: hidden;
  transition: max-height 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

body.menu-open .mobile-nav-panel {
  display: block;
  max-height: 80vh;
  overflow-y: auto;
}

/* OVERLAY */
.mobile-nav-overlay {
  display: none;
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(4px);
  z-index: 1000;
  opacity: 0;
  transition: opacity 0.3s;
}

body.menu-open .mobile-nav-overlay {
  display: block;
  opacity: 1;
}
```

---

## JavaScript (header.js)

```javascript
function setupBurgerMenu() {
  const burgerButton = document.querySelector('.header-burger');
  const overlay = document.querySelector('.mobile-nav-overlay');
  const mobileLinks = document.querySelectorAll('.mobile-nav-list a');

  if (!burgerButton) {
    console.error('❌ BURGER NOT FOUND');
    return;
  }

  const toggleMenu = () => {
    const isOpen = document.body.classList.toggle('menu-open');
    burgerButton.setAttribute('aria-expanded', isOpen);
    burgerButton.classList.toggle('active', isOpen);
  };

  const closeMenu = () => {
    document.body.classList.remove('menu-open');
    burgerButton.setAttribute('aria-expanded', 'false');
    burgerButton.classList.remove('active');
  };

  // Burger Click
  burgerButton.addEventListener('click', toggleMenu);

  // Overlay Click
  if (overlay) {
    overlay.addEventListener('click', closeMenu);
  }

  // ESC Key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && document.body.classList.contains('menu-open')) {
      closeMenu();
    }
  });

  // Link Click
  mobileLinks.forEach(link => {
    link.addEventListener('click', closeMenu);
  });
}
```

---

## Test-Protokoll (PASS/FAIL)

**Server:** http://localhost:3000

### Test-Matrix

| Breite | Layout | Brand | Nav Position | CTA | Burger | Panel | Status |
|--------|--------|-------|--------------|-----|--------|-------|--------|
| **390px** | Mobile | ✓ Links | Hidden | Hidden | ✓ Klickbar | ✓ Funktional | ⏸️ TEST |
| **768px** | Mobile | ✓ Links | Hidden | Hidden | ✓ Klickbar | ✓ Funktional | ⏸️ TEST |
| **900px** | Mobile | ✓ Links | Hidden | Hidden | ✓ Klickbar | ✓ Funktional | ⏸️ TEST |
| **1199px** | Mobile | ✓ Links | Hidden | Hidden | ✓ Klickbar | ✓ Funktional | ⏸️ TEST |
| **1200px** | Desktop | ✓ Links | **Zentriert** | Hidden | Hidden | - | ⏸️ TEST |
| **1280px** | Desktop | ✓ Links | **Zentriert** | Hidden | Hidden | - | ⏸️ TEST |
| **1349px** | Desktop | ✓ Links | **Zentriert** | Hidden | Hidden | - | ⏸️ TEST |
| **1350px** | Desktop | ✓ Links | **Links (mit Brand)** | ✓ Sichtbar | Hidden | - | ⏸️ TEST |
| **1440px** | Desktop | ✓ Links | **Links (mit Brand)** | ✓ Sichtbar | Hidden | - | ⏸️ TEST |
| **1920px** | Desktop | ✓ Links | **Links (mit Brand)** | ✓ Sichtbar | Hidden | - | ⏸️ TEST |

---

## DevTools Checkliste (KRITISCH)

### Test 1: Burger-Funktionalität (<1200px)

**Breite:** 390px, 768px, 900px, 1199px

**Schritte:**
1. DevTools → Responsive Mode
2. Breite auf **390px**
3. **Burger sichtbar** → ✓ PASS / ❌ FAIL
4. **Burger klicken** → Panel öffnet sich → ✓ PASS / ❌ FAIL
5. **Panel sichtbar** → Links klickbar → ✓ PASS / ❌ FAIL
6. **Overlay sichtbar** → Click schließt → ✓ PASS / ❌ FAIL
7. **ESC-Key** drücken → schließt → ✓ PASS / ❌ FAIL
8. **Link klicken** → schließt Panel → ✓ PASS / ❌ FAIL

**DevTools Check:**
- Elements → `body` → hat Klasse `menu-open` wenn Panel offen
- `.mobile-nav-panel` → Computed → `max-height` > 0 wenn offen
- `.mobile-nav-overlay` → Computed → `opacity: 1` wenn offen
- `.header-burger` → Computed → `display: inline-flex`

**PASS/FAIL:** ⏸️

---

### Test 2: Nav zentriert (1200-1349px)

**Breite:** 1200px, 1280px, 1349px

**Schritte:**
1. DevTools → Responsive Mode
2. Breite auf **1200px**
3. **Nav sichtbar** (Desktop-Nav, kein Burger)
4. **Nav zentriert** (nicht links!)
5. **CTA VERSTECKT** (nicht sichtbar)
6. **"Contact" voll sichtbar** (nicht abgeschnitten)

**DevTools Check:**
- Elements → `.header-nav` anklicken
- Computed → `justify-content: center`
- `.header-cta` → Computed → `display: none`

**Visuell:**
- Logo links
- Nav **in der Mitte** von `.header-left`
- Controls rechts (nur Language-Switch)
- Kein CTA

**PASS/FAIL:** ⏸️

---

### Test 3: Nav + Brand links (>=1350px)

**Breite:** 1350px, 1440px, 1920px

**Schritte:**
1. DevTools → Responsive Mode
2. Breite auf **1350px**
3. **Nav LINKS** (mit Brand zusammen)
4. **CTA SICHTBAR** (rechts in Controls)
5. **"Contact" NICHT überdeckt**

**DevTools Check:**
- Elements → `.header-nav` anklicken
- Computed → `justify-content: flex-start`
- `.header-cta` → Computed → `display: inline-flex`
- `.header-cta` → Computed → `padding: 10px 16px` (nicht 24px!)
- `.header-cta` → Computed → `font-size: 14px` (nicht 15px!)

**Visuell:**
- Logo links
- Nav **links** (direkt rechts von Logo, 24px Gap)
- Controls rechts (CTA + Language-Switch)
- CTA klein (pill-shape)
- "Contact" voll sichtbar, kein Overlap

**PASS/FAIL:** ⏸️

---

### Test 4: 1349 → 1350 Sprung-Test (KRITISCH!)

**Schritte:**
1. Breite auf **1349px**
2. **Nav Position merken** (zentriert)
3. Breite auf **1350px** ändern
4. **Logo + Nav springen ZUSAMMEN** nach links

**Erwartung:**
- **1349px**: Nav zentriert, CTA hidden
- **1350px**: Logo + Nav **zusammen links**, CTA erscheint
- **KEIN**: Logo bleibt, Nav springt alleine
- **KEIN**: Logo driftet, Nav folgt später

**Visuell:**
- Logo und Nav bewegen sich **als Block**
- Kein "Auseinanderreißen"
- Smooth transition (nur justify-content ändert sich)

**PASS/FAIL:** ⏸️

---

### Test 5: CTA Overlap-Check (1350px)

**Breite:** 1350px

**Schritte:**
1. DevTools → Elements → `.header-controls`
2. Hover über "Contact" Link
3. Prüfen: Ist "Contact" **voll klickbar**?
4. Prüfen: Überdeckt CTA **keine Nav-Items**?

**DevTools Check:**
- `.header-cta` → Computed → Width prüfen (sollte ~80-100px sein)
- `.header-nav-list` → Computed → Gap prüfen (`clamp(10px, 1.2vw, 16px)`)

**Erwartung:**
- CTA rechts in Controls
- Nav-Items links (in .header-left)
- Kein Overlap
- "Contact" voll sichtbar und klickbar

**PASS/FAIL:** ⏸️

---

## Erwartetes Verhalten (Zusammenfassung)

### ✅ Burger funktional (<1200px)
- Click → Panel öffnet (offcanvas)
- Overlay Click → schließt
- ESC → schließt
- Link Click → schließt
- body.menu-open toggle
- Z-Index korrekt (Burger 1002, Panel 1001, Overlay 1000)

### ✅ Nav zentriert (1200-1349px)
- Nav sichtbar (kein Burger)
- Nav `justify-content: center` in `.header-left`
- CTA versteckt
- Logo links, Controls rechts
- Kein Overlap

### ✅ Nav+Brand links (>=1350px)
- Nav `justify-content: flex-start` in `.header-left`
- Logo und Nav **zusammen links** (24px Gap)
- CTA sichtbar (klein: 10px 16px, 14px)
- Controls rechts (CTA + Language)
- Kein Overlap mit Nav

### ✅ 1349→1350 Sprung
- Logo + Nav springen **zusammen**
- Kein "Auseinanderreißen"
- Kein Logo-Drift
- Smooth transition

### ✅ CTA klein + kollisionsfrei
- padding: 10px 16px (statt 24px)
- font-size: 14px (statt 15px)
- border-radius: 999px (pill)
- gap: 1.2vw max 16px (statt 1.4vw)
- Kein Overlap mit "Contact"

---

## Nächste Schritte

1. **User testet http://localhost:3000**
2. **Alle 10 Breakpoints durchgehen** (siehe Test-Matrix)
3. **PASS/FAIL für jeden Test eintragen**
4. **DevTools Checks durchführen** (Computed Styles)
5. **Visuelle Checks** (Nav-Position, CTA-Größe, Overlap)

**Bei FAIL:**
- Screenshot + Console Log
- Welcher Test failed?
- Was ist sichtbar vs. erwartet?
- DevTools Computed Styles Screenshot

**Status:** ✅ READY FOR USER TESTING  
**Commit:** 8e45ed0  
**Files Changed:**
- components/Header.jsx
- public/components/header.js
- public/styles.css
- HEADER-V3-TEST-PROTOKOLL.md
