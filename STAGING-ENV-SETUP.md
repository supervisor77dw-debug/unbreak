# 🚀 STAGING ENVIRONMENT SETUP

**Datum:** 18. Januar 2026  
**Branch:** `staging`  
**Basis:** LIVE-Stand (master @ 504d7bc)  
**Vercel Preview:** Automatisch bei Push zu `staging`

---

## ⚙️ VERCEL ENVIRONMENT VARIABLES (Preview)

### 📍 Vercel Dashboard Navigation:
1. https://vercel.com → Projekt `unbreak-one`
2. **Settings** → **Environment Variables**
3. **Filter:** `Preview` (wichtig!)

---

## 🔑 ERFORDERLICHE ENV-VARIABLEN (Staging/Preview)

### 1️⃣ STRIPE (TEST MODE - KRITISCH!)

```bash
# Stripe Modus (MUSS 'test' sein!)
STRIPE_MODE=test

# Stripe Test Secret Key (Backend)
STRIPE_SECRET_KEY=sk_test_REDACTED

# Stripe Test Publishable Key (Frontend)
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_XXXXXXXXXXXXXXXXXXXXXXXXXXXX

# Webhook Secret (Stripe Test Dashboard → Webhooks)
STRIPE_WEBHOOK_SECRET=whsec_REDACTED
```

**⚠️ WICHTIG:**
- Verwende **NUR Test-Keys** (`sk_test_...`, `pk_test_...`)
- **NIEMALS** Live-Keys in Staging!
- Test-Webhook für Staging URL erstellen:
  - Stripe Dashboard → Developers → Webhooks → Add Endpoint (Test Mode)
  - URL: `https://unbreak-78ts28s8h-supervisor77dw-debugs-projects.vercel.app/api/webhooks/stripe`
  - Events: `checkout.session.completed`, `payment_intent.succeeded`

---

### 2️⃣ SUPABASE (Shared oder Separate DB)

```bash
# Supabase URL
SUPABASE_URL=https://XXXXXXXXXXXXXXXXXXXX.supabase.co

# Supabase Service Role Key (Backend)
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Supabase Anon Key (Frontend - optional)
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Optionen:**
- **Option A (empfohlen):** Separate Test-Datenbank für Staging
- **Option B:** Shared DB mit Production (mit `is_test` Flag)

---

### 3️⃣ EMAIL (Resend)

```bash
# Email Service aktivieren (true/false)
EMAILS_ENABLED=true

# Resend API Key
RESEND_API_KEY=re_XXXXXXXXXXXXXXXXXXXXXXXXXXXX

# Email-Absender Domain
EMAIL_FROM_DOMAIN=unbreak-one.com
```

**Staging-Spezifisch:**
- Optional: `EMAILS_ENABLED=false` (für Preview ohne Mail-Versand)
- Oder: Alle Test-Mails an `admin@unbreak-one.com` (bereits via BCC)

---

### 4️⃣ SITE CONFIG

```bash
# Public Site URL (für Redirects)
NEXT_PUBLIC_SITE_URL=https://unbreak-78ts28s8h-supervisor77dw-debugs-projects.vercel.app

# Node Environment
NODE_ENV=production
```

---

### 5️⃣ OPTIONAL (wenn benötigt)

```bash
# Checkout Feature Flag (Notfall-Kill-Switch)
CHECKOUT_ENABLED=true

# Admin Auth (NextAuth - falls verwendet)
NEXTAUTH_URL=https://unbreak-78ts28s8h-supervisor77dw-debugs-projects.vercel.app
NEXTAUTH_SECRET=<generate-with: openssl rand -base64 32>
```

---

## 🧪 STRIPE TEST MODE - VALIDIERUNG

### Automatische Validierung (lib/stripe-config.js):

```javascript
// STRIPE_MODE=test → Erzwingt Test-Keys
if (STRIPE_MODE === 'test') {
  if (!secretKey.startsWith('sk_test_')) {
    throw new Error('STRIPE_MODE=test requires sk_test_* key');
  }
  if (publishableKey && !publishableKey.startsWith('pk_test_')) {
    throw new Error('STRIPE_MODE=test requires pk_test_* key');
  }
}
```

**Webhook-Filter:**
```javascript
// Nur Test-Events werden verarbeitet (event.livemode === false)
if (!shouldProcessWebhookEvent(event)) {
  return res.status(200).json({ 
    skipped: true, 
    reason: 'mode_mismatch' 
  });
}
```

---

## 🎯 DEPLOYMENT WORKFLOW

### 1. Code-Änderung testen:
```bash
git checkout staging
git merge master --no-edit
git push origin staging
```

### 2. Vercel deployt automatisch:
- **Preview URL:** https://unbreak-78ts28s8h-supervisor77dw-debugs-projects.vercel.app
- **Build Zeit:** ~2 Minuten
- **ENV:** Automatisch `Preview`-Variablen

### 3. Test durchführen:
```bash
# Stripe Test-Card
4242 4242 4242 4242
CVC: 123
Datum: 12/34

