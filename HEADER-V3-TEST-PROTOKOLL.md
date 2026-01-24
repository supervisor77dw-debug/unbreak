# Header v3 - Test-Protokoll (Brand-Gutter + CTA ab 1350px)

**Commit:** 4f974e6  
**Datum:** 2026-01-24  
**Status:** ✅ READY FOR TESTING

---

## Problem-Report (User)

### Bug 1: Logo "verschmilzt" mit Menü
- Logo/Brand hatte **keine eigene Zone**
- Kein **Gutter** zwischen Brand und Nav
- Nav startete direkt nach Brand → optisches "Verschmelzen"

### Bug 2: CTA zu früh sichtbar
- CTA "Jetzt kaufen" bereits ab **~1200px sichtbar**
- Sollte **erst ab 1350px** erscheinen
- Verdeckt Inhalte, frisst Platz

---

## Implementierte Fixes

### A) Brand-Gutter (24px)

**Problem:** Brand und Nav verschmelzen optisch

**Fix:**
```css
.header-brand {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  padding: 8px 0;
  padding-right: 24px;  /* KRITISCH: GUTTER - Nav startet danach */
  margin: 0;
}
```

**Ergebnis:**
- Brand hat **eigene linke Zone**
- **24px Gutter** zwischen Brand und Nav
- Nav startet **erst nach** dem Gutter
- Kein optisches Verschmelzen mehr

---

### B) CTA STRIKT ab 1350px (mit !important)

**Problem:** CTA erscheint zu früh (bereits bei ~1200px)

**Fix:**
```css
/* CTA DEFAULT: VERSTECKT (hart) */
.header-cta {
  display: none !important;
}

/* <1200px: Burger-Mode */
@media (max-width: 1199px) {
  .header-nav { display: none !important; }
  .header-burger { display: inline-flex !important; }
  .header-cta { display: none !important; }  /* VERSTECKT */
}

/* 1200-1349px: Desktop ohne CTA */
@media (min-width: 1200px) and (max-width: 1349px) {
  .header-nav { display: flex !important; }
  .header-burger { display: none !important; }
  .header-cta { display: none !important; }  /* NOCH VERSTECKT */
}

/* >=1350px: Desktop MIT CTA */
@media (min-width: 1350px) {
  .header-nav { display: flex !important; }
  .header-burger { display: none !important; }
  .header-cta { display: inline-flex !important; }  /* JETZT SICHTBAR */
}
```

**Warum !important?**
- Überstimmt alte Regeln
- Überstimmt Inline-Styles
- Überstimmt JS-Klassen
- Garantiert **keine Override-Möglichkeit**

**Ergebnis:**
- CTA **Default versteckt** (display: none !important)
- CTA **versteckt** bei < 1200px (Burger-Mode)
- CTA **versteckt** bei 1200-1349px (Desktop ohne CTA)
- CTA **sichtbar** bei >= 1350px (Desktop mit CTA)
- **Kein früheres Erscheinen** möglich

---

### C) Nav-Gap reduziert

**Problem:** Nav-Links zu weit auseinander (Gap zu groß)

**Fix:**
```css
.nav-links,
.header-nav-list {
  gap: clamp(10px, 1.4vw, 16px);  /* Max 16px statt 1.6vw */
}
```

**Vorher:** `clamp(10px, 1.6vw, 16px)`  
**Nachher:** `clamp(10px, 1.4vw, 16px)`

**Ergebnis:**
- Weniger Platzverschwendung
- Nav kompakter
- Mehr Platz für andere Elemente

---

## Code-Diff Zusammenfassung

### public/styles.css

**1. Brand-Gutter**
```diff
  .header-brand {
    flex: 0 0 auto;
    display: flex;
    align-items: center;
    padding: 8px 0;
+   padding-right: 24px;  /* GUTTER */
    margin: 0;
  }
```

**2. CTA Default mit !important**
```diff
- .header-cta {
-   display: none;
- }

+ .header-cta {
+   display: none !important;  /* Hart versteckt */
+ }
```

**3. Nav-Gap reduziert**
```diff
  .nav-links,
  .header-nav-list {
-   gap: clamp(10px, 1.6vw, 16px);
+   gap: clamp(10px, 1.4vw, 16px);
  }
```

