# Email Service - Kill-Switch & Preview Mode

## ZWECK

Verhindert 403-Fehler von Resend im Free-Plan durch zentralen Email-Service mit Kill-Switch.

**Problem gelöst:**
- ❌ Vorher: Direkter `resend.emails.send()` → 403 Forbidden (Free-Plan)
- ✅ Jetzt: Zentrale `sendEmail()` → Preview-Logs wenn disabled, echter Versand wenn enabled

---

## ARCHITEKTUR

### Zentrale Email-Service
**Datei:** `lib/email/emailService.ts`

Alle Email-Versendungen laufen über diese zentrale Funktion:

```typescript
import { sendEmail } from '@/lib/email/emailService';

await sendEmail({
  type: 'order-confirmation',
  to: 'customer@example.com',
  subject: 'Bestellung #12345',
  html: '<html>...</html>',
  meta: { orderId: 'uuid' }
});
```

### Kill-Switch (Hard Block)

**ENV Variable:** `EMAILS_ENABLED`

- `EMAILS_ENABLED=false` (oder nicht gesetzt) → **Preview Mode**
  - Kein Resend API Call
  - Console-Log mit Email-Details
  - Return `{ preview: true }`

- `EMAILS_ENABLED=true` → **Send Mode**
  - Resend API Call
  - Echte Email wird versendet
  - Return `{ sent: true, id: '...' }`

---

## ENV VARIABLEN

### Erforderlich

```bash
# Resend API Key (ERFORDERLICH, auch im Preview-Modus)
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxxx

# Email Kill-Switch (KRITISCH)
EMAILS_ENABLED=false   # Preview-Modus (Standard)
# EMAILS_ENABLED=true  # Versand-Modus (erst nach Domain-Verifizierung!)

# Default FROM Adressen (automatische Auswahl nach Email-Typ)
EMAIL_FROM_ORDERS=orders@unbreak.one
EMAIL_FROM_SUPPORT=support@unbreak.one
EMAIL_FROM_NO_REPLY=no-reply@unbreak.one

# Fallback FROM (wenn obige nicht gesetzt)
RESEND_FROM=no-reply@unbreak.one
```

### Optional

```bash
# Shop Owner Notifications (deprecated - wird nicht mehr verwendet)
SHOP_OWNER_EMAIL=owner@unbreak.one

# Test Endpoint Secret
EMAIL_TEST_SECRET=your-secret-here
```

---

## VERWENDUNG

### 1. Order Confirmation Email

**Helper-Funktion (empfohlen):**

```typescript
import { sendOrderConfirmation } from '@/lib/email/emailService';

await sendOrderConfirmation({
  orderId: 'uuid-123',
  orderNumber: 'UB-20260103-A1B2',
  customerEmail: 'kunde@example.com',
  customerName: 'Max Mustermann',
  items: [
    { name: 'LED Strip', quantity: 2, price_cents: 4990 }
  ],
  totalAmount: 9980,
  language: 'de',
  shippingAddress: { ... }
});
```

### 2. Custom Email

**Direkte Funktion:**

```typescript
import { sendEmail } from '@/lib/email/emailService';

await sendEmail({
  type: 'support-ticket',
  to: 'customer@example.com',
  subject: 'Ihr Support-Ticket #12345',
  html: '<html>...</html>',
  text: 'Plain text version',
  replyTo: 'support@unbreak.one',
  meta: { ticketId: '12345' }
});
```

---

## EMAIL TYPES & AUTO-FROM

Der Service wählt automatisch die richtige FROM-Adresse:

| Type | FROM | REPLY-TO |
|------|------|----------|
| `order-confirmation` | `EMAIL_FROM_ORDERS` | `EMAIL_FROM_SUPPORT` |
| `order-shipped` | `EMAIL_FROM_ORDERS` | `EMAIL_FROM_SUPPORT` |
| `payment-received` | `EMAIL_FROM_ORDERS` | `EMAIL_FROM_SUPPORT` |
| `support-ticket` | `EMAIL_FROM_SUPPORT` | `EMAIL_FROM_SUPPORT` |
| `account-verification` | `EMAIL_FROM_NO_REPLY` | - |
| `password-reset` | `EMAIL_FROM_NO_REPLY` | - |
| `system-notification` | `EMAIL_FROM_NO_REPLY` | - |
| `test` | `RESEND_FROM` | - |

---

## PREVIEW MODE TESTEN

### Schritt 1: ENV setzen

```bash
# .env.local
EMAILS_ENABLED=false
RESEND_API_KEY=re_your_api_key  # Trotzdem setzen (für später)
EMAIL_FROM_ORDERS=orders@unbreak.one
```

### Schritt 2: Test Email triggern

**Via Test-Endpoint:**

```bash
# Lokal
curl http://localhost:3000/api/email/test?email=test@example.com

# Production (mit Secret)
curl https://your-domain.com/api/email/test?secret=your-secret&email=test@example.com
```

**Oder via Checkout Flow:**

1. Führe einen Test-Checkout durch
2. Payment abschließen
3. Webhook feuert
4. Prüfe Logs

### Schritt 3: Preview-Logs prüfen

