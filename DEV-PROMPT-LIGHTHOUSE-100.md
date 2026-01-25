# DEV PROMPT: Lighthouse 100% (SEO/Accessibility/Best Practices)

**Project:** UNBREAK-ONE (www.unbreak-one.com)  
**Target:** Lighthouse 100% in Best Practices, SEO, Accessibility + stabilere Performance  
**Branch Strategy:** Test-Branch → Review → Merge to Master  
**Date:** 2026-01-25

---

## Ziel

Lighthouse-Score auf **100% in allen Kategorien** bringen:
- ✅ **Performance: 88%** (bereits optimiert)
- ⚠️ **SEO: 92%** → **100%**
- ⚠️ **Accessibility: 98%** → **100%**
- ✅ **Best Practices: 100%** (stabil halten)

**Zusätzlich:** Google Fonts lokal hosten für Performance + Datenschutz

---

## FIX 1 — Descriptive Link Text (SEO/Best Practices 100%)

### Problem
Lighthouse meldet: **"Links do not have descriptive text"**  
Betroffen: 1 Link mit Text "Learn More" (Linkziel: `/gastro-edition.html`)

### Lösung

**Option A (empfohlen): Sichtbarer Text ändern**

```html
<!-- Vorher -->
<a href="/gastro-edition.html" class="btn">Learn More</a>

<!-- Nachher -->
<a href="/gastro-edition.html" class="btn" data-i18n="gastro.learnMore">
  Mehr zur Gastro-Edition
</a>
```

**i18n Übersetzungen ergänzen:**
```javascript
// i18n.js oder translations
{
  "de": {
    "gastro": {
      "learnMore": "Mehr zur Gastro-Edition"
    }
  },
  "en": {
    "gastro": {
      "learnMore": "Learn more about the Gastro Edition"
    }
  }
}
```

**Option B (alternativ): aria-label ohne Textänderung**

```html
<a href="/gastro-edition.html" 
   class="btn" 
   aria-label="Learn more about the Gastro Edition"
   data-i18n-aria="gastro.learnMoreAria">
  <span data-i18n="gastro.cta">Learn More</span>
</a>
```

### Akzeptanzkriterium
✅ Lighthouse meldet **nicht mehr** "Links do not have descriptive text"

---

## FIX 2 — Heading Order (Accessibility 100%)

### Problem
Lighthouse meldet: **"Heading elements are not in sequentially descending order"**  
Beispiel: H2 → H4 Sprung (ohne H3 dazwischen)

### Lösung

**Semantisch korrekte Struktur:**

```html
<!-- KORREKT -->
<h1>UNBREAK ONE</h1>                    <!-- Seitentitel (1x pro Seite) -->

<section>
  <h2>Das System hinter UNBREAK ONE</h2>  <!-- Hauptabschnitt -->
  
  <div class="product-row">
    <h3>Weinglashalter</h3>               <!-- Unterabschnitt -->
    <p>Beschreibung...</p>
  </div>
  
  <div class="product-row">
    <h3>Flaschenhalter</h3>               <!-- Unterabschnitt -->
    <p>Beschreibung...</p>
  </div>
</section>

<section>
  <h2>Einsatzbereiche</h2>                <!-- Nächster Hauptabschnitt -->
  <h3>Boot & Yacht</h3>                   <!-- Unterabschnitt -->
  <h3>Gastronomie</h3>                    <!-- Unterabschnitt -->
</section>
```

**FALSCH (nicht machen!):**

```html
<!-- ❌ Keine Levels überspringen -->
<h1>Titel</h1>
<h3>Direkt zu H3</h3>  <!-- ❌ H2 fehlt! -->

<!-- ❌ Kein Dummy-Heading nur für Lighthouse -->
<h3 style="display:none">Fake Heading</h3>  <!-- ❌ Täuscht Lighthouse -->
```

**Wenn nur optisches Styling ohne Semantik:**

```html
<!-- Lieber div + CSS statt falsches Heading-Level -->
<div class="heading-style-h3">Visuell wie H3, aber nicht semantisch</div>
```

### Vorgehen

1. **Alle Seiten prüfen:**
   - `index.html`, `produkt.html`, `gastro-edition.html`, `einsatzbereiche.html`, `technik.html`, `kontakt.html`

