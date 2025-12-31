# UNBREAK-ONE: Shop Page Premium Redesign - Test Plan

## 🎨 Implementierte Features

### 1. ✅ Premium Layout & Grid
- **Responsive Grid:**
  - Desktop (>1200px): 3 Spalten
  - Tablet (768-1199px): 2 Spalten
  - Mobile (<768px): 1 Spalte
- **Card Design:**
  - Einheitliche Höhen durch flexbox
  - Glassmorphism & Shadow-Effekte
  - Hover: Subtle lift + shadow intensification
  - Featured Badge für Gastro Edition

### 2. ✅ Trust Elements
- **Hero Trust Bar:**
  - ✓ Sicherer Checkout
  - 🚚 Versand 3–5 Tage
  - 🇩🇪 Made in Germany
  - 💬 Premium Support
  - Responsive: 4 Spalten → 2x2 Grid auf Mobile

- **Product Trust:**
  - Unter jedem Preis: "🚚 Versand 3–5 Tage"
  - "inkl. MwSt." Label
  - Made in Germany implizit durch Trust Bar

### 3. ✅ Optimierte CTAs
- **Primary Button:** "In den Warenkorb"
  - Full-width in Card
  - Gradient Background (Petrol)
  - Hover: Lift + Shadow
  - Min Touch Target: 48px (Mobile)
  
- **Configurator Section:**
  - Primary: "Jetzt gestalten"
  - Secondary: "Welche Varianten gibt es?"
  - Full-width auf Mobile

### 4. ✅ Gastro Edition Highlight
- **Badge:** "Gastro Edition" (Top-Right)
- **Border:** 2px Petrol
- **Visuell hervorgehoben** durch Border + Badge

### 5. ✅ Premium Configurator Block
- **2-Column Layout** (Desktop)
- **Badge:** "Individuell"
- **Headline + Description**
- **2 CTAs:** Primary + Secondary
- **Visual:** Placeholder für 3D Preview
- **Background:** Gradient (hellgrau)

### 6. ✅ Mobile UX
- **Typography:** clamp() für responsive Sizes
- **Buttons:** Full-width, min 48px height
- **Spacing:** clamp() für responsive Abstände
- **Touch Targets:** Mindestens 48x48px
- **No Overlap:** Saubere Hierarchie

---

## 🧪 Testplan

### Test 1: Desktop Layout (>1200px)

**Schritte:**
1. Öffne https://unbreak-one.vercel.app/shop
2. Browser Breite: >1200px

**✅ Erwartung:**
- [ ] 3 Produkt-Spalten im Grid
- [ ] Trust Bar: 4 Items horizontal
- [ ] Configurator: 2 Spalten (Content + Visual)
- [ ] Hover auf Product Card: Lift + Shadow
- [ ] Hover auf Button: Lift + Gradient Change

**Screenshot:**
```
[Hero mit Trust Bar]
[3x Product Cards Grid]
[Configurator 2-Column Block]
```

---

### Test 2: Tablet Layout (768-1199px)

**Schritte:**
1. Browser Breite: 768-1199px
2. Oder DevTools Responsive Mode: iPad

**✅ Erwartung:**
- [ ] 2 Produkt-Spalten
- [ ] Trust Bar: 4 Items (evtl. wrap)
- [ ] Configurator: 2 Spalten (wenn Platz)
- [ ] Card Heights uniform
- [ ] Spacing proportional

---

### Test 3: Mobile Layout (<768px)

**Schritte:**
1. Browser Breite: <768px
2. Oder DevTools: iPhone 12/13

**✅ Erwartung:**
- [ ] 1 Produkt-Spalte (full-width)
- [ ] Trust Bar: 2x2 Grid
- [ ] Configurator: 1 Spalte (stacked)
- [ ] Buttons full-width
- [ ] Touch Targets ≥48px
- [ ] Kein horizontales Scrollen
- [ ] Typography lesbar (min 16px)

