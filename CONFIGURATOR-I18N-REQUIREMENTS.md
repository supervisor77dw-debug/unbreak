# Configurator i18n Requirements (CRITICAL)

## 🚨 REQUIRED CHANGE

Der Konfigurator **MUSS** das `lang` Field an den Shop übergeben, damit der komplette i18n-Flow funktioniert.

---

## Required Item Format

### Aktuell (UNVOLLSTÄNDIG):
```javascript
{
  product_id: "glass_configurator",
  sku: "glass_configurator",
  name: "Individueller Glashalter",
  price: 3900,
  configured: true,
  config: {
    variant: "glass_holder",
    baseColor: "#1A1A1A",
    accentColor: "#FFD700",
    finish: "matte"
  }
}
```

### NEU (REQUIRED):
```javascript
{
  product_id: "glass_configurator",
  sku: "glass_configurator",
  name: lang === 'de' ? "Individueller Glashalter" : "Custom Glass Holder",
  price: 3900,
  configured: true,
  
  // ⚠️ REQUIRED FOR I18N:
  lang: 'de', // or 'en' based on current site language
  
  config: {
    variant: "glass_holder",
    baseColor: "#1A1A1A",
    accentColor: "#FFD700",
    finish: "matte"
  },
  
  // Recommended (redundant but safe):
  meta: {
    lang: 'de'
  }
}
```

---

## Implementation in Configurator

### 1. Detect Current Language

**Option A: From window.i18n (if available)**
```javascript
const currentLang = window.i18n?.getCurrentLanguage() || 'de';
```

**Option B: From localStorage**
```javascript
const currentLang = localStorage.getItem('unbreakone_lang') || 'de';
```

**Option C: From URL parameter**
```javascript
const urlParams = new URLSearchParams(window.location.search);
const currentLang = urlParams.get('lang') || 'de';
```

**Option D: From HTML lang attribute**
```javascript
const currentLang = document.documentElement.lang || 'de';
```

**Recommended: Try all sources (priority order)**
```javascript
function detectLanguage() {
  // 1. URL parameter (highest priority)
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.has('lang')) {
    return urlParams.get('lang') === 'en' ? 'en' : 'de';
  }
  
  // 2. localStorage
  const stored = localStorage.getItem('unbreakone_lang');
  if (stored && ['de', 'en'].includes(stored)) {
    return stored;
  }
  
  // 3. HTML lang attribute
  const htmlLang = document.documentElement.lang;
  if (htmlLang && htmlLang.startsWith('en')) {
    return 'en';
  }
  
  // 4. window.i18n (if available)
  if (window.i18n?.getCurrentLanguage) {
    const i18nLang = window.i18n.getCurrentLanguage();
    if (['de', 'en'].includes(i18nLang)) {
      return i18nLang;
    }
  }
  
  // 5. Default to German
  return 'de';
}

const lang = detectLanguage();
```

---

### 2. Build Item with lang Field

```javascript
function buildCartItem(config) {
  const lang = detectLanguage(); // Use function from above
  
  return {
    product_id: "glass_configurator",
    sku: "glass_configurator",
    name: lang === 'de' ? "Individueller Glashalter" : "Custom Glass Holder",
    price: 3900,
    quantity: 1,
    configured: true,
    
    // CRITICAL: Include language
    lang: lang,
    
    config: {
      variant: config.variant || "glass_holder",
      baseColor: config.baseColor,
      accentColor: config.accentColor,
      finish: config.finish,
      // ... other config fields
    },
    
    // Redundant but safe
    meta: {
      lang: lang,
      source: 'configurator',
      timestamp: new Date().toISOString()
    }
  };
}
```

---

### 3. Send to Shop (postMessage)

```javascript
function addToCart() {
  const item = buildCartItem(currentConfig);
  
  console.log('[Configurator] Sending item to shop:', {
    product_id: item.product_id,
    lang: item.lang, // ← VERIFY THIS IS SET
    config: item.config
  });
  
  window.parent.postMessage({
    type: 'CART_ADD',
    item: item
  }, '*'); // Or specific origin for security
}
```

---

## Testing in Configurator

### Test 1: Language Detection
```javascript
// In browser console (configurator page):
console.log('Detected language:', detectLanguage());

// Expected:
// - If ?lang=en in URL → 'en'
// - If localStorage has 'en' → 'en'
// - Otherwise → 'de'
```

### Test 2: Item has lang Field
```javascript
// Before sending postMessage:
const item = buildCartItem(currentConfig);
console.log('Item lang field:', item.lang);
console.log('Item meta.lang field:', item.meta?.lang);

// Expected:
// - item.lang: 'de' or 'en'
// - item.meta.lang: 'de' or 'en'
```

### Test 3: End-to-End Flow

**German Test:**
1. Open configurator with `?lang=de` or no param
2. Configure product
3. Click "In den Warenkorb"
4. Check console: `item.lang` should be `'de'`
5. Shop receives item → Cart displays in German
6. Checkout → Stripe in German
7. Email in German ✅

**English Test:**
1. Open configurator with `?lang=en`
2. Configure product
3. Click "Add to Cart"
4. Check console: `item.lang` should be `'en'`
5. Shop receives item → Cart displays in English
6. Checkout → Stripe in English
7. Email in English ✅

---

## Impact of Missing lang Field

### ❌ Without lang:
```javascript
{
  product_id: "glass_configurator",
  config: { ... }
  // ← NO lang field
}
```

**Result:**
- Shop falls back to `'de'`
- Email sent in German even if user chose English
- Stripe checkout in German
- Poor user experience for EN users

---

### ✅ With lang:
```javascript
{
  product_id: "glass_configurator",
  lang: 'en', // ← CORRECT
  config: { ... }
}
```

**Result:**
- Shop uses `'en'`
- Email sent in English ✅
- Stripe checkout in English ✅
- Correct user experience

---

## Priority

**CRITICAL - BLOCKING i18n RELEASE**

Without this change, the entire i18n system will not work for configurator purchases.

**Estimated Time:** 10-15 minutes

---

## Checklist for Configurator Team

- [ ] Add `detectLanguage()` helper function
- [ ] Update `buildCartItem()` to include `lang` field
- [ ] Test language detection in console
- [ ] Verify `postMessage` includes `lang`
- [ ] Test DE flow (configurator → cart → checkout → email)
- [ ] Test EN flow (configurator → cart → checkout → email)
- [ ] Verify console logs show correct lang
- [ ] Coordinate with shop team for integration test

---

## Reference

- **Spec:** `CONFIGURATOR-LOCALSTORAGE-SPEC.md`
- **Shop i18n:** `lib/i18n-shop.js`
- **Email Detection:** `pages/api/webhooks/stripe.js` (lines ~460-480)
- **Stripe Locale:** `pages/api/checkout/standard.js` (lines ~560-575)
- **Testing Guide:** `I18N-TESTING-GUIDE.md`

---

**Status:** ⏳ PENDING - Configurator team must implement
**Blocker for:** v1.1-messe-i18n tag
**Contact:** Shop team for questions
