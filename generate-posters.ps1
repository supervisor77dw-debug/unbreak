# ===================================
# POSTER IMAGE GENERATOR
# Erstellt optimierte Poster-Images aus Videos
# ===================================

param(
    [string]$YachtVideoPath = "images/unbreak-one-yacht.mp4",
    [string]$LiveTestVideoPath = "images/unbreak-one-winter_live.mp4",
    [int]$YachtTimestamp = 3,
    [int]$LiveTestTimestamp = 5,
    [int]$Quality = 2,
    [string]$Resolution = "1920:1080"
)

Write-Host "`n" -ForegroundColor Cyan
Write-Host "═══════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  📹 UNBREAK ONE - POSTER IMAGE GENERATOR" -ForegroundColor White
Write-Host "═══════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""

# Check if FFmpeg is installed
Write-Host "🔍 Checking for FFmpeg..." -ForegroundColor Yellow

try {
    $ffmpegVersion = ffmpeg -version 2>&1 | Select-String -Pattern "ffmpeg version" -ErrorAction Stop
    Write-Host "✅ FFmpeg found: " -NoNewline -ForegroundColor Green
    Write-Host "$($ffmpegVersion -replace 'ffmpeg version ', '')" -ForegroundColor White
} catch {
    Write-Host "❌ FFmpeg not found!" -ForegroundColor Red
    Write-Host ""
    Write-Host "📥 Install FFmpeg:" -ForegroundColor Yellow
    Write-Host "   1. Download: https://ffmpeg.org/download.html" -ForegroundColor White
    Write-Host "   2. Or use: winget install ffmpeg" -ForegroundColor White
    Write-Host "   3. Or use: choco install ffmpeg" -ForegroundColor White
    Write-Host ""
    exit 1
}

Write-Host ""

# Function to generate poster
function New-VideoPoster {
    param(
        [string]$VideoPath,
        [string]$OutputPath,
        [int]$Timestamp,
        [string]$Label
    )
    
    Write-Host "📹 Processing: $Label" -ForegroundColor Cyan
    Write-Host "   Input:     $VideoPath" -ForegroundColor Gray
    Write-Host "   Output:    $OutputPath" -ForegroundColor Gray
    Write-Host "   Timestamp: ${Timestamp}s" -ForegroundColor Gray
    
    if (-not (Test-Path $VideoPath)) {
        Write-Host "   ❌ Video file not found!" -ForegroundColor Red
        return $false
    }
    
    try {
        # Generate poster image
        $args = @(
            "-i", $VideoPath,
            "-ss", "00:00:0$Timestamp",
            "-vframes", "1",
            "-q:v", "$Quality",
            "-vf", "scale=$Resolution",
            "-y",  # Overwrite without asking
            $OutputPath
        )
        
        $process = Start-Process -FilePath "ffmpeg" -ArgumentList $args -Wait -NoNewWindow -PassThru
        
        if ($process.ExitCode -eq 0 -and (Test-Path $OutputPath)) {
            $fileSize = (Get-Item $OutputPath).Length / 1KB
            Write-Host "   ✅ Created: $OutputPath " -NoNewline -ForegroundColor Green
            Write-Host "($([math]::Round($fileSize))KB)" -ForegroundColor Gray
            return $true
        } else {
            Write-Host "   ❌ Failed to create poster" -ForegroundColor Red
            return $false
        }
    } catch {
        Write-Host "   ❌ Error: $_" -ForegroundColor Red
        return $false
    }
}

# Generate Yacht Video Poster
Write-Host "─────────────────────────────────────────────────────" -ForegroundColor Gray
$yachtSuccess = New-VideoPoster `
    -VideoPath $YachtVideoPath `
    -OutputPath "images/poster-yacht.jpg" `
    -Timestamp $YachtTimestamp `
    -Label "Yacht Hero Video"

Write-Host ""

# Generate Live Test Video Poster
Write-Host "─────────────────────────────────────────────────────" -ForegroundColor Gray
$liveTestSuccess = New-VideoPoster `
    -VideoPath $LiveTestVideoPath `
    -OutputPath "images/poster-live-test.jpg" `
    -Timestamp $LiveTestTimestamp `
    -Label "Live Test Proof Video"

Write-Host ""
Write-Host "═══════════════════════════════════════════════════════" -ForegroundColor Cyan

# Summary
Write-Host ""
Write-Host "📊 SUMMARY:" -ForegroundColor Yellow
Write-Host ""

if ($yachtSuccess) {
    Write-Host "   ✅ Yacht Poster:     " -NoNewline -ForegroundColor Green
    Write-Host "images/poster-yacht.jpg" -ForegroundColor White
} else {
    Write-Host "   ❌ Yacht Poster:     " -NoNewline -ForegroundColor Red
    Write-Host "FAILED" -ForegroundColor Red
}

if ($liveTestSuccess) {
    Write-Host "   ✅ Live Test Poster: " -NoNewline -ForegroundColor Green
    Write-Host "images/poster-live-test.jpg" -ForegroundColor White
} else {
    Write-Host "   ❌ Live Test Poster: " -NoNewline -ForegroundColor Red
    Write-Host "FAILED" -ForegroundColor Red
}

Write-Host ""

# Next Steps
if ($yachtSuccess -and $liveTestSuccess) {
    Write-Host "🎉 SUCCESS! Both posters created!" -ForegroundColor Green
    Write-Host ""
    Write-Host "📋 NEXT STEPS:" -ForegroundColor Yellow
    Write-Host "   1. Check poster quality in browser" -ForegroundColor White
    Write-Host "   2. Optimize if needed (TinyPNG/TinyJPG)" -ForegroundColor White
    Write-Host "   3. Test website: npm run dev" -ForegroundColor White
    Write-Host "   4. Commit to git" -ForegroundColor White
    Write-Host ""
    Write-Host "🌐 TEST COMMAND:" -ForegroundColor Yellow
    Write-Host "   npm run dev" -ForegroundColor Cyan
    Write-Host "   → Open: http://localhost:3000" -ForegroundColor Gray
} else {
    Write-Host "⚠️  Some posters failed to create!" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "🔧 TROUBLESHOOTING:" -ForegroundColor Yellow
    Write-Host "   1. Check if video files exist in images/ folder" -ForegroundColor White
    Write-Host "   2. Verify video file paths:" -ForegroundColor White
    Write-Host "      - $YachtVideoPath" -ForegroundColor Gray
    Write-Host "      - $LiveTestVideoPath" -ForegroundColor Gray
    Write-Host "   3. Try different timestamp (3-10 seconds)" -ForegroundColor White
    Write-Host "   4. Check FFmpeg error messages above" -ForegroundColor White
}

Write-Host ""
Write-Host "═══════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""

# Optional: Optimize with ImageMagick (if installed)
Write-Host "💡 OPTIMIZATION TIP:" -ForegroundColor Yellow
Write-Host "   Use TinyPNG or ImageMagick for further compression:" -ForegroundColor White
Write-Host "   https://tinypng.com/" -ForegroundColor Cyan
Write-Host ""

# Exit with appropriate code
if ($yachtSuccess -and $liveTestSuccess) {
    exit 0
} else {
    exit 1
}
