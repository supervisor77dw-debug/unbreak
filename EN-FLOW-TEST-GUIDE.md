# EN Flow End-to-End Test

## 🎯 Goal

Test the complete i18n flow from English site visit to English email confirmation.

**Success Criteria:**
- ✅ Cart UI in English
- ✅ Stripe Checkout in English
- ✅ Customer Email in English
- ✅ Admin Email in English (or German, documented)

---

## Prerequisites

### 1. Configurator MUST Send lang Field

⚠️ **BLOCKER:** Configurator must implement `lang` field in cart item.

**Verify in console:**
```javascript
// In shop page, after configurator adds item:
const cart = JSON.parse(localStorage.getItem('unbreakone_cart') || '{}');
console.log('Cart items:', cart.items);
// → Each item should have `lang: 'en'` or `lang: 'de'`
```

If `lang` is missing → See `CONFIGURATOR-I18N-REQUIREMENTS.md`

---

### 2. Deploy to Preview Environment

**Option A: Vercel Preview Deploy**
```bash
git push origin feat/i18n-messe
# → Vercel auto-deploys preview
# → Get URL: https://unbreak-one-<hash>.vercel.app
```

**Option B: Local Test**
```bash
npm run dev
# → http://localhost:3000
```

**Recommended:** Vercel preview (closer to production)

---

## Test Procedure

### Step 1: Open Site in English

**URL:**
```
https://your-preview-url.vercel.app/?lang=en
```

**Expected:**
- Navigation in English
- Hero section in English
- Product descriptions in English

**Screenshot 1:** 📸 Homepage in English
- Filename: `01-homepage-en.png`
- Include: Navigation, hero, product cards

---

### Step 2: Open Configurator

**Actions:**
1. Click configurator CTA or navigate to configurator
2. **Verify:** Configurator detects `lang=en` from URL/localStorage

**Console Check:**
```javascript
// In configurator iframe (if applicable):
console.log('Configurator language:', detectLanguage());
// → Expected: 'en'

// Or check localStorage:
console.log('Stored lang:', localStorage.getItem('unbreakone_lang'));
// → Expected: 'en'
```

**Expected:**
- Configurator UI in English (if implemented)
- OR: Configurator detects EN but UI still DE (acceptable for now)

---

### Step 3: Configure Product

**Actions:**
1. Select colors, finish, variant
2. **CRITICAL:** Before clicking "Add to Cart", verify language detection

**Console Check (CRITICAL):**
```javascript
// Build test item to verify lang:
const testItem = buildCartItem(currentConfig);
console.log('Item will have lang:', testItem.lang);
// → MUST be 'en'

console.log('Full item:', JSON.stringify(testItem, null, 2));
// → Verify: "lang": "en"
```

**Screenshot 2:** 📸 Configurator with product
- Filename: `02-configurator-product-en.png`
- Include: Configured product, console showing `lang: 'en'`

---

### Step 4: Add to Cart

**Actions:**
1. Click "Add to Cart" / "In den Warenkorb" (button text may still be DE)
2. Wait for redirect to shop

**Expected:**
- postMessage sent to shop
- Shop receives item with `lang: 'en'`
- Redirect to `/shop?cfg=...` or similar

**Console Check (Shop Page):**
```javascript
// After item added:
const cart = getCart();
const items = cart.getItems();
console.log('Cart items:', items);
console.log('First item lang:', items[0]?.lang);
// → Expected: 'en'
```

---

### Step 5: View Cart

**URL:** Navigate to `/cart` or click cart icon

**Expected Cart UI (ALL IN ENGLISH):**
- Header: "Shopping Cart" (not "Warenkorb")
- Subtotal: "Subtotal" (not "Zwischensumme")
- Shipping: "Shipping" (not "Versand")
- Grand Total: "Grand Total" (not "Gesamtsumme")
- Button: "Proceed to Checkout" (not "Zur Kasse")

**Screenshot 3:** 📸 Cart Page in English ⭐ **REQUIRED**
- Filename: `03-cart-en.png`
- Include:
  - Full cart page
  - All labels in English
  - Product in cart
  - Price summary
  - Checkout button

**Console Verification:**
```javascript
// Verify language detection:
console.log('Current lang:', window.i18n?.getCurrentLanguage());
// → Expected: 'en'

// Verify cart item:
const cart = getCart();
console.log('Cart item lang:', cart.getItems()[0]?.lang);
// → Expected: 'en'
```

---

### Step 6: Proceed to Checkout

**Actions:**
1. Click "Proceed to Checkout" button
2. Wait for Stripe Checkout redirect

