# Configurator Dynamic Redirect - Integration Spec

## 🚨 CRITICAL: Preview Support

**Problem:** Configurator redirects hard to Production domain, breaking Preview tests.

**Solution:** Dynamic redirect using `shop_origin` parameter.

---

## Shop → Configurator (UNBREAK-ONE)

### URL Parameters to Send

When opening configurator, shop MUST pass:

| Parameter | Description | Example | Required |
|-----------|-------------|---------|----------|
| `lang` | Site language | `en` or `de` | ✅ Yes |
| `shop_origin` | Current shop domain | `https://unbreak-one-abc123.vercel.app` | ✅ Yes |
| `return_path` | Relative return path | `/shop` | ✅ Yes |

---

### Implementation (Already Done ✅)

**File:** `lib/urls.js` - `buildConfiguratorUrl()`

```javascript
export function buildConfiguratorUrl(lang = 'de', returnUrl = null) {
  const configBase = getConfiguratorUrl();
  
  // CRITICAL: Use window.location.origin for Preview support
  let shopOrigin;
  if (typeof window !== 'undefined') {
    shopOrigin = window.location.origin; // ← Preserves preview URLs
  } else {
    shopOrigin = getSiteUrl();
  }
  
  // Extract path from returnUrl
  let returnPath = '/shop';
  if (returnUrl) {
    if (returnUrl.startsWith('http')) {
      const url = new URL(returnUrl);
      returnPath = url.pathname;
    } else {
      returnPath = returnUrl.startsWith('/') ? returnUrl : `/${returnUrl}`;
    }
  }
  
  // Build URL with params
  const params = new URLSearchParams({
    lang: lang || 'de',
    shop_origin: shopOrigin,  // ← NEW
    return_path: returnPath,  // ← NEW
  });
  
  return `${configBase}/?${params.toString()}`;
}
```

---

### Example URLs

**Production:**
```
https://unbreak-3-d-konfigurator.vercel.app/?lang=en&shop_origin=https%3A%2F%2Funbreak-one.com&return_path=%2Fshop
```

**Preview (Vercel):**
```
https://unbreak-3-d-konfigurator.vercel.app/?lang=en&shop_origin=https%3A%2F%2Funbreak-one-abc123.vercel.app&return_path=%2Fshop
```

**Local Development:**
```
https://unbreak-3-d-konfigurator.vercel.app/?lang=en&shop_origin=http%3A%2F%2Flocalhost%3A3000&return_path=%2Fshop
```

---

## Configurator → Shop (CONFIGURATOR TEAM)

### ⚠️ REQUIRED CHANGES

**File:** Configurator redirect logic

**Current (BROKEN):**
```javascript
// ❌ BREAKS PREVIEW - Hard-coded production URL
window.location.href = `https://www.unbreak-one.com/shop?cfg=${cfgEncoded}`;
```

**New (FIXED):**
```javascript
// ✅ WORKS IN PREVIEW - Dynamic origin
const params = new URLSearchParams(window.location.search);
const shopOrigin = params.get('shop_origin') || 'https://www.unbreak-one.com'; // Fallback
const returnPath = params.get('return_path') || '/shop';
const lang = params.get('lang') || 'de';

// Build return URL dynamically
const returnUrl = `${shopOrigin}${returnPath}?cfg=${cfgEncoded}&lang=${lang}`;

// Redirect
window.location.href = returnUrl;
```

---

### Complete Configurator Implementation

```javascript
/**
 * Add to Cart Handler
 * Builds item with config + lang, encodes, redirects to shop
 */
function addToCart() {
  // 1. Detect language (from URL or fallback)
  const urlParams = new URLSearchParams(window.location.search);
  const lang = urlParams.get('lang') || detectLanguage(); // Use existing detectLanguage()
  
  // 2. Build cart item
  const item = buildCartItem(currentConfig);
  item.lang = lang; // CRITICAL: Set language
  
  console.log('[Configurator] Adding to cart:', {
    product_id: item.product_id,
    lang: item.lang,
    config: item.config
  });
  
  // 3. Encode item as base64
  const json = JSON.stringify(item);
  const base64 = btoa(unescape(encodeURIComponent(json)));
  const cfgEncoded = encodeURIComponent(base64);
  
  // 4. Read shop parameters from URL
  const shopOrigin = urlParams.get('shop_origin') || 'https://www.unbreak-one.com';
  const returnPath = urlParams.get('return_path') || '/shop';
  
  // 5. Build dynamic return URL
  const returnUrl = `${shopOrigin}${returnPath}?cfg=${cfgEncoded}&lang=${lang}`;
  
  console.log('[Configurator] Redirecting to shop:', returnUrl);
  
  // 6. Redirect (preserves Preview/Production domain)
  window.location.href = returnUrl;
}
```

---

### Parameter Extraction Helper

```javascript
/**
 * Get shop redirect parameters from URL
 * @returns {object} { shopOrigin, returnPath, lang }
 */
