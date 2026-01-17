# 🚀 VERCEL ENVIRONMENT VARIABLES - Setup Guide

**Letzte Aktualisierung:** 17. Januar 2026  
**Projekt:** UNBREAK ONE  
**Vercel Projekt:** unbreak-one

---

## 📋 QUICK REFERENCE

### Wo setzen?
**Vercel Dashboard** → Project Settings → Environment Variables

### Wie setzen?
Jede Variable separat hinzufügen mit:
- **Name:** Variable name (z.B. `STRIPE_SECRET_KEY`)
- **Value:** Der Wert (z.B. `sk_live_...`)
- **Environment:** Production / Preview / Development auswählen

---

## 🔴 PRODUCTION ENVIRONMENT (Live Mode)

**Wichtig:** Nur LIVE Stripe Keys in Production!

```bash
# === STRIPE (LIVE MODE!) ===
STRIPE_SECRET_KEY=sk_live_51SiyjiPZfPWUWCa1...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_51SiyjiPZfPWUWCa1...
STRIPE_WEBHOOK_SECRET=whsec_...

# === SUPABASE DATABASE ===
SUPABASE_URL=https://qnzsdytdghfukrqpscsg.supabase.co
SUPABASE_SERVICE_ROLE_KEY=sb_secret_j9BVv-3n4lzRyXjFKgilBw_VPlqXwut
NEXT_PUBLIC_SUPABASE_URL=https://qnzsdytdghfukrqpscsg.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_X8GyhtannQqQdR0n4UjQIA_Qk2nLLmU

DATABASE_URL=postgresql://postgres.qnzsdytdghfukrqpscsg:Haw$76aii_Urwyler@aws-1-eu-west-1.pooler.supabase.co:6543/postgres?pgbouncer=true
DIRECT_URL=postgresql://postgres.qnzsdytdghfukrqpscsg:Haw$76aii_Urwyler@aws-1-eu-west-1.pooler.supabase.co:5432/postgres

# === NEXTAUTH ===
NEXTAUTH_SECRET=uE2cWwmLfCICyk3S1yak+0/wDfGdzspeCwhrwnZswKs=
NEXTAUTH_URL=https://www.unbreak-one.com

# === RESEND EMAIL ===
RESEND_API_KEY=re_4gT8QKmw_HjRrtBPJP3Ntqank5TXzmPyc
EMAILS_ENABLED=true
RESEND_FROM=UNBREAK ONE <noreply@unbreak-one.de>
SHOP_OWNER_EMAIL=shop@unbreak-one.de

# === ADMIN PANEL ===
ADMIN_API_KEY=K0ZUzL5rWPxK7nmdudjVJ9mG9k9EHMXRcKUBkiAYCjw=
NEXT_PUBLIC_ADMIN_API_KEY=K0ZUzL5rWPxK7nmdudjVJ9mG9k9EHMXRcKUBkiAYCjw=
ADMIN_SEED_EMAIL=admin@unbreak-one.com
ADMIN_SEED_PASSWORD=changeMe123!

# === FEATURE FLAGS ===
NEXT_PUBLIC_DEBUG=false
CHECKOUT_ENABLED=true
NODE_ENV=production

# === EXTERNAL SERVICES ===
NEXT_PUBLIC_CONFIGURATOR_DOMAIN=https://unbreak-3-d-konfigurator.vercel.app
NEXT_PUBLIC_SITE_URL=https://www.unbreak-one.com
```

---

## 🟡 PREVIEW ENVIRONMENT (Test Mode)

**Wichtig:** Nutze TEST Stripe Keys in Preview!

```bash
# === STRIPE (TEST MODE!) ===
STRIPE_SECRET_KEY=sk_test_your_test_key_here
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_your_test_key_here
STRIPE_WEBHOOK_SECRET=whsec_your_test_secret_here

# === ALLE ANDEREN GLEICH WIE PRODUCTION ===
# (Database, Auth, Email, etc.)
# NUR Stripe Keys sind unterschiedlich!

# === FEATURE FLAGS (optional unterschiedlich) ===
NEXT_PUBLIC_DEBUG=true
EMAILS_ENABLED=false  # Optional: Keine Emails in Preview
```

---

## 🟢 DEVELOPMENT ENVIRONMENT

**Für lokale Vercel CLI Deploys**

```bash
# Gleich wie PREVIEW (Test Mode Stripe Keys)
```

---

## ⚠️ KRITISCHE SICHERHEITSHINWEISE

### ❌ NIEMALS in Production:
- `sk_test_...` (Test Secret Key)
- `pk_test_...` (Test Publishable Key)
- Debug-Werte wie `NEXT_PUBLIC_DEBUG=true`

### ✅ IMMER in Production:
- `sk_live_...` (Live Secret Key)
- `pk_live_...` (Live Publishable Key)
- `NODE_ENV=production`
- `CHECKOUT_ENABLED=true`

