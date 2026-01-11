# Quick Test Script - Run after Vercel deployment

Write-Host "`n=== UNBREAK ONE - API Tests ===" -ForegroundColor Cyan
Write-Host "Testing deployment after commit fedef48`n" -ForegroundColor Gray

$baseUrl = "https://unbreak-one.vercel.app"
$errors = 0

# Test 1: Health Check
Write-Host "[1/5] Testing /api/health..." -ForegroundColor Yellow
try {
    $health = Invoke-RestMethod -Uri "$baseUrl/api/health" -Method GET -ErrorAction Stop
    Write-Host "  ✅ Health: $($health.status) | Version: $($health.version) | Env: $($health.env)" -ForegroundColor Green
} catch {
    Write-Host "  ❌ FAILED: $($_.Exception.Message)" -ForegroundColor Red
    $errors++
}

# Test 2: Shop Page
Write-Host "`n[2/5] Testing /shop..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "$baseUrl/shop" -Method GET -ErrorAction Stop
    if ($response.StatusCode -eq 200) {
        Write-Host "  ✅ Shop page loads (200 OK)" -ForegroundColor Green
    }
} catch {
    Write-Host "  ❌ FAILED: $($_.Exception.Message)" -ForegroundColor Red
    $errors++
}

# Test 3: Debug Page
Write-Host "`n[3/5] Testing /debug/config-session..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "$baseUrl/debug/config-session" -Method GET -ErrorAction Stop
    if ($response.StatusCode -eq 200) {
        Write-Host "  ✅ Debug page loads (200 OK)" -ForegroundColor Green
    }
} catch {
    Write-Host "  ❌ FAILED: $($_.Exception.Message)" -ForegroundColor Red
    $errors++
}

# Test 4: Config Return Page
Write-Host "`n[4/5] Testing /config-return..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "$baseUrl/config-return" -Method GET -ErrorAction Stop
    if ($response.StatusCode -eq 200) {
        Write-Host "  ✅ Config return page loads (200 OK)" -ForegroundColor Green
    }
} catch {
    Write-Host "  ❌ FAILED: $($_.Exception.Message)" -ForegroundColor Red
    $errors++
}

# Test 5: Create Session API
Write-Host "`n[5/5] Testing POST /api/config-session..." -ForegroundColor Yellow
try {
    $body = @{
        lang = "de"
        config = @{
            product_type = "glass_holder"
            quantity = 1
        }
    } | ConvertTo-Json

    $session = Invoke-RestMethod -Uri "$baseUrl/api/config-session" -Method POST -Body $body -ContentType "application/json" -ErrorAction Stop
    
    if ($session.ok -and $session.sessionId) {
        Write-Host "  ✅ Session created: $($session.sessionId.Substring(0, 8))..." -ForegroundColor Green
        
        # Test 5b: Read Session
        Write-Host "  Testing GET /api/config-session/[id]..." -ForegroundColor Yellow
        $sessionData = Invoke-RestMethod -Uri "$baseUrl/api/config-session/$($session.sessionId)" -Method GET -ErrorAction Stop
        Write-Host "  ✅ Session read: lang=$($sessionData.lang)" -ForegroundColor Green
        
        # Test 5c: Delete Session
        Write-Host "  Testing DELETE /api/config-session/[id]..." -ForegroundColor Yellow
        $deleteResult = Invoke-RestMethod -Uri "$baseUrl/api/config-session/$($session.sessionId)" -Method DELETE -ErrorAction Stop
        Write-Host "  ✅ Session deleted: $($deleteResult.success)" -ForegroundColor Green
    } else {
        Write-Host "  ❌ Invalid response format" -ForegroundColor Red
        $errors++
    }
} catch {
    Write-Host "  ❌ FAILED: $($_.Exception.Message)" -ForegroundColor Red
    $errors++
}

# Summary
Write-Host "`n=== SUMMARY ===" -ForegroundColor Cyan
if ($errors -eq 0) {
    Write-Host "✅ ALL TESTS PASSED!" -ForegroundColor Green
    Write-Host "`nStable baseline is ready for configurator integration." -ForegroundColor Gray
} else {
    Write-Host "❌ $errors test(s) failed" -ForegroundColor Red
    Write-Host "`nCheck Vercel deployment logs or wait for build to complete." -ForegroundColor Yellow
}

Write-Host "`nCommit: fedef48" -ForegroundColor Gray
Write-Host "Time: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')`n" -ForegroundColor Gray
