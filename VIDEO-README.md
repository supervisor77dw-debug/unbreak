# 🎬 VIDEO INTEGRATION - QUICK START

## ✅ Was wurde implementiert?

### 1️⃣ Hero Video (Yacht)
- **Position:** Hauptsektion (Hero)
- **Datei:** `images/unbreak-one-yacht.mp4`
- **Verhalten:** Autoplay, Loop, Muted
- **Status:** ✅ Code implementiert

### 2️⃣ Proof Video (Live Test)
- **Position:** "Produkt in Action" Sektion
- **Datei:** `images/unbreak-one-winter_live.mp4`
- **Verhalten:** Lazy Load, Play-Button
- **Status:** ✅ Code implementiert

---

## 📂 Neue Dateien

```
📁 Unbreak_One/
├── 📄 index.html                    ✅ AKTUALISIERT
├── 🎨 video-sections.css            ✅ NEU
├── ⚙️ video-controller.js           ✅ NEU
├── 🌍 translations/
│   ├── de.json                      ✅ AKTUALISIERT (proof section)
│   └── en.json                      ✅ AKTUALISIERT (proof section)
├── 📖 VIDEO-INTEGRATION-GUIDE.md    ✅ DOKUMENTATION
├── 📖 VIDEO-POSTER-SETUP.md         ✅ ANLEITUNG
└── 📁 images/
    ├── unbreak-one-yacht.mp4        ⏳ HOCHLADEN
    ├── unbreak-one-winter_live.mp4  ⏳ HOCHLADEN
    ├── poster-yacht.jpg             ⏳ ERSTELLEN
    └── poster-live-test.jpg         ⏳ ERSTELLEN
```

---

## 🚀 Nächste Schritte

### Schritt 1: Videos hochladen
```bash
# Videos in den images/ Ordner kopieren
cp /path/to/unbreak-one-yacht.mp4 images/
cp /path/to/unbreak-one-winter_live.mp4 images/
```

### Schritt 2: Poster Images erstellen
**Option A - Mit FFmpeg (empfohlen):**
```bash
# Yacht Poster
ffmpeg -i images/unbreak-one-yacht.mp4 -ss 00:00:03 -vframes 1 -q:v 2 images/poster-yacht.jpg

# Live Test Poster
ffmpeg -i images/unbreak-one-winter_live.mp4 -ss 00:00:05 -vframes 1 -q:v 2 images/poster-live-test.jpg
```

**Option B - PowerShell Script:**
```powershell
.\poster-generator.ps1
```

**Option C - Manuell:**
- Video in VLC/Player öffnen
- Attraktiven Frame wählen
- Screenshot → Speichern als JPG (1920x1080)

Details: Siehe [VIDEO-POSTER-SETUP.md](VIDEO-POSTER-SETUP.md)

### Schritt 3: Testen
```bash
# Lokaler Test
npm run dev

# Öffne: http://localhost:3000
# Prüfe:
#  ✓ Hero Video spielt automatisch
#  ✓ Proof Video lädt erst beim Scrollen
#  ✓ Play-Button funktioniert
#  ✓ Mobile: Videos responsive
```

### Schritt 4: Deployment
```bash
# Git Commit
git add .
git commit -m "feat: Add yacht hero video and live test proof video

- Hero section: Yacht video with autoplay
- Proof section: Live test video with lazy load
- Performance: Intersection Observer, viewport pause
- Accessibility: Keyboard controls, reduced motion
- i18n: DE/EN translations"

git push origin master
```

---

## 🎯 Performance Features

✅ **Lazy Loading:** Proof Video lädt nur bei Sichtbarkeit  
✅ **Poster Images:** Sofort sichtbare Fallbacks  
✅ **Viewport Pause:** Video stoppt außerhalb Viewport  
✅ **Connection Detection:** Slow 2G → nur Poster  
✅ **Preload Metadata:** Nur Metadaten, nicht ganzes Video  

**Ergebnis:**
- Initial Load: ~300KB (nur HTML/CSS/JS)
- Hero Video: Streamed (~8MB)
- Proof Video: Nur bei Scroll (~8MB)
- Total Savings: ~8MB bei Initial Load

---

## 📱 Responsive Design

| Device | Hero Height | Proof Layout | Play Button |
|--------|-------------|--------------|-------------|
| Desktop (>1024px) | 100vh | Grid 60/40 | 80px |
| Tablet (768-1024px) | 80vh | Stacked | 60px |
| Mobile (<768px) | 70vh | Stacked | 50px |

---

## 🔍 Quick Debug

### Problem: Video zeigt schwarzen Screen
```javascript
// Browser Console:
document.querySelector('.hero-video').play()
// Wenn Fehler → Autoplay blockiert (normal)
```

### Problem: Proof Video lädt nicht
```javascript
// Browser Console:
document.querySelector('.lazy-video').src
// Sollte leer sein bis Scroll
// Nach Scroll → 'images/unbreak-one-winter_live.mp4'
```

### Problem: Performance Monitoring
```javascript
// Browser Console:
VideoControllers.VideoPerformanceMonitor.prototype.getReport()
// Zeigt: loaded, errors, avgLoadTime
```

---

## 📖 Dokumentation

