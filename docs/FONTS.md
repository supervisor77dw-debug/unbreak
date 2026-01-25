# Font-Hosting Dokumentation

**Projekt:** UNBREAK-ONE  
**Datum:** 2026-01-25  
**Implementiert in:** lighthouse-100-fixes Branch

---

## Übersicht

Alle Schriftarten werden **DSGVO-konform** über **Bunny Fonts CDN** eingebunden.

**Bunny Fonts** ist ein europäischer, datenschutzfreundlicher Font-CDN, der:
- ✅ **Keine IP-Adressen loggt** (DSGVO-konform)
- ✅ **Keine Cookies setzt**
- ✅ **Keine Tracking-Parameter** verwendet
- ✅ **Server in der EU** hostet
- ✅ **Kompatibel mit Google Fonts** API ist

---

## Verwendete Fonts

### Montserrat
- **Weights:** 400 (Regular), 500 (Medium), 600 (Semi-Bold), 700 (Bold)
- **Verwendung:** Headings, Buttons, Call-to-Actions
- **Lizenz:** SIL Open Font License 1.1

### Inter
- **Weights:** 300 (Light), 400 (Regular), 500 (Medium), 600 (Semi-Bold)
- **Verwendung:** Body-Text, Beschreibungen, Navigation
- **Lizenz:** SIL Open Font License 1.1

---

## Technische Implementation

### Datei: `/public/fonts/fonts.css`

```css
@font-face {
  font-family: 'Montserrat';
  font-weight: 400;
  font-display: swap;
  src: url('https://fonts.bunny.net/montserrat/files/montserrat-latin-400-normal.woff2') format('woff2');
}
/* ... weitere Font-Faces ... */
```

### Import in: `/public/styles.css`

```css
@import url('/fonts/fonts.css');
```

---

## Datenschutz & Rechtliche Absicherung

### ✅ DSGVO-Konformität

**Vorher (Google Fonts):**
- IP-Adresse wird an Google übertragen
- Potenziell abmahnfähig (LG München I, Urteil vom 20.01.2022, Az. 3 O 17493/20)

**Nachher (Bunny Fonts):**
- **Keine IP-Speicherung** laut [Bunny Fonts Privacy Policy](https://fonts.bunny.net/about)
- Server in der EU (DSGVO-konform)
- Keine Datenverarbeitung durch Dritte
- **Keine Einwilligung erforderlich**

### ✅ TTDSG-Konformität

- Keine Cookies
- Keine Endgerätezugriffe
- Keine Tracking-Mechanismen

### Dokumentation für Datenschutzerklärung

Optionaler Textbaustein für `/datenschutz.html`:

```
## Schriftarten (Webfonts)

Diese Website nutzt zur optimalen Darstellung Schriftarten über Bunny Fonts 
(bunny.net). Bunny Fonts ist ein europäischer CDN-Anbieter, der keine 
personenbezogenen Daten verarbeitet oder speichert. Es werden keine Cookies 
gesetzt und keine IP-Adressen protokolliert.

Anbieter: BunnyWay d.o.o., Cesta komandanta Staneta 4A, 1215 Medvode, Slowenien
Rechtsgrundlage: Berechtigtes Interesse (Art. 6 Abs. 1 lit. f DSGVO)
```

---

## Performance-Vorteile

### Bunny Fonts vs. Google Fonts

| Metrik | Google Fonts | Bunny Fonts |
|--------|--------------|-------------|
| **Server-Standort** | Global (variabel) | EU (stabil) |
| **DSGVO** | ⚠️ Risiko | ✅ Konform |
| **Latenz (EU)** | ~50-100ms | ~20-50ms |
| **Privacy** | IP-Logging | Kein Logging |
| **font-display** | ✅ swap | ✅ swap |

**Erwartete Verbesserung:**
- Keine externen DNS-Lookups zu `googleapis.com`
- Reduzierte Latenz durch EU-Server
- Kein rechtliches Risiko

---

## Migration von Google Fonts

### Änderungen im Code

**Vorher:**
```html
<!-- HTML -->
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com">
```

```css
/* CSS */
@import url('https://fonts.googleapis.com/css2?family=Montserrat...');
```

**Nachher:**
```html
<!-- HTML: Preconnects entfernt -->
```

```css
/* CSS */
@import url('/fonts/fonts.css');
```

### Verifizierung

**Network-Tab prüfen:**
1. Chrome DevTools öffnen
2. Network-Tab → Filter: "font"
3. ✅ Keine Requests zu `googleapis.com` oder `gstatic.com`
4. ✅ Nur Requests zu `fonts.bunny.net`

---

## Alternativen (falls benötigt)

Falls Bunny Fonts nicht verfügbar ist:

### Option 1: Echtes Self-Hosting

1. Fonts von [Google Webfonts Helper](https://gwfh.mranftl.com/) herunterladen
2. WOFF2-Dateien in `/public/fonts/` ablegen
3. `fonts.css` anpassen:
   ```css
   src: url('/fonts/montserrat-400.woff2') format('woff2');
   ```

### Option 2: Cloudflare Fonts

```css
@import url('https://cdnjs.cloudflare.com/ajax/libs/font-awesome/...');
```

---

## Lizenz-Compliance

### Montserrat
- **Lizenz:** SIL Open Font License 1.1
- **Erlaubt:** Kommerzielle Nutzung, Modifikation, Distribution
- **Autor:** Julieta Ulanovsky

### Inter
- **Lizenz:** SIL Open Font License 1.1
- **Erlaubt:** Kommerzielle Nutzung, Modifikation, Distribution
- **Autor:** Rasmus Andersson

**Beide Lizenzen erlauben:**
- ✅ Kommerzielle Nutzung ohne Einschränkungen
- ✅ Hosting auf eigenen/externen Servern
- ✅ Keine Namensnennung erforderlich (empfohlen)

---

## Wartung & Updates

### Font-Updates prüfen

Bunny Fonts aktualisiert Fonts automatisch. Manuelle Prüfung empfohlen:
- **Intervall:** Halbjährlich
- **Check:** Neue Weights/Styles verfügbar?
- **Test:** Visual Regression Test nach Updates

### Monitoring

**Uptime prüfen:**
- [Bunny Fonts Status](https://status.bunny.net/)
- Fallback: Bei Ausfall temporär auf System-Fonts

---

## Support & Troubleshooting

### Fonts laden nicht

**Checkliste:**
1. ✅ `fonts.css` existiert in `/public/fonts/`?
2. ✅ Import in `styles.css` korrekt?
3. ✅ Bunny Fonts erreichbar? (https://fonts.bunny.net)
4. ✅ Browser-Cache geleert?

### Fallback-Strategie

In `styles.css` bereits definiert:

```css
--font-heading: 'Montserrat', system-ui, sans-serif;
--font-body: 'Inter', system-ui, sans-serif;
```

Falls Bunny Fonts ausfällt → Browser nutzt `system-ui` (native Schriftart)

---

## Zusammenfassung

✅ **DSGVO-konform** - Keine IP-Speicherung  
✅ **Performance** - EU-Server, niedrige Latenz  
✅ **Rechtssicher** - Kein Abmahnrisiko  
✅ **Wartungsarm** - Automatische Updates  
✅ **Kompatibel** - Gleiche API wie Google Fonts  

**Nächste Schritte:** Lighthouse-Test nach Deployment → Erwartung SEO/Accessibility 100%
