# WebP Image Converter - Simplified
$imagesDir = "public\images"
$quality = 85
$breakpoints = @(320, 640, 1024)

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

# Check for ImageMagick
$hasMagick = $null -ne (Get-Command magick -ErrorAction SilentlyContinue)

if (-not $hasMagick) {
    Write-Host "FEHLER: ImageMagick nicht gefunden!" -ForegroundColor Red
    Write-Host "Installation: choco install imagemagick" -ForegroundColor Yellow
    Write-Host ""
    exit 1
}

Write-Host "Tool gefunden: ImageMagick" -ForegroundColor Green
Write-Host ""

foreach ($image in $targetImages) {
    $sourcePath = Join-Path $imagesDir $image
    
    if (-not (Test-Path $sourcePath)) {
        Write-Host "SKIP: $image (nicht gefunden)" -ForegroundColor Yellow
        continue
    }
    
    $baseName = [System.IO.Path]::GetFileNameWithoutExtension($image)
    
    Write-Host "Verarbeite: $image" -ForegroundColor Cyan
    
    # Original WebP
    $webpOriginal = Join-Path $imagesDir ($baseName + ".webp")
    & magick convert $sourcePath -quality $quality $webpOriginal 2>&1 | Out-Null
    
    if (Test-Path $webpOriginal) {
        $originalSize = (Get-Item $sourcePath).Length / 1KB
        $webpSize = (Get-Item $webpOriginal).Length / 1KB
        $savings = [math]::Round((1 - ($webpSize / $originalSize)) * 100, 1)
        $sizeRounded = [math]::Round($webpSize, 1)
        Write-Host "  OK Original WebP: $sizeRounded KB (-$savings%)" -ForegroundColor Green
    }
    
    # Responsive Breakpoints
    foreach ($width in $breakpoints) {
        $webpBreakpoint = Join-Path $imagesDir ($baseName + "-" + $width + "w.webp")
        & magick convert $sourcePath -resize ($width.ToString() + "x>") -quality $quality $webpBreakpoint 2>&1 | Out-Null
        
        if (Test-Path $webpBreakpoint) {
            $size = (Get-Item $webpBreakpoint).Length / 1KB
            $sizeRounded = [math]::Round($size, 1)
            Write-Host "  OK ${width}w: $sizeRounded KB" -ForegroundColor Green
        }
    }
    
    Write-Host ""
}

Write-Host "==================================" -ForegroundColor Cyan
Write-Host "Fertig!" -ForegroundColor Green
Write-Host "==================================" -ForegroundColor Cyan
