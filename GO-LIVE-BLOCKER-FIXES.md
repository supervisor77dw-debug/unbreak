# 🚀 GO-LIVE BLOCKER FIXES - DEPLOYMENT GUIDE

**Datum:** 17. Januar 2026  
**Status:** ✅ FIXES IMPLEMENTED, READY TO DEPLOY

---

## ✅ ISSUE A: `/api/checkout/finalize` 500 Error - FIXED

### Problem gefunden:
```javascript
// ❌ VORHER: Versuch payment_status zu updaten (Spalte existiert nicht!)
.update({ 
  status: 'paid',
  payment_status: session.payment_status,  // ← FEHLER!
  ...
})
```

### Root Cause:
Die Tabelle `simple_orders` hat **keine Spalte `payment_status`**!

**Vorhandene Spalten:**
```
id, customer_user_id, customer_email, product_sku, quantity, 
total_amount_cents, currency, status, order_type, 
stripe_session_id, stripe_payment_intent_id, created_at, 
updated_at, items, paid_at, stripe_customer_id, customer_name, 
customer_phone, shipping_address, billing_address, config_json, 
preview_image_url, bom_json, price_breakdown_json, metadata, 
stripe_checkout_session_id, customer_id, trace_id, snapshot_id, 
has_snapshot, order_number, public_id
```

→ Es gibt `status` (für Order Status: pending/paid/completed)  
→ Aber kein separates `payment_status` Feld

### Fix implementiert:

**File:** `pages/api/checkout/finalize.js`

**Änderungen:**
1. ✅ `payment_status` Update entfernt
2. ✅ `paid_at` Timestamp hinzugefügt
3. ✅ Verbessertes Error Logging mit Supabase Details

```javascript
// ✅ NACH FIX:
const { error: updateError } = await supabase
  .from('simple_orders')
  .update({ 
    status: 'paid',                    // ✅ Existiert
    paid_at: new Date().toISOString(), // ✅ Existiert
    stripe_payment_intent_id: session.payment_intent?.id || session.payment_intent,
    updated_at: new Date().toISOString(),
  })
  .eq('id', orderId);

if (updateError) {
  console.error('[FINALIZE] Failed to update order:', {
    error: updateError,
    code: updateError.code,      // ✅ Supabase Error Code
    message: updateError.message, // ✅ Error Message
    details: updateError.details, // ✅ Details
    hint: updateError.hint,       // ✅ Supabase Hint
    order_id: orderId,
  });
  // ... detaillierte Response
}
```

---

## ✅ ISSUE B: Stripe Webhook Signature - ALREADY CORRECT

### Status: ✅ Code ist bereits korrekt implementiert!

**File:** `pages/api/webhooks/stripe.js`

**Bereits implementiert:**
```javascript
// ✅ Body Parser ist disabled
export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req, res) {
  try {
    // ✅ Raw body mit buffer() gelesen
    const buf = await buffer(req);
    const sig = req.headers['stripe-signature'];

    // ✅ Korrekte Signaturprüfung
    const event = stripe.webhooks.constructEvent(
      buf,  // ✅ Raw body (nicht JSON!)
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
    
    console.log('✅ [SIGNATURE] Verified OK');
    // ...
  } catch (err) {
    console.error('❌ [SIGNATURE] Verification FAILED:', err.message);
    return res.status(400).json({ 
      error: `Webhook signature verification failed: ${err.message}` 
    });
  }
}
```

**Auch korrekt:** `pages/api/stripe/webhook.js` (alternativer Endpoint)

---

## ⚠️ ZU PRÜFEN: Welcher Webhook Endpoint ist aktiv?

### Zwei Webhook Handler gefunden:

1. **`/api/webhooks/stripe`** (Haupt-Handler, 1123 Zeilen)
   - Umfassender Handler
   - Nutzt `buffer()` ✅
   - bodyParser: false ✅

2. **`/api/stripe/webhook`** (Alternative, 581 Zeilen)
   - Auch vollständig implementiert
   - Nutzt `buffer()` ✅
   - bodyParser: false ✅

### ACTION REQUIRED: Stripe Dashboard prüfen

**Schritte:**
1. Stripe Dashboard öffnen: https://dashboard.stripe.com/webhooks
2. Webhook Endpoint für Production suchen
3. Verifizieren welche URL konfiguriert ist:
   - ❓ `https://www.unbreak-one.com/api/webhooks/stripe`
   - ❓ `https://www.unbreak-one.com/api/stripe/webhook`
4. Signing Secret kopieren (whsec_...)
5. In Vercel Production Environment Variable `STRIPE_WEBHOOK_SECRET` setzen

---

## 🔑 VERCEL ENVIRONMENT VARIABLES CHECKLIST

### Production Environment (MUSS KORREKT SEIN!):

```bash
# Stripe Live Mode Keys
STRIPE_SECRET_KEY=sk_live_51SiyjiPZfPWUWCa1...  # ← LIVE nicht TEST!
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_51SiyjiPZfPWUWCa1...

# Webhook Secret (vom Stripe Dashboard)
STRIPE_WEBHOOK_SECRET=whsec_...  # ← Muss zu Endpoint passen!

# Database
SUPABASE_URL=https://qnzsdytdghfukrqpscsg.supabase.co
SUPABASE_SERVICE_ROLE_KEY=sb_secret_REDACTED

# Auth
NEXTAUTH_SECRET=<generate-with: openssl rand -base64 32>
NEXTAUTH_URL=https://www.unbreak-one.com

# Email
RESEND_API_KEY=re_REDACTED
EMAILS_ENABLED=true

# ... etc (siehe VERCEL-ENV-PRODUCTION-GUIDE.md)
```

---

