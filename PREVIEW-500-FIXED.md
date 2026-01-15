# VERCEL PREVIEW 500 - FIXED

## Problem
```
Error: ReferenceError: getSiteUrl is not defined
File: .next/server/pages/shop.js:37
```

## Root Cause
`pages/shop.js` called `getSiteUrl()` but didn't import it from `lib/urls.js`

## Fix Applied ✅

**1. Added Missing Import:**
```javascript
// pages/shop.js
import { getSiteUrl } from '../lib/urls';
```

**2. Enhanced getSiteUrl() with VERCEL_URL Fallback:**
```javascript
// lib/urls.js
export function getSiteUrl() {
  if (typeof window === 'undefined') {
    // 1. Explicit site URL (best)
    const explicit = process.env.NEXT_PUBLIC_SITE_URL || process.env.SITE_URL;
    if (explicit) return explicit.replace(/\/$/, '');
    
    // 2. Vercel URL fallback (preview deployments)
    const vercelUrl = process.env.VERCEL_URL;
    if (vercelUrl) return `https://${vercelUrl}`;
    
    // 3. Last resort
    return 'https://unbreak-one.com';
  }
  
  // Client-side logic...
}
```

## Vercel ENV Setup Required

### Production Environment

Set in Vercel Dashboard → Settings → Environment Variables:

```bash
NEXT_PUBLIC_SITE_URL=https://unbreak-one.com
```
- ✅ Environment: **Production**
- ✅ Branch: master

### Preview Environment

```bash
NEXT_PUBLIC_SITE_URL=https://unbreak-one.com
```
- ✅ Environment: **Preview**
- ✅ Branch: staging (or All Preview Branches)

**Note:** Even in Preview, use production domain for canonical URLs.
VERCEL_URL will be used for actual preview URLs automatically.

## Testing

### After Deployment

**1. Check Preview Build:**
```
https://vercel.com/dashboard → Latest staging deployment
→ Should build successfully (no 500)
```

**2. Test /shop Route:**
```bash
# Preview URL (from Vercel dashboard)
curl -I https://unbreak-one-git-staging-xyz.vercel.app/shop
# Expected: 200 OK
```

**3. Verify No Error Logs:**
```
Vercel Dashboard → Deployment → Runtime Logs
# Should NOT show: "getSiteUrl is not defined"
```

## Deployment Status

**Commit:** `613f064`
**Branch:** `staging`
**Status:** Pushed to GitHub

**Vercel Auto-Deploy:**
- Triggered: Automatically on push
- ETA: ~2 minutes
- Check: https://vercel.com/dashboard

## Next Steps

1. **Wait for Build:** Vercel auto-deploys staging branch
2. **Verify 200 OK:** Test preview URL /shop route
3. **If Still 500:** Check other missing ENV vars (see PRODUCTION-FREEZE.md)

## Fallback Plan

If preview still fails with different error:

```bash
# Check Runtime Logs for new error
# Most likely missing:
- SUPABASE_URL
- SUPABASE_SERVICE_ROLE_KEY
- NEXTAUTH_SECRET
```

Add those to Preview environment as well.