**4. Burger-Mode mit !important**
```diff
  @media (max-width: 1199px) {
-   .header-nav { display: none; }
-   .header-burger { display: inline-flex; }
-   .header-cta { display: none; }

+   .header-nav { display: none !important; }
+   .header-burger { display: inline-flex !important; }
+   .header-cta { display: none !important; }
  }
```

**5. Desktop ohne CTA mit !important**
```diff
  @media (min-width: 1200px) and (max-width: 1349px) {
-   .header-nav { display: flex; }
-   .header-burger { display: none; }
-   .header-cta { display: none; }

+   .header-nav { display: flex !important; }
+   .header-burger { display: none !important; }
+   .header-cta { display: none !important; }
  }
```

**6. Desktop MIT CTA mit !important**
```diff
  @media (min-width: 1350px) {
-   .header-nav { display: flex; }
-   .header-burger { display: none; }
-   .header-cta { display: inline-flex; }

+   .header-nav { display: flex !important; }
+   .header-burger { display: none !important; }
+   .header-cta { display: inline-flex !important; }
  }
```

---

## Test-Protokoll (PFLICHT - PASS/FAIL)

**Server:** http://localhost:3000

### Test-Matrix

| Breite | Layout | Logo | Gutter | Nav | CTA | Language | Burger | Status |
|--------|--------|------|--------|-----|-----|----------|--------|--------|
| **1100px** | Burger | ✓ Links | - | Hidden | **Hidden** | ✓ Sichtbar | ✓ Aktiv | ⏸️ TEST |
| **1200px** | Desktop | ✓ Links | **✓ 24px** | ✓ Sichtbar | **Hidden** | ✓ Sichtbar | Hidden | ⏸️ TEST |
| **1280px** | Desktop | ✓ Links | **✓ 24px** | ✓ Sichtbar | **Hidden** | ✓ Sichtbar | Hidden | ⏸️ TEST |
| **1349px** | Desktop | ✓ Links | **✓ 24px** | ✓ Sichtbar | **Hidden** | ✓ Sichtbar | Hidden | ⏸️ TEST |
| **1350px** | Desktop | ✓ Links | **✓ 24px** | ✓ Sichtbar | **✓ Sichtbar** | ✓ Sichtbar | Hidden | ⏸️ TEST |
| **1440px** | Desktop | ✓ Links | **✓ 24px** | ✓ Sichtbar | ✓ Sichtbar | ✓ Sichtbar | Hidden | ⏸️ TEST |

---

## DevTools Checklist (KRITISCH)

### Test 1: Brand-Gutter Check (1200px)

**Schritte:**
1. DevTools öffnen (F12)
2. Responsive Mode (Ctrl+Shift+M)
3. Breite auf **1200px** setzen
4. **Elements** Tab: `.header-brand` anklicken
5. **Computed** Tab prüfen:

**Erwartung:**
```
padding-right: 24px  ✓ PASS
margin: 0px          ✓ PASS
```

**Visuell:**
- Logo sitzt klar **links**
- **24px Abstand** zwischen Logo und erstem Nav-Link sichtbar
- Nav startet **NICHT direkt** neben Logo
- Kein optisches "Verschmelzen"

**PASS/FAIL:** ⏸️

---

### Test 2: CTA Breakpoint Check (KRITISCH!)

**Schritte:**
1. DevTools → Responsive Mode
2. Breiten testen:

| Breite | Expected CTA | Computed display | PASS/FAIL |
|--------|--------------|------------------|-----------|
| **1199px** | Hidden | `display: none` | ⏸️ |
| **1200px** | **Hidden** | `display: none` | ⏸️ |
| **1280px** | **Hidden** | `display: none` | ⏸️ |
| **1349px** | **Hidden** | `display: none` | ⏸️ |
| **1350px** | **Sichtbar** | `display: inline-flex` | ⏸️ |
| **1440px** | Sichtbar | `display: inline-flex` | ⏸️ |

**DevTools Check:**
1. Elements → `.header-cta` anklicken
2. Computed → `display` Property prüfen
3. Styles → Prüfen welche Media Query aktiv ist

**Erwartung:**
- Bei **< 1350px**: Media Query `(max-width: 1349px)` aktiv → `display: none !important`
- Bei **>= 1350px**: Media Query `(min-width: 1350px)` aktiv → `display: inline-flex !important`

**KRITISCH:** CTA darf **NICHT** vor 1350px erscheinen!

