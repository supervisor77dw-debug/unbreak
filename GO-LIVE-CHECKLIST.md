# GO-LIVE CHECKLIST: Stripe + Resend Production
**Messe: 15. Januar 2026 - HEUTE!**

---

## ✅ CODE CHANGES (Completed)

### 1. Migration: Processed Events Table
- ✅ File: `supabase/migrations/017_create_processed_events.sql`
- **Purpose:** Idempotent webhook processing with dedicated event tracking
- **Action Required:** Deploy migration to Production Supabase

### 2. Webhook Improvements
- ✅ File: `pages/api/stripe/webhook.js`
- **Changes:**
  - Uses `processed_events` table for idempotency (not `payments`)
  - Sends order confirmation email via Resend after successful payment
  - Email failures are non-fatal (order still marked as paid)
  - Records email status in orders table (`email_sent`, `email_sent_at`)

### 3. Feature Flag: CHECKOUT_ENABLED
- ✅ File: `pages/api/checkout/standard.js`
- **Behavior:**
  - Default: `CHECKOUT_ENABLED=true` (enabled)
  - If `CHECKOUT_ENABLED=false`: Returns HTTP 503 with user-friendly message
  - Frontend handles 503 gracefully (checkout.js)

---

## 🔧 VERCEL PRODUCTION ENVIRONMENT VARIABLES

### Critical (MUST be set):

```bash
# Base URL (for success/cancel redirects)
NEXT_PUBLIC_SITE_URL=https://unbreak-one.vercel.app

# Stripe (LIVE MODE)
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Resend (Email Service)
RESEND_API_KEY=re_...
EMAILS_ENABLED=true

# Email Sender Addresses (must be verified in Resend)
EMAIL_FROM_ORDERS=orders@unbreak.one
EMAIL_FROM_SUPPORT=support@unbreak.one
EMAIL_FROM_NO_REPLY=no-reply@unbreak.one
RESEND_FROM=orders@unbreak.one

# Supabase (already set)
SUPABASE_URL=https://...
SUPABASE_SERVICE_ROLE_KEY=...
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
```

### Optional (Feature Flags):

```bash
# Checkout System
CHECKOUT_ENABLED=true  # Default: enabled

# Email Test Endpoint Protection
EMAIL_TEST_SECRET=<random-secret>  # For /api/email/test
```

---

## 📋 STRIPE CONFIGURATION (Live Mode)

### Webhook Endpoint:
```
URL: https://unbreak-one.vercel.app/api/stripe/webhook
```

### Events to Subscribe:
- ✅ `checkout.session.completed` (CRITICAL - marks order as paid + sends email)
- ✅ `payment_intent.succeeded` (optional - backup confirmation)
- ✅ `charge.refunded` (optional - refund handling)

### Signature Verification:
- ✅ Webhook Secret: Copy from Stripe Dashboard → Environment Variable
- ✅ Endpoint configured in Stripe: Live Mode → Webhooks

### Success/Cancel URLs:
```
Success: https://unbreak-one.vercel.app/success.html?session_id={CHECKOUT_SESSION_ID}
Cancel:  https://unbreak-one.vercel.app/cart.html
```

---

## 📧 RESEND CONFIGURATION

### Domain Verification:
1. ✅ Add domain to Resend: `unbreak.one`
2. ✅ Configure DNS records:
   - SPF: `v=spf1 include:_spf.resend.com ~all`
   - DKIM: (provided by Resend)
   - DMARC: `v=DMARC1; p=none;`
3. ✅ Verify domain in Resend Dashboard

### Sender Addresses:
- ✅ `orders@unbreak.one` (verified)
- ✅ `support@unbreak.one` (verified)
- ✅ `no-reply@unbreak.one` (verified)

### Test Email:
```bash
# Call test endpoint (requires secret)
GET /api/email/test?secret=<EMAIL_TEST_SECRET>&email=your@email.com
```

---

## 🚀 DEPLOYMENT STEPS

### 1. Deploy Migration
```bash
# In Supabase Studio or CLI:
cd supabase/migrations
# Upload 017_create_processed_events.sql
# OR push via CLI:
npx supabase db push
```

### 2. Set Environment Variables in Vercel
```bash
# Via Vercel Dashboard:
Project Settings → Environment Variables → Production

# OR via CLI:
vercel env add STRIPE_SECRET_KEY production
vercel env add STRIPE_WEBHOOK_SECRET production
vercel env add RESEND_API_KEY production
vercel env add EMAILS_ENABLED production
# ... (all variables from list above)
```

