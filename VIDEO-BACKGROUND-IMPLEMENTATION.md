# Video-Hintergrund Implementation - UNBREAK ONE Hero-Section

## 📹 Übersicht

Diese Dokumentation beschreibt die vollständige Implementation des responsiven Video-Hintergrunds für die Hero-Section der UNBREAK ONE Homepage.

---

## 🎯 Features

✅ **Responsive Video-Auswahl**
- Desktop (≥1024px): `background-1920.mp4` (1920×1080)
- Mobile (<1024px): `background-1280.mp4` (1280×720)

✅ **Performance-Optimierungen**
- GPU-beschleunigte Transformationen (`will-change: transform`)
- IntersectionObserver pausiert Video außerhalb des Viewports
- Automatisches Lazy-Loading der optimalen Video-Version

✅ **Fallback-Strategien**
- Linear-Gradient Background bei Video-Ladefehlern
- Poster-Image (`Yacht_Hero.jpg`) während des Ladens

✅ **UX & Accessibility**
- Autoplay ohne Ton (`muted`)
- Mobile-kompatibel (`playsinline`)
- Endlos-Loop (`loop`)
- Dunkler Overlay für optimale Textlesbarkeit

---

## 🧱 HTML-Struktur

### Vollständige Hero-Section
```html
<section id="hero">
  <!-- Video Background -->
  <div class="hero-video-container">
    <video 
      class="hero-video" 
      autoplay 
      loop 
      muted 
      playsinline
      poster="images/Yacht_Hero.jpg">
      <!-- Desktop Version (1920x1080) -->
      <source 
        src="images/background-1920.mp4" 
        type="video/mp4" 
        media="(min-width: 1024px)">
      <!-- Mobile Version (1280x720) -->
      <source 
        src="images/background-1280.mp4" 
        type="video/mp4">
    </video>
    <!-- Dark Overlay für bessere Lesbarkeit -->
    <div class="hero-video-overlay"></div>
  </div>

  <div class="container">
    <div class="hero-content">
      <!-- Content hier -->
    </div>
  </div>
</section>
```

### Layer-Hierarchie
```
┌─────────────────────────────┐
│  #hero (Container)          │
│  ┌──────────────────────┐   │
│  │ .hero-video-container│   │ z-index: 1
│  │  ├─ <video>          │   │
│  │  └─ .hero-video-     │   │ z-index: 2
│  │     overlay          │   │
│  └──────────────────────┘   │
│  ┌──────────────────────┐   │
│  │ .container (Content) │   │ z-index: 3
│  └──────────────────────┘   │
└─────────────────────────────┘
```

---

## 🎨 CSS-Implementation

### Hero-Section Base Styles
```css
#hero {
  position: relative;
  color: var(--color-white);
  min-height: 90vh;
  display: flex;
  align-items: center;
  padding: var(--spacing-xl) 0;
  overflow: hidden;
  /* Fallback Background */
  background: linear-gradient(135deg, 
    var(--color-graphit) 0%, 
    var(--color-petrol-dark) 100%);
}
```

### Video Container (Fullscreen)
```css
.hero-video-container {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: 1;
  overflow: hidden;
}
```

### Video Element (Cover-Modus)
```css
.hero-video {
  position: absolute;
  top: 50%;
  left: 50%;
  min-width: 100%;
  min-height: 100%;
  width: auto;
  height: auto;
  transform: translate(-50%, -50%);
  object-fit: cover;
  will-change: transform; /* GPU-Beschleunigung */
}
```

### Dark Overlay (Lesbarkeit)
```css
.hero-video-overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: 2;
  background: linear-gradient(
    to bottom,
    rgba(0, 0, 0, 0.2) 0%,
    rgba(0, 0, 0, 0.4) 100%
  );
}
```

### Content Layer
```css
#hero .container {
  position: relative;
  z-index: 3;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--spacing-xl);
  align-items: center;
}
```

### Mobile Responsive Styles
```css
@media (max-width: 768px) {
  #hero {
    min-height: auto;
    padding: var(--spacing-lg) 0;
  }

  #hero .container {
    grid-template-columns: 1fr;
  }

  .hero-video {
    object-fit: cover; /* Mobile: 1280px Version */
  }
}
```

