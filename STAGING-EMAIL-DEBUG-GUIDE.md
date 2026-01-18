# STAGING EMAIL DEBUG GUIDE

## Problem
Staging-Checkout läuft durch, aber E-Mails werden nicht versendet.

## Durchgeführte Maßnahmen (Commit 8eb2b11)

### ✅ 1. Email-Guards geprüft
- ❌ **KEINE** `STRIPE_MODE`-basierte Blockierung gefunden
- ❌ **KEINE** `NODE_ENV`-basierte Blockierung gefunden  
- ❌ **KEINE** `VERCEL_ENV`-basierte Blockierung gefunden
- ✅ **Nur** `EMAILS_ENABLED` kill-switch (wie gewünscht)

### ✅ 2. Comprehensive Email Tracing
Alle Logs enthalten jetzt `trace_id` für komplette Flow-Verfolgung:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📧 [EMAIL ATTEMPT] trace_id=abc-123
📧 [EMAIL] Recipient: customer@example.com (stripe_session)
📧 [EMAIL] BCC: admin@unbreak-one.com, orders@unbreak-one.com
📧 [EMAIL] Order: UO-2026-000123 (DB: UO-2026-000123, UUID: ...)
📧 [EMAIL] Items: 2 items, Total: 8999¢
📧 [EMAIL] Shipping Address: YES
📧 [EMAIL] Customer Phone: +49 123 456789
📧 [EMAIL] Language: de
📧 [ENV CHECK] EMAILS_ENABLED: true
📧 [ENV CHECK] RESEND_API_KEY: ✅ Set
📧 [ENV CHECK] STRIPE_MODE: test
📧 [ENV CHECK] NODE_ENV: production
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

Dann folgt:
```
[EMAIL SEND] trace_id=abc-123 - Calling sendOrderConfirmation with: {
  customerEmail: 'customer@example.com',
  orderNumber: 'UO-2026-000123',
  itemCount: 2,
  totalAmount: 8999,
  language: 'de',
  hasShippingAddress: true,
  hasPhone: true
}
```

### ✅ 3. Test-Mode Email Prefix
Staging-E-Mails sind jetzt klar gekennzeichnet:

- **Customer Email**: `[TEST] Bestellbestätigung UO-2026-000123 – UNBREAK ONE`
- **Support Email**: `[TEST] Neue Bestellung UO-2026-000123`

In Live (STRIPE_MODE=live) wird **kein Prefix** hinzugefügt.

---

## Test-Ablauf

### 1. Warte auf Vercel Deployment (~2 Minuten)
```
https://vercel.com/supervisor77dw-debugs-projects/unbreak/deployments
```

### 2. Öffne Staging-URL
```
https://unbreak-78ts28s8h-supervisor77dw-debugs-projects.vercel.app
```

### 3. Führe Test-Bestellung durch
- **Karte**: `4242 4242 4242 4242`
- **CVC**: `123`
- **Datum**: `12/34`
- **Name**: Max Mustermann
- **Phone**: +49 123 456789
- **Adresse**: Teststraße 123, 12345 Berlin, Deutschland

### 4. Öffne Vercel Logs (parallel zum Checkout)
```
1. https://vercel.com
2. → unbreak-one Projekt
3. → Deployments
4. → Neuestes Preview Deployment (staging branch)
5. → Logs Tab
6. → Suche nach: [EMAIL ATTEMPT]
```

---

## Erwartete Log-Szenarien

### ✅ SZENARIO A: EMAILS_ENABLED=false (Preview Mode)

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 [EMAIL PREVIEW] trace_id=abc-123 - EMAILS_ENABLED=false
📋 [EMAIL] Email NOT sent (preview mode)
📋 [EMAIL] Would send to: customer@example.com
📋 [EMAIL] Would BCC to: admin@unbreak-one.com
📋 [EMAIL] To enable: Set EMAILS_ENABLED=true in Vercel ENV
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

**Diagnose**: E-Mail-Versand ist deaktiviert (Preview Mode)  
**Lösung**: ENV in Vercel setzen:
```
EMAILS_ENABLED=true
Scope: Preview ✅ (NICHT Production!)
```

---

### ✅ SZENARIO B: EMAILS_ENABLED=true + RESEND_API_KEY gesetzt

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ [EMAIL SUCCESS] trace_id=abc-123 - Order confirmation sent!
✅ [EMAIL] Resend Email ID: re_AbCdEfGh123456
✅ [EMAIL] TO: customer@example.com (stripe_session)
✅ [EMAIL] BCC: admin@unbreak-one.com, orders@unbreak-one.com
✅ [EMAIL] Order: UO-2026-000123
✅ [EMAIL] Mode: test
[MAIL] send customer ok
[MAIL] send internal/bcc ok
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

