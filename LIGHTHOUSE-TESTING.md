# 🚀 Lighthouse Performance Testing Guide

## Ziel
LCP von ~10s auf <4s reduzieren durch:
- ✅ Responsive Images (srcset + sizes)
- ✅ WebP/AVIF Formats
- ✅ Lazy-Loading für below-fold Images
- ✅ LCP-Element Priorisierung (fetchpriority="high")
- ✅ Video preload="none"
- ✅ Render-Blocking Reduction

---

## 📋 Implementierte Optimierungen

### 1. **LCP-Element Optimierung**
```html
<!-- Preload kritisches Hero-Poster Image -->
<link rel="preload" as="image" href="images/hero-cinematic.jpg" fetchpriority="high">

<!-- Video mit preload="none" statt "metadata" -->
<video preload="none" poster="images/hero-cinematic.jpg">
```

**Warum:** LCP ist wahrscheinlich das Hero-Poster-Bild. Durch Preload wird es priorisiert geladen.

---

### 2. **Responsive Images (srcset + sizes)**
```html
<picture>
  <source 
    srcset="images/weinglashalter_szene_ship-320w.webp 320w,
            images/weinglashalter_szene_ship-640w.webp 640w,
            images/weinglashalter_szene_ship.webp 800w"
    sizes="(max-width: 768px) 100vw, 50vw"
    type="image/webp">
  <img src="images/weinglashalter_szene_ship.jpg" 
       loading="lazy" 
       width="800" 
       height="600">
</picture>
```

**Warum:** 
- Mobile Geräte laden nur 320w statt 1024w → 70-80% weniger Daten
- WebP reduziert Dateigröße um weitere 25-35%

---

### 3. **Lazy-Loading für Below-Fold Images**
Alle Images außerhalb des Hero-Bereichs haben `loading="lazy"`:
- Produkt-Preview Images (weinglashalter, flaschenhalter)
- Use-Cases Section (Camper, Bar, Home)
- Proof-Videos

**Warum:** Browser lädt diese erst, wenn User scrollt → Initial Load Time ↓

---

### 4. **WebP Conversion**
**Kritischstes Asset:**
- `badge-made-in-germany.png`: **2,87 MB** → ~800 KB (WebP)
- `hero-cinematic.jpg`: 1,45 MB → ~450 KB (WebP)
- `Kontakt.jpg`: 1,75 MB → ~500 KB (WebP)

**Einsparung:** ~4-5 MB Initial Load

---

## 🧪 Lokaler Test

### Voraussetzungen
1. **WebP-Dateien generieren:**
   ```powershell
   .\generate-responsive-images.ps1
   ```
   
   Falls ImageMagick fehlt:
   ```powershell
   choco install imagemagick
   ```

2. **Lokalen Server starten:**
   ```powershell
   # Option 1: Python
   cd public
   python -m http.server 8000
   
   # Option 2: Node.js (http-server)
   npx http-server public -p 8000
   
   # Option 3: VS Code Live Server Extension
   # Rechtsklick auf index.html → "Open with Live Server"
   ```

---

## 📊 Lighthouse Audit Durchführen

### Chrome DevTools (Empfohlen)

1. **Browser vorbereiten:**
   - Chrome/Edge **Inkognito-Modus** öffnen (Strg+Shift+N)
   - Extensions sind deaktiviert ✅
   - Cache leeren: F12 → Network → Disable cache ✅

2. **Lighthouse starten:**
   ```
   1. F12 → Tab "Lighthouse"
   2. Mode: "Navigation (Default)"
   3. Categories: ✅ Performance, ✅ Accessibility, ✅ Best Practices, ✅ SEO
   4. Device: Desktop + Mobile testen
   5. Click "Analyze page load"
   ```

3. **Throttling:**
   - Desktop: "Applied Fast 3G, 4x CPU Slowdown"
   - Mobile: "Applied Slow 4G, 4x CPU Slowdown"

---

## 🎯 Erwartete Metriken (Ziel)

### **Vorher (Baseline):**
| Metrik | Desktop | Mobile |
|--------|---------|--------|
| Performance | 60-70 | 40-50 |
| LCP | ~10s | ~12s |
| Speed Index | ~9s | ~11s |
| TBT | 200ms | 400ms |

