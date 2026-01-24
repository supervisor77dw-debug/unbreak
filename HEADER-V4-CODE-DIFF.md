# Header v4 - Code-Diff Übersicht

**Commit:** 8e45ed0  
**Datum:** 2026-01-24

---

## 1. components/Header.jsx

### A) Neue HTML-Struktur mit .header-left wrapper

**VORHER:**
```jsx
<header className="site-header">
  <div className="header-inner" ref={headerInnerRef}>
    <div className="header-brand" ref={brandRef}>...</div>
    <nav className="header-nav" ref={navRef}>...</nav>
    <div className="header-controls" ref={controlsRef}>...</div>
  </div>
</header>
```

**NACHHER:**
```jsx
<header className="site-header">
  <div className="header-inner" ref={headerInnerRef}>
    {/* LEFT BLOCK: Brand + Nav (springen zusammen) */}
    <div className="header-left">
      <div className="header-brand" ref={brandRef}>...</div>
      <nav className="header-nav" ref={navRef}>...</nav>
    </div>

    {/* RIGHT BLOCK: Controls */}
    <div className="header-controls" ref={controlsRef}>...</div>
  </div>

  {/* MOBILE NAV PANEL (Offcanvas) */}
  <div className={`mobile-nav-panel ${isMenuOpen ? 'open' : ''}`}>
    <ul className="mobile-nav-list">...</ul>
  </div>

  {/* MOBILE NAV OVERLAY (Click-to-close) */}
  <div className={`mobile-nav-overlay ${isMenuOpen ? 'open' : ''}`} onClick={toggleMenu}></div>
</header>
```

### B) useEffect für ESC-Key + body.menu-open

**NEU:**
```jsx
// Close menu on ESC key
useEffect(() => {
  const handleEscape = (e) => {
    if (e.key === 'Escape' && isMenuOpen) {
      setIsMenuOpen(false);
    }
  };
  window.addEventListener('keydown', handleEscape);
  return () => window.removeEventListener('keydown', handleEscape);
}, [isMenuOpen]);

// Toggle body class for menu state
useEffect(() => {
  if (isMenuOpen) {
    document.body.classList.add('menu-open');
  } else {
    document.body.classList.remove('menu-open');
  }
}, [isMenuOpen]);
```

### C) Mobile-Panel Links mit onClick={toggleMenu}

**NEU:**
```jsx
<div className={`mobile-nav-panel ${isMenuOpen ? 'open' : ''}`}>
  <ul className="mobile-nav-list">
    <li><a href="/index.html" onClick={toggleMenu}>Start</a></li>
    <li><a href="/produkt.html" onClick={toggleMenu}>Produkt</a></li>
    <!-- ... alle Links mit onClick={toggleMenu} ... -->
  </ul>
</div>
```

---

## 2. public/components/header.js

### A) Neue HTML-Struktur (gleich wie Header.jsx)

**VORHER:**
```javascript
function getHeaderHTML() {
  return `
  <header class="site-header">
    <div class="header-inner">
      <div class="header-brand">...</div>
      <nav class="header-nav">...</nav>
      <div class="header-controls">...</div>
    </div>
  </header>
  `;
}
```

**NACHHER:**
```javascript
function getHeaderHTML() {
  return `
  <header class="site-header">
    <div class="header-inner">
      <!-- LEFT BLOCK: Brand + Nav (springen zusammen) -->
      <div class="header-left">
        <div class="header-brand">...</div>
        <nav class="header-nav">...</nav>
      </div>

      <!-- RIGHT BLOCK: Controls -->
      <div class="header-controls">...</div>
    </div>

    <!-- MOBILE NAV PANEL (Offcanvas) -->
    <div class="mobile-nav-panel">
      <ul class="mobile-nav-list">...</ul>
    </div>

    <!-- MOBILE NAV OVERLAY (Click-to-close) -->
    <div class="mobile-nav-overlay"></div>
  </header>
  `;
}
```

### B) setupBurgerMenu() NEU (statt setupAutoCollapse)

