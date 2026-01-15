# VERCEL ENVIRONMENT SETUP - PRODUCTION FREEZE

## Git Workflow (✅ ACTIVE)

```bash
master   → FROZEN (Production: unbreak-one.com)
staging  → Development (Preview: staging-*.vercel.app)
```

**Rules:**
- ✅ Currently on: `staging` branch
- ❌ NO direct commits to `master`
- ✅ ALL changes on `staging` first
- ⚠️ Merge to `master` ONLY after explicit approval

---

## Vercel Branch Configuration

### Production (Master)
- **Branch:** `master`
- **Domain:** `unbreak-one.com`
- **Status:** FROZEN until after Messe

### Preview (Staging)
- **Branch:** `staging`
- **URL:** `https://unbreak-one-git-staging-*.vercel.app`
- **Status:** Active development

---

## Preview 500 Error - Required ENV Variables

### Critical (Must Have - Causes 500 if missing):

```bash
# SUPABASE (Database access)
SUPABASE_URL=https://xxxxxxxxxxxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# APPLICATION
NEXT_PUBLIC_SITE_URL=https://unbreak-one.com
NEXT_PUBLIC_CONFIGURATOR_DOMAIN=https://unbreak-3-d-konfigurator.vercel.app

# STRIPE (Payment processing)
STRIPE_SECRET_KEY=sk_test_... (or sk_live_... for production)
STRIPE_WEBHOOK_SECRET=whsec_...

# NEXTAUTH (Authentication)
NEXTAUTH_URL=https://unbreak-one.com
NEXTAUTH_SECRET=your-secret-here

# EMAIL (Optional but recommended)
RESEND_API_KEY=re_...
EMAILS_ENABLED=false  # Set to false for preview
```

### Optional (Won't cause 500 but good to have):

```bash
# Feature Flags
CHECKOUT_ENABLED=true

# Email addresses
EMAIL_FROM_ORDERS=orders@unbreak-one.com
EMAIL_FROM_SUPPORT=support@unbreak-one.com
```

---

## Vercel Settings to Check

### 1. Environment Variables (Preview Environment)

Go to: https://vercel.com/[team]/unbreak-one/settings/environment-variables

**Check for each variable:**
- ✅ Environment: `Preview` (checked)
- ✅ Branch: `staging` (or All Preview Branches)

### 2. Common 500 Causes:

**Missing Database Access:**
```javascript
// If SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY missing
const supabase = createClient(undefined, undefined)
// → 500: Cannot read properties of undefined
```

**Missing NEXTAUTH_SECRET:**
```javascript
// pages/api/auth/[...nextauth].js
secret: process.env.NEXTAUTH_SECRET // undefined
// → 500: NextAuth requires secret
```

**Missing STRIPE_SECRET_KEY:**
```javascript
// pages/api/checkout/create.js
const stripe = new Stripe(undefined)
// → 500: Stripe API key required
```

---

## Debug Steps

### 1. Check Vercel Deployment Logs

```bash
# Go to: https://vercel.com/dashboard
# Click: Latest Preview Deployment (staging branch)
# Tab: "Runtime Logs"
# Look for: Error messages with missing ENV
```

### 2. Expected Error Pattern

```
Error: SUPABASE_URL is required
  at createClient (supabaseClient.js:5:10)
  at getServerSideProps (shop.js:123:20)
```

Or:

```
NextAuthError: Please define a `secret` in production
  at assertion (assertions.js:12:11)
```

### 3. Fix: Copy ENV from Production to Preview

**In Vercel Dashboard:**
1. Go to Settings → Environment Variables
2. For each variable:
   - Click variable name
   - Edit
   - Add to "Preview" environment
   - Save

**Or use Vercel CLI:**
```bash
vercel env pull .env.preview
vercel env add SUPABASE_URL preview
```

---

## Testing After Fix

### 1. Verify Preview Deployment

```bash
# Wait for new deployment (auto-triggers after ENV change)
# Or manually redeploy:
vercel --prod=false
```

### 2. Test Critical Routes

```bash
# Preview URL (from Vercel dashboard)
https://unbreak-one-git-staging-xyz.vercel.app/shop
https://unbreak-one-git-staging-xyz.vercel.app/cart
https://unbreak-one-git-staging-xyz.vercel.app/admin
```

### 3. Check for 500 Gone

```bash
# Browser DevTools → Network
# Status: Should be 200, not 500
# Console: No "fetch failed" errors
```

---

## Production Protection

### Vercel Settings (Recommended)

**Production Branch Protection:**
- Go to: Project Settings → Git
- Production Branch: `master`
- Check: "Protect Production Branch"
- Ignore Build Step: Disabled (build always)

**Deployment Protection:**
- Enable: "Deployment Protection"
- Require: Manual approval for production deployments

---

## Current Status

- ✅ Branch: `staging` (active)
- ✅ Production: Frozen on `master`
- ⏳ Preview: Needs ENV variables
- ⏳ 500 Error: Debugging required

---

## Next Steps

1. **Check Vercel Logs:** Identify exact missing ENV
2. **Add Missing ENV:** Copy from Production → Preview
3. **Redeploy:** Vercel auto-redeploys after ENV change
4. **Test:** Verify /shop loads without 500
5. **Merge:** Only after explicit approval

---

## Emergency Rollback

If staging breaks production:

```bash
# Revert to master
git checkout master
git push origin master --force

# Vercel auto-deploys master to production
# Staging preview unaffected
```