2. **Heading-Hierarchie validieren:**
   ```
   H1 (1x) → H2 → H3 → H4 (keine Sprünge!)
   ```

3. **Tools zur Validierung:**
   - Chrome DevTools → Accessibility Tree
   - [HeadingsMap Extension](https://chrome.google.com/webstore/detail/headingsmap)
   - Lighthouse Accessibility Audit

### Akzeptanzkriterium
✅ Lighthouse Accessibility zeigt **keine Fehler** zur Heading-Reihenfolge

---

## FIX 3 — Google Fonts lokal hosten (Performance + Datenschutz)

### Problem
- **Performance:** Externe Requests zu `fonts.googleapis.com` und `fonts.gstatic.com` verzögern Rendering
- **Datenschutz:** IP-Übertragung an Google (rechtliches Risiko gemäß DSGVO/TTDSG)
- **Netzwerk-Variabilität:** Externe CDN kann langsam/blockiert sein

### Lösung: Self-Hosting

#### Schritt 1: Font-Dateien herunterladen

**Aktuell verwendete Fonts:**
```css
/* styles.css Zeile 7 */
@import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700&family=Inter:wght@300;400;500;600&display=swap');
```

**Benötigte Fonts:**
- **Montserrat:** 400, 500, 600, 700
- **Inter:** 300, 400, 500, 600

**Download-Quellen:**
1. [google-webfonts-helper](https://gwfh.mranftl.com/fonts)
   - Montserrat auswählen → Weights: 400, 500, 600, 700 → WOFF2 herunterladen
   - Inter auswählen → Weights: 300, 400, 500, 600 → WOFF2 herunterladen

2. Oder direkt von [Google Fonts](https://fonts.google.com):
   - Font auswählen → Download → `.woff2` Dateien extrahieren

#### Schritt 2: Fonts in Projekt einbinden

**Verzeichnisstruktur:**
```
public/
  fonts/
    montserrat-400.woff2
    montserrat-500.woff2
    montserrat-600.woff2
    montserrat-700.woff2
    inter-300.woff2
    inter-400.woff2
    inter-500.woff2
    inter-600.woff2
```

**CSS @font-face Definitionen:**

Erstelle `public/fonts/fonts.css`:

```css
/* Montserrat */
@font-face {
  font-family: 'Montserrat';
  font-style: normal;
  font-weight: 400;
  font-display: swap;
  src: url('/fonts/montserrat-400.woff2') format('woff2');
}

@font-face {
  font-family: 'Montserrat';
  font-style: normal;
  font-weight: 500;
  font-display: swap;
  src: url('/fonts/montserrat-500.woff2') format('woff2');
}

@font-face {
  font-family: 'Montserrat';
  font-style: normal;
  font-weight: 600;
  font-display: swap;
  src: url('/fonts/montserrat-600.woff2') format('woff2');
}

@font-face {
  font-family: 'Montserrat';
  font-style: normal;
  font-weight: 700;
  font-display: swap;
  src: url('/fonts/montserrat-700.woff2') format('woff2');
}

/* Inter */
@font-face {
  font-family: 'Inter';
  font-style: normal;
  font-weight: 300;
  font-display: swap;
  src: url('/fonts/inter-300.woff2') format('woff2');
}

@font-face {
  font-family: 'Inter';
  font-style: normal;
  font-weight: 400;
  font-display: swap;
  src: url('/fonts/inter-400.woff2') format('woff2');
}

@font-face {
  font-family: 'Inter';
  font-style: normal;
  font-weight: 500;
  font-display: swap;
  src: url('/fonts/inter-500.woff2') format('woff2');
}

@font-face {
  font-family: 'Inter';
  font-style: normal;
  font-weight: 600;
  font-display: swap;
  src: url('/fonts/inter-600.woff2') format('woff2');
}
```

#### Schritt 3: CSS anpassen

**In `public/styles.css`:**

```css
/* VORHER (Zeile 7) */
@import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700&family=Inter:wght@300;400;500;600&display=swap');

/* NACHHER */
@import url('/fonts/fonts.css');
```

#### Schritt 4: HTML bereinigen

**In allen HTML-Dateien (index.html, produkt.html, etc.):**

```html
<!-- ENTFERNEN -->
<link rel="preconnect" href="https://fonts.googleapis.com" crossorigin>
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>

<!-- Optional: Preload kritischer Fonts -->
<link rel="preload" as="font" type="font/woff2" href="/fonts/montserrat-700.woff2" crossorigin>
<link rel="preload" as="font" type="font/woff2" href="/fonts/inter-400.woff2" crossorigin>
```

#### Schritt 5: Minified CSS regenerieren

Nach Änderungen in `styles.css`:

```bash
npx clean-css-cli -o public/styles.min.css public/styles.css
```

### Rechtlicher Kontext (Info für Auftraggeber)

**Warum Self-Hosting rechtssicher ist:**

1. **DSGVO-Konformität:**
   - Keine IP-Übertragung an Google
   - Keine externen Requests = keine Datenverarbeitung durch Dritte
   - Kein Cookie-Banner für Fonts nötig

2. **TTDSG-Konformität:**
   - Lokale Fonts = keine Telekommunikationsüberwachung
   - Keine Einwilligung erforderlich

3. **Best Practice:**
   - Empfohlen von Datenschutzbehörden
   - Vermeidet Abmahnrisiken

**Dokumentation (optional):**

Erstelle `docs/FONTS.md`:

```markdown
# Font-Hosting

Alle Schriftarten werden lokal gehostet (`/public/fonts/`).

**Verwendete Fonts:**
- Montserrat (400, 500, 600, 700)
- Inter (300, 400, 500, 600)

**Lizenz:** SIL Open Font License 1.1 (erlaubt Self-Hosting)

**Datenschutz:** Keine externen Font-Requests, keine IP-Übertragung an Dritte.
```

### Akzeptanzkriterien

✅ **Technisch:**
- DevTools → Network: **0 Requests** zu `fonts.googleapis.com` und `fonts.gstatic.com`
- Layout bleibt stabil (kein FOIT/FOUT)
- Fonts laden korrekt (alle Weights sichtbar)
- Lighthouse Performance: gleich oder besser

✅ **Rechtlich:**
- Keine externen Font-Requests = DSGVO-konform
- Dokumentation vorhanden

---

## Testing & Abnahme

### Pre-Deployment Checklist

- [ ] **SEO 100%:** "Links do not have descriptive text" behoben
- [ ] **Accessibility 100%:** Heading order korrekt
- [ ] **Network:** Keine Requests zu `googleapis.com` oder `gstatic.com`
- [ ] **Visual Check:** Buttons, Typografie, Spacing unverändert
- [ ] **Lighthouse Audit:** Alle 4 Kategorien ≥ 100% (Performance ≥ 88%)

### Test-Prozedur

1. **Local Testing:**
   ```bash
   # Dev-Server starten
   npm run dev
   
   # Lighthouse in Chrome DevTools
   # - Inkognito-Modus
   # - "Desktop" Profil
   # - Alle Kategorien prüfen
   ```

2. **Test-Branch Deployment:**
   ```bash
   git checkout -b lighthouse-100-fixes
   # ... Änderungen committen
   git push origin lighthouse-100-fixes
   ```

3. **Vercel Preview URL testen:**
   - Lighthouse auf Preview-URL laufen lassen
   - Network-Tab prüfen (keine Google Font Requests)
   - Visuelle Regression prüfen

4. **Nach Merge:**
   - Production Lighthouse-Test
   - Bestätigung: SEO/Accessibility/Best Practices = 100%

---

## Rollback-Plan

Falls Probleme auftreten:

```bash
# Zurück zu vorheriger Version
git revert <commit-hash>
git push origin master
```

**Oder:** Test-Branch löschen, von vorne anfangen:

```bash
git branch -D lighthouse-100-fixes
git checkout master
```

---

## Kontakt & Fragen

Bei Unklarheiten oder technischen Fragen:
- Dokumentation: `DEV-PROMPT-LIGHTHOUSE-100.md` (dieses Dokument)
- Performance-Historie: `PERFORMANCE-OPTIMIZATION-SUMMARY.md`
- Git-Historie prüfen: `git log --oneline`

---

**Viel Erfolg! 🚀**