## 📋 DEPLOYMENT STEPS

### 1. Commit & Push
```bash
git add pages/api/checkout/finalize.js
git commit -m "fix: Remove payment_status update (column does not exist in simple_orders) + improve error logging"
git push origin master
```

### 2. Vercel Deployment
- Automatisch nach Push (~2 Minuten)
- Oder manuell: Vercel Dashboard → Deployments → Redeploy

### 3. Vercel Logs prüfen (nach Deployment)
```
https://vercel.com/supervisor77dw-debugs-projects/unbreak-one/deployments
```

**Suche nach:**
- ✅ `"🔑 [STRIPE ACCOUNT] Mode: LIVE"` (nicht TEST!)
- ✅ `"✅ [SIGNATURE] Verified OK"` (bei Webhook-Events)
- ❌ Keine 500 Errors bei finalize
- ❌ Keine "column does not exist" Errors

### 4. Stripe Webhook Test
```
Stripe Dashboard → Webhooks → Endpoint auswählen → "Send test webhook"
Event Type: checkout.session.completed
```

**Erwartetes Ergebnis:**
- HTTP Status: **200 OK** ✅
- Response: `{"received": true, "event": "checkout.session.completed"}`
- Vercel Logs: `"✅ [SIGNATURE] Verified OK"`

### 5. Live Test Checkout
```
1. https://www.unbreak-one.com/shop
2. Produkt in Warenkorb
3. Checkout durchführen (echte Kreditkarte, 1 Cent Betrag wenn möglich)
4. Success Page: Sollte keine Errors zeigen
5. Vercel Logs: finalize sollte 200 zurückgeben
```

---

## 🧪 TESTING CHECKLIST

Nach Deployment testen:

- [ ] **Finalize Endpoint**
  - [ ] Success Page lädt ohne Errors
  - [ ] Order Status wird auf 'paid' gesetzt
  - [ ] paid_at Timestamp wird gesetzt
  - [ ] Keine 500 Errors in Vercel Logs
  - [ ] Keine "column does not exist" Errors

- [ ] **Webhook Handler**
  - [ ] Stripe Test Webhook liefert 200 OK
  - [ ] Signature Verification erfolgreich
  - [ ] Event wird korrekt verarbeitet
  - [ ] Email wird versendet (wenn EMAILS_ENABLED=true)

- [ ] **Environment Variables**
  - [ ] STRIPE_SECRET_KEY ist sk_live_... (nicht sk_test_!)
  - [ ] STRIPE_WEBHOOK_SECRET passt zu Stripe Dashboard
  - [ ] Alle anderen Vars gesetzt

- [ ] **E2E Test**
  - [ ] Checkout funktioniert
  - [ ] Zahlung wird verarbeitet
  - [ ] Order erscheint in Admin Panel
  - [ ] Email wird versendet
  - [ ] Success Page zeigt Order Details

---

## 🐛 TROUBLESHOOTING

### Problem: "column 'payment_status' does not exist"
**Status:** ✅ FIXED (Update entfernt)

### Problem: Webhook Signature Failed
**Mögliche Ursachen:**
1. Falscher STRIPE_WEBHOOK_SECRET in Vercel
   - **Fix:** Stripe Dashboard → Webhook Secret kopieren → Vercel setzen
2. Falscher Endpoint konfiguriert
   - **Fix:** Stripe Dashboard → Endpoint URL prüfen
3. bodyParser aktiviert (würde body parsen)
   - **Fix:** ✅ Bereits disabled mit `bodyParser: false`

### Problem: Finalize gibt immer noch 500
**Debug Steps:**
```bash
# Vercel Logs öffnen
# Suche nach: "[FINALIZE] Failed to update order"
# Prüfe Error Details:
#   - code: PGRST204 → Schema Cache Problem
#   - code: 42703 → Column does not exist (sollte fixed sein)
#   - code: andere → Datenbank Problem
```

**Falls PGRST204 (Schema Cache):**
```bash
# Supabase Dashboard → Project Settings → API → Restart
# Oder warte ~5 Minuten (Cache refresh)
```

---

## 📊 ERWARTETE ERGEBNISSE

### ✅ Nach erfolgreichem Deployment:

**Finalize Response (200 OK):**
```json
{
  "ok": true,
  "order_id": "uuid...",
  "cleared": true,
  "message": "Payment verified, order finalized",
  "order": {
    "id": "uuid...",
    "total_amount_cents": 9900,
    "currency": "eur",
    "status": "paid"
  }
}
```

**Order in Database:**
```sql
SELECT id, status, paid_at, stripe_payment_intent_id 
FROM simple_orders 
WHERE id = 'uuid...';

-- ✅ status = 'paid'
-- ✅ paid_at = '2026-01-17T10:30:00.000Z'
-- ✅ stripe_payment_intent_id = 'pi_...'
```

**Webhook Event (200 OK):**
```
Vercel Logs:
✅ [SIGNATURE] Verified OK
📥 [EVENT] Type: checkout.session.completed
💳 [SESSION] ID: cs_test_...
📧 [EMAIL] Sending confirmation to customer@example.com
✅ [WEBHOOK] Order finalized
```

---

## 🚀 GO-LIVE STATUS

**Issue A (Finalize):** ✅ FIXED  
**Issue B (Webhook):** ✅ ALREADY CORRECT  
**Environment:** 🟡 ZU PRÜFEN (LIVE Keys?)  
**Deployment:** 🟡 PENDING (Code ready)

**BLOCKER REMAINING:**
- Vercel Production Environment Variables verifizieren
- Stripe Webhook Endpoint & Secret prüfen

**READY TO DEPLOY:** ✅ JA (nach Env Var Check)

---

**Ende des Deployment Guides**
