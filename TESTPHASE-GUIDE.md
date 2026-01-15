# TESTPHASE GUIDE – Resend E-Mails & Konfigurator Return

## 📋 Ziel dieser Testphase

Kontrollierte Tests für:
1. ✉️ **Transaktionale E-Mails über Resend**
2. 🔁 **Shop → Konfigurator → Shop Rücksprung**
3. 🔐 **Vorbereitung für Stripe-Live** (noch ohne Aktivierung)

**WICHTIG:**
- ❌ KEINE DNS-, Domain- oder Vercel-Domain-Änderungen
- ❌ KEINE automatischen Merges nach master
- ✅ Alle Tests NUR auf staging/preview
- ✅ Merge erst nach expliziter Freigabe

---

## 🌍 Domain & Branch Status

### Domains
- **Production:** `unbreak-one.com` (DNS verifiziert, DKIM/SPF aktiv)
- **Preview:** `*.vercel.app` (automatisch bei staging Push)

### Branches
- **master:** Production (frozen, nur nach Freigabe)
- **staging:** Development & Testing (aktueller Branch)

### Environment
```bash
RESEND_API_KEY=re_***  # Bereits gesetzt in Vercel
EMAILS_ENABLED=false    # Preview: false, Production: true nach Test
```

---

## 📧 RESEND – E-Mail Konfiguration

### Absender-Logik (VERBINDLICH)

**Order-Mail an Kunden:**
```
from: 'UNBREAK ONE <orders@unbreak-one.com>'
reply_to: 'support@unbreak-one.com'
```

**Interne Admin-Mail:**
```
from: 'UNBREAK ONE <no-reply@unbreak-one.com>'
to: 'admin@unbreak-one.com'
```

**Support-Kommunikation:**
```
from: 'UNBREAK ONE Support <support@unbreak-one.com>'
reply_to: 'support@unbreak-one.com'
```

### ⛔ Verboten
- ❌ Gmail / iCloud / private Absender
- ❌ Abweichende Domains
- ❌ Dynamische From-Adressen

---

## 🧪 Test-Endpunkte

### 1. E-Mail Test Endpoint

**URL:** `/api/email/test`

**Zugriff:**
```bash
# Development (automatisch erlaubt)
http://localhost:3000/api/email/test

# Preview/Production (mit Secret)
https://your-preview.vercel.app/api/email/test?secret=YOUR_EMAIL_TEST_SECRET
```

**Custom E-Mail Empfänger:**
```bash
/api/email/test?email=deine@email.com&lang=de
```

**Response (EMAILS_ENABLED=false):**
```json
{
  "success": true,
  "message": "Test email preview logged (EMAILS_ENABLED=false)",
  "result": {
    "preview": true
  },
  "testData": { ... },
  "envCheck": {
    "RESEND_API_KEY": true,
    "EMAILS_ENABLED": "false"
  }
}
```

**Response (EMAILS_ENABLED=true):**
```json
{
  "success": true,
  "message": "Test email sent successfully",
  "result": {
    "sent": true,
    "id": "re_abc123..."
  }
}
```

### 2. E-Mail über echte Bestellung testen

**Flow:**
```
1. Shop → Produkt in Warenkorb → Checkout
2. Stripe Test-Zahlung (CHECKOUT_ENABLED=true)
3. Webhook → sendOrderConfirmation()
4. Check Resend Dashboard für Delivery
```

---

## 🔁 Konfigurator Return – Test

### Aktueller Flow (CORS-frei)

```
1. Shop (/shop) 
   └─ User klickt "Konfigurator starten"
   └─ buildConfiguratorUrl(lang, window.location.origin + '/shop')
   
2. Konfigurator (externe Domain)
   └─ User designt Produkt
   └─ Speichert Session: POST /api/config-session
   └─ Redirect: /config-return?sessionId=xyz
   
3. config-return.js (SERVER-SIDE)
   └─ getServerSideProps: Fetch session (kein CORS!)
   └─ Calculate price (server-side)
   └─ Save to localStorage: pendingConfiguratorItem
   └─ Redirect: /shop?from=configurator
   
4. Shop (/shop)
   └─ Detect: ?from=configurator
   └─ Read: localStorage.getItem('pendingConfiguratorItem')
   └─ Add to cart
   └─ Clean URL: window.history.replaceState
```

### Test-Schritte

1. **Öffne Shop:**
   ```
   https://your-preview.vercel.app/shop
   ```

2. **Klick "Konfigurator starten":**
   - Check: URL enthält `return=https://your-preview.vercel.app/shop` (NICHT vercel.app fallback!)
   - Check: Console log: `[NAV] Configurator click -> resolvedUrl=`