### **Nachher (Optimiert):**
| Metrik | Desktop | Mobile |
|--------|---------|--------|
| Performance | **85-95** | **75-85** |
| LCP | **<2.5s** | **<4s** |
| Speed Index | **<4s** | **<6s** |
| TBT | <200ms | <300ms |

---

## 🔍 Wichtige Lighthouse-Metriken

### **LCP (Largest Contentful Paint)**
- **Ziel:** <2.5s (Desktop), <4s (Mobile)
- **Aktuell:** Hero Poster Image (hero-cinematic.jpg)
- **Optimierung:** Preload + fetchpriority="high"

### **FCP (First Contentful Paint)**
- **Ziel:** <1.8s
- **Optimierung:** Critical CSS inline (TODO: später)

### **TBT (Total Blocking Time)**
- **Ziel:** <200ms
- **Ursache:** i18n.js, animations.js
- **Optimierung:** defer-Attribute gesetzt ✅

### **CLS (Cumulative Layout Shift)**
- **Ziel:** <0.1
- **Optimierung:** width/height auf Images gesetzt ✅

---

## 📸 Screenshots vergleichen

1. **Lighthouse Report speichern:**
   - Klick auf "View Treemap" → Export als JSON
   - Screenshot mit Win+Shift+S

2. **Vorher/Nachher vergleichen:**
   - LCP-Element identifizieren (im "Diagnostics" Tab)
   - Filmstrip-Ansicht vergleichen

---

## ⚠️ Troubleshooting

### **WebP-Images werden nicht geladen**
```powershell
# Prüfe ob Dateien existieren:
Get-ChildItem public\images\*.webp

# Falls nicht → Script erneut ausführen:
.\generate-responsive-images.ps1
```

### **LCP immer noch >4s**
1. Überprüfe Network-Tab:
   - Welches Asset blockiert?
   - Ist hero-cinematic.jpg priorisiert?

2. Preload funktioniert nicht:
   ```html
   <!-- Überprüfe dass <link rel="preload"> VOR CSS steht -->
   <link rel="preload" as="image" href="images/hero-cinematic.jpg" fetchpriority="high">
   <link rel="stylesheet" href="styles.css">
   ```

### **Badge-MIG immer noch 2.87 MB**
```powershell
# WebP manuell erstellen (falls Script fehlschlägt):
cd public\images
magick convert badge-made-in-germany.png -quality 85 badge-made-in-germany.webp

# Größe prüfen:
Get-Item badge-made-in-germany.webp | Select-Object Name, Length
```

---

## ✅ Checkliste vor Git Commit

- [ ] `generate-responsive-images.ps1` ausgeführt
- [ ] Alle WebP-Dateien in `public/images` vorhanden
- [ ] Lokaler Server läuft (`http://localhost:8000`)
- [ ] Lighthouse Score Desktop: >85
- [ ] Lighthouse Score Mobile: >75
- [ ] LCP Desktop: <2.5s
- [ ] LCP Mobile: <4s
- [ ] Keine 404-Fehler im Console (F12)
- [ ] Images laden korrekt (WebP mit PNG-Fallback)

---

## 🚢 Deployment

Nach erfolgreichen lokalen Tests:

```powershell
# 1. Commit Changes
git add .
git commit -m "perf: Optimize images - LCP <4s via responsive WebP + lazy-load"

# 2. Push to Test Branch
git push origin perf/lighthouse-lcp-images

# 3. Vercel/Netlify Preview prüfen
# 4. Lighthouse auf Live-URL ausführen
# 5. Merge nach Review
```

---

## 📚 Weitere Optimierungen (Optional)

### **Critical CSS (Phase 2)**
```html
<style>
  /* Hero-Section CSS inline */
  #hero { ... }
  .hero-video-container { ... }
</style>
```

### **Font-Loading Optimization**
```html
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="preload" as="font" href="/fonts/main.woff2" type="font/woff2" crossorigin>
```

### **Service Worker (PWA)**
- Cache hero-images für Offline-Nutzung
- Pre-cache kritische Assets

---

## 📧 Support

Bei Fragen zu diesem Guide:
- GitHub Issues: [Link to Repo]
- Dokumentation: `/docs/PERFORMANCE.md`

**Viel Erfolg! 🚀**