**Diagnose**: E-Mail erfolgreich versendet ✅  
**Erwartung**:
- Customer Email: `[TEST] Bestellbestätigung UO-2026-000123` in Inbox
- Support Email (BCC): `[TEST] Neue Bestellung UO-2026-000123` in orders@unbreak-one.com

---

### ⚠️ SZENARIO C: RESEND_API_KEY fehlt

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
❌ [EMAIL FAILED] trace_id=abc-123 - Email send failed!
❌ [EMAIL] Error: [EMAIL] RESEND_API_KEY not configured
❌ [EMAIL] TO: customer@example.com (stripe_session)
❌ [EMAIL] Order: UO-2026-000123
❌ [EMAIL] EMAILS_ENABLED: true
❌ [EMAIL] RESEND_API_KEY: MISSING
❌ [EMAIL] STRIPE_MODE: test
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

**Diagnose**: Resend API Key fehlt  
**Lösung**: ENV in Vercel setzen:
```
RESEND_API_KEY=re_YourActualKeyHere
Scope: Preview ✅
```

---

### ⚠️ SZENARIO D: Resend API Error (z.B. falscher Key)

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
❌ [EMAIL SEND] Resend API error: Invalid API key
[RESEND ERROR] { error: { message: 'Invalid API key', ... } }
❌ [EMAIL FAILED] trace_id=abc-123 - Email send failed!
❌ [EMAIL] Error: Invalid API key
❌ [EMAIL] TO: customer@example.com
❌ [EMAIL] Order: UO-2026-000123
❌ [EMAIL] EMAILS_ENABLED: true
❌ [EMAIL] RESEND_API_KEY: SET
❌ [EMAIL] STRIPE_MODE: test
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

**Diagnose**: Resend API Key ist ungültig  
**Lösung**: Key prüfen + neu setzen:
1. Login: https://resend.com/api-keys
2. Key kopieren (re_...)
3. Vercel ENV aktualisieren: `RESEND_API_KEY=re_NewKey`
4. Deployment neu triggern (leerer Commit oder Vercel UI → Redeploy)

---

## Vollständiger Log-Flow (Erfolg)

```
[WEBHOOK HIT] checkout.session.completed
[EMAILS_ENABLED] true
[RESEND_API_KEY] SET
[SESSION ID] cs_test_abc123...
[CUSTOMER EMAIL] customer@example.com

[Checkout] Creating order for session: cs_test_abc123
[Checkout] Order created: order-uuid-123 (UO-2026-000123)

[MAIL] Loading line items from Stripe...
[MAIL] lineItems count: 2
[MAIL] item: { name: 'Glashalter', unit: 4999, qty: 1, lineTotal: 4999 }
[MAIL] item: { name: 'Flaschenhalter', unit: 4000, qty: 1, lineTotal: 4000 }
[MAIL] total: 8999

📧 [LANG] Detected from cart item: de
📧 [LANG] Final language for email: de

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📧 [EMAIL ATTEMPT] trace_id=abc-123
📧 [EMAIL] Recipient: customer@example.com (stripe_session)
📧 [EMAIL] BCC: admin@unbreak-one.com, orders@unbreak-one.com
📧 [EMAIL] Order: UO-2026-000123 (DB: UO-2026-000123, UUID: order-uuid-123)
📧 [EMAIL] Items: 2 items, Total: 8999¢
📧 [EMAIL] Shipping Address: YES
📧 [EMAIL] Customer Phone: +49 123 456789
📧 [EMAIL] Language: de
📧 [ENV CHECK] EMAILS_ENABLED: true
📧 [ENV CHECK] RESEND_API_KEY: ✅ Set
📧 [ENV CHECK] STRIPE_MODE: test
📧 [ENV CHECK] NODE_ENV: production
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

[EMAIL SEND] trace_id=abc-123 - Calling sendOrderConfirmation with: {
  customerEmail: 'customer@example.com',
  orderNumber: 'UO-2026-000123',
  itemCount: 2,
  totalAmount: 8999,
  language: 'de',
  hasShippingAddress: true,
  hasPhone: true
}

📧 [EMAIL SEND] Sending order-confirmation to customer@example.com
📧 [EMAIL SEND] BCC: admin@unbreak-one.com, orders@unbreak-one.com
[RESEND CALL] Sending email...
[RESEND CALL] To: [ 'customer@example.com' ]
[RESEND CALL] BCC: [ 'admin@unbreak-one.com', 'orders@unbreak-one.com' ]
[RESEND CALL] Subject: [TEST] Bestellbestätigung UO-2026-000123 – UNBREAK ONE
[RESEND RESULT] { data: { id: 're_AbCdEfGh123456' }, error: null }
✅ [EMAIL SEND] Success - ID: re_AbCdEfGh123456

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[EMAIL RESULT] trace_id=abc-123: { sent: true, id: 're_AbCdEfGh123456' }
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ [EMAIL SUCCESS] trace_id=abc-123 - Order confirmation sent!
✅ [EMAIL] Resend Email ID: re_AbCdEfGh123456
✅ [EMAIL] TO: customer@example.com (stripe_session)
✅ [EMAIL] BCC: admin@unbreak-one.com, orders@unbreak-one.com
✅ [EMAIL] Order: UO-2026-000123
✅ [EMAIL] Mode: test
[MAIL] send customer ok
[MAIL] send internal/bcc ok
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📧 [EMAIL SEND] Sending system-notification to orders@unbreak-one.com
[RESEND CALL] Subject: [TEST] Neue Bestellung UO-2026-000123
[RESEND RESULT] { data: { id: 're_XyZ789012' }, error: null }
✅ [EMAIL SEND] Success - ID: re_XyZ789012
```