**Expected:**
- POST to `/api/checkout/standard`
- Stripe session created with `locale: 'en'`

**Console Check (Before redirect):**
```javascript
// Network tab → Find POST to /api/checkout/standard
// Request payload should include item with lang: 'en'

// Or check in shop.js logs:
console.log('[Checkout] Language from cart item: en');
console.log('[Checkout] Stripe locale: en');
```

---

### Step 7: Verify Stripe Checkout (CRITICAL)

**Expected Stripe Page (IN ENGLISH):**
- Payment form labels in English
- "Pay €XX.XX" button in English
- Shipping form in English
- Email field label: "Email" (not "E-Mail")

**How to Verify:**
1. Look at Stripe URL: Should contain `locale=en`
   ```
   https://checkout.stripe.com/c/pay/cs_...#fidkdWxOYHw...&locale=en
   ```

2. Visual check: All text on Stripe page should be English

**Screenshot 4:** 📸 Stripe Checkout in English ⭐ **REQUIRED**
- Filename: `04-stripe-checkout-en.png`
- Include:
  - Full Stripe payment form
  - URL bar showing `locale=en`
  - Product summary
  - Payment button

**If Stripe is still in German:**
- ❌ FAILED: Locale not set correctly
- Check: `/api/checkout/standard.js` line ~661
- Verify: `locale: stripeLocale` is in session data
- Debug: Console logs should show `[Checkout] Stripe locale: en`

---

### Step 8: Complete Test Payment

**Actions:**
1. Enter test data:
   - Email: `test-en@example.com`
   - Card: `4242 4242 4242 4242`
   - Expiry: Any future date (e.g., `12/34`)
   - CVC: Any 3 digits (e.g., `123`)
   - Name: `EN Test Customer`
   - Address: Any valid address

2. Click "Pay" button

**Expected:**
- Payment processing
- Redirect to success page
- Webhook triggers

---

### Step 9: Check Webhook Logs (Vercel)

**Vercel Dashboard:**
1. Go to Vercel project
2. Functions → `/api/webhooks/stripe`
3. Find latest execution
4. Check logs for:

```
[LANG] Detected from cart item: en
[LANG] Final language for email: en
[EMAIL] Recipient: test-en@example.com
```

**Expected:**
- ✅ Language detected as `'en'`
- ✅ Email sent with `language: 'en'` parameter

**Screenshot 5:** 📸 Webhook Logs showing lang=en
- Filename: `05-webhook-logs-en.png`
- Include: Language detection logs

---

### Step 10: Verify Customer Email (CRITICAL)

**Check Email Inbox:** `test-en@example.com`

**Expected Email (IN ENGLISH):**

**Subject:**
```
Order confirmation UO-2026-XXXXX – UNBREAK ONE
```
(NOT "Bestellbestätigung")

**Body:**
```
Hello EN Test Customer,

Thank you for your order at UNBREAK ONE!

Your order has been confirmed and will be processed shortly.

Order Number: UO-2026-XXXXX
Order Date: January 15, 2026

Items:
──────────────────────────────────────
1 × Custom Glass Holder – €39.00

──────────────────────────────────────

Subtotal: €39.00
Shipping: €4.90
VAT (19%): €8.34

TOTAL: €52.24
```

**Screenshot 6:** 📸 Customer Email in English ⭐ **REQUIRED**
- Filename: `06-customer-email-en.png`
- Include:
  - Full email (subject + body)
  - Highlight: English text (not German)
  - Order number
  - Price breakdown

**If Email is in German:**
- ❌ FAILED: Language not passed to email service
- Check: Webhook logs for `[LANG] Final language for email: de` (should be `en`)
- Debug: Verify cart item has `lang: 'en'`
- Check: `pages/api/webhooks/stripe.js` lines ~460-480

---

### Step 11: Verify Admin/Orders Email

**Check Email Inbox:** `orders@unbreak-one.com` (or BCC recipient)

**Expected:**
- Email received (BCC from customer confirmation)
- Language: Can be German OR English (document which)

**Screenshot 7:** 📸 Admin Email
- Filename: `07-admin-email.png`
- Include: Full email
- Note: Document language (DE or EN)

---

## German Flow (Comparison Test)

**Quick Test:** Repeat steps 1-11 with `?lang=de`

**Expected Differences:**
- Cart UI in German
- Stripe in German (`locale=de`)
- Email in German

**Screenshot 8:** 📸 DE Cart for comparison
- Filename: `08-cart-de.png`

**Screenshot 9:** 📸 DE Email for comparison
- Filename: `09-customer-email-de.png`