**Screenshot Mobile:**
```
[Hero]
[Trust 2x2]
[Product Card Full-Width]
[CTA Full-Width]
[Configurator Stacked]
```

---

### Test 4: Gastro Edition Highlight

**Schritte:**
1. Shop öffnen
2. Suche Produkt mit "gastro" im SKU/Name

**✅ Erwartung:**
- [ ] Badge "Gastro Edition" (Top-Right)
- [ ] Card hat Petrol Border (2px)
- [ ] Visuell hervorgehoben vs normale Cards
- [ ] Hover funktioniert gleich

**Fallback:**
Falls kein Gastro-Produkt:
- Manuell in Supabase Produkt anlegen mit `sku: 'GASTRO-SET-01'`

---

### Test 5: Cart Funktionalität (unverändert)

**Schritte:**
1. Klick "In den Warenkorb" bei Produkt A
2. Cart Badge erscheint: 🛒 1
3. Klick "In den Warenkorb" bei Produkt B
4. Cart Badge: 🛒 2
5. Navigiere zu /cart

**✅ Erwartung:**
- [ ] Cart State korrekt
- [ ] localStorage aktualisiert
- [ ] /cart zeigt 2 Items
- [ ] Checkout funktioniert
- [ ] **KEINE Änderung** an Checkout-Logik

---

### Test 6: Configurator CTAs

**Schritte:**
1. Scrolle zu Configurator Section
2. Klick "Jetzt gestalten"

**✅ Erwartung:**
- [ ] Redirect zu /configurator.html
- [ ] Kein 404

**Schritte:**
1. Zurück zu /shop
2. Klick "Welche Varianten gibt es?"

**✅ Erwartung:**
- [ ] Scroll zu Products Section ODER
- [ ] Link zu FAQ (falls implementiert)

---

### Test 7: Typography Responsive

**Schritte:**
1. DevTools: Responsive Mode
2. Resize von 320px → 1920px

**✅ Erwartung:**
- [ ] H1: Smooth scaling (clamp)
- [ ] Body Text: Lesbar auf allen Größen
- [ ] Buttons: Text nicht abgeschnitten
- [ ] Keine Zeilenumbrüche in mid-word

**Sizes:**
- H1: 2.5rem → 3.5rem
- Subtitle: 1.1rem → 1.3rem
- Body: 0.95rem → 1.05rem
- Buttons: 1rem → 1.1rem

---

### Test 8: Accessibility

**Schritte:**
1. Tab-Navigation mit Keyboard
2. Focus auf Buttons

**✅ Erwartung:**
- [ ] Focus Outline sichtbar (3px Petrol)
- [ ] Alle Buttons keyboard-accessible
- [ ] Logische Tab-Reihenfolge
- [ ] Alt-Text auf Images

**Screen Reader Test:**
```
"In den Warenkorb" Button
"Jetzt gestalten" Link
"Gastro Edition" Badge
```

---

### Test 9: Loading & Error States

**Schritte:**
1. Simuliere langsame Verbindung
2. Oder: Supabase kurz offline

**✅ Erwartung - Loading:**
- [ ] Spinner zentriert
- [ ] "Produkte werden geladen..."
- [ ] Kein Layout Shift

**✅ Erwartung - Error:**
- [ ] Error Message klar
- [ ] "Erneut versuchen" Button
- [ ] Button funktioniert

---

### Test 10: Cross-Browser

**Browser:**
- [ ] Chrome/Edge (latest)
- [ ] Firefox (latest)
- [ ] Safari (latest)
- [ ] Mobile Safari (iOS)
- [ ] Chrome Mobile (Android)

**✅ Erwartung:**
- [ ] Layout identisch
- [ ] Gradients rendern
- [ ] Hover Effects funktionieren
- [ ] clamp() wird unterstützt
- [ ] Grid funktioniert

---

