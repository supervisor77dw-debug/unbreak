# STRIPE LOCALE DEBUG - Test Protocol
**UNBREAK ONE - Stripe Checkout Language Debugging**  
**Status:** ✅ Deployed (Commit cd197c7)  
**Date:** 2026-01-16  
**Vercel:** Auto-deploying (~2-3 min)

---

## 🎯 A) KURZE DIAGNOSE

**URSACHE:**  
Stripe Checkout `locale` wird bereits korrekt gesetzt (Commit c908e56), aber wir brauchen **harte Beweise** via Logs, dass:
1. Frontend sendet `locale: 'en'` (oder 'de')
2. Backend empfängt `req.body.locale: 'en'`
3. Stripe Session wird mit `locale: 'en'` erstellt
4. Session Metadata enthält `ui_lang: 'en'`

**WAS WURDE IMPLEMENTIERT:**
- ✅ **3-stufige Debug-Instrumentierung** (PREFIX: `[STRIPE_LOCALE]`)
- ✅ **Metadata in Stripe Session** (ui_lang, accept_language, build_commit)
- ✅ **Vercel-sichtbare Logs** (Frontend Browser Console + Backend Vercel Logs)

**PROOF-METHODE:**
1. EN Flow testen → Vercel Logs zeigen `[STRIPE_LOCALE] resolvedLang=en, session.locale=en`
2. DE Flow testen → Vercel Logs zeigen `[STRIPE_LOCALE] resolvedLang=de, session.locale=de`
3. Stripe Dashboard → Session Details → Metadata zeigt `ui_lang: en` (oder de)

---

## 🔍 B) CODE-DIFF - Source of Truth

### 1. **SOURCE OF TRUTH: Frontend Sprache**

