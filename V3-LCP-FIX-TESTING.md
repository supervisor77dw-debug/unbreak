# V3 LCP Fix - Testing & Deployment Guide

## Was wurde geändert?

### 1. **Sentinel-basiertes Video Loading**
- **Sentinel Element** direkt nach Hero Section eingefügt (`#hero-scroll-sentinel`)
- Video wird NUR geladen wenn:
  1. User hat echte Interaktion gemacht (scroll/touch/mouse)
  2. Sentinel wird sichtbar (User scrollt nach unten)
- **IntersectionObserver:** `rootMargin: 0px`, `threshold: 0.1`
- **KEIN Preload** im HTML

### 2. **Hero-Lazy-Video.js V3 Rewrite**
- User-Interaktions-Detektion (verhindert "first paint" load)
- Sentinel Observer statt Hero Observer
- Doppelter Check: Interaktion + Sichtbarkeit
- Console Logging für Debugging

### 3. **Image Optimization Preparation**
- `IMAGE-CONVERSION-GUIDE.md` erstellt
- **WICHTIG:** hero-cinematic.avif/webp MÜSSEN manuell konvertiert werden!
- Aktuell sind es JPG-Kopien (1.5 MB) → müssen zu ~100-200 KB werden

## Testing-Protokoll

### Test 1: Local Development
```powershell
# Dev Server starten
npm run dev
# oder
vercel dev
```

**Browser DevTools öffnen:**
1. Network Tab → Filter: `mp4`
2. Seite laden → **KEIN Hero-Video Request!** ✅
3. Langsam nach unten scrollen
4. **Video startet ERST wenn Sentinel sichtbar** ✅
5. Console Log prüfen:
   ```
   [Hero Video] 🚀 V3 Lazy Loader gestartet
   [Hero Video] ✓ User-Interaktion detektiert
   [Hero Video] 🎯 Sentinel sichtbar + User hat interagiert → Lade Video
   [Hero Video] 🎬 Video-Injection gestartet...
   [Hero Video] ✓ Video geladen, fade-in...
   ```

### Test 2: Network Performance
**Erwartung:**
- **BEFORE Scroll:** Nur Images, CSS, JS (kein hero.mp4!)
- **AFTER Scroll:** hero.mp4 Request erscheint

**Mobile Simulation:**
1. DevTools → Mobile Device
2. Throttling: Fast 3G
3. Reload
4. **LCP sollte Image sein (~100-200 KB nach Konvertierung)**

### Test 3: Edge Cases
- [ ] **Kein JavaScript:** Fallback-Bild wird angezeigt ✅
- [ ] **Slow Connection:** Video lädt erst nach Scroll
- [ ] **Schnelles Scrollen:** Video lädt trotzdem korrekt
- [ ] **Zurück-Navigation:** Kein Video-Cache-Problem

## Deployment Steps

### WICHTIG: Reihenfolge einhalten!

#### Schritt 1: Image Conversion (KRITISCH!)
```powershell
# 1. hero-cinematic.jpg zu AVIF/WebP konvertieren
# → Siehe IMAGE-CONVERSION-GUIDE.md

# 2. Verifizieren
cd public/images
Get-Item hero-cinematic.* | Select-Object Name, Length

# Erwartete Ausgabe:
# hero-cinematic.jpg:  ~1.5 MB (original)
# hero-cinematic.webp: ~150-200 KB ✅
# hero-cinematic.avif: ~100-150 KB ✅
```

**Wenn die Bilder NICHT konvertiert sind:**
→ **NICHT deployen!** LCP wird sich kaum verbessern.

#### Schritt 2: Git Commit
```powershell
git status
git add public/index.html public/hero-lazy-video.js IMAGE-CONVERSION-GUIDE.md V3-LCP-FIX-TESTING.md

# Falls Bilder konvertiert:
git add public/images/hero-cinematic.{avif,webp}

git commit -m "fix(lcp): V3 Sentinel-based lazy video loading

- Add sentinel element after hero section
- Rewrite hero-lazy-video.js with user interaction detection
- IntersectionObserver with rootMargin 0px (no preload)
- Video loads ONLY after scroll + user interaction
- Remove hero video from initial DOM completely

BREAKING: Requires AVIF/WebP image conversion (see IMAGE-CONVERSION-GUIDE.md)
Expected LCP improvement: 21s → <3s"

git push origin lcp-fix-v3-sentinel
```