**Expected Output:**

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📧 [EMAIL PREVIEW] Email sending is DISABLED
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📧 [EMAIL PREVIEW] Type:      order-confirmation
📧 [EMAIL PREVIEW] To:        kunde@example.com
📧 [EMAIL PREVIEW] From:      orders@unbreak.one
📧 [EMAIL PREVIEW] Reply-To:  support@unbreak.one
📧 [EMAIL PREVIEW] Subject:   Bestellbestätigung - Bestellung #UB-123
📧 [EMAIL PREVIEW] Preview:   Hallo Max Mustermann, Vielen Dank für Ihre Bestellung! Wir haben Ihre Bestellung erhalten...
📧 [EMAIL PREVIEW] Meta:      {
  "orderId": "uuid-123",
  "orderNumber": "UB-123",
  "totalAmount": 9980,
  "language": "de"
}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ℹ️  [EMAIL PREVIEW] To enable sending: Set EMAILS_ENABLED=true
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

**Wichtig:**
- ✅ Kein Resend API Call
- ✅ Keine 403-Fehler
- ✅ Alle Email-Details sichtbar
- ✅ Webhook läuft durch ohne Fehler

---

## PRODUCTION AKTIVIERUNG

### ⚠️ ERST NACH DOMAIN-VERIFIZIERUNG!

1. **Domain in Resend verifizieren:**
   - https://resend.com/domains
   - DNS Records setzen (SPF, DKIM)
   - Warten auf Verifizierung

2. **FROM-Adressen prüfen:**
   ```bash
   # .env.production (Vercel)
   EMAIL_FROM_ORDERS=orders@unbreak.one     # ← Verifizierte Domain!
   EMAIL_FROM_SUPPORT=support@unbreak.one   # ← Verifizierte Domain!
   EMAIL_FROM_NO_REPLY=no-reply@unbreak.one # ← Verifizierte Domain!
   ```

3. **Kill-Switch aktivieren:**
   ```bash
   EMAILS_ENABLED=true  # ← Erst JETZT setzen!
   ```

4. **Test mit echter Email:**
   ```bash
   # Test mit echter Email-Adresse
   curl https://your-domain.com/api/email/test?secret=SECRET&email=your-real-email@gmail.com
   
   # Prüfen:
   # - Email kommt an
   # - Resend Dashboard zeigt 2xx (nicht 403)
   # - FROM ist korrekt
   # - REPLY-TO funktioniert
   ```

---

## GEÄNDERTE DATEIEN

### Neue Dateien

1. **`lib/email/emailService.ts`** (ZENTRAL)
   - `sendEmail()` - Hauptfunktion
   - `sendOrderConfirmation()` - Helper
   - Kill-Switch Logik
   - Email-Type Routing

### Angepasste Dateien

2. **`pages/api/email/order.js`**
   - Verwendet `sendOrderConfirmation()`
   - Kein direkter Resend Call mehr

3. **`pages/api/email/test.js`**
   - Verwendet `sendEmail()`
   - Zeigt EMAILS_ENABLED Status

4. **`pages/api/webhooks/stripe.js`**
   - Ruft `/api/email/order` auf
   - Nutzt indirekt `emailService.ts`

---

## FEHLERBEHANDLUNG

### Email Validation

```typescript
// Wirft Fehler wenn:
if (!to) throw new Error('[EMAIL] Missing recipient');
if (!isValidEmail(to)) throw new Error('[EMAIL] Invalid email');
if (!subject) throw new Error('[EMAIL] Missing subject');
if (!html) throw new Error('[EMAIL] Missing HTML');
```

### Graceful Degradation

**Email-Fehler stoppt NICHT den Webhook:**

```typescript
const result = await sendEmail({ ... });

if (result.preview) {
  // Preview-Modus → OK
}

if (result.sent) {
  // Gesendet → OK
}

if (result.error) {
  // Fehler → Loggen, aber nicht werfen
  console.error('Email failed:', result.error);
  // Webhook läuft weiter!
}
```

---

## DEBUGGING

### Preview-Logs finden

**Vercel Functions:**
```
https://vercel.com/[team]/[project]/logs
Filter: "EMAIL PREVIEW"
```

**Lokale Entwicklung:**
```
Terminal Ausgabe direkt sichtbar
```

### Häufige Probleme

**403 Forbidden:**
- ✅ Fixed! Kommt nicht mehr vor wenn `EMAILS_ENABLED=false`

**Email kommt nicht an (EMAILS_ENABLED=true):**
- Domain nicht verifiziert?
- FROM-Adresse falsch?
- Resend Dashboard prüfen

**"Invalid email address":**
- Email-Format prüfen
- Array vs String?

---

## MIGRATION CHECKLIST

- [x] `emailService.ts` erstellt
- [x] `/api/email/order.js` angepasst
- [x] `/api/email/test.js` angepasst
- [x] ENV `EMAILS_ENABLED=false` gesetzt
- [ ] Lokaler Test: Preview-Logs erscheinen
- [ ] Production Test: Preview-Logs erscheinen
- [ ] Keine 403-Fehler mehr
- [ ] Domain-Verifizierung (später)
- [ ] `EMAILS_ENABLED=true` (später)
- [ ] Echter Email-Test (später)

---

## NEXT STEPS

1. **Jetzt (Free-Plan):**
   - ✅ Preview-Modus aktiv
   - ✅ Keine 403-Fehler
   - ✅ Entwicklung geht weiter

2. **Später (nach Upgrade):**
   - Domain verifizieren
   - `EMAILS_ENABLED=true` setzen
   - Echte Emails versenden

3. **Optional (Enhancement):**
   - Email Templates in separate Dateien
   - Email Queueing (z.B. mit BullMQ)
   - Email Analytics
   - A/B Testing von Subject Lines
