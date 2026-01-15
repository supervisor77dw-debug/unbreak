# PRODUCTION ENV VARIABLES - Quick Reference
**Critical for Go-Live: 15. Januar 2026**

---

## 🔴 REQUIRED (Production will fail without these)

```bash
# Base URL
NEXT_PUBLIC_SITE_URL=https://unbreak-one.vercel.app

# Stripe Live Mode
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Resend Email Service
RESEND_API_KEY=re_...
EMAILS_ENABLED=true

# Verified Sender Addresses
EMAIL_FROM_ORDERS=orders@unbreak.one
EMAIL_FROM_SUPPORT=support@unbreak.one
EMAIL_FROM_NO_REPLY=no-reply@unbreak.one
RESEND_FROM=orders@unbreak.one

# Supabase (should already be set)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
```

---

## 🟡 OPTIONAL (Feature Flags)

```bash
# Checkout Kill-Switch (default: enabled)
CHECKOUT_ENABLED=true

# Email Test Endpoint Protection
EMAIL_TEST_SECRET=random-secret-here

# Node Environment (auto-set by Vercel)
NODE_ENV=production
```

---

## 📋 COPY-PASTE TEMPLATE

```bash
# === BASE CONFIGURATION ===
NEXT_PUBLIC_SITE_URL=https://unbreak-one.vercel.app

# === STRIPE (LIVE MODE) ===
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_
STRIPE_SECRET_KEY=sk_live_
STRIPE_WEBHOOK_SECRET=whsec_

# === RESEND EMAIL ===
RESEND_API_KEY=re_
EMAILS_ENABLED=true
EMAIL_FROM_ORDERS=orders@unbreak.one
EMAIL_FROM_SUPPORT=support@unbreak.one
EMAIL_FROM_NO_REPLY=no-reply@unbreak.one
RESEND_FROM=orders@unbreak.one

# === SUPABASE (already configured) ===
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=

# === FEATURE FLAGS (optional) ===
CHECKOUT_ENABLED=true
EMAIL_TEST_SECRET=
```

---

## 🚨 EMERGENCY KILL-SWITCHES

### Disable Checkout:
```bash
CHECKOUT_ENABLED=false
```
**Effect:** All checkout requests return HTTP 503  
**User sees:** "Der Checkout ist vorübergehend nicht verfügbar..."

### Disable Emails:
```bash
EMAILS_ENABLED=false
```
**Effect:** Emails logged but not sent  
**Orders:** Still processed normally (emails non-fatal)

---

## ✅ VERIFICATION

### Test Stripe Connection:
```bash
# Check logs for:
🔑 [STRIPE ACCOUNT] Mode: LIVE
🔑 [STRIPE ACCOUNT] Account ID: acct_...
```

### Test Email Service:
```bash
# Call test endpoint:
curl https://unbreak-one.vercel.app/api/email/test?secret=YOUR_SECRET&email=your@email.com
```

### Check Environment:
```bash
# Verify all vars are set:
curl https://unbreak-one.vercel.app/api/debug/env-check
```

---

## 📊 WHERE TO SET THESE

### Vercel Dashboard:
```
1. Login to Vercel
2. Select Project: unbreak-one
3. Settings → Environment Variables
4. Select: Production
5. Add each variable individually
6. Redeploy (or auto-deploys on next push)
```

### Vercel CLI:
```bash
vercel env add STRIPE_SECRET_KEY production
vercel env add RESEND_API_KEY production
# ... etc
```

---

## 🔐 SECURITY NOTES

- **Never commit** live keys to Git
- **Never share** webhook secrets
- **Rotate keys** if exposed
- **Use different keys** for production/preview/development

---

## 📅 LAST UPDATED
- Date: 2026-01-15
- Branch: post-messe
- Commit: 280d704

**Next:** See [GO-LIVE-CHECKLIST.md](GO-LIVE-CHECKLIST.md) for deployment steps
