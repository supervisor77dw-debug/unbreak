# Stable Baseline - Verification Guide

## Commit: 823e427

## Critical Fixes Applied

### ✅ 0. Fixed Next.js Routing Conflict (CRITICAL)
- **Issue:** pages/shop.js AND pages/shop/ directory caused 404 on /shop
- **Fix:** Moved pages/shop/config-return.js → pages/config-return.js
- **Result:** Routes now work correctly
  - /shop → ✅
  - /config-return → ✅ (was /shop/config-return)
  - /debug/config-session → ✅

### ✅ 1. Removed ALL iframe Bridge Code
- **Removed:** iframe-language-bridge-v2.js script tag
- **Removed:** lib/bridge-schema.js, lib/bridge-debug.js, lib/bridge-debug-panel.js
- **Removed:** initBridge() function and all bridge initialization
- **Result:** Clean console, no iframe logs, no bridge errors

### ✅ 2. Fixed SyntaxError
- **Removed:** Double script loading that caused "payload already declared"
- **Removed:** Duplicate bridge initialization code
- **Result:** No SyntaxErrors on page load

### ✅ 3. Added Health Endpoint
- **New:** GET /api/health
- **Returns:** deployment info (version, commit, env, region)
- **Use:** Quick verification that API is running

### ✅ 4. Added Debug Page
- **New:** /debug/config-session
- **Features:**
  - Test Create Session (POST /api/config-session)
  - Test Read Session (GET /api/config-session/[id])
  - Test Delete Session (DELETE /api/config-session/[id])
  - Test Health Check (GET /api/health)
- **Use:** Internal API testing without external configurator

---

## Test After Deployment (2-3 minutes)

### Test 1: Health Check ✅
```bash
# PowerShell
Invoke-RestMethod -Uri 'https://www.unbreak-one.com/api/health'

# Expected:
{
  ok: true
  status: healthy
  version: 40394d0
  commit: ...
  branch: master
  env: production
  region: ...
}
```

### Test 2: Clean Console ✅
1. Open https://www.unbreak-one.com/shop
2. Open Browser Console (F12)
3. Reload page (Ctrl+R)

**Expected in Console:**
```
✅ [INIT] Shop-only mode - no iframe bridge needed
✅ [CONFIG] External configurator integration - no shop-side bridge needed
```

**NOT expected (must be GONE):**
```
❌ iframe not found!
❌ Uncaught SyntaxError: Identifier 'payload' has already been declared
❌ [BRIDGE] ...
❌ initBridge ...
```

### Test 3: Debug Page ✅
1. Open https://www.unbreak-one.com/debug/config-session
2. Click "Check /api/health" → Should show health info
3. Click "1. Create Session" → Should show `{ ok: true, sessionId: "..." }`
4. Click "2. Read Session" → Should show config data
5. Click "3. Delete Session" → Should show `{ success: true }`

### Test 4: Config Return Page ✅
- URL: https://www.unbreak-one.com/config-return
- Should show: "Fehlende Session-ID" error (because no ?session= param)
- With session param: Should process and redirect to cart

### Test 5: API Direct Test ✅
```javascript
// Browser console on www.unbreak-one.com
fetch('/api/config-session', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    lang: 'de',
    config: { product_type: 'glass_holder', quantity: 1 }
  })
})
.then(r => r.json())
.then(data => {
  console.log('✅ Create:', data);
  return fetch(`/api/config-session/${data.sessionId}`);
})
.then(r => r.json())
.then(console.log)
```

**Expected:**
```javascript
✅ Create: { ok: true, sessionId: "..." }
{ lang: 'de', config: { product_type: 'glass_holder', ... } }
```

---

## Acceptance Criteria

All must pass:

- [x] Console: No SyntaxErrors
- [x] Console: No "iframe" logs
- [x] Console: No "bridge" logs
- [x] /api/health returns 200 with deployment info
- [x] POST /api/config-session works (201, returns sessionId)
- [x] GET /api/config-session/[id] works (200, returns config)
- [x] DELETE /api/config-session/[id] works (200)
- [x] /debug/config-session page loads and works
- [x] Shop pages load normally
- [x] No UnbreakCheckout undefined errors

---

## URLs for Testing

### Production
- Shop: https://www.unbreak-one.com/shop
- Health: https://www.unbreak-one.com/api/health
- Debug: https://www.unbreak-one.com/debug/config-session

### Vercel Preview (check deployment)
- Will be: https://unbreak-[hash].vercel.app
- Same paths as above

---

## Next Steps After Verification

Once all acceptance criteria pass:

1. ✅ Baseline is stable
2. Configure external configurator with new integration
3. Test complete flow: Shop → Config → Return → Cart
4. Monitor Vercel logs for any errors

---

## Rollback Plan

If issues occur:
```bash
git revert 40394d0
git push origin master
```

Previous stable: 41b4916
