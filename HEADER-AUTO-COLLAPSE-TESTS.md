# Header Progressive Collapse Tests

## Implementierung v2 (Grid + 3-Stufen Collapse)

### Änderungen

**Dateien geändert:**
- `components/Header.jsx` - Progressive Collapse (React): Normal → CTA hidden → Burger
- `public/components/header.js` - Progressive Collapse (Vanilla JS): Normal → CTA hidden → Burger
- `public/styles.css` - Grid Layout + clamp spacing

**CSS-Regeln entfernt (verursachten Wrap/Abschneiden):**
- ❌ `.header-inner { display: flex; justify-content: space-between; width: 100% }` 
- ✅ `.header-inner { display: grid; grid-template-columns: auto 1fr auto; }`
- ❌ `.nav-links { gap: var(--spacing-md) }` (fest 24px, zu groß)
- ✅ `.nav-links { gap: clamp(10px, 2vw, 26px) }` (responsive spacing)
- ❌ Flex-Layout (Brand/Nav/Controls als flex-children)
- ✅ Grid-Layout (Brand col-1, Nav col-2 center, Controls col-3 end)

**Architektur-Änderung:**
- Flex → Grid (3 Spalten: auto 1fr auto)
- `.header-brand { grid-column: 1; justify-self: start; }`
- `.header-nav { grid-column: 2; justify-self: center; }`
- `.header-controls { grid-column: 3; justify-self: end; }`
- Alle Zonen: `white-space: nowrap` (nie umbrechen)

**Messlogik (Progressive Collapse - 3 Stufen):**
- Sitzt in: `components/Header.jsx` (useLayoutEffect Hook, ctaHidden + isCollapsed states)
- Sitzt in: `public/components/header.js` (setupAutoCollapse Funktion)

**Berechnung:**
```javascript
const available = headerInner.clientWidth;
const neededBrand = brand.scrollWidth;
const neededNav = nav.scrollWidth;
const neededControls = controls.scrollWidth;
const gaps = 32; // 2x column-gap 16px
let neededTotal = neededBrand + neededNav + neededControls + gaps;

// Stufe 1: Normal (alles sichtbar)
if (neededTotal <= available) → Normal

// Stufe 2: CTA verstecken
if (neededTotal > available && !ctaHidden) → setCtaHidden(true)

// Stufe 3: Burger aktivieren
if (neededTotal > available && ctaHidden) → setIsCollapsed(true)
```

## Test-Protokoll

Bitte testen und Screenshots machen:

### ✅ 1024px
- [ ] Header 1 Zeile
- [ ] Logo links
- [ ] Nav zentriert ODER Burger (je nach Textlänge)
- [ ] Controls rechts
- [ ] Kein Text abgeschnitten
- [ ] Kein Wrap

### ✅ 1178px (kritischer Breakpoint - vorher CTA abgeschnitten)
- [ ] Header 1 Zeile
- [ ] Logo links
- [ ] Nav zentriert ODER Burger
- [ ] CTA sichtbar (wenn Desktop) ODER hidden (wenn collapsed)
- [ ] Kein Abschneiden
- [ ] Kein Wrap

### ✅ 1200px
- [ ] Header 1 Zeile
- [ ] Logo links
- [ ] Nav zentriert
- [ ] CTA + Language-Switch rechts
- [ ] Burger hidden
- [ ] Kein Wrap

### ✅ 1366px
- [ ] Header 1 Zeile (volle Desktop-Breite)
- [ ] Logo links
- [ ] Nav zentriert (alle Punkte sichtbar)
- [ ] CTA + Language-Switch rechts
- [ ] Burger hidden
- [ ] Kein Wrap

### ✅ 1440px
- [ ] Header 1 Zeile (volle Desktop-Breite)
- [ ] Logo links
- [ ] Nav zentriert (perfekt ausgerichtet)
- [ ] CTA + Language-Switch rechts
- [ ] Burger hidden
- [ ] Kein Wrap

## Erwartetes Verhalten

**Desktop (genug Platz):**
- Logo links
- Nav zentriert (8 Menüpunkte sichtbar)
- CTA "Jetzt kaufen" rechts
- Language-Switch rechts
- Burger hidden

**Auto-Collapse (zu wenig Platz):**
- Logo links
- Nav HIDDEN (collapsed class)
- Burger VISIBLE (visible class)
- CTA optional hidden (wenn zu wenig Platz)
- Language-Switch bleibt wenn möglich

**Mobile (<900px fester Breakpoint):**
- Logo links
- Nav HIDDEN (mobile-only)
- Burger VISIBLE
- CTA hidden (nur im Burger-Dropdown)
- Language-Switch rechts

## Technische Details

**ResizeObserver:**
```javascript
const availableWidth = headerInner.clientWidth;
const brandWidth = brandRef.scrollWidth;
const navWidth = navRef.scrollWidth;
const controlsWidth = controlsRef.scrollWidth;
const gaps = 32; // 2x gap 16px
const neededWidth = brandWidth + navWidth + controlsWidth + gaps;

const shouldCollapse = neededWidth > availableWidth;
```

**CSS Layout:**
```css
.header-inner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: nowrap;
}

.header-brand { flex: 0 0 auto; white-space: nowrap; }
.header-nav { flex: 1 1 auto; justify-content: center; overflow: visible; }
.header-controls { flex: 0 0 auto; margin-left: auto; white-space: nowrap; }
```

**Wichtig:**
- Kein `overflow: hidden` auf Nav (verhindert Abschneiden)
- `justify-content: space-between` auf header-inner (korrekte Ausrichtung)
- `margin-left: auto` auf controls (pusht rechts)
- `white-space: nowrap` überall (verhindert Wrap)
