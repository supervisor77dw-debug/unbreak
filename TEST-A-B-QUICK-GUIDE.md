# Test A+B: EN/DE Flow Verification

## 🎯 Goal

Verify effectiveLang resolution and i18n flow with console screenshots.

**Required Screenshots:**
1. ⭐ Shop Console (EN) - effectiveLang + item.lang
2. ⭐ Customer Email (EN) - Full email in English

---

## Test A: English Flow (?lang=en)

### Step 1: Open Shop with EN Parameter

**URL (Vercel Preview):**
```
https://unbreak-one-<hash>.vercel.app/?lang=en
```

**OR Local:**
```
http://localhost:3000/?lang=en
```

**Expected:**
- Site language switches to English
- Navigation, hero, products in English

---

### Step 2: Open Browser Console

**Chrome/Edge:**
- Press `F12` or `Ctrl+Shift+I`
- Click "Console" tab

**Firefox:**
- Press `F12` or `Ctrl+Shift+K`
- Click "Console" tab

**Safari:**
- Enable Developer Menu: Safari → Preferences → Advanced → Show Develop menu
- Press `Cmd+Option+C`

---

### Step 3: Enable Debug Mode

**In Console, run:**
```javascript
localStorage.setItem('unbreakone_debug', 'true');
location.reload();
```

**Expected:**
- Page reloads
- Debug mode enabled

---

### Step 4: Prepare Configurator Item (Simulate)

**In Console, create test item:**
```javascript
// Simulate configurator item with lang='en'
const testItem = {
  product_id: "glass_configurator",
  sku: "glass_configurator",
  name: "Custom Glass Holder",
  price_cents: 3900, // €39.00
  quantity: 1,
  configured: true,
  lang: 'en', // ← CRITICAL
  config: {
    variant: "glass_holder",
    baseColor: "#1A1A1A",
    accentColor: "#FFD700",
    finish: "matte"
  },
  meta: {
    lang: 'en' // Redundant but safe
  }
};

// Encode to base64 (like configurator does)
const json = JSON.stringify(testItem);
const base64 = btoa(unescape(encodeURIComponent(json)));
const cfgParam = encodeURIComponent(base64);

console.log('Test item created:', testItem);
console.log('cfg parameter:', cfgParam);
```

---

### Step 5: Navigate with cfg Parameter

**In Console, run:**
```javascript
// Navigate to shop with cfg parameter (simulates configurator redirect)
window.location.href = `/shop?cfg=${cfgParam}`;
```

**Expected:**
- Page redirects to `/shop?cfg=...`
- Cart receives item

---

### Step 6: Watch Console Logs (CRITICAL)

**Look for these logs:**

**Language Resolution:**
```
[CFG2CART][LANG] Language resolution: {
  item.lang: 'en',
  item.meta.lang: 'en',
  URL lang: 'en',
  currentLang: 'en',
  effectiveLang: 'en'  ← VERIFY THIS
}

[CFG2CART][LANG] Setting site language to: en
```

**Cart Item Normalization:**
```
[CFG2CART][ITEM] Normalized cart item: {
  product_id: 'glass_configurator',
  sku: 'UNBREAK-GLAS-CONFIG',
  price_cents: 3900,  ← VERIFY NOT 0 or NaN
  lang: 'en',         ← VERIFY THIS
  config: {...}
}
```

**Success:**
```
[CFG2CART][SUCCESS] ✅ Item added to cart
```

---

### Step 7: Screenshot Console (REQUIRED ⭐)

**What to capture:**
1. Full console output showing:
   - `[CFG2CART][LANG]` logs
   - `effectiveLang: 'en'`
   - `item.lang: 'en'`
   - `[CFG2CART][ITEM]` normalized item
   - `price_cents: 3900` (not NaN)
   - `lang: 'en'`
   - `[CFG2CART][SUCCESS]`

**Filename:** `test-a-console-en.png`

**Tips:**
- Expand log objects to show details
- Highlight key values (effectiveLang, lang, price_cents)
- Include timestamp for verification

---

### Step 8: Verify Cart UI

**Navigate to:**
```
/cart
```