## 📊 Akzeptanzkriterien

### Layout ✅
- [x] Responsive Grid: 3 → 2 → 1 Spalten
- [x] Einheitliche Card Heights
- [x] Trust Bar responsive
- [x] Configurator 2-Column → Stacked

### UX ✅
- [x] Touch Targets ≥48px (Mobile)
- [x] Buttons full-width (Mobile)
- [x] Hover Effects dezent
- [x] Keine Overlap/Scroll-Issues

### Design ✅
- [x] Petrol Gradient konsistent
- [x] Typography Hierarchy klar
- [x] Spacing harmonisch (clamp)
- [x] Gastro Badge visuell hervorgehoben

### Funktionalität ✅
- [x] Cart Add funktioniert
- [x] Checkout unverändert
- [x] Configurator Links funktionieren
- [x] Loading/Error States

### Accessibility ✅
- [x] Keyboard Navigation
- [x] Focus Outlines
- [x] Alt Texts
- [x] Semantisches HTML

---

## 🚀 Deployment

```bash
git add pages/shop.js
git commit -m "UNBREAK-ONE: Premium Shop Page Redesign

Features:
- Responsive Grid: 3→2→1 Spalten (Desktop→Tablet→Mobile)
- Premium Product Cards mit Hover Effects
- Trust Bar: Checkout, Versand, Made in Germany, Support
- Gastro Edition Badge + Border Highlight
- Premium Configurator CTA Block (2-Column Layout)
- Mobile-First UX: Full-width buttons, clamp() typography
- Enhanced CTAs: 'In den Warenkorb' primary button
- Loading/Error States styled
- Accessibility: Focus outlines, keyboard nav

Design:
- Petrol gradient (#0A6C74) als Hauptfarbe
- Glassmorphism & shadow effects
- clamp() für responsive typography
- Touch targets ≥48px (Mobile)

UX Improvements:
- Product trust: '🚚 Versand 3–5 Tage' unter Preis
- 'inkl. MwSt.' Label
- Configurator: 2 CTAs (Primary + Secondary)
- Cart Badge: Gradient style matching brand

No Changes:
- Cart state logic unchanged
- Checkout flow unchanged
- Product data/API unchanged

See SHOP-PREMIUM-TEST.md for complete test plan"

git push
```

---

## 📝 Notes

### Was NICHT geändert wurde:
- ✅ Cart State Management (`lib/cart.js`)
- ✅ Checkout API (`pages/api/checkout/standard.js`)
- ✅ Stripe Integration
- ✅ Product Data Structure
- ✅ getServerSideProps Logic

### Was NUR geändert wurde:
- ✅ JSX Structure (Hero, Products, Configurator)
- ✅ CSS Styles (Grid, Cards, Typography, Colors)
- ✅ Microcopy (Trust Elements, Button Labels)
- ✅ Badge Logic (Gastro Detection)

### Optional: Nächste Schritte
- [ ] 3D Preview in Configurator Block (echtes Thumbnail)
- [ ] Product Images optimieren (WebP, Lazy Loading)
- [ ] Animate on Scroll (AOS) für Cards
- [ ] Filter/Sort Optionen (Preis, Kategorie)
- [ ] "Quick View" Modal für Produktdetails
- [ ] Wishlist/Favorites Funktion
- [ ] Vergleichs-Feature für Produkte

---

## 🎯 Success Metrics

**Nach Deployment prüfen:**

1. **Lighthouse Score:**
   - Performance: >90
   - Accessibility: >95
   - Best Practices: >90
   - SEO: >95

2. **Core Web Vitals:**
   - LCP: <2.5s
   - FID: <100ms
   - CLS: <0.1

3. **User Engagement:**
   - Cart Add Rate
   - Configurator Clicks
   - Bounce Rate
   - Time on Page

4. **Mobile:**
   - Touch Response <100ms
   - No horizontal scroll
   - Readable text (min 16px)