**ENTFERNT:**
```javascript
// State für Progressive Collapse
let ctaHidden = false;
let isCollapsed = false;
let resizeObserver = null;

function setupAutoCollapse() {
  // ... komplexe Messung + Collapse-Logik ...
}
```

**NEU:**
```javascript
function setupBurgerMenu() {
  const burgerButton = document.querySelector('.header-burger');
  const mobilePanel = document.querySelector('.mobile-nav-panel');
  const overlay = document.querySelector('.mobile-nav-overlay');
  const mobileLinks = document.querySelectorAll('.mobile-nav-list a');

  if (!burgerButton) {
    if (window.clientLogger) window.clientLogger.error('❌ BURGER NOT FOUND: .header-burger selector failed');
    return;
  }

  if (window.clientLogger) window.clientLogger.log('✓ Burger-Menu initialized');

  // Toggle Menu
  const toggleMenu = () => {
    const isOpen = document.body.classList.toggle('menu-open');
    burgerButton.setAttribute('aria-expanded', isOpen);
    burgerButton.classList.toggle('active', isOpen);
    if (window.clientLogger) window.clientLogger.log(isOpen ? '▶ Menu opened' : '◀ Menu closed');
  };

  // Close Menu
  const closeMenu = () => {
    document.body.classList.remove('menu-open');
    burgerButton.setAttribute('aria-expanded', 'false');
    burgerButton.classList.remove('active');
    if (window.clientLogger) window.clientLogger.log('◀ Menu closed');
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

  // Close on Link Click
  mobileLinks.forEach(link => {
    link.addEventListener('click', closeMenu);
  });
}
```

### C) initHeader() angepasst

**VORHER:**
```javascript
function initHeader() {
  const headerContainer = document.getElementById('header-container');
  if (headerContainer) {
    headerContainer.innerHTML = getHeaderHTML();
    setActiveMenuItem();
    
    // Auto-Collapse aktivieren
    setTimeout(() => {
      setupAutoCollapse();
    }, 100);
  }
}
```

**NACHHER:**
```javascript
function initHeader() {
  const headerContainer = document.getElementById('header-container');
  if (headerContainer) {
    headerContainer.innerHTML = getHeaderHTML();
    setActiveMenuItem();
    
    // Burger-Menü aktivieren
    setupBurgerMenu();
    
    if (window.clientLogger) window.clientLogger.log('✓ Header loaded with Burger-Menu');
  } else {
    if (window.clientLogger) window.clientLogger.error('❌ Header container (#header-container) not found');
  }
}
```

---

## 3. public/styles.css

### A) .header-inner mit justify-content:space-between

**VORHER:**
```css
.header-inner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: nowrap;
  gap: 12px;
}
```

**NACHHER (unverändert, aber jetzt mit 2 Children statt 3):**
```css
.header-inner {
  display: flex;
  align-items: center;
  justify-content: space-between;  /* LEFT | RIGHT */
  flex-wrap: nowrap;
  gap: 12px;
}
```

### B) .header-left NEU

**NEU:**
```css
/* LEFT BLOCK: Brand + Nav (springen zusammen ab 1350px) */
.header-left {
  display: flex;
  align-items: center;
  flex: 1 1 auto;  /* Kann wachsen */
  min-width: 0;  /* Kritisch für Shrinking */
  gap: 24px;  /* Gutter zwischen Brand und Nav */
}
```

### C) .header-brand ohne padding-right

**VORHER:**
```css
.header-brand {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  padding: 8px 0;
  padding-right: 24px;  /* GUTTER */
  white-space: nowrap;
  margin: 0;
}
```

**NACHHER:**
```css
/* Zone 1: Brand/Logo - Links */
.header-brand {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  padding: 8px 0;  /* Optischer Abstand oben/unten */
  white-space: nowrap;
  margin: 0;  /* KRITISCH: Kein auto-margin (verhindert Drift) */
  /* padding-right entfernt - Gap kommt von .header-left */
}
```