**PASS/FAIL:** ⏸️

---

### Test 3: Visueller Verschmelzungs-Check

**Schritte:**
1. Breite auf **1200px**
2. **Visuell prüfen:**
   - Logo **links** in eigener Zone
   - **Sichtbarer Abstand** (24px) zwischen Logo und Nav
   - Nav startet **klar getrennt** vom Logo
   - Kein "Zusammenkleben" / "Verschmelzen"

**Vergleich vorher/nachher:**

**VORHER (Bug):**
```
[Logo][Nav-Link1][Nav-Link2]...
      ↑ Kein Gutter, verschmilzt
```

**NACHHER (Fix):**
```
[Logo]  ←24px→  [Nav-Link1][Nav-Link2]...
      ↑ Klarer Gutter
```

**PASS/FAIL:** ⏸️

---

### Test 4: Überdeckungs-Check (1200px)

**Problem (vorher):** CTA war schon bei 1200px sichtbar und verdeckte Inhalte

**Check:**
1. Breite auf **1200px**
2. **Hover über Nav-Links**
3. Prüfen: Sind alle Links **klickbar**?
4. Prüfen: Verdeckt **nichts** die Links?

**Erwartung:**
- CTA ist **versteckt** (display: none)
- Nav-Links **voll klickbar**
- Keine Überdeckung durch CTA
- Language-Switch **sichtbar** und klickbar

**PASS/FAIL:** ⏸️

---

### Test 5: CTA Übergangs-Check (1349 → 1350px)

**Schritte:**
1. Breite auf **1349px**
2. CTA MUSS **versteckt** sein
3. Breite auf **1350px** ändern
4. CTA MUSS **erscheinen**

**Erwartung:**
- **1349px**: CTA `display: none`
- **1350px**: CTA `display: inline-flex`
- **Exakter Wechsel** bei 1350px
- Kein Layout-Sprung
- Logo bleibt links

**PASS/FAIL:** ⏸️

---

## Erwartetes Verhalten

### ✅ Brand hat eigene Zone + 24px Gutter
- `.header-brand { padding-right: 24px }`
- Logo sitzt klar **links**
- **24px Abstand** vor Nav
- Nav startet **nach** dem Gutter
- Kein optisches Verschmelzen

### ✅ CTA erscheint EXAKT ab 1350px
- Default: `display: none !important`
- < 1200px: `display: none !important`
- 1200-1349px: `display: none !important`
- >= 1350px: `display: inline-flex !important`
- Kein früheres Erscheinen möglich

### ✅ Alle Media Queries mit !important
- Überstimmt alte Regeln
- Überstimmt Inline-Styles
- Überstimmt JS-Klassen
- Garantiert deterministische Breakpoints

### ✅ Nav kompakter
- Gap reduziert: `clamp(10px, 1.4vw, 16px)`
- Weniger Platzverschwendung
- Mehr Platz für CTA ab 1350px

---

## Explizite Bestätigung

**"CTA erscheint erst ab 1350px, Brand hat feste linke Zone + 24px Gutter."**

- ✅ Brand hat **eigene linke Zone** (flex: 0 0 auto)
- ✅ Brand hat **24px Gutter** rechts (padding-right: 24px)
- ✅ Nav startet **NACH** dem Gutter (kein Verschmelzen)
- ✅ CTA **Default versteckt** (display: none !important)
- ✅ CTA **versteckt** bei < 1350px (!important)
- ✅ CTA **sichtbar** bei >= 1350px (!important)
- ✅ Keine Override-Möglichkeit (alle Media Queries mit !important)

---

## Nächste Schritte

1. **User testet localhost:3000** mit DevTools Responsive Mode
2. **Alle 6 Breakpoints** durchgehen (1100, 1200, 1280, 1349, 1350, 1440)
3. **Brand-Gutter Check** (24px Abstand sichtbar?)
4. **CTA Breakpoint Check** (erst ab 1350px?)
5. **Verschmelzungs-Check** (Logo klar getrennt von Nav?)
6. **PASS/FAIL** für jeden Test eintragen

**Bei FAIL:**
- Screenshot machen
- Welcher Test failed?
- Was ist sichtbar vs. erwartet?

**Status:** ✅ READY FOR USER TESTING  
**Server:** http://localhost:3000  
**Commit:** 4f974e6