### 3. Deploy Code to Production
```bash
# Option A: Merge to master branch (triggers auto-deploy)
git checkout master
git merge post-messe --no-ff -m "GO-LIVE: Stripe + Resend Integration"
git push origin master

# Option B: Manual deployment
vercel --prod
```

### 4. Configure Stripe Webhook
```
1. Login to Stripe Dashboard (Live Mode)
2. Developers → Webhooks → Add Endpoint
3. URL: https://unbreak-one.vercel.app/api/stripe/webhook
4. Events: checkout.session.completed, payment_intent.succeeded, charge.refunded
5. Copy Webhook Secret → Vercel ENV: STRIPE_WEBHOOK_SECRET
```

### 5. Test End-to-End
```
1. Create real order with minimal amount (€1 test product)
2. Complete Stripe Checkout
3. Verify:
   - ✅ Order status = 'paid' in Supabase
   - ✅ Email received at customer address
   - ✅ Production job created
   - ✅ processed_events table has entry
   - ✅ Admin panel shows correct payment status
```

---

## 🧪 TESTING PROTOCOL

### Pre-Launch Checklist:
- [ ] Supabase migration deployed (processed_events table exists)
- [ ] Vercel ENV vars set (all required variables)
- [ ] Stripe webhook endpoint configured (Live Mode)
- [ ] Resend domain verified (DNS records active)
- [ ] Sender addresses verified in Resend
- [ ] Test email sent successfully

### Live Test (Small Order):
- [ ] Create order with real product
- [ ] Complete Stripe checkout with test card (or minimal amount)
- [ ] Verify order status = 'paid' in database
- [ ] Verify email received
- [ ] Check Stripe Dashboard for successful payment
- [ ] Check Resend Dashboard for delivered email
- [ ] Verify admin panel shows correct data

### Monitoring:
- [ ] Vercel logs: `/api/stripe/webhook` (no errors)
- [ ] Stripe logs: Webhook delivery success
- [ ] Resend logs: Email delivery success
- [ ] Database: processed_events growing, no duplicates

---

## 🆘 EMERGENCY PROCEDURES

### If Checkout Fails:
```bash
# Disable checkout immediately
vercel env add CHECKOUT_ENABLED=false production
# Redeploy or wait for cache clear

# Users see:
"Der Checkout ist vorübergehend nicht verfügbar. Bitte versuchen Sie es später erneut."
```

### If Emails Fail:
```bash
# Disable emails (orders still process!)
vercel env add EMAILS_ENABLED=false production

# Emails will be logged but not sent
# Orders remain paid, can send emails manually later
```

### If Webhook Signature Fails:
```
1. Check STRIPE_WEBHOOK_SECRET in Vercel
2. Compare with Stripe Dashboard → Webhooks → Signing Secret
3. Regenerate if needed (but old events will fail!)
```

### Rollback:
```bash
# Revert to previous deployment
vercel rollback

# OR disable specific features
CHECKOUT_ENABLED=false
EMAILS_ENABLED=false
```

---

## 📊 VERIFICATION QUERIES

### Check Processed Events:
```sql
SELECT 
  stripe_event_id,
  event_type,
  processing_status,
  created_at
FROM processed_events
ORDER BY created_at DESC
LIMIT 10;
```

### Check Orders with Email Status:
```sql
SELECT 
  order_number,
  status,
  customer_email,
  email_sent,
  email_sent_at,
  total_amount_cents
FROM orders
WHERE status = 'paid'
ORDER BY created_at DESC
LIMIT 10;
```

### Find Failed Webhooks:
```sql
SELECT 
  stripe_event_id,
  event_type,
  error_message,
  created_at
FROM processed_events
WHERE processing_status = 'failed'
ORDER BY created_at DESC;
```

---

## ✅ GO-LIVE STATUS

- [x] Code deployed
- [ ] Migration applied
- [ ] ENV vars configured
- [ ] Stripe webhook configured
- [ ] Resend domain verified
- [ ] End-to-end test passed

**Date:** 2026-01-15 (Messe Day 2)  
**Critical:** Must be live before shop opens!

---

## 📝 NOTES

### Email Service:
- Non-fatal: Email failures don't block orders
- Retry: Can manually resend via admin panel later
- Preview Mode: If `EMAILS_ENABLED=false`, emails are logged only

### Idempotency:
- Stripe events processed exactly once
- Safe to retry webhook delivery
- Event ID stored in `processed_events` table

### Feature Flags:
- `CHECKOUT_ENABLED`: Quick kill-switch for checkout
- `EMAILS_ENABLED`: Quick kill-switch for emails
- Both default to enabled (must explicitly disable)

### Security:
- Webhook signature strictly verified
- No prices from frontend (server-side only)
- Event replay protection via processed_events

---

**END OF CHECKLIST**