### D) .header-nav mit justify-content:center (Default)

**VORHER:**
```css
.header-nav {
  flex: 1 1 auto;
  min-width: 0;
  overflow: visible;
  white-space: nowrap;
  display: flex;
  justify-content: center;
}
```

**NACHHER:**
```css
/* Zone 2: Nav - Default zentriert (1200-1349), ab 1350 links */
.header-nav {
  flex: 1 1 auto;
  min-width: 0;
  overflow: visible;
  white-space: nowrap;
  display: flex;
  justify-content: center;  /* Default: zentriert (wird bei >=1350 auf flex-start) */
}

/* Nav-Liste */
.nav-links,
.header-nav-list {
  display: flex;
  flex-wrap: nowrap;
  align-items: center;
  gap: clamp(10px, 1.2vw, 16px);  /* Kompakter Gap (vorher 1.4vw) */
  list-style: none;
  margin: 0;
  padding: 0;
}

.nav-links li,
.header-nav-list li {
  white-space: nowrap;
  flex-shrink: 0;
}
```

### E) .header-cta KLEINER

**VORHER:**
```css
.btn-nav,
.header-cta {
  background-color: var(--color-petrol-deep);
  color: var(--color-white);
  padding: 10px 24px;  /* GROß */
  font-size: 15px;     /* GROß */
  box-shadow: 0 2px 6px rgba(10, 108, 116, 0.25);
  white-space: nowrap;
  flex: 0 0 auto;
}

.header-cta {
  display: none !important;
}
```

**NACHHER:**
```css
.btn-nav,
.header-cta {
  background-color: var(--color-petrol-deep);
  color: var(--color-white);
  padding: 10px 16px;  /* KLEINER (statt 24px) */
  font-size: 14px;      /* KLEINER (statt 15px) */
  box-shadow: 0 2px 6px rgba(10, 108, 116, 0.25);
  white-space: nowrap;
  flex: 0 0 auto;
  border-radius: 999px;  /* Pill-Shape NEU */
}

.header-cta {
  display: none !important;
}
```

### F) .header-burger Basis-Styles

**VORHER:**
```css
.burger-menu,
.header-burger {
  display: none;
  flex-direction: column;
  gap: 5px;
  cursor: pointer;
  padding: var(--spacing-xs);
  flex: 0 0 auto;
}

.burger-menu.visible,
.header-burger.visible {
  display: flex;
}
```

**NACHHER:**
```css
.burger-menu,
.header-burger {
  display: none;  /* Default: hidden (per Media Query aktiviert) */
  flex-direction: column;
  gap: 5px;
  cursor: pointer;
  padding: var(--spacing-xs);
  flex: 0 0 auto;
  border: none;
  background: transparent;
  position: relative;
}
/* .visible Klasse entfernt - nicht mehr verwendet */
```

### G) Media Queries NEU mit justify-content Switch

**VORHER:**
```css
/* Burger-Mode: < 1200px */
@media (max-width: 1199px) {
  .header-nav { display: none !important; }
  .header-burger { display: inline-flex !important; }
  .header-cta { display: none !important; }
}

/* Desktop ohne CTA: 1200px - 1349px */
@media (min-width: 1200px) and (max-width: 1349px) {
  .header-nav { display: flex !important; }
  .header-burger { display: none !important; }
  .header-cta { display: none !important; }
}

/* Desktop mit CTA: >= 1350px */
@media (min-width: 1350px) {
  .header-nav { display: flex !important; }
  .header-burger { display: none !important; }
  .header-cta { display: inline-flex !important; }
}
```

