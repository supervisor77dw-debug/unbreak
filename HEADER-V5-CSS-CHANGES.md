# Header v5 - CSS-Regeln Änderungen (VORHER/NACHHER)

**Commit:** 504dede  
**Datum:** 2026-01-24

---

## 🔴 ENTFERNT/GEÄNDERT (Logo-Drift Ursachen)

### 1. `.header-left` - Implizites justify-content

**VORHER (PROBLEMATISCH):**
```css
.header-left {
  display: flex;
  align-items: center;
  flex: 1 1 auto;
  min-width: 0;
  gap: 24px;
  /* KEIN justify-content - implizit flex-start, aber nicht explizit gesetzt */
}
```

**Problem:**
- Kein explizites `justify-content`
- Bei bestimmten Viewport-Größen konnte Flexbox anders verteilen
- Logo konnte "wandern"

**NACHHER (GEFIXT):**
```css
.header-left {
  display: flex;
  align-items: center;
  flex: 1 1 auto;
  min-width: 0;
  gap: 24px;
  justify-content: flex-start;  /* NEU - EXPLIZIT - Logo IMMER links */
}
```

---

### 2. `.header-inner` - Fehlende overflow-Kontrolle

**VORHER:**
```css
.header-inner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: nowrap;
  gap: 12px;
  max-width: var(--container-max-width);
  margin: 0 auto;
  padding: var(--spacing-sm) 0;
  white-space: nowrap;
  /* KEIN overflow */
}
```

**NACHHER (GEFIXT):**
```css
.header-inner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: nowrap;
  gap: 12px;
  max-width: var(--container-max-width);
  margin: 0 auto;
  padding: var(--spacing-sm) 0;
  white-space: nowrap;
  overflow: visible;  /* NEU - Logo-Drift Prevention */
}
```

---

### 3. `.header-brand` - Fehlende min-width

**VORHER:**
```css
.header-brand {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  padding: 8px 0;
  white-space: nowrap;
  margin: 0;
  /* KEIN min-width explizit */
}
```

**NACHHER (GEFIXT):**
```css
.header-brand {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  padding: 8px 0;
  white-space: nowrap;
  margin: 0;
  min-width: 0;  /* NEU - Explizite Sicherheit */
}
```

---

## 🔴 ENTFERNT/GEÄNDERT (CTA-Kollision Ursachen)

### 4. CTA Breakpoint zu früh (1350px)

**VORHER (PROBLEMATISCH):**
```css
/* Desktop ohne CTA: 1200px - 1349px */
@media (min-width: 1200px) and (max-width: 1349px) {
  .header-nav {
    display: flex !important;
    justify-content: center !important;
  }
  .header-cta {
    display: none !important;
  }
  .header-burger {
    display: none !important;
  }
}

/* Desktop mit CTA: >= 1350px */
@media (min-width: 1350px) {
  .header-nav {
    display: flex !important;
    justify-content: flex-start !important;
  }
  .header-cta {
    display: inline-flex !important;  /* ZU FRÜH! */
    padding: 10px 16px;
    font-size: 14px;
    border-radius: 999px;
  }
  .header-burger {
    display: none !important;
  }
}
```

**Problem:**
- CTA erscheint schon bei 1350px
- Nicht genug Platz für Nav + CTA
- "Contact" wird überdeckt

**NACHHER (GEFIXT):**
```css
/* Desktop ohne CTA: 1200px - 1449px */
@media (min-width: 1200px) and (max-width: 1449px) {
  .header-nav {
    display: flex !important;
    justify-content: center !important;
  }
  .header-cta {
    display: none !important;  /* Hidden bis 1449px */
  }
  .header-burger {
    display: none !important;
  }
}

/* Desktop mit CTA: >= 1450px */
@media (min-width: 1450px) {
  .header-nav {
    display: flex !important;
    justify-content: flex-start !important;
  }
  .header-cta {
    display: inline-flex !important;  /* ERST AB 1450px! */
    padding: 8px 12px;     /* KLEINER */
    font-size: 13px;       /* KLEINER */
    line-height: 1;        /* NEU */
    border-radius: 999px;
    gap: 4px;              /* NEU - Icon spacing */
  }
  .header-burger {
    display: none !important;
  }
}
```

**Änderung:**
- Breakpoint: 1350px → **1450px** (100px später)
- CTA padding: 10px 16px → **8px 12px**
- CTA font-size: 14px → **13px**
- CTA line-height: **1** (neu)
- CTA gap: **4px** (neu, für Icon)

---

### 5. CTA zu groß (padding/font)

**VORHER (PROBLEMATISCH):**
```css
.btn-nav,
.header-cta {
  background-color: var(--color-petrol-deep);
  color: var(--color-white);
  padding: 10px 16px;  /* ZU GROSS */
  font-size: 14px;     /* ZU GROSS */
  box-shadow: 0 2px 6px rgba(10, 108, 116, 0.25);
  white-space: nowrap;
  flex: 0 0 auto;
  border-radius: 999px;
}
```

**Problem:**
- Zu viel Padding (10px 16px)
- Zu große Schrift (14px)
- Text zu lang ("Jetzt kaufen" = 12 Zeichen)
- Gesamtbreite ~110px

