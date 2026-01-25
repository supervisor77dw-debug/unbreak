# Hero Image Format Converter
# Erstellt WebP und AVIF Versionen des Hero-Poster-Bildes

$sourceImage = "images/poster-yacht.jpg"
$publicSourceImage = "public/images/poster-yacht.jpg"
$outputDir = "public/images"

Write-Host "==================================" -ForegroundColor Cyan
Write-Host "Hero Poster Format Conversion" -ForegroundColor Cyan
Write-Host "==================================" -ForegroundColor Cyan
Write-Host ""

# Bestimme Quellbild
$source = $null
if (Test-Path $publicSourceImage) {
    $source = $publicSourceImage
    Write-Host "Quelle: $publicSourceImage" -ForegroundColor Green
} elseif (Test-Path $sourceImage) {
    $source = $sourceImage
    Write-Host "Quelle: $sourceImage" -ForegroundColor Green
} else {
    Write-Host "FEHLER: poster-yacht.jpg nicht gefunden!" -ForegroundColor Red
    exit 1
}

# Check for ImageMagick
$hasMagick = $null -ne (Get-Command magick -ErrorAction SilentlyContinue)

if (-not $hasMagick) {
    Write-Host ""
    Write-Host "WARNUNG: ImageMagick nicht verfügbar" -ForegroundColor Yellow
    Write-Host "Die Konvertierung kann nicht lokal durchgeführt werden." -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Alternativen:" -ForegroundColor Cyan
    Write-Host "1. ImageMagick installieren: choco install imagemagick" -ForegroundColor White
    Write-Host "2. Online-Konverter nutzen (z.B. squoosh.app)" -ForegroundColor White
    Write-Host "3. Vercel Build wird automatisch WebP generieren" -ForegroundColor White
    Write-Host ""
    Write-Host "Benötigte Dateien:" -ForegroundColor Cyan
    Write-Host "- $outputDir/poster-yacht.webp" -ForegroundColor White
    Write-Host "- $outputDir/poster-yacht.avif" -ForegroundColor White
    Write-Host ""
    exit 0
}

Write-Host "Tool gefunden: ImageMagick" -ForegroundColor Green
Write-Host ""

# Erstelle WebP
$webpOutput = Join-Path $outputDir "poster-yacht.webp"
Write-Host "Erstelle WebP..." -ForegroundColor Cyan
& magick convert $source -quality 85 $webpOutput 2>&1 | Out-Null

if (Test-Path $webpOutput) {
    $webpSize = [math]::Round((Get-Item $webpOutput).Length / 1KB, 2)
    Write-Host "✓ WebP erstellt: $webpSize KB" -ForegroundColor Green
} else {
    Write-Host "✗ WebP Fehler" -ForegroundColor Red
}

# Erstelle AVIF
$avifOutput = Join-Path $outputDir "poster-yacht.avif"
Write-Host "Erstelle AVIF..." -ForegroundColor Cyan
& magick convert $source -quality 85 $avifOutput 2>&1 | Out-Null

if (Test-Path $avifOutput) {
    $avifSize = [math]::Round((Get-Item $avifOutput).Length / 1KB, 2)
    Write-Host "✓ AVIF erstellt: $avifSize KB" -ForegroundColor Green
} else {
    Write-Host "✗ AVIF Fehler" -ForegroundColor Red
}

Write-Host ""
Write-Host "==================================" -ForegroundColor Cyan
Write-Host "Fertig!" -ForegroundColor Green
Write-Host "==================================" -ForegroundColor Cyan
