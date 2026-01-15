# E-MAIL VERSAND TEST GUIDE – Messe-Ready

## 🎯 Problem gelöst: EMAILS_ENABLED fehlte!

**Root Cause:** Die Environment Variable `EMAILS_ENABLED` fehlte komplett.
- ❌ Vorher: Email-Service lief im Preview-Modus (keine echten Sends)
- ✅ Jetzt: `EMAILS_ENABLED=true` gesetzt

---

## 📋 Was wurde implementiert

### 1. ✅ Stripe Webhook (bereits vorhanden)
**Endpoint:** `/api/stripe/webhook`

**Supported Events:**
- `checkout.session.completed` → Order confirmation email
- `payment_intent.succeeded` → Payment record
- `charge.refunded` → Refund handling

**Security:**
- ✅ Webhook signature verification (STRIPE_WEBHOOK_SECRET)
- ✅ Idempotency check (processed_events table)
- ✅ Atomic operations

### 2. ✅ Resend Integration (server-side)
**From-Adressen (verbindlich):**
```
Orders:   UNBREAK ONE <orders@unbreak-one.com>
Support:  UNBREAK ONE Support <support@unbreak-one.com>
No-Reply: UNBREAK ONE <no-reply@unbreak-one.com>
Reply-To: support@unbreak-one.com (bei Order-Mails)
```

### 3. ✅ Enhanced Logging
Jeder Email-Versuch wird jetzt geloggt mit:
- `email_send_attempt` - Start des Versuchs
- `recipient` - Empfänger-Adresse
- `orderId`/`orderNumber` - Order-Referenz
- `EMAILS_ENABLED` Status
- `RESEND_API_KEY` Status (Set/Missing)
- Resend Response ID oder Error

**Log-Formate:**
```
✅ [EMAIL SUCCESS] - Email erfolgreich versendet
📋 [EMAIL PREVIEW MODE] - EMAILS_ENABLED=false (kein Send)
❌ [EMAIL FAILED] - Resend API Fehler
❌ [EMAIL EXCEPTION] - Unerwarteter Fehler
⚠️  [EMAIL SKIPPED] - Keine customer_email
```

### 4. ✅ Order-Mail Inhalt
- Ordernummer & Datum
- Produktliste (Name, Menge, Preis)
- Versandkosten & Gesamtsumme
- Lieferadresse
- Support-Kontakt
- Sprache: Deutsch (EN optional via metadata)

---

## 🔐 Environment Variables (CRITICAL)

### Lokale Entwicklung (.env.local) ✅
```bash
RESEND_API_KEY=re_4gT8QKmw_HjRrtBPJP3Ntqank5TXzmPyc
EMAILS_ENABLED=true  # ← JETZT gesetzt!
STRIPE_SECRET_KEY=sk_test_51SiyjiPZfPWUWCa1...
STRIPE_WEBHOOK_SECRET=whsec_37IH7f5icrdCS20UU76avUTX8FV45odC
```

### Vercel Preview (staging branch) ⚠️
**ACTION REQUIRED:** In Vercel Dashboard setzen:

1. **Gehe zu:** https://vercel.com/[team]/unbreak-one/settings/environment-variables

2. **Setze für "Preview":**
   ```
   EMAILS_ENABLED=true
   RESEND_API_KEY=re_4gT8QKmw_HjRrtBPJP3Ntqank5TXzmPyc
   STRIPE_SECRET_KEY=sk_test_51SiyjiPZfPWUWCa1...
   STRIPE_WEBHOOK_SECRET=whsec_37IH7f5icrdCS20UU76avUTX8FV45odC
   ```

3. **Redeploy Preview:**
   ```bash
   git commit --allow-empty -m "Trigger preview redeploy"
   git push origin staging
   ```

### Vercel Production (master branch) ⚠️
**ACTION REQUIRED:** Gleiche Variablen wie Preview, aber:
- Scope: **Production**
- Später: Live Stripe Keys verwenden (sk_live_...)

---

## 🧪 TEST-ANLEITUNG

### Test 1: Stripe Webhook (Lokal)

**Voraussetzung:** Stripe CLI installiert
```bash
# 1. Stripe CLI Login
stripe login

# 2. Webhook forwarding starten (Terminal offen lassen)
stripe listen --forward-to localhost:3000/api/stripe/webhook

# 3. Kopiere webhook secret (whsec_...)
# Setze in .env.local:
STRIPE_WEBHOOK_SECRET=whsec_xxx  # Von Stripe CLI

# 4. Test-Event senden
stripe trigger checkout.session.completed
```