**NACHHER:**
```css
/* <1200px: Burger-Mode (Mobile) */
@media (max-width: 1199px) {
  .header-nav { display: none !important; }
  .header-cta { display: none !important; }
  .header-burger {
    display: inline-flex !important;
    position: relative;
    z-index: 1002;  /* NEU: Über Panel */
  }
}

/* 1200-1349px: Desktop ohne CTA, Nav ZENTRIERT */
@media (min-width: 1200px) and (max-width: 1349px) {
  .header-nav {
    display: flex !important;
    justify-content: center !important;  /* NEU: Nav ZENTRIERT */
  }
  .header-cta { display: none !important; }
  .header-burger { display: none !important; }
}

/* >=1350px: Desktop mit CTA, Nav LINKS */
@media (min-width: 1350px) {
  .header-nav {
    display: flex !important;
    justify-content: flex-start !important;  /* NEU: Nav LINKS */
  }
  .header-cta {
    display: inline-flex !important;
    padding: 10px 16px;  /* Kleiner */
    font-size: 14px;     /* Kleiner */
    border-radius: 999px;
  }
  .header-burger { display: none !important; }
}
```

### H) .mobile-nav-panel + .mobile-nav-overlay NEU

**NEU:**
```css
/* === MOBILE NAV PANEL (Offcanvas) === */
.mobile-nav-panel {
  display: none;
  position: absolute;
  top: 100%;  /* Unter Header */
  left: 0;
  right: 0;
  background: linear-gradient(180deg, rgba(20, 24, 30, 0.98), rgba(20, 24, 30, 0.95));
  backdrop-filter: blur(12px) saturate(130%);
  -webkit-backdrop-filter: blur(12px) saturate(130%);
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3);
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

.mobile-nav-list {
  list-style: none;
  margin: 0;
  padding: var(--spacing-md) var(--spacing-lg);
}

.mobile-nav-list li {
  margin: 0;
  padding: 0;
}

.mobile-nav-list li.divider {
  height: 1px;
  background: rgba(255, 255, 255, 0.1);
  margin: var(--spacing-sm) 0;
}

.mobile-nav-list a {
  display: block;
  padding: var(--spacing-sm) var(--spacing-md);
  color: rgba(230, 235, 240, 0.88);
  text-decoration: none;
  border-radius: var(--border-radius-sm);
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
}

.mobile-nav-list a:hover,
.mobile-nav-list a:focus {
  background: rgba(10, 108, 116, 0.15);
  color: var(--color-petrol-deep);
}

.mobile-nav-list a.btn {
  margin-top: var(--spacing-sm);
  text-align: center;
}

/* === MOBILE NAV OVERLAY === */
.mobile-nav-overlay {
  display: none;
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
  z-index: 1000;
  opacity: 0;
  transition: opacity 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

body.menu-open .mobile-nav-overlay {
  display: block;
  opacity: 1;
}
```

---

## Zusammenfassung Änderungen

### HTML/JSX
- ✅ `.header-left` wrapper (Brand + Nav zusammen)
- ✅ `.mobile-nav-panel` (offcanvas)
- ✅ `.mobile-nav-overlay` (backdrop)
- ✅ `<button type="button">` auf Burger

### CSS
- ✅ `.header-left` mit `gap: 24px`
- ✅ `.header-nav` mit `justify-content: center` (Default)
- ✅ Media Query >=1350: `justify-content: flex-start`
- ✅ `.header-cta` kleiner (10px 16px, 14px, pill)
- ✅ `.nav-links` gap reduziert (1.2vw max 16px)
- ✅ `.mobile-nav-panel` + `.mobile-nav-overlay` Styles
- ✅ `body.menu-open` triggers

### JavaScript
- ✅ `setupBurgerMenu()` implementiert
- ✅ `setupAutoCollapse()` entfernt
- ✅ Click/Overlay/ESC/Link handlers
- ✅ `body.menu-open` toggle
- ✅ Console Logging

### React (Header.jsx)
- ✅ useEffect für ESC-Key
- ✅ useEffect für body.menu-open
- ✅ Mobile-Panel onClick handlers

---

**Commit:** 8e45ed0  
**Files Changed:**
- components/Header.jsx (Struktur + useEffects)
- public/components/header.js (Struktur + setupBurgerMenu)
- public/styles.css (Layout + Media Queries + Mobile Panel)
- HEADER-V3-TEST-PROTOKOLL.md (neu)