function getShopRedirectParams() {
  const params = new URLSearchParams(window.location.search);
  
  return {
    shopOrigin: params.get('shop_origin') || 'https://www.unbreak-one.com',
    returnPath: params.get('return_path') || '/shop',
    lang: params.get('lang') || 'de'
  };
}

// Usage:
const { shopOrigin, returnPath, lang } = getShopRedirectParams();
const returnUrl = `${shopOrigin}${returnPath}?cfg=${cfgEncoded}&lang=${lang}`;
window.location.href = returnUrl;
```

---

## Testing Requirements

### Test 1: Preview → Configurator → Preview

**Steps:**
1. Open Preview: `https://unbreak-one-abc123.vercel.app/?lang=en`
2. Click "Zum Konfigurator" / "Open Configurator"
3. Verify configurator URL contains:
   ```
   ?lang=en&shop_origin=https%3A%2F%2Funbreak-one-abc123.vercel.app&return_path=%2Fshop
   ```
4. Configure product
5. Click "In den Warenkorb" / "Add to Cart"
6. **CRITICAL:** Verify redirect goes to **Preview domain**:
   ```
   https://unbreak-one-abc123.vercel.app/shop?cfg=...&lang=en
   ```
   **NOT** production domain ❌

**Expected:** ✅ URL stays in Preview (vercel.app)

---

### Test 2: Production → Configurator → Production

**Steps:**
1. Open Production: `https://unbreak-one.com/?lang=de`
2. Click configurator link
3. Verify configurator URL contains:
   ```
   ?lang=de&shop_origin=https%3A%2F%2Funbreak-one.com&return_path=%2Fshop
   ```
4. Add to cart
5. **CRITICAL:** Verify redirect goes to **Production**:
   ```
   https://unbreak-one.com/shop?cfg=...&lang=de
   ```

**Expected:** ✅ URL stays in Production

---

### Test 3: Local → Configurator → Local

**Steps:**
1. Open Local: `http://localhost:3000/?lang=en`
2. Click configurator link
3. Verify URL contains `shop_origin=http%3A%2F%2Flocalhost%3A3000`
4. Add to cart
5. **CRITICAL:** Verify redirect goes to **localhost**:
   ```
   http://localhost:3000/shop?cfg=...&lang=en
   ```

**Expected:** ✅ URL stays on localhost

---

## Acceptance Criteria

### Shop (UNBREAK-ONE) ✅
- [x] `buildConfiguratorUrl()` passes `shop_origin` parameter
- [x] `shop_origin` uses `window.location.origin` (not hardcoded)
- [x] `return_path` passed as `/shop`
- [x] `lang` parameter included

### Configurator (PENDING ⚠️)
- [ ] Read `shop_origin` from URL params
- [ ] Read `return_path` from URL params
- [ ] Read `lang` from URL params
- [ ] Build dynamic return URL: `${shopOrigin}${returnPath}?cfg=...&lang=${lang}`
- [ ] Redirect to dynamic URL (not hardcoded production)
- [ ] Fallback to `https://www.unbreak-one.com` if params missing
- [ ] Console log redirect URL for debugging

### Testing ✅
- [ ] Test 1: Preview → Preview (stays in vercel.app)
- [ ] Test 2: Production → Production (stays in unbreak-one.com)
- [ ] Test 3: Local → Local (stays in localhost)
- [ ] Verify `cfg` parameter preserved
- [ ] Verify `lang` parameter preserved

---

## Debugging

### Console Checks (Shop)

**When clicking configurator link:**
```javascript
// Check generated URL
console.log('Configurator URL:', buildConfiguratorUrl('en', '/shop'));

// Expected output (Preview):
// https://unbreak-3-d-konfigurator.vercel.app/?lang=en&shop_origin=https%3A%2F%2Funbreak-one-abc123.vercel.app&return_path=%2Fshop
```

---

### Console Checks (Configurator)