**Expected Logs (lokaler Server):**
```
[Webhook] Received event: checkout.session.completed (evt_...)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📧 [EMAIL SEND ATTEMPT] Starting email send process
📧 [EMAIL] Recipient: customer@example.com
📧 [EMAIL] Order: TEST123
📧 [EMAIL] EMAILS_ENABLED: true
📧 [EMAIL] RESEND_API_KEY: ✅ Set
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ [EMAIL SUCCESS] Order confirmation sent!
✅ [EMAIL] Resend Email ID: re_abc123...
✅ [EMAIL] Recipient: customer@example.com
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

**Check:**
1. **Resend Dashboard:** https://resend.com/emails
   - Status: Delivered
   - From: UNBREAK ONE <orders@unbreak-one.com>
   - To: customer@example.com

2. **Inbox:** admin@unbreak-one.com (catch-all)
   - Betreff: "Bestellbestätigung - Bestellung #TEST123"
   - Inhalt: Produktliste, Summe, Adresse

---

### Test 2: Stripe Webhook (Preview Deployment)

**Webhook URL:** 
```
https://unbreak-one-git-staging-[hash].vercel.app/api/stripe/webhook
```

**Setup in Stripe Dashboard:**

1. **Gehe zu:** https://dashboard.stripe.com/test/webhooks

2. **Add endpoint:**
   - URL: `https://[preview-url]/api/stripe/webhook`
   - Events: 
     - `checkout.session.completed`
     - `payment_intent.succeeded`
     - `charge.refunded`

3. **Kopiere Signing Secret:**
   - Zeigt: `whsec_...`
   - Setze in Vercel ENV: `STRIPE_WEBHOOK_SECRET`

4. **Test mit echter Bestellung:**
   ```
   1. Öffne: https://[preview-url]/shop
   2. Produkt in Warenkorb
   3. Checkout → Stripe Test Payment
   4. Kreditkarte: 4242 4242 4242 4242 | 12/34 | 123
   5. Submit Payment
   ```

**Expected Result:**
- ✅ Stripe Dashboard → Event sent (200 OK)
- ✅ Vercel Logs → Email sent
- ✅ Resend Dashboard → Email delivered
- ✅ Inbox → Email received

---

### Test 3: Vercel Logs prüfen

**Logs anschauen:**

1. **Gehe zu:** https://vercel.com/[team]/unbreak-one/logs

2. **Filter:**
   - Deployment: staging (oder Preview URL)
   - Time: Last 1 hour
   - Search: `[EMAIL`

3. **Erwartete Logs:**
   ```
   📧 [EMAIL SEND ATTEMPT] Starting email send process
   📧 [EMAIL] Recipient: customer@example.com
   ✅ [EMAIL SUCCESS] Order confirmation sent!
   ✅ [EMAIL] Resend Email ID: re_abc123...
   ```

4. **Wenn EMAILS_ENABLED=false:**
   ```
   📋 [EMAIL PREVIEW MODE] EMAILS_ENABLED=false
   📋 [EMAIL] Email NOT sent (preview mode)
   📋 [EMAIL] To enable: Set EMAILS_ENABLED=true in Vercel ENV
   ```

5. **Bei Fehler:**
   ```
   ❌ [EMAIL FAILED] Email send failed!
   ❌ [EMAIL] Error: Invalid API key
   ```

---

## 🔍 Debugging Guide

### Problem: "Email NOT sent (preview mode)"

**Symptom:**
```
📋 [EMAIL PREVIEW MODE] EMAILS_ENABLED=false
```

**Fix:**
1. Check Vercel ENV: `EMAILS_ENABLED=true` gesetzt?
2. Scope korrekt? (Preview oder Production)
3. Redeploy nach ENV-Änderung

---

### Problem: "RESEND_API_KEY not configured"

**Symptom:**
```
❌ [EMAIL FAILED] Error: RESEND_API_KEY not configured
```

**Fix:**
1. Vercel Dashboard → Environment Variables
2. Setze: `RESEND_API_KEY=re_4gT8QKmw_...`
3. Scope: Preview UND Production
4. Redeploy

---

### Problem: "403 Forbidden" von Resend

**Symptom:**
```
❌ [EMAIL FAILED] Resend API error: 403 Forbidden
```

**Possible Causes:**
1. **API Key falsch:** Check Resend Dashboard → API Keys
2. **Domain nicht verifiziert:** 
   - Gehe zu: https://resend.com/domains
   - Check: unbreak-one.com status = "Verified"
   - DKIM/SPF records korrekt?
3. **Free Plan Limit:** Max 100 emails/day

---

### Problem: "No customer email"

**Symptom:**
```
⚠️  [EMAIL SKIPPED] No customer email found
```

**Fix:**
1. Check Checkout flow: customer_email wird gespeichert?
2. Check Stripe Session: customer_details.email vorhanden?
3. Check Order in DB: customer_email field populated?

---

### Problem: Webhook kommt nie an

**Symptom:**
- Stripe Dashboard zeigt 500 oder timeout
- Vercel Logs zeigen nichts

**Fix:**
1. **Check Webhook URL:** Richtige Domain?
2. **Check Signature Secret:** 
   ```bash
   # Logs sollten zeigen:
   [Webhook] Received event: checkout.session.completed
   ```
   Wenn nicht → Secret falsch