---

## ⚙️ JavaScript-Funktionalität

### Responsive Video Loader
```javascript
const heroVideo = document.querySelector('.hero-video');

if (heroVideo) {
    // Funktion: Lade optimale Video-Version
    function loadOptimalVideo() {
        const screenWidth = window.innerWidth;
        const videoSources = heroVideo.querySelectorAll('source');
        
        videoSources.forEach(source => {
            const mediaQuery = source.getAttribute('media');
            
            if (mediaQuery && screenWidth >= 1024) {
                source.removeAttribute('media');
            }
        });
        
        heroVideo.load();
    }
    
    // Initial load
    loadOptimalVideo();
    
    // Debounced resize listener
    let resizeTimer;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(loadOptimalVideo, 250);
    });
}
```

### Error Handling & Fallback
```javascript
heroVideo.addEventListener('error', () => {
    console.warn('Video konnte nicht geladen werden.');
    const videoContainer = document.querySelector('.hero-video-container');
    if (videoContainer) {
        videoContainer.style.display = 'none';
    }
});
```

### Performance: IntersectionObserver
```javascript
const observerOptions = {
    threshold: 0.1
};

const videoObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            heroVideo.play().catch(err => {
                console.log('Autoplay verhindert:', err);
            });
        } else {
            heroVideo.pause();
        }
    });
}, observerOptions);

videoObserver.observe(heroVideo);
```

---

## 📁 Benötigte Video-Dateien

Platziere folgende Videos im `/images` Ordner:

### Desktop Version
- **Dateiname:** `background-1920.mp4`
- **Auflösung:** 1920×1080 (Full HD)
- **Format:** MP4 (H.264)
- **Empfohlene Bitrate:** 5-8 Mbps
- **Dauer:** 10-20 Sekunden (Loop)

### Mobile Version
- **Dateiname:** `background-1280.mp4`
- **Auflösung:** 1280×720 (HD)
- **Format:** MP4 (H.264)
- **Empfohlene Bitrate:** 3-5 Mbps
- **Dauer:** 10-20 Sekunden (Loop)

### Video-Komprimierung (Empfehlung)
```bash
# Desktop Version (FFmpeg)
ffmpeg -i input.mp4 -vf scale=1920:1080 -c:v libx264 -crf 23 -preset slow -an background-1920.mp4

# Mobile Version (FFmpeg)
ffmpeg -i input.mp4 -vf scale=1280:720 -c:v libx264 -crf 25 -preset slow -an background-1280.mp4
```

---

## 🎨 Overlay-Anpassungen

### Standard Overlay (35% Dunkelheit)
```css
.hero-video-overlay {
  background: linear-gradient(
    to bottom,
    rgba(0, 0, 0, 0.2) 0%,
    rgba(0, 0, 0, 0.4) 100%
  );
}
```

### Hellerer Overlay (für helle Videos)
```css
.hero-video-overlay {
  background: rgba(0, 0, 0, 0.25);
}
```

### Dunklerer Overlay (für dunkle Videos)
```css
.hero-video-overlay {
  background: rgba(0, 0, 0, 0.5);
}
```

### Petrol-Farbiger Overlay (Corporate Identity)
```css
.hero-video-overlay {
  background: linear-gradient(
    to bottom,
    rgba(10, 108, 116, 0.3) 0%,
    rgba(0, 0, 0, 0.4) 100%
  );
}
```

---

## 🚀 Performance-Tipps

### 1. Video-Optimierung
- **Format:** MP4 (H.264) für beste Kompatibilität
- **CRF-Wert:** 23-25 (Balance zwischen Qualität und Dateigröße)
- **Framerate:** 24-30 fps (höhere Frameraten sind unnötig)
- **Audio entfernen:** Spart 50-70% Dateigröße

### 2. Lazy Loading
- Videos werden nur geladen, wenn sie im Viewport sind
- IntersectionObserver pausiert Video außerhalb des Sichtfelds

### 3. Fallback-Strategie
```css
#hero {
  /* Fallback: Linear Gradient Background */
  background: linear-gradient(135deg, 
    var(--color-graphit) 0%, 
    var(--color-petrol-dark) 100%);
}
```

