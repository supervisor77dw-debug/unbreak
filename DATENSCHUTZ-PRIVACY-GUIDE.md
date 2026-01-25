# Datenschutz/Privacy Policy - UNBREAK ONE

## Überblick

Komplett überarbeitete Datenschutzerklärung für unbreak-one.com, angepasst für Online-Shop ohne Bowling/Reservierungen.

**Stand:** 25.01.2026 (DE) / 25 Jan 2026 (EN)

## Dateien

| Datei | Sprache | URL |
|-------|---------|-----|
| `public/datenschutz.html` | Deutsch | www.unbreak-one.com/datenschutz.html |
| `public/privacy.html` | English | www.unbreak-one.com/privacy.html |

## Struktur

### Technisch
- **Statisches HTML** (kein i18n-System)
- Language Toggle oben rechts (DE ↔ EN)
- Responsive Layout via `legal-styles.css`
- Clean H1/H2/H3 Hierarchie (Lighthouse-konform)

### Inhalt

✅ **Neu/Aktualisiert:**
1. **Online-Shop & Bestellungen** (Abschnitt 6)
   - Stammdaten, Kontaktdaten, Bestelldaten
   - Rechtsgrundlage: Art. 6 Abs. 1 lit. b DSGVO

2. **Zahlungsabwicklung** (Abschnitt 7)
   - Stripe + PayPal + Kreditkarten
   - Korrekte Formulierung: "Kartendaten werden direkt von Stripe verarbeitet"
   - Drittländer-Hinweis (USA, EU-Standardvertragsklauseln)
   - Betrugsprävention, 3D Secure

3. **Schriftarten** (Abschnitt 7a)
   - Lokales Hosting (Bunny Fonts)
   - Keine Datenübertragung an Google Fonts
   - DSGVO-konform

4. **Kontakt-E-Mail**
   - info@unbreak-one.de (statt allgemeiner Kontakt)

❌ **Entfernt:**
- Bowling-Reservierungen
- Gastronomieleistungen
- Event-Buchungen

## Language Toggle

### Funktionsweise
```html
<div class="legal-lang-toggle">
    <a href="datenschutz.html" class="lang-link active">DE</a>
    <span class="lang-separator">|</span>
    <a href="privacy.html" class="lang-link">EN</a>
</div>
```

### Styling
- Rechts oben positioniert
- Active State: underline + darker color
- Hover Effect
- Border-Bottom als Separator

## Abschnitte

### DE (datenschutz.html)
1. Verantwortlicher
2. Hosting und technische Bereitstellung
3. Server-Logfiles
4. Kontaktaufnahme
5. Cookies und ähnliche Technologien
6. Online-Shop, Bestellungen und Vertragsabwicklung
7. Zahlungsabwicklung (Stripe, PayPal, Kreditkarten)
7a. Schriftarten (lokales Hosting)
8. Social Media
9. Ihre Rechte
10. Beschwerdestelle
11. Datensicherheit

### EN (privacy.html)
1. Controller
2. Hosting and technical provision
3. Server log files
4. Contact
5. Cookies and similar technologies
6. Online shop, orders and contract performance
7. Payments (Stripe, PayPal, cards)
7a. Fonts (local hosting)
8. Social media
9. Your rights
10. Supervisory authority
11. Data security

## Zahlungsabwicklung - Details

### Stripe Integration
```
Anbieter: Stripe Payments Europe, Ltd. und verbundene Unternehmen
Zahlungsarten: Kredit-/Debitkarte, PayPal (via Stripe)
Datenverarbeitung: Direkt durch Stripe (nicht durch unbreak-one.com)
```

### Verarbeitete Daten
- **Zahlungsdaten:** Kartenart, Karteninhaber, Prüfdaten
- **Transaktionsdaten:** Betrag, Währung, Zeit, Status
- **Sicherheitsdaten:** Betrugsprävention, 3D Secure
- **Kontaktdaten:** E-Mail, Rechnungs-/Lieferadresse

### Rechtsgrundlagen
- Art. 6 Abs. 1 lit. b DSGVO (Vertragserfüllung)
- Art. 6 Abs. 1 lit. f DSGVO (berechtigtes Interesse an sicherer Zahlung)

### Drittländer-Transfer
- USA-Transfer möglich (je nach Zahlungsart)
- Garantien: EU-Standardvertragsklauseln
- Weitere Infos: Stripe/PayPal Privacy Notices im Checkout

## Fonts - DSGVO Compliance

### Status
✅ **Lokal gehostet** via Bunny Fonts (EU-CDN)

### Implementierung
```css
/* public/fonts/fonts.css */
@font-face {
  font-family: 'Montserrat';
  src: url('https://fonts.bunny.net/montserrat/...');
  font-display: swap;
}
```

### Network Check
```bash
# DevTools → Network → Filter "google"
# Expected: 0 requests to googleapis.com oder gstatic.com
```

## SEO & Accessibility

### Meta Tags
```html
<meta name="robots" content="noindex, follow">
<meta name="description" content="...">
```

### Heading Hierarchie
```
H1: Datenschutzerklärung / Privacy Policy
  H2: 1. Verantwortlicher / Controller
  H2: 2. Hosting...
  H2: 3. Server-Logfiles...
  ...
```

✅ Keine H1-Duplikate
✅ Keine übersprungenen Levels
✅ Logische Struktur

## Testing

### Checklist
- [ ] DE-Seite lädt korrekt: `/datenschutz.html`
- [ ] EN-Seite lädt korrekt: `/privacy.html`
- [ ] Language Toggle funktioniert
- [ ] Alle Links funktionieren (info@unbreak-one.de, Social Media)
- [ ] Responsive auf Mobile
- [ ] Lighthouse: SEO 100%, Accessibility 100%
- [ ] Network: 0 Google Fonts Requests
- [ ] Stripe-Sektion korrekt formuliert

### Lighthouse Prüfung
```bash
# Expected Results:
Performance:     >= 90
SEO:            100
Accessibility:  100
Best Practices: 100
```

### Font Check
```javascript
// Browser Console
const fonts = document.fonts;
fonts.forEach(f => console.log(f.family, f.status));

// Expected: Alle Fonts "loaded" von bunny.net
```

## Deployment

**Datum:** 25.01.2026  
**Branch:** master  
**Commit:** 2d2b48c  
**URLs:**
- 🇩🇪 https://www.unbreak-one.com/datenschutz.html
- 🇬🇧 https://www.unbreak-one.com/privacy.html

## Maintenance

### Bei Änderungen:
1. Beide Dateien (DE + EN) synchron aktualisieren
2. "Stand" / "Last updated" Datum anpassen
3. Git Commit mit Änderungslog
4. Deployment via `git push origin master`
5. Vercel Auto-Deploy (~60s)

### Bei neuen Zahlungsarten:
1. Abschnitt 7 ergänzen
2. Rechtsgrundlagen prüfen
3. Drittländer-Transfer dokumentieren
4. Datenschutzhinweise des Anbieters verlinken

## Kontakt

**Verantwortlicher:**
Ricks Gastro & Event GmbH  
Grasweg 48  
24118 Kiel, Deutschland  
info@unbreak-one.de

**Hoster:**
crossmedia1 – Thomas Ferenz  
Tel.: 0431 536 81 18
