# 🧪 VERCEL STAGING DEPLOYMENT - SETUP GUIDE

**Branch:** `staging`  
**Zweck:** E2E-Tests mit Stripe Test Mode (keine echten Zahlungen)

---

## 📋 VERCEL DEPLOYMENT

### 1. Automatisches Preview Deployment

Vercel erstellt automatisch ein Preview Deployment für den `staging` Branch:

**Preview URL:** `https://unbreak-one-git-staging-[projekt-slug].vercel.app`

Oder im Vercel Dashboard:
1. Projekt öffnen: https://vercel.com/[dein-team]/unbreak-one
2. **Deployments** Tab
3. Branch Filter: `staging` auswählen
4. Neuestes Deployment anklicken → **Visit** Button

---

## ⚙️ ENVIRONMENT VARIABLES KONFIGURIEREN

### Im Vercel Dashboard:

**Settings** → **Environment Variables** → Preview Environment

```bash
# === STRIPE CONFIGURATION (TEST MODE) ===
STRIPE_MODE=test

# Stripe Test Keys (aus Stripe Dashboard → Test Mode → API Keys)
STRIPE_SECRET_KEY=sk_test_51...
STRIPE_PUBLISHABLE_KEY=pk_test_51...

# Stripe Webhook Secret (wird im nächsten Schritt erstellt)
STRIPE_WEBHOOK_SECRET=whsec_...

# === DATABASE (gleiche wie Production) ===
SUPABASE_URL=https://[projekt-id].supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# === EMAIL (Optional - gleich wie Production) ===
EMAILS_ENABLED=true
RESEND_API_KEY=re_...

# === AUTH (gleich wie Production) ===
NEXTAUTH_URL=https://unbreak-one-git-staging-[projekt-slug].vercel.app
NEXTAUTH_SECRET=[gleicher Secret wie Production]

# === SITE CONFIG ===
NEXT_PUBLIC_SITE_URL=https://unbreak-one-git-staging-[projekt-slug].vercel.app
```

**WICHTIG:** Nach dem Setzen der Environment Variables:
- **Redeploy** triggern: Deployments → Latest → Redeploy

---

## 🪝 STRIPE WEBHOOK SETUP

### 1. Stripe Dashboard öffnen

- https://dashboard.stripe.com
- **Test Mode** aktivieren (Toggle oben rechts)

### 2. Webhook erstellen

**Developers** → **Webhooks** → **Add endpoint**

**Endpoint URL:**
```
https://unbreak-one-git-staging-[projekt-slug].vercel.app/api/webhooks/stripe
```

**Events to send:**
- `checkout.session.completed`
- `payment_intent.succeeded`
- `customer.created`
- `customer.updated`

### 3. Signing Secret kopieren

Nach dem Erstellen:
1. Webhook anklicken
2. **Signing secret** anzeigen (whsec_...)
3. Kopieren

### 4. In Vercel einfügen

**Vercel Dashboard** → **Settings** → **Environment Variables**

```bash
STRIPE_WEBHOOK_SECRET=whsec_...
```

**Redeploy** triggern!

---

## 🧪 TEST-WORKFLOW

### 1. Staging-URL öffnen

```
https://unbreak-one-git-staging-[projekt-slug].vercel.app
```

**Erwartung:** Orange Test-Banner oben sichtbar:
> ⚠️ TESTMODUS AKTIV – Keine echten Zahlungen – Nur für Tests

### 2. Konfigurator durchlaufen

1. Produkt auswählen (z.B. Glashalter)
2. Konfiguration anpassen (Farbe, Optionen)
3. **In den Warenkorb** klicken

### 3. Checkout mit Test-Karte

**Warenkorb öffnen** → **Zur Kasse**

**Stripe Test-Karten:**

| Kartennummer | Beschreibung |
|--------------|--------------|
| `4242 4242 4242 4242` | ✅ Erfolgreiche Zahlung |
| `4000 0025 0000 3155` | 🔐 3D Secure Authentication |
| `4000 0000 0000 9995` | ❌ Insufficient funds (declined) |

**Test-Daten:**
- CVV: `123` (beliebig)
- Ablaufdatum: `12/28` (beliebiges zukünftiges Datum)
- PLZ: `10115` (beliebig)
- Name: `Test User` (beliebig)

### 4. Webhook Logs prüfen

**Vercel Dashboard** → **Deployments** → Staging → **Runtime Logs**

