# ===================================
# UNBREAK ONE - Responsive Images Generator
# Generiert WebP-Versionen + responsive Breakpoints
# ===================================

# Erfordert: ImageMagick oder cwebp (Google WebP Tools)
# Installation: choco install imagemagick oder https://developers.google.com/speed/webp/download

$imagesDir = "public\images"
$quality = 85
$breakpoints = @(320, 640, 1024)

# Liste der zu optimierenden Bilder
$targetImages = @(
    "badge-made-in-germany.png",
    "hero-cinematic.jpg",
    "Camper_Hero.jpg",
    "Bar_Hero.jpg",
    "scene-home.jpg",
    "weinglashalter_szene_ship.jpg",
    "flaschenhalter_szene_ship.jpg"
)

Write-Host "==================================" -ForegroundColor Cyan
Write-Host "UNBREAK ONE - Image Optimization" -ForegroundColor Cyan
Write-Host "==================================" -ForegroundColor Cyan
Write-Host ""

# Überprüfe, ob cwebp verfügbar ist
$hasWebP = $null -ne (Get-Command cwebp -ErrorAction SilentlyContinue)
$hasMagick = $null -ne (Get-Command magick -ErrorAction SilentlyContinue)

if (-not $hasWebP -and -not $hasMagick) {
    Write-Host "FEHLER: Weder cwebp noch ImageMagick gefunden!" -ForegroundColor Red
    Write-Host ""
    Write-Host "Installation:" -ForegroundColor Yellow
    Write-Host "  1. ImageMagick: choco install imagemagick" -ForegroundColor White
    Write-Host "  2. Google WebP: https://developers.google.com/speed/webp/download" -ForegroundColor White
    Write-Host ""
    exit 1
}

Write-Host "Tool gefunden: $(if ($hasWebP) { 'cwebp' } else { 'ImageMagick' })" -ForegroundColor Green
Write-Host ""

foreach ($image in $targetImages) {
    $sourcePath = Join-Path $imagesDir $image
    
    if (-not (Test-Path $sourcePath)) {
        Write-Host "⚠️  SKIP: $image (nicht gefunden)" -ForegroundColor Yellow
        continue
    }
    
    $baseName = [System.IO.Path]::GetFileNameWithoutExtension($image)
    $extension = [System.IO.Path]::GetExtension($image)
    
    Write-Host "🖼️  Verarbeite: $image" -ForegroundColor Cyan
    
    # Originalgröße WebP
    $webpOriginal = Join-Path $imagesDir "$baseName.webp"
    
    if ($hasWebP) {
        & cwebp -q $quality $sourcePath -o $webpOriginal 2>&1 | Out-Null
    } else {
        & magick convert $sourcePath -quality $quality $webpOriginal 2>&1 | Out-Null
    }
    
    if (Test-Path $webpOriginal) {
        $originalSize = (Get-Item $sourcePath).Length / 1KB
        $webpSize = (Get-Item $webpOriginal).Length / 1KB
        $savings = [math]::Round((1 - ($webpSize / $originalSize)) * 100, 1)
        Write-Host "   ✓ Original WebP: $webpOriginal ($([math]::Round($webpSize, 1)) KB, -$savings%)" -ForegroundColor Green
    }
    
    # Responsive Breakpoints
    foreach ($width in $breakpoints) {
        $webpBreakpoint = Join-Path $imagesDir "$baseName-${width}w.webp"
        
        if ($hasWebP) {
            # cwebp unterstützt kein Resize - nutze ImageMagick wenn verfügbar
            if ($hasMagick) {
                & magick convert $sourcePath -resize "${width}x>" -quality $quality $webpBreakpoint 2>&1 | Out-Null
            } else {
                Write-Host "   ⚠️  Skip ${width}w (cwebp kann nicht resizen)" -ForegroundColor Yellow
                continue
            }
        } else {
            & magick convert $sourcePath -resize "${width}x>" -quality $quality $webpBreakpoint 2>&1 | Out-Null
        }
        
        if (Test-Path $webpBreakpoint) {
            $size = (Get-Item $webpBreakpoint).Length / 1KB
            Write-Host "   ✓ ${width}w: $([math]::Round($size, 1)) KB" -ForegroundColor Green
        }
    }
    
    Write-Host ""
}

Write-Host "==================================" -ForegroundColor Cyan
Write-Host "Fertig! ✅" -ForegroundColor Green
Write-Host "==================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Nächste Schritte:" -ForegroundColor Yellow
Write-Host "  1. Überprüfe die generierten WebP-Dateien in: $imagesDir" -ForegroundColor White
Write-Host "  2. Teste die Seite lokal: npm start oder python -m http.server 8000" -ForegroundColor White
Write-Host "  3. Lighthouse Test (Chrome DevTools, Inkognito-Modus)" -ForegroundColor White
Write-Host ""