**Expected Cart UI (IN ENGLISH):**
- Header: "Shopping Cart" ✅
- Subtotal: "Subtotal" ✅
- Shipping: "Shipping" ✅
- Grand Total: "Grand Total" ✅
- Button: "Proceed to Checkout" ✅
- Price: €39.00 (not NaN) ✅

**Optional Screenshot:** `test-a-cart-en.png`

---

### Step 9: Proceed to Checkout

**Click:** "Proceed to Checkout" button

**Expected:**
- Redirect to Stripe
- URL contains `locale=en`

**Verify in Network Tab:**
- Find POST to `/api/checkout/standard`
- Check request payload:
  ```json
  {
    "items": [{
      "lang": "en",  ← VERIFY
      "price_cents": 3900,  ← VERIFY
      // ...
    }]
  }
  ```

**Optional Screenshot:** `test-a-stripe-en.png`

---

### Step 10: Complete Test Purchase

**Stripe Test Card:**
- Card: `4242 4242 4242 4242`
- Expiry: `12/34`
- CVC: `123`
- Email: `test-en@example.com`
- Name: `EN Test Customer`

**Click:** Pay button

**Expected:**
- Payment success
- Redirect to success page
- Webhook triggers

---

### Step 11: Check Webhook Logs (Vercel)

**Vercel Dashboard:**
1. Functions → `/api/webhooks/stripe`
2. Latest execution
3. Look for:

```
[LANG] Detected from cart item: en
[LANG] Final language for email: en
[EMAIL] Recipient: test-en@example.com
```

**Optional Screenshot:** `test-a-webhook-en.png`

---

### Step 12: Verify Customer Email (REQUIRED ⭐)

**Check inbox:** `test-en@example.com`

**Expected Email Subject:**
```
Order confirmation UO-2026-XXXXX – UNBREAK ONE
```

**Expected Email Body (IN ENGLISH):**
```
Hello EN Test Customer,

Thank you for your order at UNBREAK ONE!

Your order has been confirmed and will be processed shortly.

Order Number: UO-2026-XXXXX
Order Date: January 16, 2026

Items:
──────────────────────────────────────
1 × Custom Glass Holder – €39.00
──────────────────────────────────────

Subtotal: €39.00
Shipping: €4.90
VAT (19%): €8.34

TOTAL: €52.24
```

**Screenshot (CRITICAL ⭐):** `test-a-email-en.png`

**What to capture:**
- Full email (subject + body)
- Highlight: English text ("Hello", "Thank you", "Subtotal", "VAT")
- Order number visible
- Price €39.00 (not NaN)

---

## Test B: German Flow (Default)

### Step 1: Clear Test State

**In Console:**
```javascript
// Clear debug flag
localStorage.removeItem('unbreakone_debug');

// Clear language (to test default)
localStorage.removeItem('unbreakone_lang');

// Reload
location.reload();
```

---

### Step 2: Open Shop WITHOUT lang Parameter

**URL:**
```
https://unbreak-one-<hash>.vercel.app/
```

**Expected:**
- Site defaults to German
- Navigation, hero, products in German

---

### Step 3: Enable Debug + Create DE Item

**In Console:**
```javascript
// Enable debug
localStorage.setItem('unbreakone_debug', 'true');
location.reload();

// After reload, create DE test item
const testItemDE = {
  product_id: "glass_configurator",
  sku: "glass_configurator",
  name: "Individueller Glashalter",
  price_cents: 3900,
  quantity: 1,
  configured: true,
  lang: 'de', // ← DE this time
  config: {
    variant: "glass_holder",
    baseColor: "#000000",
    accentColor: "#FFFFFF",
    finish: "glossy"
  },
  meta: {
    lang: 'de'
  }
};

const json = JSON.stringify(testItemDE);
const base64 = btoa(unescape(encodeURIComponent(json)));
const cfgParam = encodeURIComponent(base64);

// Navigate
window.location.href = `/shop?cfg=${cfgParam}`;
```

---

### Step 4: Verify Console Logs

**Expected:**
```
[CFG2CART][LANG] Language resolution: {
  item.lang: 'de',
  item.meta.lang: 'de',
  URL lang: 'not set',
  currentLang: 'de',
  effectiveLang: 'de'  ← VERIFY
}

[CFG2CART][ITEM] Normalized cart item: {
  product_id: 'glass_configurator',
  price_cents: 3900,  ← VERIFY
  lang: 'de',         ← VERIFY
}
```