| Datei | Inhalt |
|-------|--------|
| [VIDEO-INTEGRATION-GUIDE.md](VIDEO-INTEGRATION-GUIDE.md) | Vollständige technische Dokumentation |
| [VIDEO-POSTER-SETUP.md](VIDEO-POSTER-SETUP.md) | Anleitung für Poster Image Erstellung |
| `video-sections.css` | Alle Styles (Hero, Proof, Responsive) |
| `video-controller.js` | JavaScript Module (Lazy Load, Play Control) |

---

## ✨ Features im Detail

### Hero Video
```
✓ Autoplay (muted)
✓ Seamless Loop
✓ Dark Overlay (Text Lesbarkeit)
✓ Poster Fallback
✓ Mobile: playsinline
✓ Error Handling
✓ Slow Connection Detection
```

### Proof Video
```
✓ Lazy Loading (Intersection Observer)
✓ Play/Pause Button
✓ Video Label Badge
✓ Proof Points Sidebar
✓ CTA Button (Conversion)
✓ Viewport Auto-Pause
✓ Keyboard Controls
```

---

## 🎨 Customization

### Video-Label Text ändern
```html
<!-- index.html, Zeile ~149 -->
<div class="video-label">
  <span data-i18n="proof.videoLabel">
    🎥 Echter Produkttest – Winter Edition
  </span>
</div>
```

### Overlay Farbe ändern
```css
/* video-sections.css, Zeile ~40 */
.hero-video-overlay {
  background: linear-gradient(
    135deg,
    rgba(0, 0, 0, 0.5) 0%,  /* Dunkler */
    rgba(0, 0, 0, 0.3) 50%, /* Heller */
    rgba(0, 0, 0, 0.5) 100%
  );
}
```

### Lazy Load Threshold ändern
```javascript
/* video-controller.js, Zeile ~14 */
const CONFIG = {
  lazyLoadThreshold: '200px', // Früher: '500px'
};
```

---

## 🌍 Mehrsprachigkeit (i18n)

**Deutsch:**
```json
"proof": {
  "sectionTitle": "Produkt in Action – Echter Härtetest",
  "videoLabel": "🎥 Echter Produkttest – Winter Edition",
  ...
}
```

**Englisch:**
```json
"proof": {
  "sectionTitle": "Product in Action – Real Stress Test",
  "videoLabel": "🎥 Real Product Test – Winter Edition",
  ...
}
```

Sprache wechseln: Language Switcher in Header

---

## 📊 Conversion Optimierung

### Proof Section Design
```
📹 Video (links)        📝 Proof Points (rechts)
                        ✓ Extreme Stabilität
                        ✓ Sicherer Halt
                        ✓ Winter-Bedingungen
                        ✓ Professionell
                        
                        [CTA Button: Zum Konfigurator]
                        
                        → Vollständiger Testbericht
```

**Warum es funktioniert:**
- Video zeigt echte Nutzung (Trust)
- Bullet Points = schnell erfassbar
- CTA direkt neben Beweis
- Link zu Details (vertieftes Interesse)

---

## ⚡ Performance Tipps

### Video Kompression
```bash
# FFmpeg: Optimale Kompression für Web
ffmpeg -i input.mp4 \
  -c:v libx264 \
  -preset slow \
  -crf 23 \
  -c:a aac \
  -b:a 128k \
  -movflags +faststart \
  output.mp4

# Ziel: 6-10MB für 30-60s Video
```

### Lighthouse Score Optimierung
1. Videos Lazy Load: ✅
2. Poster Images optimiert: ⏳
3. Preload metadata: ✅
4. Viewport pause: ✅

**Expected Score:**
- Performance: 85-95
- Accessibility: 95-100
- Best Practices: 90-100

---

## 🔒 Accessibility Checklist

- [x] Keyboard Controls (Space/Enter)
- [x] ARIA Labels (Play Button)
- [x] Tabindex für Video
- [x] Prefers-Reduced-Motion
- [x] Alt Text / Fallback Content
- [x] High Contrast Mode Support
- [x] Focus Indicators

---

## 🎯 Testing Checklist

### Desktop
- [ ] Chrome: Video autoplay, lazy load
- [ ] Firefox: Video controls
- [ ] Safari: iOS playsinline
- [ ] Edge: Performance

### Mobile
- [ ] iOS Safari: Autoplay policy
- [ ] Chrome Android: Touch controls
- [ ] Small screens: Responsive layout

### Performance
- [ ] Lighthouse Score > 85
- [ ] Network Tab: Lazy load works
- [ ] CPU: No frame drops
- [ ] Memory: No leaks

---

## 💡 Optionale Erweiterungen

1. **Landing Page `/live-test`** → Vollständiger Test
2. **Video Analytics** → Google Analytics Events
3. **A/B Testing** → Autoplay vs. Manual
4. **Video Thumbnails** → Zeitmarken-Navigation
5. **Social Sharing** → Twitter/LinkedIn Video-Cards

---

## 🆘 Support

**Problem?** → Siehe [VIDEO-INTEGRATION-GUIDE.md](VIDEO-INTEGRATION-GUIDE.md) → Troubleshooting

**Fragen?**
- Code Review: `video-controller.js`
- Styles: `video-sections.css`
- HTML: `index.html` (Zeilen 93-168)

---

**Version:** 1.0  
**Status:** ✅ Code Ready, ⏳ Videos & Posters  
**Datum:** 18. Januar 2026
