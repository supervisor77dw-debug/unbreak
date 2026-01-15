# i18n Testing Guide

## Quick Test (5 min)

### Test EN Flow
1. **Open site with EN parameter:**
   ```
   https://unbreak-one.com/?lang=en
   ```

2. **Verify homepage is in English:**
   - Navigation, Hero, Product descriptions

3. **Open Konfigurator:**
   - Should detect EN from URL/localStorage
   - Konfigurator must send `lang: 'en'` in item

4. **Add to Cart & Checkout:**
   - Cart receives item with `lang: 'en'`
   - Checkout creates Stripe session with `locale: 'en'`

5. **Verify Stripe Checkout:**
   - Stripe payment page should be in English
   - Check URL: contains `locale=en` parameter

6. **Complete Test Purchase:**
   - Use Stripe test card: `4242 4242 4242 4242`
   - Random CVV & future expiry

7. **Check Email (CRITICAL):**
   - Customer email should arrive in **English**
   - Subject: "Order confirmation ..."
   - Body: "Hello ...", "Thank you for your order..."

### Test DE Flow
1. **Open site without lang parameter or `?lang=de`:**
   ```
   https://unbreak-one.com/
   ```

2. **Same steps as EN test**

3. **Verify Email in German:**
   - Subject: "Bestellbestätigung ..."
   - Body: "Hallo ...", "vielen Dank für Ihre Bestellung..."

---

## What Was Implemented

### ✅ Email Language Detection
**File:** `pages/api/webhooks/stripe.js`

**Priority:**
1. `cart_items[0].lang` (from configurator)
2. `cart_items[0].meta.lang` (fallback)
3. `session.locale` (Stripe)
4. `shipping_address.country` (geo-based)
5. Default: `'de'`

**Result:** Customer emails sent in correct language based on user choice.

---

### ✅ Stripe Checkout Locale
**File:** `pages/api/checkout/standard.js`

**Detection:**
```javascript
const firstItem = items[0];
const userLanguage = firstItem.lang || firstItem.meta.lang || 'de';
const stripeLocale = userLanguage === 'en' ? 'en' : 'de';
```

**Result:** Stripe payment page shown in correct language.

---

### ✅ Language Preservation in Cart
**File:** `pages/shop.js`

**Normalization:**
```javascript
const cartItem = {
  // ... other fields
  lang: item.lang || currentLang, // CRITICAL: Preserve from configurator
  meta: {
    lang: item.lang || currentLang, // Redundant but safe
  }
};
```

**Result:** Language flows through entire purchase funnel.

---

### ✅ Translation Module Created
**File:** `lib/i18n-shop.js` (330 lines)

**Contents:**
- `shopTranslations.de`: German strings
- `shopTranslations.en`: English strings
- `t(lang, key, params)`: Translation function with parameter substitution
- `getCurrentLanguage()`: Multi-source lang detection
- `ts(key, params)`: Auto-detect language wrapper

**Usage Example:**
```javascript
import { t, ts } from '../lib/i18n-shop';

// Explicit language:
const subject = t('de', 'email.customer.subject', { orderNumber: 'UO-2026-123' });
// "Bestellbestätigung UO-2026-123 – UNBREAK ONE"

// Auto-detect:
const buttonText = ts('cart.checkout');
// "Zur Kasse" (if DE) or "Checkout" (if EN)
```

**Ready for future Cart/Checkout UI integration.**

---

## Configurator Requirements (CRITICAL)

### Updated Spec: `CONFIGURATOR-LOCALSTORAGE-SPEC.md`

**Required Item Format:**
```javascript
{
  product_id: "glass_configurator",
  sku: "glass_configurator",
  name: lang === 'de' ? "Individueller Glashalter" : "Custom Glass Holder",
  price: 3900,
  configured: true,
  
  // ⚠️ REQUIRED for i18n:
  lang: 'de', // or 'en' - MUST be set!
  
  config: {
    variant: "glass_holder",
    baseColor: "#1A1A1A",
    accentColor: "#FFD700",
    finish: "matte"
  },
  
  meta: {
    lang: 'de' // Redundant but recommended
  }
}
```

**Configurator MUST:**
1. Detect current site language
2. Include `lang: 'de'|'en'` in item
3. Send via `window.parent.postMessage()`

---

## Debugging

### Check Email Language
**Logs to check:**
```bash
# In Vercel logs or terminal:
[LANG] Detected from cart item: en
[LANG] Final language for email: en
[EMAIL] Recipient: customer@example.com
```

### Check Stripe Locale
**Logs to check:**
```bash
[Checkout] Language from cart item: en
[Checkout] Stripe locale: en
```

**Visual check:** Stripe checkout page should be in English/German.

### Common Issues

**Email still in German even with lang=en:**
- Check configurator sends `lang: 'en'`
- Check shop.js preserves lang in cartItem
- Check webhook extracts lang correctly
- Verify `emailService.ts` receives correct `language` param

**Stripe checkout in wrong language:**
- Check cart item has `lang` field
- Check `standard.js` logs: `[Checkout] Stripe locale: en`
- Verify Stripe session creation includes `locale` property

---

## Next Steps (Post-Messe)

### Cart UI Translation
**File to modify:** `pages/cart.js` or `components/Cart.jsx`

```javascript
import { ts } from '../lib/i18n-shop';

// Replace hardcoded strings:
<h1>Warenkorb</h1> → <h1>{ts('cart.title')}</h1>
<button>Zur Kasse</button> → <button>{ts('cart.checkout')}</button>
<span>Zwischensumme:</span> → <span>{ts('cart.subtotal')}:</span>
```

### Checkout UI Translation
**File to modify:** `pages/checkout.js` or `components/Checkout.jsx`

```javascript
import { ts } from '../lib/i18n-shop';

<h1>{ts('checkout.title')}</h1>
<button>{ts('checkout.placeOrder')}</button>
<p>{ts('checkout.processing')}</p>
```

### Admin Panel i18n
- Extract all hardcoded German strings
- Add to `lib/i18n-shop.js` under `admin` section
- Implement language switcher in admin UI

---

## Success Criteria

- [x] Email language detection from cart
- [x] Stripe checkout locale setting
- [x] Language preservation through flow
- [x] Translation module created
- [x] Configurator spec updated
- [ ] Test EN purchase end-to-end (**REQUIRED**)
- [ ] Test DE purchase end-to-end
- [ ] Screenshot: EN email received
- [ ] Screenshot: DE email received
- [ ] Cart UI translated (post-messe)
- [ ] Checkout UI translated (post-messe)

---

## Rollback Plan

If issues occur, revert to v1.0-messe:

```bash
git revert 5769ac8
git push origin master
```

Or deploy specific tag:
```bash
git checkout v1.0-messe
# Deploy to Vercel
```

---

**Status:** ✅ Backend i18n complete, ready for testing
**Commit:** `5769ac8` (feat: i18n for emails and Stripe checkout)
**Based on:** `v1.0-messe` (tag 8ba0f88)