**Optional Screenshot:** `test-b-console-de.png`

---

### Step 5: Verify Cart UI (German)

**Navigate to:** `/cart`

**Expected (IN GERMAN):**
- Header: "Warenkorb" ✅
- Subtotal: "Zwischensumme" ✅
- Shipping: "Versand" ✅
- Grand Total: "Gesamtsumme" ✅
- Button: "Zur Kasse" ✅

**Optional Screenshot:** `test-b-cart-de.png`

---

### Step 6: Verify Email (German)

**Complete purchase with:**
- Email: `test-de@example.com`

**Expected Email Subject:**
```
Bestellbestätigung UO-2026-XXXXX – UNBREAK ONE
```

**Expected Body (IN GERMAN):**
```
Hallo DE Test Customer,

vielen Dank für Ihre Bestellung bei UNBREAK ONE!

Ihre Bestellung wurde bestätigt...

Zwischensumme: €39,00
Versand: €4,90
MwSt. (19%): €8,34

GESAMT: €52,24
```

**Optional Screenshot:** `test-b-email-de.png`

---

## Success Checklist

### Test A (English):
- [ ] Console shows `effectiveLang: 'en'` ✅
- [ ] Console shows `item.lang: 'en'` ✅
- [ ] Console shows `price_cents: 3900` (not NaN) ✅
- [ ] Cart UI in English ✅
- [ ] Stripe checkout in English ✅
- [ ] Email subject: "Order confirmation" ✅
- [ ] Email body: "Hello", "Thank you", "Subtotal" ✅
- [ ] ⭐ Screenshot: Console with lang resolution
- [ ] ⭐ Screenshot: Email in English

### Test B (German):
- [ ] Console shows `effectiveLang: 'de'` ✅
- [ ] Console shows `item.lang: 'de'` ✅
- [ ] Console shows `price_cents: 3900` ✅
- [ ] Cart UI in German ✅
- [ ] Stripe checkout in German ✅
- [ ] Email subject: "Bestellbestätigung" ✅
- [ ] Email body: "Hallo", "vielen Dank", "Zwischensumme" ✅

---

## Troubleshooting

### Issue 1: effectiveLang not logged
**Symptom:** Console doesn't show `[CFG2CART][LANG]`

**Solution:** Debug mode not enabled
```javascript
localStorage.setItem('unbreakone_debug', 'true');
location.reload();
```

---

### Issue 2: price_cents is 0 or NaN
**Symptom:** Console shows `price_cents: 0` or `NaN`

**Cause:** Test item missing `price_cents` field

**Solution:** Ensure test item has:
```javascript
price_cents: 3900, // NOT price: 39
```

---

### Issue 3: lang stays 'de' in EN test
**Symptom:** `effectiveLang: 'de'` even with `?lang=en`

**Cause:** Site language not switching, or item has `lang: 'de'`

**Solution:** 
1. Verify URL has `?lang=en`
2. Verify test item has `lang: 'en'`
3. Check `window.i18n.getCurrentLanguage()` in console

---

### Issue 4: Email still in German
**Symptom:** Email arrives in German despite EN flow

**Cause:** Cart item missing `lang` field, or webhook fallback to DE

**Solution:**
1. Check cart item in console: `getCart().getItems()[0].lang`
2. Should be `'en'`
3. Check webhook logs in Vercel for `[LANG] Detected from cart item: en`

---

## Required Deliverables

**Minimum (2 Screenshots):**
1. ⭐ `test-a-console-en.png` - Console showing effectiveLang='en' + item.lang='en'
2. ⭐ `test-a-email-en.png` - Customer email in English

**Nice to Have (4 more):**
3. `test-a-cart-en.png` - Cart UI in English
4. `test-b-console-de.png` - Console showing effectiveLang='de'
5. `test-b-cart-de.png` - Cart UI in German
6. `test-b-email-de.png` - Email in German

---

## Timeline

**Test A:** ~10 minutes
**Test B:** ~10 minutes
**Total:** ~20 minutes

---

**Status:** ✅ Ready to run
**Branch:** feat/i18n-messe @ 1ae46cd
**Deploy:** Vercel preview auto-deployed