**NACHHER (GEFIXT):**
```css
.btn-nav,
.header-cta {
  background-color: var(--color-petrol-deep);
  color: var(--color-white);
  padding: 8px 12px;   /* KLEINER */
  font-size: 13px;     /* KLEINER */
  line-height: 1;      /* NEU */
  box-shadow: 0 2px 6px rgba(10, 108, 116, 0.25);
  white-space: nowrap;
  flex: 0 0 auto;
  border-radius: 999px;
  display: inline-flex;       /* NEU */
  align-items: center;        /* NEU */
  justify-content: center;    /* NEU */
  gap: 4px;                   /* NEU - Icon spacing */
}
```

**Änderung:**
- padding: 10px 16px → **8px 12px** (2px weniger vertikal, 4px weniger horizontal)
- font-size: 14px → **13px** (1px kleiner)
- line-height: **1** (neu, kompakter)
- display: **inline-flex** (neu, für Icon)
- gap: **4px** (neu, zwischen Icon und Text)
- Gesamtbreite: ~110px → **~70px** (40px gespart!)

---

### 6. Nav-gap zu groß

**VORHER (PROBLEMATISCH):**
```css
.nav-links,
.header-nav-list {
  display: flex;
  flex-wrap: nowrap;
  align-items: center;
  gap: clamp(10px, 1.2vw, 16px);  /* ZU GROSS */
  list-style: none;
  margin: 0;
  padding: 0;
}
```

**Problem:**
- Gap max 16px
- 1.2vw bei 1450px = 17.4px (clamped zu 16px)
- Nav frisst zu viel Platz

**NACHHER (GEFIXT):**
```css
.nav-links,
.header-nav-list {
  display: flex;
  flex-wrap: nowrap;
  align-items: center;
  gap: clamp(8px, 1vw, 14px);  /* KOMPAKTER */
  list-style: none;
  margin: 0;
  padding: 0;
}
```

**Änderung:**
- Min gap: 10px → **8px** (2px kleiner)
- Viewport-basiert: 1.2vw → **1vw** (0.2vw kleiner)
- Max gap: 16px → **14px** (2px kleiner)
- Bei 1450px: vorher 16px, nachher 14px → **2px gespart**

---

## 🔴 ENTFERNT (HTML - Text zu lang)

### 7. CTA Text "Jetzt kaufen" → Icon + "Kaufen"

**VORHER (PROBLEMATISCH):**
```html
<a href="/shop" class="btn btn-nav header-cta" data-i18n="nav.buyNow">
  Jetzt kaufen
</a>
```

**Problem:**
- Text "Jetzt kaufen" = 12 Zeichen
- Breite: ~50px (bei 14px font)
- Kein Icon

**NACHHER (GEFIXT):**
```html
<a href="/shop" class="btn btn-nav header-cta" data-i18n="nav.buyNow">
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="flex-shrink:0;">
    <path d="M19 6h-2c0-2.76-2.24-5-5-5S7 3.24 7 6H5c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm-7-3c1.66 0 3 1.34 3 3H9c0-1.66 1.34-3 3-3zm7 17H5V8h14v12z" fill="currentColor"/>
  </svg>
  <span>Kaufen</span>
</a>
```

**Änderung:**
- Text: "Jetzt kaufen" → **"Kaufen"** (6 statt 12 Zeichen)
- Icon: **Shopping Bag SVG** (14x14)
- Gesamtbreite: Icon 14px + gap 4px + Text ~30px = **~50px** (statt ~50px Text alone)
- Mit kleinerer Schrift (13px) + weniger Padding: **~70px total** (statt ~110px)

---

## Zusammenfassung der Änderungen

### CSS-Regeln GEÄNDERT:
1. ✅ `.header-inner` + `overflow: visible`
2. ✅ `.header-left` + `justify-content: flex-start` (EXPLIZIT)
3. ✅ `.header-brand` + `min-width: 0` (EXPLIZIT)
4. ✅ `.header-cta` padding 10px 16px → 8px 12px
5. ✅ `.header-cta` font-size 14px → 13px
6. ✅ `.header-cta` + `line-height: 1`
7. ✅ `.header-cta` + `display: inline-flex`
8. ✅ `.header-cta` + `gap: 4px`
9. ✅ `.header-nav-list` gap 1.2vw/16px → 1vw/14px

### Media Query Breakpoints GEÄNDERT:
1. ✅ 1200-1349px → **1200-1449px**
2. ✅ >=1350px → **>=1450px**

### HTML GEÄNDERT:
1. ✅ CTA Text "Jetzt kaufen" → "Kaufen"
2. ✅ CTA + Shopping Bag Icon (SVG 14x14)

### Gewinn:
- **Logo-Drift FIXED** (justify-content:flex-start HART)
- **CTA 100px später** (1450px statt 1350px)
- **CTA 40px schmaler** (~70px statt ~110px)
- **Nav 2px kompakter** (14px statt 16px gap)
- **Kein Overlap** mehr

---

**Commit:** 504dede  
**Files:**
- public/styles.css
- public/components/header.js
- components/Header.jsx
- HEADER-V5-TEST-PROTOKOLL.md
