# STRIPE LOCALE - Screenshot Checklist
**UNBREAK ONE - Proof of Correct Language Handling**

---

## 📸 REQUIRED SCREENSHOTS (4 Total)

### 1. Browser Console - EN Flow ✅
**File:** `stripe-locale-browser-console-en.png`

**How to capture:**
1. Open: `https://unbreak-one.com/en/cart`
2. Add product to cart
3. Open Browser DevTools (F12)
4. Switch to "Console" tab
5. Click "Zur Kasse" / "Proceed to Checkout"
6. Wait for `[STRIPE_LOCALE]` logs to appear
7. Screenshot the Console with visible logs:
   ```
   [STRIPE_LOCALE] A) FRONTEND - Before Checkout Request
   [STRIPE_LOCALE] currentLang: en
   [STRIPE_LOCALE] lang source: {...}
   [STRIPE_LOCALE] Request Payload: {locale: "en"}
   ```

**Wichtig:** Scroll so, dass alle `[STRIPE_LOCALE]` Zeilen sichtbar sind!

---

### 2. Vercel Logs - EN Flow ✅
**File:** `stripe-locale-vercel-logs-en.png`

**How to capture:**
1. Go to: https://vercel.com/[team]/unbreak-one/logs
2. Filter by: "STRIPE_LOCALE"
3. Find logs from EN checkout (timestamp should match screenshot #1)
4. Expand log entries to show:
   ```
   [STRIPE_LOCALE] B) BACKEND API - Checkout Request Received
   [STRIPE_LOCALE] req.body.locale: en
   [STRIPE_LOCALE] ✅ Priority 1: req.body.locale = en
   [STRIPE_LOCALE] C) BEFORE stripe.checkout.sessions.create
   [STRIPE_LOCALE] sessionData.locale: en
   [STRIPE_LOCALE] ✅ SESSION CREATED SUCCESSFULLY
   [STRIPE_LOCALE] session.locale: en
   [STRIPE_LOCALE] metadata.ui_lang: en
   ```
5. Screenshot the complete log flow

**Wichtig:** Zeige alle 3 Stufen (A→B→C) im Screenshot!

---

### 3. Stripe Dashboard - Session Metadata ✅
**File:** `stripe-session-metadata-en.png`

**How to capture:**
1. From Vercel logs, copy `stripe_session_id: cs_test_...`
2. Go to: https://dashboard.stripe.com/test/payments
3. Paste session ID in search
4. Click session → "View Details"
5. Scroll to "Metadata" section
6. Screenshot showing:
   ```
   Metadata:
   - order_id: xxx-xxx-xxx
   - ui_lang: en          ← CRITICAL!
   - accept_language: en-US,en;q=0.9,...
   - build_commit: cd197c7
   ```

**Wichtig:** `ui_lang: en` muss sichtbar sein!

---

### 4. Stripe Checkout UI - English ✅
**File:** `stripe-checkout-ui-en.png`

**How to capture:**
1. Complete steps from Screenshot #1
2. After clicking "Proceed to Checkout", Stripe redirects
3. Stripe Checkout page opens (https://checkout.stripe.com/c/pay/...)
4. Screenshot the payment form showing:
   - "Pay" button (not "Bezahlen")
   - "Email" field (not "E-Mail")
   - "Card information" (not "Karteninformationen")
   - Total amount in EUR

**Wichtig:** English UI labels müssen sichtbar sein!

---

## 📸 BONUS SCREENSHOTS (Optional)

### 5. Browser Console - DE Flow
**File:** `stripe-locale-browser-console-de.png`

Same as #1, but:
- Start from: `https://unbreak-one.com/cart` (German)
- Expect: `[STRIPE_LOCALE] currentLang: de`
- Expect: `[STRIPE_LOCALE] Request Payload: {locale: "de"}`

---

### 6. Stripe Checkout UI - Deutsch
**File:** `stripe-checkout-ui-de.png`

Same as #4, but:
- Start from German cart
- Expect: "Bezahlen" button
- Expect: "Kartennummer" field
- Expect: German UI labels

---

## ✅ VERIFICATION CHECKLIST

**Before submitting screenshots:**
- [ ] All 4 required screenshots captured
- [ ] Screenshots are high-resolution (readable text)
- [ ] Timestamps match across screenshots (same test run)
- [ ] Browser Console shows `[STRIPE_LOCALE]` prefix
- [ ] Vercel Logs show complete flow (A→B→C)
- [ ] Stripe Metadata shows `ui_lang: en`
- [ ] Stripe UI shows English labels (or German for DE flow)

---

## 📧 SUBMIT TO CODER

**When ready, provide:**
1. 4 screenshots (upload to GitHub issue or share via file)
2. Session ID from screenshot #2: `cs_test_...`
3. Vercel log timestamp: `2026-01-16 20:30:45 UTC`
4. Confirmation: "Stripe UI was in **English** (or Deutsch)"

**Expected Response:**
✅ "Screenshots confirmed! Locale system working correctly. Merge to master."

OR

🚨 "Issue found: Stripe shows DE despite session.locale=en. Investigating caching..."

---

**Status:** ⏳ Awaiting screenshots  
**ETA:** After Vercel deployment completes (~2 min)