**Erwartete Logs:**
```
✅ [SIGNATURE] Verified OK
📥 [EVENT] Type: checkout.session.completed
🔒 [STRIPE MODE] Event livemode=false, Server mode=test
```

### 5. Order im Admin Panel prüfen

**Admin Login:**
```
https://unbreak-one-git-staging-[projekt-slug].vercel.app/admin/orders
```

**Order-Details prüfen:**
- Status: `paid`
- Metadata: `"stripe_mode": "test"`
- Customer Email: E-Mail aus Checkout

### 6. Email-Bestätigung

Falls `EMAILS_ENABLED=true`:
- Bestätigungs-E-Mail sollte ankommen
- Betreff: Bestellbestätigung

---

## 🔍 DEBUGGING

### Test-Banner nicht sichtbar?

**Browser Console öffnen (F12):**
```javascript
fetch('/api/stripe-mode').then(r => r.json()).then(console.log)
```

**Erwartete Response:**
```json
{
  "mode": "test",
  "isTestMode": true,
  "isLiveMode": false
}
```

### Checkout schlägt fehl?

**Vercel Runtime Logs prüfen:**
1. Vercel Dashboard → Deployments → Staging
2. **Functions** Tab
3. `/api/checkout/standard` suchen
4. Logs prüfen auf:
   - `🧪 [STRIPE CHECKOUT] Test mode - checkout allowed`
   - `✅ [STRIPE CONFIG] Mode: TEST, Keys validated`

### Webhook kommt nicht an?

**Stripe Dashboard → Webhooks → Event log:**
- Events sollten als `test mode` markiert sein
- HTTP Status: `200 OK`
- Response: `{"received":true}`

**Falls 400/500 Error:**
- Vercel Runtime Logs prüfen
- Signature-Validierung fehlgeschlagen? → `STRIPE_WEBHOOK_SECRET` prüfen

---

## ✅ SUCCESS CHECKLIST

Staging ist richtig konfiguriert wenn:

- [ ] Preview URL erreichbar
- [ ] Orange Test-Banner sichtbar
- [ ] Environment Variables gesetzt (insb. `STRIPE_MODE=test`)
- [ ] Stripe Webhook erstellt (Test Mode)
- [ ] Checkout mit `4242 4242 4242 4242` funktioniert
- [ ] Webhook empfängt `checkout.session.completed` Event
- [ ] Order wird in DB angelegt mit `stripe_mode: test`
- [ ] Email-Bestätigung verschickt (falls enabled)
- [ ] Logs zeigen `Test mode - checkout allowed`

---

## 🚫 FEHLER VERMEIDEN

### NIEMALS in Staging:

❌ **Live Stripe Keys** (`sk_live_...`, `pk_live_...`)  
→ `lib/stripe-config.js` wirft automatisch Error

❌ **STRIPE_MODE=live**  
→ Staging ist IMMER Test-Mode

❌ **Production Webhook URL**  
→ Test-Webhooks müssen auf Staging-URL zeigen

---

## 🔄 NACH DER MESSE: PRODUCTION DEPLOYMENT

Wenn Staging getestet und bereit:

1. **Staging zu Master mergen:**
   ```bash
   git checkout master
   git merge staging
   git push origin master
   ```

2. **Vercel Production Environment Variables:**
   ```bash
   STRIPE_MODE=live
   STRIPE_SECRET_KEY=sk_live_...
   STRIPE_PUBLISHABLE_KEY=pk_live_...
   STRIPE_WEBHOOK_SECRET=whsec_... (Live Webhook Secret)
   ```

3. **Stripe Live Webhook erstellen:**
   - URL: `https://unbreak-one.com/api/webhooks/stripe`
   - Events: gleiche wie Test-Webhook
   - **Live Mode** aktiviert

4. **Test-Banner verschwindet automatisch** (da `STRIPE_MODE=live`)

---

## 📞 SUPPORT

**Probleme beim Setup?**

**Vercel Logs:** https://vercel.com/[team]/unbreak-one/deployments  
**Stripe Test Dashboard:** https://dashboard.stripe.com/test  
**Supabase Logs:** https://supabase.com/dashboard/project/[projekt-id]/logs

**Quick Checks:**
```bash
# Environment Variables prüfen
curl https://[staging-url]/api/stripe-mode

# Webhook testen (Stripe CLI)
stripe listen --forward-to https://[staging-url]/api/webhooks/stripe
```
