# 🧪 MESSE-STAND FREEZE + STAGING TEST ENVIRONMENT

## Übersicht

**Datum:** 2026-01-18  
**Ziel:** Production-Freeze für Messe + separates Test-Deployment mit Stripe Test Mode

---

## ✅ Status

### Production (unbreak-one.com)
- ✅ **FROZEN** bei Git Tag: `messe-release-2026-01-18`
- ✅ Commit: `57f0d82`
- ⚠️ **KEINE DEPLOYMENTS** bis nach der Messe!

### Staging (Preview Deployment)
- Branch: `staging`
- Stripe Mode: **TEST ONLY**
- Zweck: E2E-Tests für Shop-Flow ohne Live-Payments

---

## 🔒 Stripe Test Mode Enforcement

### Technische Sicherungen

#### 1. Zentrale Config (`lib/stripe-config.js`)
- **Environment Variable:** `STRIPE_MODE=test` (default)
- **Key Validation:** Automatische Prüfung, dass Test-Keys mit `sk_test_` / `pk_test_` starten
- **Live Mode Guard:** Live-Keys werden in Staging automatisch abgelehnt

#### 2. Checkout API (`pages/api/checkout/*.js`)
- `guardCheckoutSession()` fügt Metadata hinzu: `stripe_mode: 'test'`
- Alle Sessions sind im Test-Mode markiert

#### 3. Webhook Handler (`pages/api/webhooks/stripe.js`)
- `shouldProcessWebhookEvent()` filtert Events nach `livemode` Flag
- Test-Events werden nur in Test-Mode verarbeitet
- Live-Events werden in Test-Mode ignoriert (mit Warnung)

#### 4. UI-Warnung (TestModeBanner)
- Orange Banner oben auf jeder Seite: **"⚠️ TESTMODUS AKTIV"**
- Nur sichtbar wenn `STRIPE_MODE=test`

---

## 🚀 Deployment Setup

### Environment Variables (Vercel Staging)

```bash
# Stripe Configuration
STRIPE_MODE=test

# Stripe Test Keys
STRIPE_SECRET_KEY=sk_test_... # Aus Stripe Dashboard → Test Mode
STRIPE_PUBLISHABLE_KEY=pk_test_... # Aus Stripe Dashboard → Test Mode

# Webhook Secret (supports multiple secrets)
# Format: Single secret OR multiple separated by |
# Example single: whsec_test_abc123
# Example multi: whsec_live_xyz|whsec_test_abc (both Live + Test)
STRIPE_WEBHOOK_SECRET=whsec_... # Webhook Endpoint für Staging

# Database (gleiche Supabase wie Production)
SUPABASE_URL=https://...supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ... # Gleicher Key

# Email (optional - kann disabled sein für Tests)
EMAILS_ENABLED=true
RESEND_API_KEY=re_... # Gleicher Key
```

### Stripe Dashboard Setup

1. **Test Mode aktivieren** (Toggle oben rechts)
2. **Webhook erstellen:**
   - URL: `https://staging-unbreak-one.vercel.app/api/webhooks/stripe`
   - Events: `checkout.session.completed`, `payment_intent.succeeded`
   - Signing Secret kopieren → `STRIPE_WEBHOOK_SECRET`

---

## 🧪 Testing Workflow

### Test-Kreditkarten (Stripe Test Mode)

| Karte | Beschreibung |
|-------|-------------|
| `4242 4242 4242 4242` | Erfolgreiche Zahlung |
| `4000 0025 0000 3155` | 3D Secure Authentication |
| `4000 0000 0000 9995` | Karte abgelehnt (insufficient funds) |

**Weitere Testdaten:**
- CVV: `123` (beliebig)
- Ablaufdatum: Beliebiges zukünftiges Datum
- Postleitzahl: Beliebig

### E2E Test-Flow