3. **Check Vercel Function Timeout:** Max 10s (Hobby Plan)

---

## 📊 Monitoring Checklist

### Nach jeder Bestellung prüfen:

**1. Stripe Dashboard**
- [ ] Event `checkout.session.completed` sent
- [ ] Response: 200 OK
- [ ] Kein retry nötig

**2. Vercel Logs**
- [ ] `[Webhook] Received event: checkout.session.completed`
- [ ] `📧 [EMAIL SEND ATTEMPT]`
- [ ] `✅ [EMAIL SUCCESS]` oder `❌ [EMAIL FAILED]`

**3. Resend Dashboard**
- [ ] Email status: "Delivered" (nicht "Bounced")
- [ ] From: `UNBREAK ONE <orders@unbreak-one.com>`
- [ ] To: Korrekte Kunden-Email

**4. Catch-All Inbox (admin@unbreak-one.com)**
- [ ] Email angekommen
- [ ] Ordernummer korrekt
- [ ] Produktliste korrekt
- [ ] Summe korrekt

**5. Supabase DB**
- [ ] Order status: `paid`
- [ ] Order `email_sent`: `true`
- [ ] Order `email_sent_at`: Timestamp
- [ ] Order `metadata.email_id`: Resend ID

---

## 🚀 Deployment Workflow

### Local → Staging → Production

**1. Local Test (JETZT):**
```bash
# .env.local hat EMAILS_ENABLED=true ✅
npm run dev

# Test mit Stripe CLI
stripe listen --forward-to localhost:3000/api/stripe/webhook
stripe trigger checkout.session.completed

# Check Logs in Terminal
# Check Resend Dashboard
```

**2. Commit & Push zu staging:**
```bash
git add pages/api/stripe/webhook.js .env.local
git commit -m "FIX: Email sending - Added EMAILS_ENABLED + enhanced logging"
git push origin staging
```

**3. Vercel Preview Setup:**
- Warte auf Deployment (~2 Min)
- Setze ENV in Vercel Dashboard (siehe oben)
- Redeploy Preview
- Test mit echter Bestellung

**4. Nach erfolgreichem Test → Production:**
```bash
git checkout master
git merge staging --no-ff -m "EMAIL FIX: Order confirmation emails working"
git push origin master
```

---

## 📧 Email-Template Vorschau

**Betreff:** Bestellbestätigung - Bestellung #UNBO-12345

**Inhalt:**
```
UNBREAK ONE

Vielen Dank für Ihre Bestellung!

Hallo Max Mustermann,

Wir haben Ihre Bestellung erhalten und werden sie schnellstmöglich bearbeiten.

Bestellübersicht
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Produkt                    Anzahl    Preis
LED Strip White 5m            2     €99.80
LED Controller RGB            1     €29.90
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Gesamt:                            €129.70

Lieferadresse
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Max Mustermann
Teststraße 123
12345 Berlin
DE

Bei Fragen kontaktieren Sie uns gerne unter:
support@unbreak-one.com

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
UNBREAK ONE
```

---

## ✅ MESSE-READY CHECKLIST

Vor Go-Live prüfen:

### Environment Variables
- [x] `RESEND_API_KEY` - Set ✅
- [x] `EMAILS_ENABLED=true` - Set ✅
- [x] `STRIPE_SECRET_KEY` - Set ✅
- [x] `STRIPE_WEBHOOK_SECRET` - Set ✅

### Resend Dashboard
- [ ] Domain unbreak-one.com verified
- [ ] DKIM records: Verified
- [ ] SPF records: Verified
- [ ] Test email sent & delivered

### Stripe Webhook
- [ ] Endpoint configured (Production URL)
- [ ] Events selected (checkout.session.completed)
- [ ] Signing secret set in ENV
- [ ] Test event successful (200 OK)

### Testing
- [ ] Local test: Email received
- [ ] Preview test: Email received
- [ ] Production test: Email received
- [ ] Catch-all works (admin@unbreak-one.com)

### Logs & Monitoring
- [ ] Vercel logs show email success
- [ ] Resend dashboard shows deliveries
- [ ] No errors in production

---

## 🆘 Emergency Contacts

**Bei Problemen während Messe:**

1. **Check Vercel Logs SOFORT:**
   - https://vercel.com/[team]/unbreak-one/logs
   - Filter: `[EMAIL`

2. **Check Resend Dashboard:**
   - https://resend.com/emails
   - Status: Delivered/Bounced?

3. **Fallback: Admin-Benachrichtigung:**
   - Catch-All: admin@unbreak-one.com
   - Prüfe Inbox manuell

4. **Quick Fix wenn kein Email:**
   - Check ENV: `EMAILS_ENABLED=true`?
   - Redeploy: `git commit --allow-empty -m "redeploy" && git push`

---

**Status:** ✅ Ready for Testing  
**Branch:** staging  
**Next Steps:** 
1. Push changes
2. Set Vercel ENV (Preview)
3. Test webhook
4. Check inbox
