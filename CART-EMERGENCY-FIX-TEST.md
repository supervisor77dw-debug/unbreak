# CART EMERGENCY FIX - Testing Guide
## Phantom €39.00 Price Bug - FIXED

---

## 🎯 FIX SUMMARY

**PROBLEM:** Cart Line Item shows €39.00, Totals show €19.90 (CORRECT)

**ROOT CAUSE:** 
- Cart items had MULTIPLE price fields: `price`, `price_cents`, `unit_price_cents`
- Line Item rendering used ambiguous field (e.g., `item.price` = 3900)
- Totals used correct field (`price_cents` = 1990)
- Result: €39.00 displayed instead of €19.90

**MATHEMATICAL PROOF (from user):**
```
Cart Display (qty=2):
- Line Item Unit: €39.00 ❌
- Line Item Total: €78.00 (= 39 × 2) ❌
- Subtotal: €39.80 ✅ (CORRECT)

Calculation:
€39.80 / 2 = €19.90 per item ✅ (proves totals use 1990 cents)
€78.00 / 2 = €39.00 per item ❌ (proves line item used 3900)
```

**SOLUTION IMPLEMENTED:**
1. ✅ Normalize ALL cart items to canonical `unit_price_cents` on render
2. ✅ Fallback chain: `unit_price_cents || price_cents || price*100`
3. ✅ Line Item renders ONLY from `unit_price_cents`
4. ✅ Line Total renders from `unit_price_cents * quantity`
5. ✅ Debug logging for normalized items
6. ✅ Debug logging for line item render

---

## ✅ TESTING PROTOCOL (1 minute)

### Test 1: Verify Cart Empty State
1. Open: http://localhost:3000/cart?debugCart=1
2. Check browser console for:
   ```
   [CART][NORMALIZED_ITEMS] []
   [CART PRICING] { calculated_subtotal: 0, ... }
   ```
3. **Expected:** Empty cart, no errors ✅

### Test 2: Add Configurator Item
1. Open browser console (F12)
2. Paste this code:
   ```javascript
   // Add test configurator item (base price €19.90)
   const testItem = {
     product_id: "glass_configurator",
     sku: "UNBREAK-GLAS-CONFIG",
     name: "Custom Glass Holder",
     price_cents: 1990,  // CORRECT field
     configured: true,
     quantity: 1,
     config: {
       variant: "glass_holder",
       baseColor: "#000000",
       accentColor: "#FFD700"
     }
   };

   // Add to cart
   const cart = JSON.parse(localStorage.getItem('cart') || '{"items":[]}');
   cart.items.push(testItem);
   localStorage.setItem('cart', JSON.stringify(cart));
   window.location.reload();
   ```
3. **Expected:** Cart shows 1 item

### Test 3: Verify Normalized Prices (CRITICAL!)
1. Check browser console for:
   ```
   [CART][NORMALIZED_ITEMS] [
     {
       sku: "UNBREAK-GLAS-CONFIG",
       qty: 1,
       unit_price_cents: 1990,
       raw_price: undefined,
       raw_price_cents: 1990
     }
   ]

   [CART][LINE_ITEM_RENDER] {
     sku: "UNBREAK-GLAS-CONFIG",
     displaying_unit_price_cents: 1990,
     formatted: "19.90"
   }
   ```

2. Check UI display:
   - **Line Item Unit Price:** €19.90 ✅ (NOT €39.00!)
   - **Line Total (qty=1):** €19.90 ✅
   - **Subtotal:** €19.90 ✅
   - **Grand Total:** €24.80 (= €19.90 + €4.90 shipping) ✅

### Test 4: Verify Quantity=2 (REGRESSION TEST)
1. In cart UI, increase quantity to 2
2. Check UI display:
   - **Line Item Unit Price:** €19.90 ✅ (NOT €39.00!)
   - **Line Total (qty=2):** €39.80 ✅ (NOT €78.00!)
   - **Subtotal:** €39.80 ✅
   - **Grand Total:** €44.70 (= €39.80 + €4.90) ✅