**Datei:** [lib/i18n-shop.js](lib/i18n-shop.js#L350-365)

```javascript
/**
 * Get current language from i18n system
 */
export function getCurrentLanguage() {
  if (typeof window !== 'undefined') {
    // Priority 1: window.i18n.getCurrentLanguage()
    if (window.i18n && typeof window.i18n.getCurrentLanguage === 'function') {
      return window.i18n.getCurrentLanguage();
    }
    
    // Priority 2: localStorage
    const stored = localStorage.getItem('unbreakone_lang');
    if (stored && ['de', 'en'].includes(stored)) {
      return stored;
    }
    
    // Priority 3: HTML lang attribute
    const htmlLang = document.documentElement.lang;
    if (htmlLang && ['de', 'en'].includes(htmlLang)) {
      return htmlLang;
    }
  }
  
  return 'de'; // Fallback
}
```

**Erlaubte Werte:** `"de"` | `"en"` (string, lowercase)

---

### 2. **FRONTEND → BACKEND: Checkout Request**

**Datei:** [pages/cart.js](pages/cart.js#L127-155) - Neu instrumentiert!

```javascript
// Get current language for Stripe Checkout locale
const currentLang = typeof window !== 'undefined' && window.i18n?.getCurrentLanguage 
  ? window.i18n.getCurrentLanguage() 
  : 'de';

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// [STRIPE_LOCALE] A) FRONTEND - Before Checkout Request
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('[STRIPE_LOCALE] A) FRONTEND - Before Checkout Request');
console.log('[STRIPE_LOCALE] currentLang:', currentLang);
console.log('[STRIPE_LOCALE] lang source:', {
  window_i18n: typeof window?.i18n !== 'undefined',
  localStorage_lang: localStorage.getItem('unbreakone_lang'),
  html_lang: document.documentElement.lang,
  pathname: window.location.pathname,
});
console.log('[STRIPE_LOCALE] origin:', window.location.origin);
console.log('[STRIPE_LOCALE] pathname:', window.location.pathname);

const payload = {
  items: cart.getCheckoutPayload(),
  email: session?.user?.email || null,
  locale: currentLang, // ✅ CRITICAL: Pass to backend
};

console.log('[STRIPE_LOCALE] Request Payload:', {
  items_count: payload.items.length,
  locale: payload.locale, // ✅ SHOULD BE 'en' or 'de'
  email: payload.email ? '***@***' : null,
});

// POST to /api/checkout/standard
await fetch('/api/checkout/standard', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(payload),
});
```

---

### 3. **BACKEND: Language Resolution**

**Datei:** [pages/api/checkout/standard.js](pages/api/checkout/standard.js#L542-580) - Neu instrumentiert!

```javascript
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// [STRIPE_LOCALE] B) BACKEND API - Request Analysis
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('[STRIPE_LOCALE] B) BACKEND API - Checkout Request Received');
console.log('[STRIPE_LOCALE] req.headers.accept-language:', req.headers['accept-language']);
console.log('[STRIPE_LOCALE] req.body.locale:', req.body.locale); // ✅ SHOULD BE 'en' or 'de'
console.log('[STRIPE_LOCALE] Cart snapshot:', {
  items: items.slice(0, 3).map(i => ({
    sku: i.sku,
    unit_price_cents: i.unit_price_cents,
    lang: i.lang || 'NONE',
  })),
});

// PRIORITY RESOLUTION (already implemented in c908e56)
let userLanguage = 'de'; // Default

// Priority 1: req.body.locale (from cart)
if (req.body.locale && ['de', 'en'].includes(req.body.locale)) {
  userLanguage = req.body.locale; // ✅ HIGHEST PRIORITY
  console.log('[STRIPE_LOCALE] ✅ Priority 1: req.body.locale =', userLanguage);
}
// Priority 2: Cart items metadata (fallback)
else if (items[0]?.lang && ['de', 'en'].includes(items[0].lang)) {
  userLanguage = items[0].lang;
  console.log('[STRIPE_LOCALE] ✅ Priority 2: items[0].lang =', userLanguage);
}

const stripeLocale = userLanguage === 'en' ? 'en' : 'de';
console.log('[STRIPE_LOCALE] resolvedLang:', userLanguage);
console.log('[STRIPE_LOCALE] stripeLocale:', stripeLocale);
```

---

### 4. **STRIPE SESSION CREATION**

**Datei:** [pages/api/checkout/standard.js](pages/api/checkout/standard.js#L675-740) - Neu instrumentiert!

```javascript
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// [STRIPE_LOCALE] C) BEFORE STRIPE SESSION CREATION
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('[STRIPE_LOCALE] C) BEFORE stripe.checkout.sessions.create');
console.log('[STRIPE_LOCALE] sessionData.locale:', stripeLocale); // ✅ 'en' or 'de'
console.log('[STRIPE_LOCALE] success_url:', userLanguage === 'en' 
  ? `${origin}/en/success?session_id={...}` 
  : `${origin}/success?session_id={...}`);
console.log('[STRIPE_LOCALE] cancel_url:', userLanguage === 'en' 
  ? `${origin}/en/cart` 
  : `${origin}/cart`);

const sessionData = {
  payment_method_types: ['card'],
  line_items: lineItems,
  mode: 'payment',
  locale: stripeLocale, // ✅ CRITICAL: 'en' or 'de'
  success_url: userLanguage === 'en' 
    ? `${origin}/en/success?session_id={CHECKOUT_SESSION_ID}` 
    : `${origin}/success?session_id={CHECKOUT_SESSION_ID}`,
  cancel_url: userLanguage === 'en' 
    ? `${origin}/en/cart` 
    : `${origin}/cart`,
  
  // METADATA: For debugging in Stripe Dashboard
  metadata: {
    order_id: order.id,
    ui_lang: userLanguage, // ✅ 'de' or 'en'
    accept_language: req.headers['accept-language']?.substring(0, 50) || 'NONE',
    build_commit: process.env.VERCEL_GIT_COMMIT_SHA || 'local',
    // ... other metadata
  },
};

// CREATE SESSION
const session = await stripe.checkout.sessions.create(sessionData);

console.log('[STRIPE_LOCALE] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('[STRIPE_LOCALE] ✅ SESSION CREATED SUCCESSFULLY');
console.log('[STRIPE_LOCALE] stripe_session_id:', session.id);
console.log('[STRIPE_LOCALE] session.locale:', session.locale); // ✅ SHOULD MATCH stripeLocale
console.log('[STRIPE_LOCALE] metadata.ui_lang:', session.metadata.ui_lang);
console.log('[STRIPE_LOCALE] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
```

---

## 🧪 C) TESTANLEITUNG (Vercel Production)

### ✅ TEST 1: ENGLISH FLOW

**Steps:**
1. Open: `https://unbreak-one.com/en` (or any EN page)
2. Add product to cart (Glashalter or Flaschenhalter)
3. Click "Proceed to Checkout"
4. Open Browser Console (F12)
5. Check logs with prefix `[STRIPE_LOCALE]`

**Expected Browser Console Logs:**
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[STRIPE_LOCALE] A) FRONTEND - Before Checkout Request
[STRIPE_LOCALE] currentLang: en
[STRIPE_LOCALE] lang source: {
  window_i18n: true,
  localStorage_lang: "en",
  html_lang: "en",
  pathname: "/en/cart"
}
[STRIPE_LOCALE] Request Payload: {
  items_count: 1,
  locale: "en", // ✅ CRITICAL
  email: null
}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

**Expected Vercel Logs:** (Go to https://vercel.com → Logs)
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[STRIPE_LOCALE] B) BACKEND API - Checkout Request Received
[STRIPE_LOCALE] req.body.locale: en
[STRIPE_LOCALE] ✅ Priority 1: req.body.locale = en
[STRIPE_LOCALE] resolvedLang: en
[STRIPE_LOCALE] stripeLocale: en
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[STRIPE_LOCALE] C) BEFORE stripe.checkout.sessions.create
[STRIPE_LOCALE] sessionData.locale: en
[STRIPE_LOCALE] success_url: https://unbreak-one.com/en/success?session_id={...}
[STRIPE_LOCALE] cancel_url: https://unbreak-one.com/en/cart
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[STRIPE_LOCALE] ✅ SESSION CREATED SUCCESSFULLY
[STRIPE_LOCALE] stripe_session_id: cs_test_abc123...
[STRIPE_LOCALE] session.locale: en // ✅ STRIPE CONFIRMS
[STRIPE_LOCALE] metadata.ui_lang: en
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

**Expected Stripe Checkout UI:**
- Language: **English** ✅
- "Pay" button (not "Bezahlen")
- "Card number" (not "Kartennummer")

**Stripe Dashboard Verification:**
1. Go to: https://dashboard.stripe.com/test/payments
2. Find session (cs_test_abc123...)
3. Click session → View Details
4. Check **Metadata:**
   - `ui_lang: en` ✅
   - `accept_language: en-US,en;q=0.9,...`
   - `build_commit: cd197c7` ✅

---

### ✅ TEST 2: GERMAN FLOW

**Steps:**
1. Open: `https://unbreak-one.com` (German, no /en/)
2. Add product to cart
3. Click "Zur Kasse"
4. Open Browser Console (F12)
5. Check logs

**Expected Browser Console Logs:**
```
[STRIPE_LOCALE] A) FRONTEND - Before Checkout Request
[STRIPE_LOCALE] currentLang: de
[STRIPE_LOCALE] lang source: {
  localStorage_lang: "de",
  html_lang: "de",
  pathname: "/cart"
}
[STRIPE_LOCALE] Request Payload: {
  locale: "de", // ✅ CRITICAL
}
```

**Expected Vercel Logs:**
```
[STRIPE_LOCALE] req.body.locale: de
[STRIPE_LOCALE] ✅ Priority 1: req.body.locale = de
[STRIPE_LOCALE] stripeLocale: de
[STRIPE_LOCALE] sessionData.locale: de
[STRIPE_LOCALE] session.locale: de
[STRIPE_LOCALE] metadata.ui_lang: de
```

**Expected Stripe Checkout UI:**
- Language: **Deutsch** ✅
- "Bezahlen" button (not "Pay")
- "Kartennummer" (not "Card number")

---

## 🚨 FEHLERFALL-ANALYSE

### Scenario 1: Stripe zeigt trotzdem DE (obwohl session.locale = en)

**BEWEISE SAMMELN:**

**A) Browser Console Screenshot:**
- Zeige `[STRIPE_LOCALE] Request Payload: { locale: "en" }`

**B) Vercel Logs Screenshot:**
- Zeige `[STRIPE_LOCALE] session.locale: en`

