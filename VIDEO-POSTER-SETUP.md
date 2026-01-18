# VIDEO POSTER IMAGES - SETUP GUIDE

## Benötigte Poster Images

Für die optimale Performance der Video-Integration werden Poster-Images benötigt. Diese dienen als:
- Fallback für langsame Verbindungen
- Vorschau während des Video-Ladens
- Ersatz bei Video-Fehlern

### 1. Yacht Video Poster
**Datei:** `images/poster-yacht.jpg`
**Quelle:** Frame aus `images/unbreak-one-yacht.mp4`
**Empfohlene Größe:** 1920x1080px
**Format:** JPG (optimiert, ~200-300KB)

**Erstellen:**
```bash
# Mit FFmpeg (automatisch besten Frame wählen)
ffmpeg -i images/unbreak-one-yacht.mp4 -ss 00:00:03 -vframes 1 -q:v 2 images/poster-yacht.jpg

# Oder mit Video-Editor einen attraktiven Frame exportieren
```

**Optimierung:**
- Komprimierung: 80-85%
- Auflösung: 1920x1080px
- Keine Text-Overlays (kommen via HTML)

---

### 2. Live Test Video Poster
**Datei:** `images/poster-live-test.jpg`
**Quelle:** Frame aus `images/unbreak-one-winter_live.mp4`
**Empfohlene Größe:** 1920x1080px (oder 16:9 Aspect Ratio)
**Format:** JPG (optimiert, ~200-300KB)

**Erstellen:**
```bash
# Mit FFmpeg
ffmpeg -i images/unbreak-one-winter_live.mp4 -ss 00:00:05 -vframes 1 -q:v 2 images/poster-live-test.jpg

# Wähle einen Frame der:
# - Das Produkt klar zeigt
# - Action/Bewegung andeutet
# - Professionell aussieht
```

**Optimierung:**
- Komprimierung: 80-85%
- Auflösung: 1920x1080px
- Optional: Text-Overlay "Live Test" hinzufügen

---

## Automatische Poster-Generierung

### Option 1: FFmpeg Batch Script
```bash
# poster-generator.sh
#!/bin/bash

# Yacht Video Poster (3 Sekunden in)
ffmpeg -i images/unbreak-one-yacht.mp4 -ss 00:00:03 -vframes 1 -q:v 2 -vf scale=1920:1080 images/poster-yacht.jpg

# Live Test Poster (5 Sekunden in)
ffmpeg -i images/unbreak-one-winter_live.mp4 -ss 00:00:05 -vframes 1 -q:v 2 -vf scale=1920:1080 images/poster-live-test.jpg

echo "Poster images created successfully!"
```

### Option 2: PowerShell Script (Windows)
```powershell
# poster-generator.ps1

# Yacht Video Poster
ffmpeg -i "images/unbreak-one-yacht.mp4" -ss 00:00:03 -vframes 1 -q:v 2 -vf scale=1920:1080 "images/poster-yacht.jpg"

# Live Test Poster
ffmpeg -i "images/unbreak-one-winter_live.mp4" -ss 00:00:05 -vframes 1 -q:v 2 -vf scale=1920:1080 "images/poster-live-test.jpg"

Write-Host "✅ Poster images created!" -ForegroundColor Green
```

---

## Alternative: Online Tools

Falls FFmpeg nicht verfügbar ist:

1. **Online Video Thumbnail Generator:**
   - https://www.vidthumbnail.com/
   - https://thumbnail-generator.com/

2. **Video-Player Screenshot:**
   - Video in VLC/Media Player öffnen
   - Zum gewünschten Frame navigieren
   - Screenshot erstellen (meist Strg+Alt+S)
   - In Photoshop/GIMP auf 1920x1080 croppen

3. **Video-Editor:**
   - DaVinci Resolve (kostenlos)
   - Adobe Premiere
   - Final Cut Pro
   - Frame exportieren

---

## Optimierung nach Erstellung

```bash
# ImageMagick (weitere Kompression)
convert poster-yacht.jpg -quality 85 -strip poster-yacht-optimized.jpg
convert poster-live-test.jpg -quality 85 -strip poster-live-test-optimized.jpg

# TinyPNG/TinyJPG (Online)
# https://tinypng.com/
# → Drag & Drop Poster Images
```

---

## Fallback: Placeholder Images

Falls die Poster-Erstellung nicht sofort möglich ist, können temporär Platzhalter verwendet werden:

**Temporäre Lösung:**
1. Kopiere ein bestehendes Hero-Image
2. Benenne um zu `poster-yacht.jpg` und `poster-live-test.jpg`
3. Platziere in `images/` Ordner

**Code-Anpassung für Fallback:**
```html
<!-- Falls Poster fehlt, einfach entfernen: -->
<video ... >
  <!-- poster="images/poster-yacht.jpg" auskommentieren -->
</video>
```

---

## Dateigröße & Performance

**Zielwerte:**
- Poster Images: 200-400KB (je nach Qualität)
- Video Files: 6-10MB (wie gewünscht)

**Gesamt-Ladezeit:**
- Hero Section: <1s (Poster sofort sichtbar)
- Proof Video: Lazy Load (nur bei Sichtbarkeit)

---

## Checkliste

- [ ] Yacht Poster erstellt (`images/poster-yacht.jpg`)
- [ ] Live Test Poster erstellt (`images/poster-live-test.jpg`)
- [ ] Bilder optimiert (< 400KB)
- [ ] Aspect Ratio 16:9 korrekt
- [ ] Bilder in `images/` Ordner hochgeladen
- [ ] Browser-Test: Poster werden vor Video-Load angezeigt
- [ ] Mobile Test: Poster sichtbar bei langsamer Verbindung

---

## Support

Bei Problemen:
1. Prüfe Browser Console auf Fehler
2. Stelle sicher, dass Dateipfade korrekt sind
3. Teste mit Browser DevTools → Network Tab
4. Verwende temporär ein bestehendes Bild als Fallback