---

## Success Checklist

### Cart UI (Step 5)
- [ ] Header: "Shopping Cart" ✅
- [ ] Empty state: "Your cart is empty" (if tested)
- [ ] Subtotal: "Subtotal" ✅
- [ ] Shipping: "Shipping" ✅
- [ ] Grand Total: "Grand Total" ✅
- [ ] Free shipping: "Free" ✅
- [ ] Checkout button: "Proceed to Checkout" ✅
- [ ] Redirecting text: "Redirecting to Stripe..." ✅

### Stripe Checkout (Step 7)
- [ ] URL contains `locale=en` ✅
- [ ] Payment form in English ✅
- [ ] Product name in English ✅
- [ ] Pay button in English ✅

### Customer Email (Step 10)
- [ ] Subject: "Order confirmation" ✅
- [ ] Greeting: "Hello [Name]," ✅
- [ ] Thanks: "Thank you for your order" ✅
- [ ] Confirmed: "has been confirmed" ✅
- [ ] Subtotal: "Subtotal" ✅
- [ ] Shipping: "Shipping" ✅
- [ ] VAT: "VAT (19%)" ✅
- [ ] Total: "TOTAL" ✅

### Technical (Console/Logs)
- [ ] Cart item has `lang: 'en'` ✅
- [ ] Checkout logs show `lang: en` ✅
- [ ] Webhook detects `lang: en` ✅
- [ ] Email service receives `language: 'en'` ✅

---

## Failure Scenarios

### Scenario 1: Cart still in German
**Symptom:** Cart shows "Warenkorb", "Zwischensumme", etc.

**Cause:** `ts()` function not detecting language correctly

**Debug:**
```javascript
// In cart page console:
console.log('window.i18n:', window.i18n);
console.log('getCurrentLanguage():', window.i18n?.getCurrentLanguage());
```

**Fix:** Check `lib/i18n-shop.js` → `getCurrentLanguage()` function

---

### Scenario 2: Stripe still in German
**Symptom:** Stripe checkout page in German despite `?lang=en`

**Cause:** Cart item missing `lang` field OR checkout API not extracting it

**Debug:**
```javascript
// In shop console before checkout:
const cart = getCart();
console.log('Cart items:', cart.getItems());
// → Verify lang: 'en'

// In Network tab → POST /api/checkout/standard:
// → Request should include items[0].lang = 'en'
```

**Fix:** 
1. Configurator: Add `lang` to item
2. Checkout API: Verify extraction (line ~560)

---

### Scenario 3: Email in German
**Symptom:** Customer email arrives in German

**Cause:** Language not detected from cart OR email service fallback to DE

**Debug (Webhook Logs):**
```
[LANG] Detected from cart item: de  ← Should be 'en'
```

**Fix:** Verify cart item has `lang: 'en'` in order record

---

## Required Screenshots Summary

1. `01-homepage-en.png` - Homepage in English
2. `02-configurator-product-en.png` - Configurator with console
3. ⭐ `03-cart-en.png` - **CRITICAL: Cart page in English**
4. ⭐ `04-stripe-checkout-en.png` - **CRITICAL: Stripe in English**
5. `05-webhook-logs-en.png` - Webhook language detection
6. ⭐ `06-customer-email-en.png` - **CRITICAL: Customer email in English**
7. `07-admin-email.png` - Admin email (document language)
8. `08-cart-de.png` - Cart in German (comparison)
9. `09-customer-email-de.png` - Email in German (comparison)

**Minimum Required:** 3, 4, 6 (Cart, Stripe, Email)

---

## Next Steps After Success

1. **Create comparison document:**
   - Side-by-side: EN vs DE
   - Highlight differences

2. **Tag release:**
   ```bash
   git tag -a v1.1-messe-i18n -m "i18n for cart, checkout, emails - EN/DE"
   git push origin v1.1-messe-i18n
   ```

3. **Merge to master:**
   ```bash
   git checkout master
   git merge feat/i18n-messe
   git push origin master
   ```

4. **Deploy to production:**
   - Vercel: Merge triggers auto-deploy
   - OR: Manual deploy from dashboard

---

## Rollback Plan

If EN flow fails:

```bash
# Keep working in feat/i18n-messe branch
# Don't merge to master
# Production stays at v1.0-messe ✅

git checkout master
# → master still at v1.0-messe (safe)
```

---

**Test Duration:** ~15-20 minutes
**Critical Path:** Cart UI → Stripe Locale → Email Language
**Blocker:** Configurator must send `lang` field
**Status:** ⏳ Ready for testing after configurator update