**C) Stripe Dashboard Screenshot:**
- Session Details → Metadata → `ui_lang: en`

**D) Stripe Session URL prüfen:**
```javascript
// In Browser Console NACH Redirect:
console.log(window.location.href);
// Sollte sein: https://checkout.stripe.com/c/pay/cs_test_...
```

**E) Stripe Session ID aus URL extrahieren:**
```javascript
// URL: https://checkout.stripe.com/c/pay/cs_test_abc123xyz#fidkdWx...
// Session ID: cs_test_abc123xyz
```

**F) Stripe Dashboard Query:**
1. Go to: https://dashboard.stripe.com/test/payments/cs_test_abc123xyz
2. Check `locale` field (sollte `en` sein)
3. Screenshot Metadata

**G) Caching prüfen:**
```bash
# In Browser Console:
localStorage.clear();
sessionStorage.clear();
location.reload();
```

**H) Alte Session wiederverwendet?**
- Vergleiche `session.created` timestamp (Stripe Dashboard)
- Mit Vercel Log timestamp (sollte ~gleich sein)

**I) Zweite Route checken:**
```bash
# In Vercel Logs suchen:
grep "stripe.checkout.sessions.create" -r pages/api/
# Sollte NUR in pages/api/checkout/standard.js sein
```

---

## 📊 ERWARTETE LOGAUSGABE (Beispiele)

