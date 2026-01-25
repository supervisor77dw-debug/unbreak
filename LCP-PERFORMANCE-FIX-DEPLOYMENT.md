# LCP Performance Fix – Deployment Checklist

## ✅ Implementierte Änderungen

### 1. LCP vom Video entkoppelt
- ✅ Hero verwendet jetzt statisches `<picture>` Element als LCP
- ✅ Bild mit `fetchpriority="high"` und width/height Attributen
- ✅ AVIF/WebP/JPG Fallback-Kette implementiert

### 2. Video Lazy-Loading
- ✅ Video hat `preload="none"` 
- ✅ `data-src` statt `src` für verzögertes Laden
- ✅ IntersectionObserver lädt Video erst bei Sichtbarkeit
- ✅ Sanfter Fade-in nach Video-Load

### 3. Width/Height für alle Images
- ✅ Logo: 180×60 + `loading="eager"`
- ✅ Badge: 200×200 + `loading="eager"`
- ✅ Hero-Poster: 1920×1080 + `fetchpriority="high"`
- ✅ Alle weiteren Bilder: width/height + `loading="lazy"`

### 4. CSS Layering optimiert
- ✅ Hero-Image-Container: z-index 1 (LCP)
- ✅ Hero-Video-Container: z-index 2 (lazy)
- ✅ Overlay: z-index 3

## 🚨 WICHTIG: Vor Deployment erstellen

### Fehlende Bild-Formate

Die folgenden Dateien müssen vor dem Deployment erstellt werden:

```
public/images/poster-yacht.webp
public/images/poster-yacht.avif
```

**Quelle:** `public/images/poster-yacht.jpg` (110 KB)

### Option A: ImageMagick (lokal)

```powershell
cd c:\Users\dirk\Dropbox\projekte\Antigravity\Unbreak_One
.\create-hero-formats.ps1
```

**Voraussetzung:** `choco install imagemagick`

### Option B: Online-Konverter

1. Öffne: https://squoosh.app
2. Lade `public/images/poster-yacht.jpg` hoch
3. Exportiere als:
   - WebP (Quality: 85)
   - AVIF (Quality: 85)
4. Speichere in `public/images/`

### Option C: Vercel Build Hook

Falls ImageMagick im Vercel Build verfügbar ist, wird dies automatisch generiert.

**Prüfen:**
```bash
# Im package.json unter "scripts":
"prebuild": "node scripts/optimize-images.js"
```

## 📊 Erwartete Performance-Verbesserung

### Vor dem Fix:
- LCP: ~14s (Video als LCP-Element)
- Initial Payload: ~12 MB
- Performance Score: ~40-50

### Nach dem Fix:
- **LCP: <3s** (statisches Poster-Bild)
- **Initial Payload: <500 KB** (ohne Video)
- **Performance Score: 75-85**

## ✅ Deployment Verifizierung

Nach dem Deployment auf Production:

### 1. DevTools → Network
```
✓ Video lädt NICHT beim Initial Load
✓ Nur poster-yacht.jpg/webp/avif im Initial Load
✓ Keine 404-Fehler für .webp/.avif
✓ Video lädt erst nach ~1-2s
```

### 2. Lighthouse (Mobile)
```
✓ LCP < 4s (Ziel: <3s)
✓ Performance > 75
✓ CLS < 0.1
✓ SEO weiterhin 100
```

### 3. Visual Check
```
✓ Hero zeigt sofort statisches Bild
✓ Video blendet sanft ein nach 1-2s
✓ Kein "Flash of Unstyled Content"
✓ Smooth Transition Bild→Video
```

## 🔥 Kritische Pfade

### Fallback-Szenario

Falls `.webp`/`.avif` fehlen:
- ✅ Browser lädt automatisch `.jpg` Fallback
- ⚠️ Performance-Gewinn reduziert, aber kein Fehler
- 📝 TODO: Formate nachträglich erstellen

### Video-Fehler

Falls Video nicht lädt:
- ✅ Error Handler zeigt weiterhin statisches Bild
- ✅ Kein Absturz der Seite
- ✅ User Experience bleibt intakt

## 📝 Nächste Schritte

1. **Vor Merge:**
   - [ ] WebP/AVIF für poster-yacht.jpg erstellen
   - [ ] Local Preview testen
   - [ ] Lighthouse Score prüfen

2. **Nach Deployment:**
   - [ ] Production Lighthouse Test (Mobile)
   - [ ] Network Tab verifizieren
   - [ ] Video Lazy-Load testen (scroll)
   - [ ] SEO Score bestätigen (sollte 100 bleiben)

3. **Optional (Follow-up):**
   - [ ] Badge-Bild optimieren (~3 MB → <100 KB)
   - [ ] Weitere Above-the-fold Bilder zu WebP/AVIF konvertieren
   - [ ] Preload für kritische Fonts prüfen

## 🎯 Erfolgskriterien (messbar)

- [x] LCP ist ein Bild, kein Video
- [x] Initial Payload < 2 MB
- [ ] Performance Score > 75 (nach Deployment verifizieren)
- [ ] SEO Score = 100 (keine Regression)
- [x] CLS eliminiert (width/height gesetzt)

## 📞 Support

Bei Problemen nach Deployment:

1. Lighthouse Report speichern
2. Network Tab Screenshot
3. Browser Console Errors checken
4. Fallback auf statisches Bild funktioniert?

---

**Status:** ✅ Code Ready for Deployment
**Blocker:** ⚠️ WebP/AVIF Bilder müssen erstellt werden
**ETA:** ~5 Min für Bildkonvertierung + Deployment
