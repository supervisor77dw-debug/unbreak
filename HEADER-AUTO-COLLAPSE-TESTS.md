# Header Auto-Collapse Tests

## Implementierung

### Änderungen

**Dateien geändert:**
- `components/Header.jsx` - ResizeObserver + Auto-Collapse Logik (React)
- `public/components/header.js` - ResizeObserver + Auto-Collapse Logik (Vanilla JS)
- `public/styles.css` - CSS-Regeln korrigiert

**CSS-Regeln entfernt/geändert (verursachten Wrap/Abschneiden):**
- ❌ `.nav-links { overflow: hidden }` → ✅ `overflow: visible`
- ❌ `.nav-links { justify-content: flex-start }` → ✅ `justify-content: center`
- ✅ `.header-inner { justify-content: space-between }` hinzugefügt
- ✅ `.header-controls { margin-left: auto }` hinzugefügt
- ✅ `white-space: nowrap` überall (brand, nav, controls)
- ✅ `.burger-menu.visible` für auto-collapse
- ✅ `.header-nav.collapsed` für ausgeblendete Nav

**Messlogik (ResizeObserver):**
- Sitzt in: `components/Header.jsx` (useLayoutEffect Hook)
- Sitzt in: `public/components/header.js` (setupAutoCollapse Funktion)
- Berechnung: `neededWidth = brand.scrollWidth + nav.scrollWidth + controls.scrollWidth + gaps`
- Wenn `neededWidth > availableWidth`: Auto-Collapse aktiviert (Burger visible, Nav hidden, CTA optional hidden)

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
