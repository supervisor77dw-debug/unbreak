# 🚀 QUICK START: Go-Live in 5 Steps

**Messe Day 2 - 15. Januar 2026**  
**Zeitaufwand: 15-30 Minuten**

---

## ✅ Pre-Check

- [ ] post-messe branch auf GitHub gepusht (Commit: 7ab1e26)
- [ ] Du hast Zugriff auf:
  - Vercel Dashboard
  - Stripe Dashboard (Live Mode)
  - Supabase Studio
  - Resend Dashboard

---

## 1️⃣ MIGRATION DEPLOYEN (2 Min)

### Option A: Supabase Studio
```
1. Öffne: https://supabase.com/dashboard
2. Wähle Projekt: unbreak-one
3. SQL Editor → New Query
4. Kopiere Inhalt von: supabase/migrations/017_create_processed_events.sql
5. Run → Prüfe: "Table created successfully"
```

### Option B: CLI
```bash
cd c:\Users\dirk\Dropbox\projekte\Antigravity\Unbreak_One
npx supabase db push
```

**Verify:**
```sql
SELECT COUNT(*) FROM processed_events;
-- Should return 0 (table exists but empty)
```

---

## 2️⃣ VERCEL ENV VARS (5 Min)

### Copy-Paste Template:
```bash
# In Vercel Dashboard → Settings → Environment Variables → Production

NEXT_PUBLIC_SITE_URL=https://unbreak-one.vercel.app

# Stripe Live (hol Keys aus Stripe Dashboard)
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_
STRIPE_SECRET_KEY=sk_live_
STRIPE_WEBHOOK_SECRET=whsec_  # Kommt in Schritt 3

# Resend (hol Key aus Resend Dashboard)
RESEND_API_KEY=re_
EMAILS_ENABLED=true
EMAIL_FROM_ORDERS=orders@unbreak.one
EMAIL_FROM_SUPPORT=support@unbreak.one
EMAIL_FROM_NO_REPLY=no-reply@unbreak.one
RESEND_FROM=orders@unbreak.one

# Optional
CHECKOUT_ENABLED=true
```

**Nach jedem Add:** Click "Save"

---

## 3️⃣ STRIPE WEBHOOK (3 Min)

```
1. Öffne: https://dashboard.stripe.com/webhooks (Live Mode!)
2. Click: "Add endpoint"
3. URL: https://unbreak-one.vercel.app/api/stripe/webhook
4. Events to send:
   ✅ checkout.session.completed
   ✅ payment_intent.succeeded
   ✅ charge.refunded
5. Click: "Add endpoint"
6. Copy "Signing secret" (whsec_...)
7. Zurück zu Vercel → Add ENV:
   STRIPE_WEBHOOK_SECRET=whsec_...
```

---

## 4️⃣ RESEND DOMAIN (5 Min)

### DNS Records (bei deinem Domain-Provider):
```
1. Öffne: https://resend.com/domains
2. Add Domain: unbreak.one
3. Kopiere DNS Records:
   
   SPF:   v=spf1 include:_spf.resend.com ~all
   DKIM:  [provided by Resend]
   DMARC: v=DMARC1; p=none;
   
4. Setze Records bei deinem Provider
5. Wait for verification (5-15 Min)
6. Verify Sender Addresses:
   - orders@unbreak.one
   - support@unbreak.one
   - no-reply@unbreak.one
```

**Quick Test:**
```bash
curl "https://unbreak-one.vercel.app/api/email/test?secret=YOUR_SECRET&email=deine@email.com"
```

---

## 5️⃣ DEPLOY & TEST (10 Min)

### Deploy to Production:
```bash
git checkout master
git merge post-messe --no-ff -m "GO-LIVE: Stripe + Resend Production"
git push origin master

# Vercel deploys automatically
# Watch: https://vercel.com/dashboard
```

### End-to-End Test:
```
1. Öffne Shop: https://unbreak-one.vercel.app
2. Wähle Produkt (minimaler Preis)
3. Checkout → Stripe Test Card:
   Card: 4242 4242 4242 4242
   Exp: 12/34
   CVC: 123
   ZIP: 12345
4. Complete Payment
5. Verify:
   ✅ Redirect zu success.html
   ✅ Email erhalten (check Inbox)
   ✅ Supabase: Order status = 'paid'
   ✅ Supabase: processed_events hat Entry
```

### SQL Verification:
```sql
-- Check last order
SELECT 
  order_number,
  status,
  customer_email,
  email_sent,
  total_amount_cents
FROM orders
ORDER BY created_at DESC
LIMIT 1;

-- Check webhook event
SELECT * FROM processed_events
ORDER BY created_at DESC
LIMIT 1;
```

---

## ✅ SUCCESS CRITERIA

- [ ] Migration deployed (processed_events table exists)
- [ ] ENV vars set (all required)
- [ ] Stripe webhook configured (whsec_... in ENV)
- [ ] Resend domain verified (green checkmark)
- [ ] Test order: status = 'paid'
- [ ] Test email: delivered to inbox
- [ ] No errors in Vercel logs
- [ ] No errors in Stripe webhook logs

---

## 🆘 TROUBLESHOOTING

### Email nicht angekommen?
```bash
# Check Resend Dashboard → Logs
# Check email_sent field in orders table
# Check Vercel logs for email errors

# Temporary fix: Disable emails
vercel env add EMAILS_ENABLED=false production
```

### Webhook fehlt?
```bash
# Check Stripe Dashboard → Webhooks → Delivery Log
# Verify STRIPE_WEBHOOK_SECRET matches
# Check Vercel logs: /api/stripe/webhook
```

### Order nicht paid?
```bash
# Check processed_events table
# Check Stripe payment status
# Manually trigger webhook from Stripe Dashboard
```

---

## 🎉 GO-LIVE!

Wenn alle Tests ✅:

```bash
# Master branch ist live
# Shop nimmt echte Zahlungen an
# Emails werden versendet
# Messe-Ready! 🚀
```

---

## 📋 Detaillierte Docs

- **Deployment:** [GO-LIVE-CHECKLIST.md](GO-LIVE-CHECKLIST.md)
- **ENV Vars:** [ENV-PRODUCTION.md](ENV-PRODUCTION.md)
- **Tech Details:** [STRIPE-RESEND-IMPLEMENTATION.md](STRIPE-RESEND-IMPLEMENTATION.md)

---

**Viel Erfolg! 🍀**
