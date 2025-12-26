# Vercel Konfigurator - Camera Fit Anpassung

## Problem
Modelle (Glashalter + Flaschenhalter) sind im Modal zu groß gerahmt.
Vorher war es besser - jetzt sollen sie 20-30% kleiner erscheinen.

## Ziel
Im Modal-Startzustand sollen beide Varianten "luftiger" sein:
**ca. 20-30% kleiner im Bild** (mehr Abstand rundherum).

## Umsetzung im Vercel-Projekt

### 1. iframe-Erkennung
```javascript
// Erkennung: Läuft im Modal (Homepage)
const inIframe = window.self !== window.top;
```

### 2. Responsive Check
```javascript
const isMobile = window.matchMedia("(max-width: 820px)").matches;
```

### 3. Fit-Margin anpassen
```javascript
// Beispiel: fitCameraToObject / frameArea / fitToBox Funktion
const inIframe = window.self !== window.top;
const isMobile = window.matchMedia("(max-width: 820px)").matches;

// FIT-MARGIN Werte (größer = Modell kleiner im Frame)
const fitMargin = 
  inIframe && isMobile ? 1.55 :  // Modal + Mobile: 55% mehr Abstand
  inIframe ? 1.40 :               // Modal Desktop: 40% mehr Abstand  
  isMobile ? 1.25 :               // Direkt Mobile: 25% mehr Abstand
  1.15;                           // Direkt Desktop: 15% Abstand (Baseline)

// In eurer Camera-Fit-Funktion verwenden:
camera.position.set(
  center.x,
  center.y,
  center.z + (size * fitMargin)
);
```

### 4. Wichtig
- **Fit muss NACH** `model.scale` erfolgen
- **Fit muss NACH** Bounding-Box-Update erfolgen
- Test: Direkt (nicht iframe) = normale Größe, Modal (iframe) = 20-30% kleiner

### 5. Test
1. Öffne Konfigurator direkt: `https://unbreak-3-d-konfigurator.vercel.app/`
   → Größe wie bisher (fitMargin 1.15 Desktop, 1.25 Mobile)

2. Öffne über Homepage Modal: `http://localhost:8000` → CTA klicken
   → Modelle deutlich kleiner (fitMargin 1.40 Desktop, 1.55 Mobile)

### 6. Code-Suche im Vercel-Projekt
Suche nach:
- `fitToBox`
- `frameArea`
- `camera.position.set`
- `controls.fitToBox`
- `getBoundingBox`
- Ähnliche Kamera-Framing-Funktionen

## Finale Werte
```
Desktop Direkt: fitMargin = 1.15
Desktop Modal:  fitMargin = 1.40  (entspricht ~22% kleiner)
Mobile Direkt:  fitMargin = 1.25
Mobile Modal:   fitMargin = 1.55  (entspricht ~24% kleiner)
```

## Datei im Vercel-Projekt
Wahrscheinlich in:
- `src/scene.js` oder `src/camera.js`
- `src/configurator.js`
- Oder ähnlicher Dateiname mit Three.js Camera-Setup

---

**Hinweis**: Diese Änderung muss im **Vercel-Konfigurator-Projekt** gemacht werden, 
nicht in der Homepage (Unbreak_One).