1. **Homepage:** Staging-URL öffnen → Test-Banner sichtbar
2. **Konfigurator:** Produkt konfigurieren (z.B. Glashalter)
3. **Warenkorb:** In den Warenkorb legen
4. **Checkout:** E-Mail eingeben → Checkout starten
5. **Stripe:** Test-Karte `4242 4242 4242 4242` verwenden
6. **Success Page:** Nach Zahlung → Success-Seite
7. **Webhook:** Logs in Vercel prüfen → `checkout.session.completed` verarbeitet
8. **Email:** Bestätigungs-E-Mail empfangen (wenn `EMAILS_ENABLED=true`)
9. **Admin Panel:** Order im Admin Panel sichtbar mit `stripe_mode: 'test'`

### Log-Checks

**Checkout API:**
```
🧪 [STRIPE CHECKOUT] Test mode - checkout allowed
✅ [STRIPE CONFIG] Mode: TEST, Keys validated
```

**Webhook:**
```
✅ [SIGNATURE] Verified OK
📥 [EVENT] Type: checkout.session.completed
🔒 [STRIPE MODE] Event livemode=false, Server mode=test
```

---

## 📊 Datenbank

### Orders Tabelle

Test-Orders sind markiert:
```sql
SELECT 
  order_number,
  status,
  metadata->>'stripe_mode' as stripe_mode,
  created_at
FROM orders
WHERE metadata->>'stripe_mode' = 'test'
ORDER BY created_at DESC;
```

### Trennung Test/Live

- **Test-Orders:** `metadata.stripe_mode = 'test'`
- **Live-Orders:** `metadata.stripe_mode = 'live'` (oder nicht gesetzt)

---

## ⚠️ WICHTIG: Production Safety

### Was ist geschützt?

1. **Git Tag `messe-release-2026-01-18`:** Production-State eingefroren
2. **Vercel Production:** Kein Auto-Deploy von `staging` Branch
3. **Stripe Live Keys:** Nicht in Staging Environment
4. **Database:** Gleiche DB, aber Test-Orders sind markiert

### Risiken

❌ **KEINE LIVE KEYS IN STAGING!**  
→ `lib/stripe-config.js` validiert automatisch und wirft Error bei Mismatch

❌ **PRODUCTION NICHT DEPLOYEN**  
→ `master` Branch bleibt beim Tag `messe-release-2026-01-18`

✅ **Staging kann beliebig oft deployed werden**  
→ Jeder Push zu `staging` Branch erstellt neues Preview Deployment

---

## 🔄 Nach der Messe: Live-Deployment

### Wenn alles getestet ist:

1. **Staging zu Master mergen:**
   ```bash
   git checkout master
   git merge staging
   git push origin master
   ```

2. **Vercel Production Environment Variables anpassen:**
   ```bash
   STRIPE_MODE=live
   STRIPE_SECRET_KEY=sk_live_...
   STRIPE_PUBLISHABLE_KEY=pk_live_...
   STRIPE_WEBHOOK_SECRET=whsec_... # Live Webhook Secret
   ```

3. **Stripe Webhook (Live Mode) erstellen:**
   - URL: `https://unbreak-one.com/api/webhooks/stripe`
   - Events: `checkout.session.completed`, `payment_intent.succeeded`

4. **Test-Banner verschwindet automatisch** (da `STRIPE_MODE=live`)

---

## 📝 Checklist

### Staging Setup
- [x] Git Tag `messe-release-2026-01-18` erstellt
- [x] Staging Branch erstellt
- [x] `lib/stripe-config.js` implementiert
- [x] Alle Checkout-APIs aktualisiert
- [x] Webhook-Filter implementiert
- [x] Test-Mode Banner erstellt
- [ ] Vercel Staging Environment Variables konfiguriert
- [ ] Stripe Test Webhook erstellt
- [ ] E2E Test durchgeführt

### Production Protection
- [x] Production frozen bei Tag
- [ ] Vercel Auto-Deploy für `staging` disabled (oder Preview-only)
- [ ] Team informiert: **KEINE PRODUCTION DEPLOYMENTS**

---

## 📞 Support

**Bei Problemen:**
- Vercel Logs prüfen: `https://vercel.com/your-team/unbreak-one/deployments`
- Stripe Logs prüfen: Stripe Dashboard → Logs
- Supabase Logs: Supabase Dashboard → Logs
- Database Orders: Admin Panel → Orders (Filter: Test Mode)

**Kontakt:** dirk@unbreak-one.com
