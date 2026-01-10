# iFrame "Add to Cart" Integration - Test Guide

**Deployed:** ✅ Commit `753df1d`  
**Status:** Ready for testing after Vercel deployment

---

## 🎯 What Was Implemented

### 1. **Message Event Listener** (`handleIframeMessage`)
- Listens for messages from iframe configurator
- **Security:** Origin whitelist validation (`ALLOWED_ORIGINS`)
- Handles: `UNBREAK_ONE_ADD_TO_CART`, `LOCALE_ACK`, `UNBREAK_ONE_RESET_VIEW`

### 2. **Add to Cart Handler** (`handleAddToCart`)
- Receives product configuration from iframe
- Calls `/api/checkout/create` with payload
- Redirects to Stripe Checkout
- Localized error messages (DE/EN)

### 3. **Event Protocol**
```javascript
// Expected message from iframe:
{
  type: "UNBREAK_ONE_ADD_TO_CART",
  payload: {
    variant: "glass_holder",     // or "bottle_holder"
    sku: "glass_holder",          // SKU for Stripe
    quantity: 1,
    config: {                     // Full configuration JSON
      baseColor: "#1a1a1a",
      accentColor: "#ffd700",
      parts: ["base", "holder"]
    },
    pricing: {
      basePrice: 4900,            // in cents
      totalPrice: 4900
    },
    locale: "de"                  // or "en"
  }
}
```

---

## 🧪 Testing Steps

### **Phase 1: Local Development Test**

1. **Start dev server:**
   ```powershell
   npm run dev
   ```

2. **Open:** http://localhost:3000

3. **Open Browser DevTools** → Console

4. **Navigate to configurator section** (scroll or click)

5. **Verify iframe loads:**
   - Check console for: `[iFrame Bridge] Iframe detected, initializing...`
   - Should see: `[iFrame Bridge] Sent SET_LOCALE to iframe: de`

6. **Configure product in iframe:**
   - Choose glass or bottle holder
   - Select colors/parts
   - Click **"In den Warenkorb"** button

7. **Expected Console Output:**
   ```
   [iFrame Bridge] 🛒 Add to Cart received: {variant: "glass_holder", ...}
   [iFrame Bridge] Starting checkout with config: {...}
   [iFrame Bridge] ✅ Redirecting to checkout: https://checkout.stripe.com/...
   ```

8. **Expected Result:**
   - Redirect to Stripe Checkout
   - Correct product in checkout
   - Correct language (DE/EN)

---

### **Phase 2: Production Test**

1. **Wait for Vercel deployment** (check https://vercel.com dashboard)

2. **Open:** https://unbreak-one.vercel.app

3. **Hard refresh** to clear cache: `Ctrl + Shift + R`

4. **Repeat steps 3-8 from Phase 1**

5. **Test language switch:**
   - Click DE/EN toggle in header
   - Verify iframe receives new locale
   - Configure product
   - Click "Add to Cart"
   - Verify checkout is in correct language

---

### **Phase 3: Security Test**

1. **Open DevTools → Console**

2. **Test blocked origin:**
   ```javascript
   // Should be blocked
   window.postMessage({
     type: "UNBREAK_ONE_ADD_TO_CART",
     payload: { variant: "glass_holder" }
   }, "*");
   ```

3. **Expected:**
   ```
   [iFrame Bridge] Message source mismatch
   ```

4. **Verify ALLOWED_ORIGINS:**
   - Production: Only `unbreak-3-d-konfigurator.vercel.app` and `unbreak-one.vercel.app`
   - Dev: Also includes `localhost:3000`

---

### **Phase 4: Error Handling Test**

1. **Invalid payload test** (in iframe - requires iframe code modification):
   ```javascript
   parent.postMessage({
     type: "UNBREAK_ONE_ADD_TO_CART",
     payload: null  // Invalid
   }, "https://unbreak-one.vercel.app");
   ```

2. **Expected:**
   ```
   [iFrame Bridge] Invalid Add to Cart payload
   ```

3. **Network error simulation:**
   - Open DevTools → Network tab
   - Set throttling to "Offline"
   - Try adding to cart
   - Should show: "Checkout error. Please try again."

---

## 🔍 Debugging Checklist

### ✅ **If iframe doesn't load:**
- Check ALLOWED_ORIGINS includes iframe domain
- Verify iframe src: `https://unbreak-3-d-konfigurator.vercel.app`
- Check network tab for CORS errors

### ✅ **If "Add to Cart" doesn't work:**
- Open console, check for errors
- Verify message format matches protocol
- Check `/api/checkout/create` response in Network tab
- Verify Stripe API keys are set in Vercel env

### ✅ **If wrong language in checkout:**
- Check `locale` in payload
- Verify `currentLang` is correct before sending
- Check Stripe checkout session `locale` parameter

### ✅ **If security warnings appear:**
- Verify origin matches ALLOWED_ORIGINS
- Check `event.source === iframe.contentWindow`
- Ensure no wildcard "*" origins in production

---

## 📋 Expected Console Logs (Success Flow)

```
[iFrame Bridge] Iframe detected, initializing...
[iFrame Bridge] Sent SET_LOCALE to iframe: de
[iFrame Bridge] Received ACK from iframe: de
[iFrame Bridge] 🛒 Add to Cart received: {variant: "glass_holder", config: {...}}
[iFrame Bridge] Starting checkout with config: {...}
[iFrame Bridge] ✅ Redirecting to checkout: https://checkout.stripe.com/c/pay/cs_test_...
```

---

## 🚨 Known Limitations

1. **Single-item checkout only** - No cart state, direct to checkout
2. **Requires iframe modification** - Iframe must send correct event format
3. **No quantity selection** - Currently hardcoded to `quantity: 1`
4. **No cart preview** - Immediate redirect to Stripe

---

## 🔄 Next Steps (Optional Enhancements)

- [ ] Add cart preview modal before checkout
- [ ] Support multiple items (cart state)
- [ ] Add loading spinner during checkout creation
- [ ] Track "Add to Cart" analytics events
- [ ] Add success toast notification
- [ ] Support guest checkout vs. account creation

---

## 📝 iframe Requirements (For Configurator Team)

The iframe must send this message when user clicks "In den Warenkorb":

```javascript
// In iframe (unbreak-3-d-konfigurator.vercel.app)
function handleAddToCart() {
  const config = collectConfiguration(); // Your internal function
  
  window.parent.postMessage({
    type: "UNBREAK_ONE_ADD_TO_CART",
    payload: {
      variant: config.productType,        // "glass_holder" | "bottle_holder"
      sku: config.productType,            // Same as variant for now
      quantity: 1,
      config: config,                     // Full config object
      pricing: {
        basePrice: calculatePrice(config),
        totalPrice: calculatePrice(config)
      },
      locale: getCurrentLocale()          // "de" | "en"
    }
  }, "https://unbreak-one.vercel.app");  // Target homepage
}
```

**Security Note:** Only send to trusted parent origins. Check `window.parent !== window` to verify you're in an iframe.

---

## ✅ Deployment Status

- **Commit:** `753df1d`
- **Files Modified:** `public/iframe-language-bridge.js`
- **Lines Added:** 117 insertions, 9 deletions
- **Pushed to:** `master` branch
- **Vercel:** Auto-deploying...

Wait for Vercel deployment to complete before testing on production.
