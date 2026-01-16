# i18n CONSISTENCY TEST - Cart + Stripe Checkout
**Status:** ✅ Deployed (Commit c908e56)  
**Vercel:** Auto-deploying (~2-3 min)  
**Date:** 2026-01-16

---

## 🎯 Implementation Summary

### A) Cart - "Entfernen" Button übersetzt ✅

**Changed:** [pages/cart.js](pages/cart.js#L394)

**Before:**
```jsx
<button onClick={() => handleRemoveItem(item.product_id)}>
  Entfernen
</button>
```

**After:**
```jsx
<button onClick={() => handleRemoveItem(item.product_id)}>
  {t('cart.remove')}
</button>
```

**Translations (lib/i18n-shop.js):**
- DE: `cart.remove: "Entfernen"`
- EN: `cart.remove: "Remove"`

---

### B) Stripe Checkout Locale ✅

**Changed:** 
- [pages/cart.js](pages/cart.js#L130-135) - Send locale to API
- [pages/api/checkout/standard.js](pages/api/checkout/standard.js#L542-564) - Use req.body.locale

**Cart sends locale:**
```javascript
const currentLang = window.i18n?.getCurrentLanguage() || 'de';

const payload = {
  items: cart.getCheckoutPayload(),
  email: session?.user?.email || null,
  locale: currentLang, // 🌐 Pass to Stripe
};
```

**API prioritizes locale:**
```javascript
// Priority 1: req.body.locale (from cart)
if (req.body.locale && ['de', 'en'].includes(req.body.locale)) {
  userLanguage = req.body.locale;
}
// Priority 2: Cart items metadata
// Priority 3: Default 'de'

const stripeLocale = userLanguage === 'en' ? 'en' : 'de';

const session = await stripe.checkout.sessions.create({
  locale: stripeLocale, // ✅ 'de' or 'en'
  // ...
});
```

---

### C) Success/Cancel URLs mit Sprache ✅

**Changed:** [pages/api/checkout/standard.js](pages/api/checkout/standard.js#L641-648)

**Implementation:**
```javascript
const sessionData = {
  // ...
  success_url: userLanguage === 'en' 
    ? `${origin}/en/success?session_id={CHECKOUT_SESSION_ID}` 
    : `${origin}/success?session_id={CHECKOUT_SESSION_ID}`,
  cancel_url: userLanguage === 'en' 
    ? `${origin}/en/cart` 
    : `${origin}/cart`,
};
```

**URL Examples:**
- DE Flow: `/success?session_id=...` → `/cart`
- EN Flow: `/en/success?session_id=...` → `/en/cart`

---

## ✅ ACCEPTANCE TESTS (Nach Vercel Deployment)

### Test 1: Cart Remove Button (DE)

**Steps:**
1. Navigate to: `https://unbreak-one.com/cart` (or German page)
2. Add item to cart
3. Check button text

**Expected:**
- Button shows: **"Entfernen"** ✅
- Clicking removes item ✅

**Screenshot Required:**
- [ ] Cart DE mit "Entfernen" Button

---

### Test 2: Cart Remove Button (EN)

**Steps:**
1. Navigate to: `https://unbreak-one.com/en/cart` (or English page)
2. Add item to cart
3. Check button text

**Expected:**
- Button shows: **"Remove"** ✅
- Clicking removes item ✅

**Screenshot Required:**
- [ ] Cart EN mit "Remove" Button

---

### Test 3: Stripe Checkout DE

**Steps:**
1. Navigate to: `https://unbreak-one.com/cart` (German)
2. Add item to cart
3. Click "Zur Kasse" / "Checkout"
4. Check Stripe Checkout UI language

**Expected:**
- Stripe UI shows: **German** ✅
- Payment form labels: German ✅
- "Bezahlen" button (not "Pay") ✅
- Console log: `🌐 [Checkout] Stripe locale: de` ✅

**Screenshot Required:**
- [ ] Stripe Checkout UI auf Deutsch

---

### Test 4: Stripe Checkout EN

**Steps:**
1. Navigate to: `https://unbreak-one.com/en/cart` (English)
2. Add item to cart
3. Click "Proceed to Checkout"
4. Check Stripe Checkout UI language

**Expected:**
- Stripe UI shows: **English** ✅
- Payment form labels: English ✅
- "Pay" button (not "Bezahlen") ✅
- Console log: `🌐 [Checkout] Stripe locale: en` ✅

**Screenshot Required:**
- [ ] Stripe Checkout UI in English

---

### Test 5: Success Return (DE → DE)

**Steps:**
1. Start checkout from German cart
2. Complete Stripe payment (test card: 4242 4242 4242 4242)
3. Check redirect URL after success

**Expected:**
- Redirects to: `/success?session_id=...` ✅
- Page language: German ✅
- Success message: "Bestellung erfolgreich!" ✅

---

### Test 6: Success Return (EN → EN)

**Steps:**
1. Start checkout from English cart (`/en/cart`)
2. Complete Stripe payment (test card: 4242 4242 4242 4242)
3. Check redirect URL after success

**Expected:**
- Redirects to: `/en/success?session_id=...` ✅
- Page language: English ✅
- Success message: "Order successful!" ✅

---

### Test 7: Cancel Return (DE → DE)

**Steps:**
1. Start checkout from German cart
2. Click "Back" / cancel in Stripe
3. Check redirect URL

**Expected:**
- Redirects to: `/cart` ✅
- Page language: German ✅
- Cart still has items ✅

---

### Test 8: Cancel Return (EN → EN)

**Steps:**
1. Start checkout from English cart (`/en/cart`)
2. Click "Back" / cancel in Stripe
3. Check redirect URL

**Expected:**
- Redirects to: `/en/cart` ✅
- Page language: English ✅
- Cart still has items ✅

---

## 🔧 Console Logs (Vercel)

**Expected logs during checkout:**

```
🌐 [Checkout] Origin: https://unbreak-one.com
🌐 [Checkout] Language from request body: en
🌐 [Checkout] Stripe locale: en
💰 [Checkout] Creating line item for UNBREAK-GLAS-01: €19.90
✅ [VALIDATION] Stripe amount verified: { amount_cents: 1990, matches_snapshot: true }
```

---

## 📊 Proof für Coder (Required)

### 1. Screenshots

**Cart Buttons:**
- [ ] Screenshot: Cart DE - Button "Entfernen"
- [ ] Screenshot: Cart EN - Button "Remove"

**Stripe Checkout:**
- [ ] Screenshot: Stripe Checkout DE (German UI)
- [ ] Screenshot: Stripe Checkout EN (English UI)

**Naming:**
- `cart-de-remove-button.png`
- `cart-en-remove-button.png`
- `stripe-checkout-de.png`
- `stripe-checkout-en.png`

### 2. PR/Commit Link

**Commit:** `c908e56`  
**Message:** "P0 i18n: Cart + Stripe Checkout vollständig DE/EN"  
**Files Changed:**
- pages/cart.js
- pages/api/checkout/standard.js
- POST-MESSE-PRICING-CLEANUP.md (documentation)

**GitHub:**
```
https://github.com/supervisor77dw-debug/unbreak/commit/c908e56
```

---

## 🚀 Deployment Status

**Branch:** master  
**Commit:** c908e56  
**Pushed:** ✅  
**Vercel:** Auto-deploying  
**ETA:** ~2-3 minutes  

**Ready for testing:** After Vercel deployment completes

---

## 🎯 Acceptance Criteria (Summary)

**MUST PASS:**
- [ ] Cart DE → "Entfernen" Button
- [ ] Cart EN → "Remove" Button
- [ ] Stripe Checkout DE → German UI
- [ ] Stripe Checkout EN → English UI
- [ ] Success DE → `/success` (German)
- [ ] Success EN → `/en/success` (English)
- [ ] Cancel DE → `/cart` (German)
- [ ] Cancel EN → `/en/cart` (English)

**All tests must pass before merge signoff!**

---

**Testing Date:** 2026-01-16  
**Tester:** User (nach Vercel deployment)  
**Status:** ⏳ Awaiting screenshots + verification