**On page load:**
```javascript
const params = new URLSearchParams(window.location.search);
console.log('Received params:', {
  lang: params.get('lang'),
  shop_origin: params.get('shop_origin'),
  return_path: params.get('return_path')
});

// Expected:
// {
//   lang: 'en',
//   shop_origin: 'https://unbreak-one-abc123.vercel.app',
//   return_path: '/shop'
// }
```

**Before redirect:**
```javascript
const returnUrl = `${shopOrigin}${returnPath}?cfg=${cfgEncoded}&lang=${lang}`;
console.log('Redirecting to:', returnUrl);

// Expected (Preview):
// https://unbreak-one-abc123.vercel.app/shop?cfg=...&lang=en

// NOT:
// https://www.unbreak-one.com/shop?cfg=... ❌
```

---

## Common Issues

### Issue 1: Redirect goes to Production from Preview

**Symptom:** Click "Add to Cart" in Preview → Redirects to `unbreak-one.com`

**Cause:** Configurator ignores `shop_origin` parameter

**Solution:** Configurator MUST use `params.get('shop_origin')` for redirect

---

### Issue 2: shop_origin is Production in Preview

**Symptom:** `shop_origin=https%3A%2F%2Funbreak-one.com` even in Preview

**Cause:** Shop uses `getSiteUrl()` instead of `window.location.origin`

**Solution:** ✅ Already fixed in `lib/urls.js` - uses `window.location.origin`

---

### Issue 3: Parameters missing in configurator URL

**Symptom:** Configurator URL doesn't have `shop_origin` or `return_path`

**Cause:** Shop using old `buildConfiguratorUrl()` version

**Solution:** Update to latest `lib/urls.js` from feat/i18n-messe branch

---

## Priority

**CRITICAL - BLOCKS PREVIEW TESTING**

Without this fix, all i18n tests must be done in Production, which is risky.

---

## Estimated Time

**Shop Changes:** ✅ Already done (commit 90899af+)
**Configurator Changes:** 15-20 minutes
**Testing:** 10 minutes (3 tests)

---

## Rollout Plan

### Phase 1: Shop Update (DONE ✅)
```bash
# Already in feat/i18n-messe branch
git checkout feat/i18n-messe
# lib/urls.js updated with shop_origin + return_path
```

### Phase 2: Configurator Update (PENDING ⚠️)
- Configurator team implements dynamic redirect
- Test locally with localhost
- Deploy to configurator staging

### Phase 3: Integration Test
- Open Preview shop
- Click configurator
- Verify URL params received
- Add to cart
- Verify Preview → Preview redirect ✅

### Phase 4: Production Deployment
- Merge configurator changes
- Merge shop changes (feat/i18n-messe → master)
- Verify Production → Production ✅

---

## Checklist

### Shop Team (DONE ✅)
- [x] Update `buildConfiguratorUrl()` in `lib/urls.js`
- [x] Add `shop_origin` parameter (window.location.origin)
- [x] Add `return_path` parameter
- [x] Test URL generation in console
- [x] Commit and push to feat/i18n-messe

### Configurator Team (TODO ⚠️)
- [ ] Add URL parameter extraction
- [ ] Implement dynamic redirect URL building
- [ ] Remove hardcoded `https://www.unbreak-one.com`
- [ ] Add console logging for debugging
- [ ] Test with Preview shop domain
- [ ] Test with Production domain
- [ ] Test with localhost
- [ ] Deploy to staging
- [ ] Notify shop team for integration test

### Integration Testing (TODO ⚠️)
- [ ] Test 1: Preview → Preview ✅
- [ ] Test 2: Production → Production ✅
- [ ] Test 3: Local → Local ✅
- [ ] Verify lang parameter preserved
- [ ] Verify cfg parameter preserved
- [ ] Document results

---

## Reference

**Shop Implementation:**
- File: `lib/urls.js`
- Function: `buildConfiguratorUrl()`
- Commit: In feat/i18n-messe branch

**Configurator Spec:**
- This document
- See "Configurator → Shop" section for code examples

**Related:**
- `CONFIGURATOR-I18N-REQUIREMENTS.md` - Language field requirement
- `TEST-A-B-QUICK-GUIDE.md` - EN/DE flow testing
- `EN-FLOW-TEST-GUIDE.md` - Complete E2E test

---

**Status:** Shop ✅ Done | Configurator ⏳ Pending | Testing ⏳ Blocked
**Priority:** CRITICAL - Required for Preview testing
**Blocker for:** Test A+B, v1.1-messe-i18n tag