3. **CRITICAL:** NO €39.00 anywhere in UI! ✅

### Test 5: Real Configurator Test
1. Go to: http://localhost:3000/configurator
2. Configure glass holder (any colors)
3. Click "In den Warenkorb"
4. Verify redirect to cart
5. Check browser console for `[CART][NORMALIZED_ITEMS]`
6. Verify UI shows €19.90 (NOT €39.00)

---

## 🔧 DEBUG LOGS REFERENCE

**[CART][NORMALIZED_ITEMS]:**
- Shows all cart items AFTER normalization
- Each item should have `unit_price_cents` populated
- Fallback chain: `unit_price_cents || price_cents || price*100`

**[CART][LINE_ITEM_RENDER]:**
- Shows EXACTLY what field is used for display
- Should log `displaying_unit_price_cents: 1990`
- Should log `formatted: "19.90"`

**[CART PRICING]:**
- Shows total calculation
- `calculated_subtotal` should match sum of line totals

---

## ✅ ACCEPTANCE CRITERIA

**MUST HAVE (Emergency Fix):**
- [x] Line Item shows €19.90 (NOT €39.00) ✅
- [x] Line Total (qty=2) shows €39.80 (NOT €78.00) ✅
- [x] Subtotal matches Line Total ✅
- [x] NO €39.00 anywhere in UI ✅
- [x] Debug logs show unit_price_cents: 1990 ✅
- [x] Committed to master (f5f7862) ✅

**NEXT STEPS (Follow-up Refactor):**
- [ ] Canonical schema in lib/cart.js (normalizeCartItem)
- [ ] Normalize items on addItem() (not just on render)
- [ ] Remove ambiguous price fields from localStorage
- [ ] Remove unused resolveCartItemPrice() function
- [ ] Cleanup debug logging

---

## 🐛 TROUBLESHOOTING

### Issue: Still shows €39.00
**Solution:** 
1. Hard refresh (Ctrl+Shift+R)
2. Clear localStorage: `localStorage.clear()`
3. Check console for `[CART][NORMALIZED_ITEMS]` log
4. Verify `unit_price_cents` is populated

### Issue: No debug logs appearing
**Solution:** 
1. Add `?debugCart=1` to URL
2. Check browser console (F12)
3. Refresh page

### Issue: Different price after checkout
**Solution:** 
1. Server recalculates price during checkout (CORRECT)
2. Cart UI is just a preview
3. Final price comes from pricing snapshot API

---

## 📊 CODE CHANGES

**File: pages/cart.js**

**Change 1: Normalize Items (Lines 171-187)**
```javascript
// EMERGENCY FIX: Normalize ALL items to use unit_price_cents ONLY
const normalizedCartItems = cartItems.map(item => {
  const unit_price_cents = 
    item.unit_price_cents ||
    item.price_cents ||
    (item.price ? Math.round(item.price * 100) : 0);
  
  return {
    ...item,
    unit_price_cents,
  };
});
```

**Change 2: Line Item Render (Line 286)**
```javascript
// BEFORE (BROKEN):
€{formatPrice(resolveCartItemPrice(item, null, null))}

// AFTER (FIXED):
€{formatPrice(item.unit_price_cents)}
```

**Change 3: Line Total Render (Line 355)**
```javascript
// BEFORE (BROKEN):
€{formatPrice(resolveCartItemPrice(item, null, null) * item.quantity)}

// AFTER (FIXED):
€{formatPrice(item.unit_price_cents * item.quantity)}
```

---

## 📝 COMMIT INFO

**Branch:** master  
**Commit:** f5f7862  
**Message:** fix(cart): EMERGENCY PATCH - Normalize items to unit_price_cents, fix phantom 39.00

**Files Changed:**
- `pages/cart.js` - Normalize items, render from unit_price_cents

**Testing Date:** 2026-01-16  
**Priority:** CRITICAL 🚨  
**Status:** ✅ DEPLOYED TO MASTER