---

## Nach Test: Logs sichern

### Logs kopieren (Vercel Dashboard)
1. Deployment → Logs Tab
2. Scroll zu `[EMAIL ATTEMPT]`
3. Kopiere **gesamten Block** (inkl. `[EMAIL RESULT]`)
4. Sende Logs zur Analyse

### Logs filtern (Optional)
Suche nach diesen Keywords:
- `[EMAIL ATTEMPT]`
- `[EMAIL RESULT]`
- `[EMAIL SUCCESS]`
- `[EMAIL PREVIEW]`
- `[EMAIL ERROR]`
- `[EMAIL EXCEPTION]`
- `RESEND_API_KEY`
- `EMAILS_ENABLED`

---

## ENV-Variablen Checkliste (Staging Preview)

**Kritische ENV für Email-Versand**:
```bash
# Email Service
EMAILS_ENABLED=true                    # ✅ MUSS true sein
RESEND_API_KEY=re_YourActualKeyHere    # ✅ MUSS gesetzt sein

# Stripe (Test-Mode)
STRIPE_MODE=test                       # ✅ Test-Mode
STRIPE_SECRET_KEY=sk_test_...          # ✅ Test Secret Key
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...     # ✅ Test Publishable Key
STRIPE_WEBHOOK_SECRET=whsec_...        # ✅ Test Webhook Secret

# Supabase (gleich wie Production)
SUPABASE_URL=https://...supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# Site URL (Staging)
NEXT_PUBLIC_SITE_URL=https://unbreak-78ts28s8h-supervisor77dw-debugs-projects.vercel.app
```

**Scope in Vercel**: ✅ Preview (NICHT Production!)

---

## Troubleshooting

### Problem: Logs zeigen `[EMAIL PREVIEW]`
**Ursache**: `EMAILS_ENABLED=false` oder nicht gesetzt  
**Lösung**: ENV in Vercel setzen → `EMAILS_ENABLED=true` (Preview Scope)

### Problem: `[EMAIL ERROR] RESEND_API_KEY not configured`
**Ursache**: `RESEND_API_KEY` fehlt  
**Lösung**: ENV in Vercel setzen → `RESEND_API_KEY=re_...` (Preview Scope)

### Problem: `[EMAIL ERROR] Invalid API key`
**Ursache**: Resend API Key ist falsch/abgelaufen  
**Lösung**: 
1. Login: https://resend.com/api-keys
2. Key generieren (falls nötig)
3. ENV aktualisieren in Vercel
4. Deployment neu triggern

### Problem: Logs zeigen SUCCESS, aber keine E-Mail in Inbox
**Ursache**: Spam-Filter oder E-Mail-Verzögerung  
**Lösung**:
1. Prüfe Spam-Ordner
2. Prüfe Resend Dashboard: https://resend.com/emails
3. Suche nach Email ID (aus Log): `re_AbCdEfGh123456`
4. Prüfe Delivery Status in Resend

### Problem: KEINE [EMAIL ATTEMPT] Logs überhaupt
**Ursache**: Webhook wurde nicht verarbeitet / Session mismatch  
**Lösung**:
1. Prüfe `[WEBHOOK FILTER]` in Logs
2. Möglicherweise Event livemode mismatch
3. Prüfe Stripe Dashboard → Webhooks → Events
4. Checke ob Webhook delivery zu Vercel successful

---

## Commit Info
- **Commit**: `8eb2b11`
- **Branch**: `staging`
- **Files**:
  - `lib/email/emailService.ts` (Test-Mode Prefix)
  - `pages/api/webhooks/stripe.js` (Enhanced Tracing)
- **Deploy**: https://vercel.com → unbreak-one → staging branch

---

## Next Steps
1. ⏳ Warte ~2 Minuten für Deployment
2. 🧪 Test-Bestellung durchführen
3. 📋 Logs kopieren
4. 📧 Analyse basierend auf Szenario A-D oben
5. ✅ ENV korrigieren falls nötig
6. 🔄 Nochmal testen
