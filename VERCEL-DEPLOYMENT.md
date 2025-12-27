# 🚀 Vercel Deployment Guide - UNBREAK ONE

**Quick Reference: Deploying to Vercel with all required environment variables**

---

## 📋 Prerequisites

- [ ] Vercel account (free tier works)
- [ ] GitHub repository with UNBREAK ONE code
- [ ] Supabase project (get credentials ready)
- [ ] Stripe account (Test or Live mode)

---

## 🔧 Step-by-Step Deployment

### 1. Connect Repository to Vercel

1. **Go to:** [https://vercel.com/new](https://vercel.com/new)
2. **Import Git Repository:**
   - Select your GitHub repository
   - Click "Import"
3. **Configure Project:**
   - Framework Preset: **Next.js** (auto-detected)
   - Root Directory: `./` (default)
   - Build Command: `npm run build` (default)
   - Output Directory: `.next` (default)

⚠️ **DO NOT CLICK DEPLOY YET** - Set environment variables first!

---

### 2. Set Environment Variables (CRITICAL)

**Click "Environment Variables" section BEFORE deploying**

Add the following variables for **ALL ENVIRONMENTS** (Production, Preview, Development):

#### Required Supabase Variables

| Variable Name | Where to Get | Notes |
|---------------|--------------|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase Dashboard → Settings → API → Project URL | Starts with `https://` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase Dashboard → Settings → API → Project API keys → `anon` `public` | Long JWT token |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase Dashboard → Settings → API → Project API keys → `service_role` | ⚠️ **SECRET** - Never expose to client |

**Get Supabase Credentials:**
1. Open: [https://app.supabase.com](https://app.supabase.com)
2. Select your project
3. Go to: **Settings** → **API**
4. Copy values from the "Project API keys" section

---

#### Required Stripe Variables

| Variable Name | Where to Get | Notes |
|---------------|--------------|-------|
| `STRIPE_SECRET_KEY` | Stripe Dashboard → Developers → API Keys | Use `sk_test_xxx` for testing<br>Use `sk_live_xxx` for production |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Stripe Dashboard → Developers → API Keys | Use `pk_test_xxx` for testing<br>Use `pk_live_xxx` for production |
| `STRIPE_WEBHOOK_SECRET` | Stripe Dashboard → Developers → Webhooks | Set up webhook first (see below) |

**Get Stripe Credentials:**
1. Open: [https://dashboard.stripe.com/test/apikeys](https://dashboard.stripe.com/test/apikeys) (Test mode)
   - Or: [https://dashboard.stripe.com/apikeys](https://dashboard.stripe.com/apikeys) (Live mode)
2. Copy **Secret key** → `STRIPE_SECRET_KEY`
3. Copy **Publishable key** → `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`

---

#### Optional but Recommended

| Variable Name | Value | Notes |
|---------------|-------|-------|
| `NEXT_PUBLIC_BASE_URL` | `https://your-domain.vercel.app` | Used for success/cancel redirects |

---

### 3. Environment Variable Configuration in Vercel

**For each variable:**

1. **Variable Name:** Enter exact name (case-sensitive!)
2. **Value:** Paste credential from Supabase/Stripe
3. **Environments:** Select **ALL** (Production, Preview, Development)
   - ✅ Production
   - ✅ Preview
   - ✅ Development
4. Click **Add**

**Example:**
```
Name:         NEXT_PUBLIC_SUPABASE_URL
Value:        https://abcdefgh.supabase.co
Environments: Production ✓  Preview ✓  Development ✓
```

**Repeat for all 6+ variables**

---

### 4. Deploy

1. **Click "Deploy"** (after all env vars are set)
2. **Wait for build** (~2-3 minutes)
3. **Check build logs** for:
   ```
   🔧 Injecting Supabase credentials...
   📍 Environment: Vercel
   🔗 Supabase URL: https://xxx.supabase.co...
   ✅ public/login.html
   ✅ public/account.html
   ...
   ✨ Environment injection complete!
   ```

---

### 5. Set Up Stripe Webhook (After First Deploy)

1. **Get your Vercel deployment URL:**
   - Example: `https://unbreak-one.vercel.app`

2. **Create Webhook in Stripe:**
   - Go to: [https://dashboard.stripe.com/webhooks](https://dashboard.stripe.com/webhooks)
   - Click **"Add endpoint"**
   - Endpoint URL: `https://your-domain.vercel.app/api/stripe/webhook`
   - Events to send:
     - ✅ `checkout.session.completed`
     - ✅ `payment_intent.succeeded`
     - ✅ `charge.refunded`
   - Click **"Add endpoint"**

3. **Copy Webhook Secret:**
   - Click on the newly created webhook
   - Reveal **Signing secret** (starts with `whsec_`)
   - Copy to clipboard

4. **Add to Vercel Environment Variables:**
   - Go back to Vercel → Settings → Environment Variables
   - Add new variable:
     - Name: `STRIPE_WEBHOOK_SECRET`
     - Value: `whsec_xxx...`
     - Environments: All ✓
   - Click **Add**

5. **Redeploy:**
   - Go to Deployments tab
   - Click ⋯ menu on latest deployment
   - Click **"Redeploy"**

---

## ✅ Verification Checklist

After deployment, test the following:

### Frontend

- [ ] Site loads without errors
- [ ] Navigation works (all pages)
- [ ] `/login` page loads Supabase login form
- [ ] `/shop` page loads products
- [ ] 3D Configurator iframe loads

### Checkout Flow

- [ ] Click "Kaufen" on a product
- [ ] Redirects to Stripe Checkout (not `shop.unbreak-one.com` error)
- [ ] Success URL: `https://your-domain.vercel.app/success.html`
- [ ] Cancel URL: `https://your-domain.vercel.app/cancel.html`

### Backend

- [ ] Test payment with card: `4242 4242 4242 4242`
- [ ] Order created in Supabase `orders` table
- [ ] Payment recorded in Supabase `payments` table
- [ ] Webhook received (check Stripe Dashboard → Webhooks → Events)

### Environment Variables

- [ ] No "Missing Supabase environment variables" error in build logs
- [ ] All 6+ variables visible in Vercel → Settings → Environment Variables
- [ ] Variables applied to all environments (Prod/Preview/Dev)

---

## 🐛 Troubleshooting

### Build Fails: "Missing Supabase environment variables"

**Error Message:**
```
❌ MISSING SUPABASE ENVIRONMENT VARIABLES
Required variables:
  • NEXT_PUBLIC_SUPABASE_URL
  • NEXT_PUBLIC_SUPABASE_ANON_KEY
```

**Solutions:**

1. **Check Variable Names (Case-Sensitive):**
   - ❌ `next_public_supabase_url` (wrong)
   - ✅ `NEXT_PUBLIC_SUPABASE_URL` (correct)

2. **Check Environments Selected:**
   - Make sure **all three** checkboxes are selected:
     - Production ✓
     - Preview ✓
     - Development ✓

3. **Redeploy After Adding Variables:**
   - Adding env vars requires redeployment
   - Go to: Deployments → Latest → Redeploy

4. **Verify Values:**
   - Supabase URL should start with `https://`
   - Anon key should be a long JWT token (starts with `eyJhbGciOi...`)

---

### Checkout Redirects to `shop.unbreak-one.com`

**Solutions:**

1. **Set `NEXT_PUBLIC_BASE_URL`:**
   ```
   NEXT_PUBLIC_BASE_URL=https://your-domain.vercel.app
   ```

2. **Verify API Uses Dynamic Origin:**
   - Check `pages/api/checkout/*.js` files use `getOrigin(req)`
   - Should NOT have hardcoded `shop.unbreak-one.com`

---

### Stripe Webhook Not Receiving Events

**Solutions:**

1. **Check Webhook URL:**
   - Must match your Vercel domain exactly
   - Example: `https://unbreak-one.vercel.app/api/stripe/webhook`

2. **Verify Webhook Secret:**
   - `STRIPE_WEBHOOK_SECRET` must match Stripe Dashboard value
   - Starts with `whsec_`

3. **Check Events Selected:**
   - At minimum: `checkout.session.completed`

4. **Test Webhook:**
   - Stripe Dashboard → Webhooks → Your endpoint → Send test webhook

---

### Login/Account Pages Show "YOUR_SUPABASE_URL"

**Solutions:**

1. **Check Build Logs:**
   - Should show: `✅ public/login.html`
   - If shows: `⏭️ No placeholders found` → Already processed
   - If shows: `⚠️ File not found` → File missing

2. **Verify File Paths:**
   - `public/login.html` exists in repo
   - `scripts/inject-env.js` exists in repo

3. **Redeploy:**
   - Environment injection runs during build
   - Redeploy to re-run injection

---

## 🔒 Security Best Practices

### Environment Variables

- ✅ **DO:**
  - Use `NEXT_PUBLIC_` prefix for client-side variables
  - Keep `SERVICE_ROLE_KEY` and `STRIPE_SECRET_KEY` without `NEXT_PUBLIC_` prefix
  - Rotate secrets regularly
  - Use different keys for Test vs Live mode

- ❌ **DON'T:**
  - Expose `SUPABASE_SERVICE_ROLE_KEY` to client
  - Commit `.env.local` to Git
  - Use Live Stripe keys in Preview/Development environments
  - Share webhook secrets publicly

### Stripe

- Use **Test mode** for Preview/Development
- Use **Live mode** only for Production
- Enable webhook signature verification (automatic with `STRIPE_WEBHOOK_SECRET`)

---

## 📖 Related Documentation

- [LAUNCH-GUIDE.md](LAUNCH-GUIDE.md) - Complete production deployment guide
- [BUY-BUTTON-FIX-SUMMARY.md](BUY-BUTTON-FIX-SUMMARY.md) - Dynamic origin detection
- [SUBDOMAIN-REMOVAL-SUMMARY.md](SUBDOMAIN-REMOVAL-SUMMARY.md) - Main domain routing
- [SETUP-ECOMMERCE.md](SETUP-ECOMMERCE.md) - E-commerce setup guide

---

## 🆘 Support

**Build still failing?**

1. Check Vercel build logs (Deployments → Latest → View Build Logs)
2. Look for specific error messages
3. Verify all environment variables are set
4. Check `scripts/inject-env.js` runs successfully

**Need help?**
- Vercel Docs: [https://vercel.com/docs/concepts/projects/environment-variables](https://vercel.com/docs/concepts/projects/environment-variables)
- Supabase Docs: [https://supabase.com/docs/guides/api](https://supabase.com/docs/guides/api)
- Stripe Docs: [https://stripe.com/docs/webhooks](https://stripe.com/docs/webhooks)

---

**Last Updated:** December 27, 2025  
**Version:** 1.0
