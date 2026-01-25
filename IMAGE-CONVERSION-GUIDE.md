# Image Conversion Guide - WICHTIG!

## Problem
Die hero-cinematic.avif und .webp Dateien sind aktuell nur JPG-Kopien (jeweils 1.5 MB).
**Das muss manuell gefixed werden, bevor Lighthouse-Tests laufen!**

## Lösung: Online-Konvertierung (einfachste Option)

### Option 1: Squoosh (empfohlen)
1. Öffne https://squoosh.app/
2. Lade `public/images/hero-cinematic.jpg` hoch
3. Linke Seite: Original (1.5 MB)
4. Rechte Seite wählen:
   - **WebP**: Quality 80, Effort 6 → ~150-200 KB
   - Speichere als `hero-cinematic.webp`
5. Nochmal hochladen:
   - **AVIF**: Quality 60, Effort 6 → ~100-150 KB
   - Speichere als `hero-cinematic.avif`

### Option 2: CloudConvert
1. https://cloudconvert.com/jpg-to-webp
2. Upload `hero-cinematic.jpg`
3. Convert to WebP (Quality 80)
4. Download → speichere als `hero-cinematic.webp`
5. Wiederhole für AVIF: https://cloudconvert.com/jpg-to-avif

### Option 3: ImageMagick (falls installiert)
```powershell
# WebP
magick convert hero-cinematic.jpg -quality 80 hero-cinematic.webp

# AVIF
magick convert hero-cinematic.jpg -quality 60 hero-cinematic.avif
```

## Verifizierung
Nach Konvertierung:
```powershell
cd public/images
Get-Item hero-cinematic.* | Select-Object Name, Length

# Erwartete Größen:
# hero-cinematic.jpg:  ~1.5 MB (original)
# hero-cinematic.webp: ~150-200 KB ✅
# hero-cinematic.avif: ~100-150 KB ✅
```

## Deployment
Nach Konvertierung:
1. Bilder nach `public/images/` kopieren (überschreibe die JPG-Kopien)
2. `git add public/images/hero-cinematic.{avif,webp}`
3. `git commit -m "fix: Real AVIF/WebP hero images (not JPG copies)"`
4. Erst danach deployen und Lighthouse testen!

## Warum wichtig?
- JPG: 1.5 MB → lange LCP
- WebP: ~150 KB → 90% kleiner
- AVIF: ~100 KB → 93% kleiner
- **LCP wird dramatisch besser (von ~21s auf ~2s)**