#### Schritt 3: Vercel Preview Deploy
```powershell
# Automatisch durch GitHub Push
# Oder manuell:
vercel --prod
```

**Preview URL testen:**
1. Lighthouse Run auf Preview URL
2. **Akzeptanz-Kriterien:**
   - LCP < 4s (Ziel: < 3s) ✅
   - Performance Score > 75 ✅
   - Network: Kein hero.mp4 vor Scroll ✅
   - SEO Score = 100 ✅

#### Schritt 4: Production Merge (nur bei Erfolg!)
```powershell
git checkout master
git merge lcp-fix-v3-sentinel
git push origin master
```

## Lighthouse Testing

### Command-Line Lighthouse
```powershell
# Install (falls nicht vorhanden)
npm install -g lighthouse

# Test auf Preview URL
lighthouse https://unbreak-one-[preview-id].vercel.app `
  --output html `
  --output-path ./lighthouse-v3-preview.html `
  --preset=desktop `
  --only-categories=performance,seo

# Test auf Production (nach Merge)
lighthouse https://www.unbreak-one.com `
  --output html `
  --output-path ./lighthouse-v3-production.html `
  --preset=desktop `
  --only-categories=performance,seo
```

### Online Lighthouse
1. **PageSpeed Insights:** https://pagespeed.web.dev/
2. URL eingeben: `https://www.unbreak-one.com`
3. **"Analyse"** klicken
4. Warten...
5. **Check:**
   - LCP < 3s ✅
   - Performance > 75 ✅
   - "Largest Contentful Paint element: body > section#hero > div.hero-image-container > picture > img"

## Troubleshooting

### Problem: Video lädt sofort trotzdem
**Check:**
```javascript
// Browser Console
document.getElementById('hero-scroll-sentinel')
// → sollte existieren

document.getElementById('hero-video-container').innerHTML
// → sollte LEER sein initial
```

### Problem: LCP immer noch schlecht (>10s)
**Mögliche Ursachen:**
1. **AVIF/WebP nicht konvertiert** → Siehe IMAGE-CONVERSION-GUIDE.md
2. Browser cached alte Version → Hard Reload (Ctrl+Shift+R)
3. CDN cached alte Version → Vercel Cache purgen

### Problem: Video spielt nie ab
**Check Console Logs:**
```
[Hero Video] 🚀 V3 Lazy Loader gestartet  ← Muss erscheinen
[Hero Video] ✓ User-Interaktion detektiert ← Nach Scroll/Touch
[Hero Video] 🎯 Sentinel sichtbar...        ← Nach weiterer Scroll
```

Wenn Logs fehlen → hero-lazy-video.js nicht geladen

## Success Metrics

### Before (V2 - BROKEN)
- **LCP:** 21.0s ❌
- **Performance:** 60/100 ❌
- **Network:** Hero video + AVIF loaded immediately ❌

### Expected After (V3)
- **LCP:** < 3s ✅ (hero-cinematic.avif ~100 KB)
- **Performance:** > 75 ✅ (Ziel: > 85)
- **Network:** NO hero.mp4 before scroll ✅
- **SEO:** 100 ✅ (unchanged)

## Rollback Plan

Falls V3 auch nicht funktioniert:
```powershell
# Zurück zu V1 (14s LCP, aber stabil)
git checkout master
git revert c9876b0  # V2 rückgängig
git push origin master

# Oder kompletter Rollback
git reset --hard debf3b8  # Zurück zu V1
git push origin master --force
```

## Next Steps After Success

1. ✅ V3 deployed und getestet
2. ✅ Lighthouse < 3s LCP
3. → **Monitor Production** (1 Woche)
4. → **Real User Metrics** (RUM) implementieren?
5. → Weitere Optimierungen:
   - Font optimization (WOFF2 subsetting)
   - Image lazy-loading für below-fold content
   - Service Worker für static assets