3. **Design erstellen & "Speichern & Zurück":**
   - Check: POST /api/config-session → 201 Created
   - Check: Redirect zu /config-return?sessionId=...

4. **Automatische Weiterleitung:**
   - Check: Loading screen erscheint
   - Check: Server fetches session (kein CORS-Error!)
   - Check: Redirect zu /shop?from=configurator
   - Check: Item im Warenkorb

5. **Verify Console:**
   ```
   [CONFIG-RETURN SSR] Fetching session: ...
   [CONFIG-RETURN SSR] Session loaded: ...
   [CONFIG-RETURN SSR] Price calculated: 4990
   [CONFIG-RETURN] Config saved to localStorage: ...
   [shop:return] Configurator return detected
   [shop:return] Loading pending configurator item: ...
   [shop:cart] Configurator item added successfully
   ```

### ❌ Fehlerfall: CORS Error

**Symptom:**
```
Access to fetch at 'https://unbreak-one.com/api/config-session' 
from origin 'https://unbreak-3-d-konfigurator.vercel.app' 
has been blocked by CORS policy
```

**Fix:**
- ✅ Middleware muss /api/* routes NICHT redirecten
- ✅ config-return.js muss Server-Side fetchen (nicht client-side)

**Check middleware.js:**
```javascript
export function middleware(request) {
  const url = request.nextUrl;
  
  // CRITICAL: Never redirect API routes
  if (url.pathname.startsWith('/api/')) {
    return NextResponse.next(); // ← MUSS da sein!
  }
  
  // Rest of middleware...
}
```

---

## ✅ Abnahme-Kriterien

Merge nach master NUR wenn:

- [ ] **E-Mail Test erfolgreich**
  - [ ] From: `UNBREAK ONE <orders@unbreak-one.com>`
  - [ ] Reply-To: `support@unbreak-one.com`
  - [ ] DKIM/SPF: PASS (Resend Dashboard)
  - [ ] Delivery: Success (nicht Bounced)

- [ ] **Konfigurator Return erfolgreich**
  - [ ] Shop → Konfigurator: bleibt auf gleicher Domain
  - [ ] Return URL: `window.location.origin + '/shop'`
  - [ ] Kein vercel.app Leak in Return URL
  - [ ] Session fetch: Server-side (kein CORS)
  - [ ] Item im Warenkorb: ✅

- [ ] **Debug Code entfernt**
  - [ ] Kein "Configurator Return Debug" Popup
  - [ ] Keine UI-Debug-Boxen
  - [ ] Console-Logs nur server-side (erlaubt)

- [ ] **Preview Deployment ohne Errors**
  - [ ] /shop loads: 200 OK
  - [ ] /cart loads: 200 OK
  - [ ] /api/email/test: 200 OK
  - [ ] Keine 500 Errors in Vercel Logs

---

## 🚀 Test-Ablauf

### Phase 1: Preview Deployment

```bash
# 1. Status check
git status
# Should show: On branch staging

# 2. Commit changes
git add .
git commit -m "TEST: Resend email + configurator return (staging)"

# 3. Push to staging
git push origin staging
```

**Result:**
- Vercel auto-deploys preview: `https://unbreak-one-git-staging-*.vercel.app`
- Check deployment status in Vercel Dashboard

### Phase 2: E-Mail Test

```bash
# 1. Open test endpoint
https://unbreak-one-git-staging-*.vercel.app/api/email/test?email=DEINE@EMAIL.COM

# 2. Check Response JSON:
{
  "result": {
    "preview": true  # ← EMAILS_ENABLED=false (correct für Preview)
  }
}

# 3. Check Server Logs (Vercel Dashboard → Runtime Logs):
📧 [EMAIL PREVIEW] Email sending is DISABLED
📧 [EMAIL PREVIEW] Type:      test
📧 [EMAIL PREVIEW] To:        DEINE@EMAIL.COM
📧 [EMAIL PREVIEW] From:      UNBREAK ONE <no-reply@unbreak-one.com>
📧 [EMAIL PREVIEW] Subject:   TEST: Bestellbestätigung #TEST12345
```

**Expected:**
- ✅ Response 200 OK
- ✅ `preview: true` (weil EMAILS_ENABLED=false)
- ✅ From-Adresse: `UNBREAK ONE <no-reply@unbreak-one.com>`
- ✅ Keine Errors in Logs

### Phase 3: Konfigurator Return Test

```bash
# 1. Open shop
https://unbreak-one-git-staging-*.vercel.app/shop

# 2. Click "Konfigurator starten"
# Check URL in browser:
https://unbreak-3-d-konfigurator.vercel.app/?lang=de&return=https%3A%2F%2Funbreak-one-git-staging-xyz.vercel.app%2Fshop

# 3. Design erstellen, "Speichern & Zurück"

# 4. Check Console Logs:
[CONFIG-RETURN SSR] Fetching session: ...
[CONFIG-RETURN SSR] Session loaded: ...
[shop:return] Configurator return detected
[shop:cart] Configurator item added successfully
```

**Expected:**
- ✅ Return URL: Preview domain (nicht unbreak-one.com leak)
- ✅ Kein CORS Error
- ✅ Item im Warenkorb
- ✅ Clean URL: `/shop` (kein `?from=configurator` mehr)

### Phase 4: Freigabe-Entscheidung

**Wenn alle Tests ✅:**
```bash
# Controlled merge to master
git checkout master
git merge staging --no-ff -m "TEST RELEASE: Resend + Configurator Return"
git push origin master
```

**Wenn Tests ❌:**
```bash
# Stay on staging, fix issues
git add .
git commit -m "FIX: [beschreibung]"
git push origin staging
# Repeat Phase 2-3
```

---

## 🔍 Debug-Tools

### Check Environment Variables (Preview)

```bash
# Add to pages/api/debug/env.js (only preview!)
export default function handler(req, res) {
  const isPreview = req.headers.host?.includes('vercel.app');
  if (!isPreview) return res.status(403).json({ error: 'Preview only' });
  
  res.json({
    RESEND_API_KEY: !!process.env.RESEND_API_KEY,
    EMAILS_ENABLED: process.env.EMAILS_ENABLED,
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
    VERCEL_URL: process.env.VERCEL_URL,
  });
}
```

### Check Resend Dashboard

**URL:** https://resend.com/emails

**Check:**
- Delivery Status: Delivered / Bounced
- DKIM/SPF: Pass / Fail
- From/Reply-To: Correct addresses

### Check Vercel Logs

**URL:** https://vercel.com/[your-team]/unbreak-one/logs

**Filter:**
- Deployment: staging branch
- Time: Last 1 hour
- Search: `[EMAIL` or `[CONFIG-RETURN`

---

## 📝 Post-Test Checklist

Nach erfolgreichem Test UND Merge:

- [ ] Tag release: `git tag v0.9.2-resend`
- [ ] Update Vercel ENV (Production):
  - [ ] `EMAILS_ENABLED=true` (nur nach Domain-Verifikation!)
- [ ] Dokumentation:
  - [ ] Update README mit Test-Ergebnissen
  - [ ] Screenshot von erfolgreicher Test-Email
- [ ] Production Smoke-Test:
  - [ ] /api/email/test auf Production (mit Secret)
  - [ ] Echter Order-Flow (Test-Kauf)

---

## 🆘 Troubleshooting

### Problem: "RESEND_API_KEY not configured"

**Symptom:**
```json
{
  "sent": false,
  "error": "RESEND_API_KEY not configured"
}
```

**Fix:**
1. Check Vercel Dashboard → Settings → Environment Variables
2. Verify: `RESEND_API_KEY=re_***` exists for Preview
3. Redeploy if needed

### Problem: "403 Forbidden" von Resend

**Symptom:**
```
Resend API error: 403 Forbidden
```

**Fix:**
1. Check Resend Dashboard → Domain verification
2. DKIM/SPF müssen "Verified" sein
3. Nur verifizierte Domains erlaubt (Free Plan)

### Problem: CORS Error bei Konfigurator Return

**Symptom:**
```
Redirect is not allowed for a preflight request
```

**Fix:**
```javascript
// middleware.js - Check API exclusion
if (url.pathname.startsWith('/api/')) {
  return NextResponse.next(); // ← MUST be present!
}
```

### Problem: Return URL zeigt vercel.app statt Preview

**Symptom:**
```
https://unbreak-3-d-konfigurator.vercel.app/?return=https://unbreak-one.vercel.app/shop
```

**Fix:**
```javascript
// lib/configuratorLink.js oder shop.js
const returnUrl = window.location.origin + '/shop';  // ← Nicht hardcoded!
```

---

## 📞 Support

Bei Problemen:
1. Check Vercel Runtime Logs
2. Check Resend Dashboard
3. Check Browser Console (Network Tab)
4. Dokumentiere Error + Steps to Reproduce

**Status:** Ready for Testing ✅  
**Branch:** staging  
**Next:** Push to staging → Test → Freigabe
