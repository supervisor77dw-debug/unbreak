# ⚡ QUICK REFERENCE: Vercel ENV Variables (Staging)

**Scope:** `Preview` (nicht Production!)  
**Dashboard:** https://vercel.com → unbreak-one → Settings → Environment Variables

---

## 🔑 KOPIER-VORLAGE (Stripe Test-Keys einsetzen!)

```bash
# ============================================
# 1️⃣ STRIPE TEST MODE (KRITISCH!)
# ============================================
STRIPE_MODE=test
STRIPE_SECRET_KEY=sk_test_DEIN_TEST_SECRET_KEY_HIER
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_DEIN_TEST_PUBLISHABLE_KEY_HIER
STRIPE_WEBHOOK_SECRET=whsec_DEIN_TEST_WEBHOOK_SECRET_HIER

# ============================================
# 2️⃣ SUPABASE (DB Connection)
# ============================================
SUPABASE_URL=https://DEINE_SUPABASE_ID.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# ============================================
# 3️⃣ EMAIL (Resend)
# ============================================
EMAILS_ENABLED=true
RESEND_API_KEY=re_DEIN_RESEND_KEY_HIER
EMAIL_FROM_DOMAIN=unbreak-one.com

# ============================================
# 4️⃣ SITE CONFIG
# ============================================
NEXT_PUBLIC_SITE_URL=https://unbreak-78ts28s8h-supervisor77dw-debugs-projects.vercel.app
NODE_ENV=production

# ============================================
# 5️⃣ OPTIONAL
# ============================================
CHECKOUT_ENABLED=true
```

---

## 📋 VERCEL DASHBOARD - SCHRITT FÜR SCHRITT

1. **Login:** https://vercel.com
2. **Projekt:** `unbreak-one` öffnen
3. **Settings** → **Environment Variables**
4. **Filter:** `Preview` auswählen (NICHT Production!)
5. **Add Variable:**
   - Name: `STRIPE_MODE`
   - Value: `test`
   - Environment: ✅ **Preview** (Production NICHT ankreuzen!)
   - Save
6. Wiederhole für alle anderen Variablen oben

---

## ⚠️ KRITISCHE CHECKS

### ✅ Richtige Environment-Scope:
- ✅ **Preview** angehakt
- ❌ **Production** NICHT angehakt
- ❌ **Development** NICHT angehakt

### ✅ Stripe Test-Keys validieren:
```bash
# Secret Key muss starten mit:
sk_test_

# Publishable Key muss starten mit:
pk_test_

# Webhook Secret muss starten mit:
whsec_
```

### ✅ Stripe Test-Webhook URL:
```
https://unbreak-78ts28s8h-supervisor77dw-debugs-projects.vercel.app/api/webhooks/stripe
```

**Stripe Dashboard Setup:**
1. https://dashboard.stripe.com/test/webhooks
2. "Add endpoint"
3. URL: (siehe oben)
4. Events: `checkout.session.completed`, `payment_intent.succeeded`
5. Copy Signing Secret → `STRIPE_WEBHOOK_SECRET`

---

## 🧪 VALIDATION COMMANDS

### Nach ENV-Setup, neues Deployment triggern:
```bash
git checkout staging
git commit --allow-empty -m "chore: Trigger Vercel redeploy"
git push origin staging
```

### Vercel Logs prüfen:
```
Vercel Dashboard → Deployments → [Latest Preview] → Logs
```

**Erwartete Log-Zeilen:**
```
[STRIPE CONFIG] Mode: test
[STRIPE CONFIG] Secret key: sk_test_***
[STRIPE CONFIG] Publishable key: pk_test_***
✅ [STRIPE CONFIG] Test mode keys validated
```

---

## 🎯 TEST-BESTELLUNG DURCHFÜHREN

1. **URL öffnen:**
   ```
   https://unbreak-78ts28s8h-supervisor77dw-debugs-projects.vercel.app
   ```

2. **Produkt in Warenkorb** → Checkout

3. **Test-Mode Banner prüfen:**
   ```
   ⚠️ TEST-MODUS AKTIV - Keine echten Zahlungen
   ```

4. **Stripe Test-Card:**
   ```
   Kartennummer: 4242 4242 4242 4242
   Ablaufdatum: 12/34
   CVC: 123
   Name: Test User
   ```

5. **Adresse eingeben:**
   ```
   Name: Max Mustermann
   Telefon: +49 123 456789
   Straße: Teststraße 123
   PLZ: 12345
   Ort: Berlin
   Land: Deutschland
   ```

6. **Zahlung abschließen**

---

## ✅ ERWARTETES ERGEBNIS

### Frontend:
- ✅ Test-Mode Banner sichtbar (orange)
- ✅ Checkout erfolgreich
- ✅ Success-Page mit Bestellnummer

### Backend (Vercel Logs):
```
📦 [Checkout] Creating order...
✅ [Checkout] Order created: UO-2026-000XXX
💳 [STRIPE] Session created
🔒 [STRIPE MODE] Event livemode=false, Server mode=test
✅ [WEBHOOK] Processing test event
📧 [EMAIL] Sending to customer
```

### Stripe Dashboard (Test Mode):
- ✅ Payment erfolgreich
- ✅ Event `checkout.session.completed` (livemode=false)
- ✅ Webhook Delivery erfolgreich

### Datenbank:
```sql
SELECT 
  order_number,
  customer_email,
  customer_phone,
  shipping_address,
  is_test
FROM simple_orders
WHERE order_number = 'UO-2026-000XXX';

-- Erwartung:
-- is_test = true ✅
-- customer_phone = '+49 123 456789' ✅
-- shipping_address = {JSON mit vollständiger Adresse} ✅
```

### Email (Kunde):
- ✅ Bestellnummer
- ✅ Positionen mit Preisen
- ✅ **Lieferadresse (📍)**
- ✅ Zwischensumme, Versand, Gesamt

### Email (Support BCC):
- ✅ Kundenname, Email, **Telefon (📞)**
- ✅ **Vollständige Lieferadresse (📍)**
- ✅ Alle Preisdetails

---

## 🚨 TROUBLESHOOTING

### Problem: "Missing STRIPE_SECRET_KEY"
**Ursache:** ENV nicht in Preview Scope gesetzt  
**Lösung:** Vercel Dashboard → ENV → Scope auf "Preview" setzen

### Problem: Keine Logs sichtbar
**Ursache:** Deployment nicht neu getriggert nach ENV-Änderung  
**Lösung:** Empty Commit + Push (siehe Validation Commands)

### Problem: "mode_mismatch" in Logs
**Ursache:** `STRIPE_MODE` nicht auf `test` gesetzt  
**Lösung:** ENV-Variable hinzufügen/korrigieren

### Problem: Live-Keys in Staging
**Ursache:** Production ENV statt Preview  
**Lösung:** ⚠️ **SOFORT** ENV löschen und in Preview neu setzen!

---

## 📞 SUPPORT

Bei Problemen:
1. Vercel Logs prüfen
2. Stripe Dashboard → Events prüfen
3. STAGING-ENV-SETUP.md lesen (vollständige Doku)

---

**Letzte Aktualisierung:** 2026-01-18  
**Branch:** `staging` @ 8919fd9  
**Status:** ✅ Ready for ENV Setup