### 🔒 Server-Side Only (niemals NEXT_PUBLIC_):
- `STRIPE_SECRET_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `NEXTAUTH_SECRET`
- `RESEND_API_KEY`
- `ADMIN_API_KEY` (ohne NEXT_PUBLIC_)
- `DATABASE_URL`
- `ADMIN_SEED_PASSWORD`

### 🌐 Client-Side Safe (kann NEXT_PUBLIC_ haben):
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SITE_URL`
- `NEXT_PUBLIC_CONFIGURATOR_DOMAIN`
- `NEXT_PUBLIC_DEBUG`

---

## 🔄 DEPLOYMENT WORKFLOW

### 1. Neue Variable hinzufügen:

```bash
# Vercel Dashboard:
1. Settings → Environment Variables
2. Add New → Name: NEUE_VARIABLE
3. Value: [wert]
4. Select Environment(s)
5. Save
```

### 2. Deployment auslösen:

```bash
# Option A: Neuer Git Push
git push origin master

# Option B: Vercel Dashboard
Deployments → Redeploy

# Option C: Vercel CLI
vercel --prod
```

### 3. Verifizieren:

```bash
# Check Vercel Logs nach Deployment
https://vercel.com/supervisor77dw-debugs-projects/unbreak-one/deployments

# Suche nach:
"🔑 [STRIPE ACCOUNT] Mode: LIVE"  # ✅ Sollte LIVE sein
"🔑 [STRIPE ACCOUNT] Mode: TEST"  # ❌ Falsch in Production!
```

---

## 🛠️ TROUBLESHOOTING

### Problem: "STRIPE_SECRET_KEY is not defined"

**Lösung:**
```bash
1. Vercel Dashboard → Environment Variables prüfen
2. Sicherstellen dass Variable in richtiger Environment gesetzt ist
3. Redeploy auslösen
```

### Problem: "Webhook signature verification failed"

**Lösung:**
```bash
1. Stripe Dashboard → Webhooks → Endpoint bearbeiten
2. Webhook Secret kopieren (whsec_...)
3. In Vercel als STRIPE_WEBHOOK_SECRET setzen
4. Redeploy
```

### Problem: Payments laufen im Test Mode trotz Live Keys

**Lösung:**
```bash
1. Check .env.local lokal - sollte TEST Keys haben
2. Check Vercel Production Environment - sollte LIVE Keys haben
3. Vercel Logs prüfen: "Mode: LIVE" oder "Mode: TEST"?
4. Falls falsch: Keys in Vercel korrigieren, redeploy
```

### Problem: Admin kann sich nicht einloggen

**Lösung:**
```bash
1. NEXTAUTH_SECRET gesetzt? (in allen Environments gleich)
2. NEXTAUTH_URL korrekt?
   - Production: https://www.unbreak-one.com
   - Preview: https://xxx.vercel.app
   - Local: http://localhost:3000
3. SUPABASE_SERVICE_ROLE_KEY gesetzt?
4. ADMIN_SEED_EMAIL/PASSWORD korrekt?
```

---

## 📊 AKTUELLER STATUS (17.01.2026)

**Lokale Entwicklung (.env.local):**
- ✅ Bereinigt (keine Duplikate)
- ✅ TEST Stripe Keys (sk_test_...)
- ✅ Gruppiert & dokumentiert

**Vercel Production:**
- ⚠️ **MUSS NOCH GEPRÜFT WERDEN!**
- ❓ Sind LIVE Stripe Keys gesetzt? (sk_live_...)
- ❓ Oder noch TEST Keys? (sk_test_...)

**Vercel Preview:**
- ✅ Sollte TEST Keys haben
- ✅ Gleiche Config wie lokal

---

## 🎯 NEXT STEPS

**VOR LIVE-GO:**
1. [ ] Vercel Dashboard öffnen
2. [ ] Production Environment Variables prüfen
3. [ ] **STRIPE_SECRET_KEY** = `sk_live_...` setzen (nicht sk_test!)
4. [ ] **NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY** = `pk_live_...` setzen
5. [ ] Redeploy auslösen
6. [ ] Vercel Logs prüfen: "Mode: LIVE"
7. [ ] Test-Checkout mit 1 Cent durchführen

**NACH LIVE-GO:**
1. [ ] Admin-Passwort ändern (nicht mehr `changeMe123!`)
2. [ ] ADMIN_SEED_PASSWORD aus Vercel entfernen (nicht mehr nötig)
3. [ ] Webhook Logs in Stripe prüfen (erfolgreich delivered?)

---

## 📚 LINKS

- **Vercel Dashboard:** https://vercel.com/supervisor77dw-debugs-projects/unbreak-one
- **Stripe Dashboard:** https://dashboard.stripe.com/
- **Supabase Dashboard:** https://supabase.com/dashboard/project/qnzsdytdghfukrqpscsg
- **Resend Dashboard:** https://resend.com/

---

**Ende des Setup Guides**