# Erwartetes Ergebnis:
✅ Checkout zeigt Test-Mode Banner (orange)
✅ Zahlung erfolgreich
✅ Webhook verarbeitet Event (livemode=false)
✅ Order in DB mit is_test=true
✅ Email an Kunde + BCC Support
```

---

## 📊 MONITORING & DEBUGGING

### Vercel Logs:
```
Vercel Dashboard → Deployments → [Latest Preview] → Logs
```

**Wichtige Log-Zeilen:**
```
🔒 [STRIPE MODE] Event livemode=false, Server mode=test
✅ [WEBHOOK] Processing test mode event
📧 [EMAIL] Sending to customer (BCC: admin@unbreak-one.com)
```

### Stripe Dashboard (Test Mode):
```
Stripe Dashboard → Developers → Events
→ Filter: checkout.session.completed
→ Check: livemode=false
```

---

## ⚠️ WICHTIGE UNTERSCHIEDE ZU PRODUCTION

| Feature | Production (master) | Staging (staging) |
|---------|-------------------|-------------------|
| **Branch** | `master` | `staging` |
| **Stripe** | Live-Keys | **Test-Keys** |
| **Webhook** | Live-Mode Events | **Test-Mode Events** |
| **DB Orders** | `is_test=false` | **`is_test=true`** |
| **URL** | unbreak-one.com | vercel.app Preview |
| **ENV Scope** | Production | **Preview** |

---

## 🚨 KRITISCHE CHECKS VOR GO-LIVE

### Pre-Flight Checklist:

- [ ] `STRIPE_MODE=test` in Staging Preview ENV
- [ ] `sk_test_...` Secret Key gesetzt
- [ ] `pk_test_...` Publishable Key gesetzt
- [ ] Staging Webhook URL in Stripe Dashboard (Test Mode)
- [ ] Test-Bestellung erfolgreich (4242 Card)
- [ ] Email mit vollständiger Adresse + Telefon
- [ ] Support-Mail (BCC) enthält alle Daten
- [ ] Backend zeigt Order mit `is_test=true`
- [ ] **KEINE Live-Keys in Staging ENV!**

---

## 🔄 UPDATE WORKFLOW (Master → Staging)

Wenn LIVE-Stand zu Staging synchronisiert werden soll:

```bash
# 1. Sicherstellen, dass master aktuell ist
git checkout master
git pull origin master

# 2. Staging aktualisieren
git checkout staging
git merge master --no-edit

# 3. Push triggert automatisch Vercel Preview
git push origin staging

# 4. Warte ~2 Min für Deployment
# 5. Test mit Stripe Test-Card durchführen
```

---

## 🎨 VISUELLE UNTERSCHEIDUNG

### Test-Mode Banner (orange):
```html
<!-- Automatisch sichtbar wenn STRIPE_MODE=test -->
<div class="test-mode-banner">
  ⚠️ TEST-MODUS AKTIV - Keine echten Zahlungen
</div>
```

**Component:** `components/TestModeBanner.js`  
**API:** `/api/stripe-mode` → Returns `{ mode: 'test' }`

---

## 📝 NÄCHSTE SCHRITTE

1. **Vercel ENV setzen** (siehe oben)
2. **Stripe Test-Webhook erstellen**
3. **Test-Bestellung durchführen**
4. **Logs prüfen** (Vercel + Stripe)
5. **Freigabe für Produktion** (nach erfolgreichem Test)

---

## 🆘 TROUBLESHOOTING

### Problem: "Missing STRIPE_SECRET_KEY"
**Lösung:** ENV-Variable in Vercel Preview setzen (nicht Production!)

### Problem: "mode_mismatch - Event skipped"
**Lösung:** `STRIPE_MODE=test` setzen ODER Webhook livemode checken

### Problem: "No order found for session"
**Lösung:** Metadata `order_id` im Checkout prüfen (sollte UUID sein)

### Problem: Email fehlt Adresse
**Lösung:** Bereits gefixt in 504d7bc - Staging hat neuesten Stand

---

**Erstellt:** 2026-01-18  
**Basis:** LIVE-Stand @ 504d7bc  
**Status:** ✅ Ready for Testing