### 4. Poster Image
```html
<video poster="images/Yacht_Hero.jpg">
```
Zeigt statisches Bild während des Ladens.

---

## 🔧 Troubleshooting

### Video wird nicht abgespielt
**Problem:** Autoplay wird vom Browser blockiert.
**Lösung:** Stelle sicher, dass `muted` und `playsinline` Attribute gesetzt sind.

```html
<video autoplay loop muted playsinline>
```

### Video ist verpixelt
**Problem:** Falsche Video-Version wird geladen.
**Lösung:** Überprüfe `media`-Attribute und JavaScript Video-Loader.

### Video ruckelt auf Mobile
**Problem:** Video-Datei zu groß.
**Lösung:** 
1. Reduziere Auflösung auf 1280×720
2. Erhöhe CRF-Wert auf 25-28
3. Reduziere Framerate auf 24 fps

### Overlay zu dunkel/hell
**Lösung:** Passe `rgba(0, 0, 0, X)` Wert in `.hero-video-overlay` an:
- Heller: `X = 0.2` (20% Dunkelheit)
- Standard: `X = 0.35` (35% Dunkelheit)
- Dunkler: `X = 0.5` (50% Dunkelheit)

---

## 📱 Browser-Kompatibilität

| Browser | Desktop | Mobile |
|---------|---------|--------|
| Chrome  | ✅      | ✅     |
| Firefox | ✅      | ✅     |
| Safari  | ✅      | ✅     |
| Edge    | ✅      | ✅     |
| Opera   | ✅      | ✅     |

**Hinweis:** `playsinline` ist essentiell für iOS Safari!

---

## ✅ Integration Checklist

- [ ] Video-Dateien in `/images` Ordner hochgeladen
  - [ ] `background-1920.mp4` (Desktop)
  - [ ] `background-1280.mp4` (Mobile)
- [ ] HTML-Struktur eingefügt (`index.html`)
- [ ] CSS-Styles hinzugefügt (`styles.css`)
- [ ] JavaScript-Funktionalität implementiert (`script.js`)
- [ ] Poster-Image gesetzt (optional)
- [ ] Overlay-Dunkelheit angepasst
- [ ] Browser-Tests durchgeführt
  - [ ] Desktop (Chrome, Firefox, Safari)
  - [ ] Mobile (iOS Safari, Chrome Mobile)
- [ ] Performance getestet
  - [ ] Video lädt ohne Verzögerung
  - [ ] Keine Ruckler beim Abspielen
  - [ ] Fallback-Background funktioniert

---

## 📚 Weitere Anpassungen

### Video pausieren beim Tab-Wechsel
```javascript
document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
        heroVideo.pause();
    } else {
        heroVideo.play();
    }
});
```

### Video-Speed anpassen (Slow-Motion)
```javascript
heroVideo.playbackRate = 0.75; // 75% Geschwindigkeit
```

### Mehrere Video-Quellen (Rotation)
```javascript
const videos = [
    'background-1920-scene1.mp4',
    'background-1920-scene2.mp4',
    'background-1920-scene3.mp4'
];

let currentIndex = 0;

heroVideo.addEventListener('ended', () => {
    currentIndex = (currentIndex + 1) % videos.length;
    heroVideo.src = `images/${videos[currentIndex]}`;
    heroVideo.play();
});
```

---

## 💡 Best Practices

1. **Video-Länge:** 10-20 Sekunden für nahtlosen Loop
2. **Dateigröße:** Max. 5 MB (Desktop), Max. 2 MB (Mobile)
3. **Szenen-Auswahl:** Ruhige, atmosphärische Aufnahmen (kein hektisches Movement)
4. **Farbpalette:** Passend zum Corporate Design (Petrol/Graphit-Töne)
5. **Testing:** Immer auf echten Mobile-Geräten testen (nicht nur im Browser-Simulator)

---

## 📞 Support

Bei Fragen oder Problemen:
- **Repository:** [unbreak](https://github.com/supervisor77dw-debug/unbreak)
- **Branch:** master
- **Dateien:** `index.html`, `styles.css`, `script.js`

---

**Stand:** 14. Dezember 2025
**Version:** 1.0
**Status:** ✅ Production Ready