### EN Flow (Complete):
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[STRIPE_LOCALE] A) FRONTEND - Before Checkout Request
[STRIPE_LOCALE] currentLang: en
[STRIPE_LOCALE] lang source: {window_i18n: true, localStorage_lang: "en", html_lang: "en", pathname: "/en/cart"}
[STRIPE_LOCALE] origin: https://unbreak-one.com
[STRIPE_LOCALE] pathname: /en/cart
[STRIPE_LOCALE] Request Payload: {items_count: 1, locale: "en", email: null}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

[Vercel Backend Logs]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[STRIPE_LOCALE] B) BACKEND API - Checkout Request Received
[STRIPE_LOCALE] req.headers.accept-language: en-US,en;q=0.9,de;q=0.8
[STRIPE_LOCALE] req.body.locale: en
[STRIPE_LOCALE] req.body.items count: 1
[STRIPE_LOCALE] Cart snapshot: {items: [{sku: "UNBREAK-GLAS-01", unit_price_cents: 1990, lang: "NONE"}]}
[STRIPE_LOCALE] ✅ Priority 1: req.body.locale = en
[STRIPE_LOCALE] resolvedLang: en
[STRIPE_LOCALE] stripeLocale: en
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[STRIPE_LOCALE] C) BEFORE stripe.checkout.sessions.create
[STRIPE_LOCALE] sessionData.locale: en
[STRIPE_LOCALE] success_url: https://unbreak-one.com/en/success?session_id={CHECKOUT_SESSION_ID}
[STRIPE_LOCALE] cancel_url: https://unbreak-one.com/en/cart
[STRIPE_LOCALE] line_items: [{name: "Glass Holder", sku: "UNBREAK-GLAS-01", amount: 1990, qty: 1}]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[STRIPE_LOCALE] ✅ SESSION CREATED SUCCESSFULLY
[STRIPE_LOCALE] stripe_session_id: cs_test_a1b2c3d4e5f6g7h8i9j0
[STRIPE_LOCALE] session.locale: en
[STRIPE_LOCALE] session.url: https://checkout.stripe.com/c/pay/cs_test_a1b2c3d4e5f6g7h8i9j0#fidkd...
[STRIPE_LOCALE] metadata.ui_lang: en
[STRIPE_LOCALE] metadata.accept_language: en-US,en;q=0.9,de;q=0.8
[STRIPE_LOCALE] metadata.build_commit: cd197c7
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### DE Flow (Complete):
```
[STRIPE_LOCALE] A) FRONTEND - Before Checkout Request
[STRIPE_LOCALE] currentLang: de
[STRIPE_LOCALE] Request Payload: {locale: "de"}

[Vercel Backend]
[STRIPE_LOCALE] req.body.locale: de
[STRIPE_LOCALE] ✅ Priority 1: req.body.locale = de
[STRIPE_LOCALE] stripeLocale: de
[STRIPE_LOCALE] sessionData.locale: de
[STRIPE_LOCALE] session.locale: de
[STRIPE_LOCALE] metadata.ui_lang: de
```

---

## 🎯 ACCEPTANCE CRITERIA

**MUST PASS:**
- [ ] EN Flow: Browser Console zeigt `locale: "en"`
- [ ] EN Flow: Vercel Logs zeigen `req.body.locale: en`
- [ ] EN Flow: Vercel Logs zeigen `session.locale: en`
- [ ] EN Flow: Stripe Dashboard Metadata zeigt `ui_lang: en`
- [ ] EN Flow: Stripe Checkout UI ist auf Englisch
- [ ] DE Flow: Browser Console zeigt `locale: "de"`
- [ ] DE Flow: Vercel Logs zeigen `req.body.locale: de`
- [ ] DE Flow: Stripe Checkout UI ist auf Deutsch

**PROOF DELIVERABLES:**
- [ ] Screenshot: Browser Console (EN Flow) - `[STRIPE_LOCALE]` logs
- [ ] Screenshot: Vercel Logs (EN Flow) - Complete flow A→B→C
- [ ] Screenshot: Stripe Dashboard (EN Session) - Metadata `ui_lang: en`
- [ ] Screenshot: Stripe Checkout UI (EN) - English labels

---

## 📝 COMMIT INFO

**Branch:** master  
**Commit:** cd197c7  
**Message:** DEBUG: STRIPE_LOCALE hard instrumentation (Frontend + Backend + Metadata)

**Files Changed:**
- `pages/cart.js` - Frontend checkout request logging
- `pages/api/checkout/standard.js` - Backend language resolution + session creation logging
- `I18N-CART-STRIPE-TEST-GUIDE.md` - Test documentation

**Deployment:**
- Vercel auto-deploying: https://unbreak-one.com
- ETA: ~2-3 minutes
- Live after deployment: ✅

---

**Testing Date:** 2026-01-16  
**Priority:** P0 - Messe Blocker 🚨  
**Status:** ⏳ Ready for testing after Vercel deployment
