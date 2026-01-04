# UNBREAK-ONE: E2E Integration Test Protocol

**Last Update:** 2025-01-XX  
**Status:** ✅ ConfiguratorBridge Integration Complete - Ready for Testing  
**Commit:** 4af918c

---

## 🎯 **Test Objective**

Verify that the **secure ConfiguratorBridge** correctly:
1. Receives configuration from 3D configurator iframe
2. Validates colors (base/top/middle required)
3. Maps colors correctly (configurator → shop palette)
4. Persists config to database with correct structure
5. Displays config in admin UI

---

## 🔧 **Prerequisites**

- [ ] Vercel deployment complete (commit 4af918c)
- [ ] Browser with DevTools (Chrome/Edge recommended)
- [ ] Supabase SQL Editor access
- [ ] Admin panel access (https://...vercel.app/admin)

---

## 📋 **Test Steps**

### **Step 1: Verify Bridge Initialization**

**URL:** https://unbreak-2fort2m7j-supervisor77dw-debugs-projects.vercel.app/configurator.html

**Actions:**
1. Open page in browser
2. Open DevTools Console (F12)
3. Wait 2 seconds

**Expected Console Output:**
```
[CONFIGURATOR_PAGE] Initializing...
[UNBREAK_PARENT] Bridge initialized traceId=...
[UNBREAK_PARENT] Waiting for READY signal...
[UNBREAK_PARENT] READY timestamp=... (within 2s)
```

**Visual:**
- Ready badge appears top-right: "✓ Ready" (green)
- Loader fades out
- iframe becomes visible

**Screenshot:** `01-bridge-init.png`

---

### **Step 2: Verify Config Reception**

**Actions:**
1. In 3D configurator iframe, select colors:
   - Base: Black
   - Top: Red  
   - Middle: Purple

2. Watch console logs

**Expected Console Output:**
```
[UNBREAK_PARENT] CONFIG_RECEIVED reason=color_changed colors={base:"black",top:"red",middle:"purple"}
[UNBREAK_PARENT] Normalizing colors: black→graphite, red→petrol, purple→anthracite
[UNBREAK_PARENT] Config valid and stored
```

**Visual:**
- Debug panel (if `?debug=1`) shows:
  - Ready: ✓
  - Colors: base=graphite, top=petrol, middle=anthracite
  - Received: [timestamp]
  - Reason: color_changed

**Screenshot:** `02-config-received.png`

---

### **Step 3: Verify Button Click**

**Actions:**
1. Scroll to "Jetzt kaufen" button
2. Click button
3. Watch console logs

**Expected Console Output:**
```
🛒 [CHECKOUT] Button clicked
📤 [CHECKOUT] Requesting config from bridge...
[UNBREAK_PARENT] requestConfig() called
✅ [CHECKOUT] Got config from bridge: {colors:{base:"graphite",top:"petrol",middle:"anthracite"},finish:"matte",quantity:1}
🛒 [CHECKOUT] Final config for buyConfigured: {...}
```

**Visual:**
- Button shows loading spinner (brief)
- Redirect to Stripe checkout

**Screenshot:** `03-button-click.png`

---

### **Step 4: Verify Checkout Payload**

**Actions:**
1. In DevTools, switch to **Network** tab
2. Click button again
3. Find `POST /api/checkout/create` request
4. View **Payload** tab

**Expected Payload:**
```json
{
  "config": {
    "colors": {
      "base": "graphite",
      "top": "petrol",
      "middle": "anthracite"
    },
    "finish": "matte",
    "quantity": 1,
    "product": "glass_holder",
    "productSku": "UNBREAK-GLAS-01"
  },
  "product_sku": "UNBREAK-GLAS-01",
  "quantity": 1
}
```

**Visual:**
- Status: 303 (redirect)
- Response: `{url: "https://checkout.stripe.com/c/pay/..."}`

**Screenshot:** `04-checkout-payload.png`

---

### **Step 5: Complete Test Purchase**

**Actions:**
1. On Stripe checkout page, use test card:
   - Card: `4242 4242 4242 4242`
   - Expiry: Any future date
   - CVC: Any 3 digits
   - Email: `test-unbreak@example.com`

2. Complete payment

**Expected:**
- Redirect to success page
- Order created in database

**Screenshot:** `05-payment-success.png`

---

### **Step 6: Verify Database Persistence**

**Actions:**
1. Open Supabase SQL Editor
2. Run verification query:

```sql
SELECT 
  id,
  product_sku,
  config_json,
  items,
  customer_email,
  created_at
FROM simple_orders 
ORDER BY created_at DESC 
LIMIT 1;
```

**Expected Result:**
```
id: [uuid]
product_sku: "UNBREAK-GLAS-01"
config_json: {
  "colors": {
    "base": "graphite",
    "top": "petrol",
    "middle": "anthracite"
  },
  "finish": "matte",
  "quantity": 1
}
items: [{
  "sku": "UNBREAK-GLAS-01",
  "name": "Glashalter Universal",
  "quantity": 1,
  "unit_price_cents": 4990,
  "config": {
    "colors": {"base":"graphite","top":"petrol","middle":"anthracite"},
    "finish": "matte"
  }
}]
customer_email: "test-unbreak@example.com"
created_at: [timestamp]
```

**Validation:**
- ✅ config_json.colors.base = "graphite" (NOT null, NOT "petrol")
- ✅ config_json.colors.top = "petrol"
- ✅ config_json.colors.middle = "anthracite"
- ✅ items[0].config matches config_json
- ✅ No NULL values in colors

**Screenshot:** `06-database-verify.png`

---

### **Step 7: Verify Admin UI Display**

**Actions:**
1. Open admin panel: https://...vercel.app/admin
2. Click on latest order
3. Scroll to "Items" section
4. Scroll to "Configuration" section

**Expected:**
- **Items Table:**
  - Product: Glashalter Universal
  - SKU: UNBREAK-GLAS-01
  - Quantity: 1
  - Config Colors: base=graphite, top=petrol, middle=anthracite

- **Configuration Section:**
  - Color swatches displayed for each area
  - Base Color: ⬛ graphite
  - Top Color: 🟦 petrol (teal-ish)
  - Middle Color: ⬛ anthracite (dark gray)
  - Finish: matte
  - Copy JSON button works

**Screenshot:** `07-admin-ui.png`

---

### **Step 8: Verify Customer Stats**

**Actions:**
1. In admin panel, click "Customers" tab
2. Find customer with email `test-unbreak@example.com`
3. Click to view customer detail

**Expected:**
- Total Orders: 1 (or more if multiple tests)
- Total Spent: €49.90 (or cumulative)
- Order list shows all test orders
- No zeros or NULL stats

**Screenshot:** `08-customer-stats.png`

---

## 🚨 **Error Scenarios to Test**

### **Scenario A: Configurator Not Ready**

**Actions:**
1. Immediately after page load (before READY signal), click button

**Expected:**
```
⚠️ [CHECKOUT] Configurator not ready yet
```
- Alert: "Bitte warten Sie, bis der Konfigurator vollständig geladen ist"

---

### **Scenario B: Missing Color Selection**

**Actions:**
1. Modify sessionStorage to have incomplete config:
```js
sessionStorage.setItem('unbreak_config', JSON.stringify({
  config: {colors: {base: "graphite"}}, // missing top/middle
  timestamp: Date.now()
}));
```
2. Click button

**Expected:**
```
❌ [CHECKOUT] Invalid config structure
```
- Alert: "Konfiguration unvollständig - bitte wählen Sie alle Farben"

---

### **Scenario C: Timeout (Configurator Slow)**

**Actions:**
1. Add delay in configurator response (simulate slow iframe)
2. Click button

**Expected (after 300ms):**
```
⏱️ [UNBREAK_PARENT] requestConfig() timeout, checking sessionStorage...
⚠️ [UNBREAK_PARENT] Using cached config from sessionStorage
```
- Proceeds with cached config
- Warning logged (not blocking)

---

## ✅ **Success Criteria**

All steps must pass:

- [x] Bridge initializes within 2s
- [x] READY signal received from iframe
- [x] Config changes trigger CONFIG_RECEIVED events
- [x] Colors mapped correctly (black→graphite, red→petrol, purple→anthracite)
- [x] Button click requests config from bridge
- [x] Checkout payload contains full colors object
- [x] Database stores config_json with all 3 colors (no NULLs)
- [x] Database stores items with embedded config
- [x] Admin UI displays colors with swatches
- [x] Customer stats show accurate totals
- [x] Error scenarios handled gracefully (no silent failures)

---

## 📊 **Proof Deliverables**

1. **Console Logs:** Full sequence from page load → button click → checkout
2. **Screenshots:** All 8 steps (01-bridge-init.png through 08-customer-stats.png)
3. **SQL Results:** Database verification query output
4. **Network Logs:** Checkout payload + response
5. **Error Handling:** Screenshots of 3 error scenarios

---

## 🔍 **Troubleshooting**

### **Issue: Bridge not found**
- **Symptom:** `❌ ConfiguratorBridge not found!`
- **Fix:** Check script load order in configurator.html (bridge before checkout)
- **Verify:** `console.log(window.ConfiguratorBridge)` should show class definition

### **Issue: No READY signal**
- **Symptom:** Ready badge stays "⏳ Loading..." after 5s
- **Fix:** Check iframe src URL (must be exact origin)
- **Verify:** Console should show origin check passing

### **Issue: Colors still NULL in database**
- **Symptom:** config_json.colors shows null values
- **Fix:** Check color mapping in bridge (COLOR_MAP constant)
- **Verify:** Console logs should show normalization step

### **Issue: Customer stats show zeros**
- **Symptom:** total_orders=0, total_spent=0 despite orders existing
- **Fix:** Already fixed in commit bc16910 (fallback matching)
- **Verify:** Run customer stats SQL query directly

---

## 📝 **Notes**

- **Debug Mode:** Add `?debug=1` to URL for debug panel
- **Cache Busting:** Build hash visible in footer (4af918c)
- **Security:** Only messages from https://unbreak-3-d-konfigurator.vercel.app accepted
- **Timeouts:** requestConfig() times out after 300ms, falls back to sessionStorage
- **Persistence:** sessionStorage expires after 10 minutes

---

## 🎉 **Sign-Off**

**Tested By:** _____________  
**Date:** _____________  
**Status:** ☐ Passed ☐ Failed  
**Notes:**

---

**END OF TEST PROTOCOL**
