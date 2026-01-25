# Hero Cinematic Image Converter
# Erstellt WebP und AVIF Versionen des Hero-Bildes

$sourceImage = "public/images/hero-cinematic.jpg"
$outputDir = "public/images"

Write-Host "==================================" -ForegroundColor Cyan
Write-Host "Hero Cinematic Format Conversion" -ForegroundColor Cyan
Write-Host "==================================" -ForegroundColor Cyan
Write-Host ""

if (-not (Test-Path $sourceImage)) {
    Write-Host "FEHLER: $sourceImage nicht gefunden!" -ForegroundColor Red
    exit 1
}

$sourceSize = [math]::Round((Get-Item $sourceImage).Length / 1MB, 2)
Write-Host "Quelle: $sourceImage ($sourceSize MB)" -ForegroundColor Green
Write-Host ""

# Check for ImageMagick
$hasMagick = $null -ne (Get-Command magick -ErrorAction SilentlyContinue)

if (-not $hasMagick) {
    Write-Host ""
    Write-Host "WARNUNG: ImageMagick nicht verfügbar" -ForegroundColor Yellow
    Write-Host "Die Konvertierung kann nicht lokal durchgeführt werden." -ForegroundColor Yellow
    Write-Host ""
    Write-Host "WICHTIG: Benötigte Dateien müssen erstellt werden:" -ForegroundColor Red
    Write-Host "- $outputDir/hero-cinematic.webp (Ziel: ~400 KB)" -ForegroundColor White
    Write-Host "- $outputDir/hero-cinematic.avif (Ziel: ~300 KB)" -ForegroundColor White
    Write-Host ""
    Write-Host "Alternativen:" -ForegroundColor Cyan
    Write-Host "1. ImageMagick installieren: choco install imagemagick" -ForegroundColor White
    Write-Host "2. Online-Konverter nutzen: https://squoosh.app" -ForegroundColor White
    Write-Host "   - Upload: $sourceImage" -ForegroundColor White
    Write-Host "   - Export: WebP (80-85%) + AVIF (80-85%)" -ForegroundColor White
    Write-Host "3. Vercel Build könnte automatisch konvertieren" -ForegroundColor White
    Write-Host ""
    
    # Erstelle temporäre Kopien um 404s zu vermeiden
    Write-Host "Erstelle temporäre Fallback-Dateien..." -ForegroundColor Yellow
    Copy-Item $sourceImage "$outputDir/hero-cinematic.webp" -Force
    Copy-Item $sourceImage "$outputDir/hero-cinematic.avif" -Force
    Write-Host "✓ Temporäre Dateien erstellt (MÜSSEN durch echte ersetzt werden!)" -ForegroundColor Yellow
    Write-Host ""
    exit 0
}

Write-Host "Tool gefunden: ImageMagick" -ForegroundColor Green
Write-Host ""

# Erstelle WebP
$webpOutput = Join-Path $outputDir "hero-cinematic.webp"
Write-Host "Erstelle WebP..." -ForegroundColor Cyan
& magick convert $sourceImage -quality 85 -define webp:method=6 $webpOutput 2>&1 | Out-Null

if (Test-Path $webpOutput) {
    $webpSize = [math]::Round((Get-Item $webpOutput).Length / 1KB, 2)
    $webpSavings = [math]::Round((1 - (Get-Item $webpOutput).Length / (Get-Item $sourceImage).Length) * 100, 0)
    Write-Host "OK WebP erstellt: $webpSize KB (Einsparung: $webpSavings%)" -ForegroundColor Green
} else {
    Write-Host "FEHLER bei WebP" -ForegroundColor Red
}

# Erstelle AVIF
$avifOutput = Join-Path $outputDir "hero-cinematic.avif"
Write-Host "Erstelle AVIF..." -ForegroundColor Cyan
& magick convert $sourceImage -quality 85 $avifOutput 2>&1 | Out-Null

if (Test-Path $avifOutput) {
    $avifSize = [math]::Round((Get-Item $avifOutput).Length / 1KB, 2)
    $avifSavings = [math]::Round((1 - (Get-Item $avifOutput).Length / (Get-Item $sourceImage).Length) * 100, 0)
    Write-Host "OK AVIF erstellt: $avifSize KB (Einsparung: $avifSavings%)" -ForegroundColor Green
} else {
    Write-Host "FEHLER bei AVIF" -ForegroundColor Red
}

Write-Host ""
Write-Host "==================================" -ForegroundColor Cyan
Write-Host "Fertig!" -ForegroundColor Green
Write-Host "==================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Original: $sourceSize MB" -ForegroundColor White
if (Test-Path $webpOutput) {
    Write-Host "WebP: $webpSize KB" -ForegroundColor Green
}
if (Test-Path $avifOutput) {
    Write-Host "AVIF: $avifSize KB" -ForegroundColor Green
}
