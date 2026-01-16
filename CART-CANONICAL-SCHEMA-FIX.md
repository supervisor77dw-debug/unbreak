# CART CANONICAL SCHEMA FIX - Testing Guide
## €3900.00 Bug FINAL RESOLUTION

---

## 🎯 PROBLEM (PROVEN BY SCREENSHOT)

**Display:** Cart shows **€3900.00** for UNBREAK-GLAS-CONFIG  
**Expected:** Should show **€39.00**

**ROOT CAUSE:**
- Legacy cart items had `price: 3900` (cents)
- Code interpreted as euro → `formatPrice(3900)` → `3900 / 100` → **€39.00**
- **BUT:** Price was ALREADY in cents, not euro!
- **ACTUAL BUG:** `price: 3900` rendered as euro → **€3900.00** ❌

**PROOF:**
```
Item in localStorage: { price: 3900 }
UI code: formatPrice(item.price) 
formatPrice() expects CENTS → divides by 100
Result: 3900 / 100 = €39.00 ❓

BUT CODE TREATED 3900 AS EURO:
Display: €3900.00 ❌
```

**DATA INCONSISTENCY:**
- Configurator sets `price_cents: 1990` (cents) ✅
- Legacy items have `price: 3900` (ambiguous - cents or euro?) ❌
- Some code paths interpret as cents, others as euro
- Result: **Random prices** depending on code path!

---

## ✅ CANONICAL FIX (Commit 4b05466)

### 1. normalizeCartItem() Function

**Location:** lib/cart.js  
**Purpose:** Convert ANY legacy item to canonical schema

**Logic:**
```javascript
function normalizeCartItem(rawItem) {
  let unit_price_cents = 0;

  // PRIORITY 1: unit_price_cents (canonical field)
  if (rawItem.unit_price_cents) {
    unit_price_cents = rawItem.unit_price_cents;
  }
  // PRIORITY 2: price_cents (configurator)
  else if (rawItem.price_cents) {
    unit_price_cents = rawItem.price_cents;
  }
  // PRIORITY 3: price (AMBIGUOUS - disambiguate!)
  else if (rawItem.price != null) {
    const priceValue = Number(rawItem.price);
    
    // HEURISTIC: Disambiguate cents vs euro
    if (priceValue >= 100) {
      // Treat as CENTS (e.g., 1990, 2490, 3900)
      unit_price_cents = Math.round(priceValue);
    } else {
      // Treat as EURO (e.g., 19.90, 24.90, 39.00)
      unit_price_cents = Math.round(priceValue * 100);
    }
  }

  // VALIDATION: Must be positive integer
  assert(Number.isInteger(unit_price_cents) && unit_price_cents >= 0);

  return {
    sku: rawItem.sku,
    name: rawItem.name,
    unit_price_cents,  // ✅ ONLY price field
    quantity: rawItem.quantity || 1,
    currency: 'EUR',
    // ... other fields
  };
}
```

**Heuristic Examples:**
```javascript
// Input: price = 3900
// 3900 >= 100 → treated as CENTS
// Output: unit_price_cents = 3900 → €39.00 ✅

// Input: price = 39
// 39 < 100 → treated as EURO
// Output: unit_price_cents = 3900 → €39.00 ✅

// Input: price = 19.90
// 19.90 < 100 → treated as EURO
// Output: unit_price_cents = 1990 → €19.90 ✅

// Input: price_cents = 1990
// PRIORITY 2 → direct use
// Output: unit_price_cents = 1990 → €19.90 ✅
```

### 2. Migration on Load

**When:** Cart.load() (every page load)  
**What:** Normalize ALL legacy items, save to localStorage

```javascript
load() {
  let items = JSON.parse(localStorage.getItem('cart'));
  
  // STEP 1: Remove invalid items
  const validItems = items.filter(item => /* validation */);
  
  // STEP 2: Normalize ALL items to canonical schema
  const normalizedItems = validItems.map(normalizeCartItem);
  
  // STEP 3: Save normalized items immediately
  localStorage.setItem('cart', JSON.stringify(normalizedItems));
  
  return normalizedItems;
}
```

**Result:**
- Legacy `price: 3900` → normalized to `unit_price_cents: 3900` ✅
- Legacy `price_cents: 1990` → normalized to `unit_price_cents: 1990` ✅
- Ambiguous fields REMOVED from localStorage
- Future loads already have canonical schema

### 3. Migration on Add

**When:** Cart.addItem() (every add to cart)  
**What:** Normalize item BEFORE adding to cart

```javascript
addItem(product) {
  // STEP 1: Normalize item
  const normalizedItem = normalizeCartItem(product);
  
  // STEP 2: Add to cart (already normalized)
  this.items.push(normalizedItem);
  
  // STEP 3: Save
  this.save();
}
```

**Result:**
- New items ALWAYS have canonical schema
- No legacy fields in new cart state

### 4. Cart UI Simplification

**Location:** pages/cart.js  
**Change:** Remove temporary normalization (now in lib/cart.js)

```javascript
// BEFORE (temporary fix):
const normalizedCartItems = cartItems.map(item => {
  const unit_price_cents = item.unit_price_cents || item.price_cents || (item.price * 100);
  return { ...item, unit_price_cents };
});

// AFTER (canonical schema):
// Items already normalized in lib/cart.js
// Just use them directly:
const subtotal = cartItems.reduce((sum, item) => 
  sum + (item.unit_price_cents * item.quantity), 0
);
```

**Line Item Render:**
```javascript
// Unit Price:
€{formatPrice(item.unit_price_cents)}

// Line Total:
€{formatPrice(item.unit_price_cents * item.quantity)}
```

### 5. Internal Methods Updated

**getTotal():**
```javascript
// BEFORE: item.price ❌
// AFTER: item.unit_price_cents ✅
getTotal() {
  return this.items.reduce((sum, item) => 
    sum + (item.unit_price_cents * item.quantity), 0
  );
}
```

**getCheckoutPayload():**
```javascript
// BEFORE: price_cents: item.price ❌
// AFTER: price_cents: item.unit_price_cents ✅
getCheckoutPayload() {
  return this.items.map(item => ({
    sku: item.sku,
    quantity: item.quantity,
    price_cents: item.unit_price_cents,  // ✅ canonical field
  }));
}
```

---

## 🧪 ACCEPTANCE TEST

### Test 1: Legacy Item with price=3900 (cents)

**Setup:**
```javascript
// Simulate legacy item in localStorage
localStorage.setItem('cart', JSON.stringify([{
  product_id: "glass_configurator",
  sku: "UNBREAK-GLAS-CONFIG",
  name: "Custom Glass Holder",
  price: 3900,  // ❌ Legacy ambiguous field
  quantity: 1,
  configured: true,
  config: { variant: "glass_holder" }
}]));

window.location.reload();
```

**Expected After Load:**
- Console: `[CART][LOAD][MIGRATION] 🔄 Migrated cart`
- Console: `[CART][NORMALIZE] price >= 100 → treated as cents: { price: 3900, unit_price_cents: 3900 }`
- localStorage updated with: `{ unit_price_cents: 3900, ... }` (NO price field!)
- UI displays: **€39.00** ✅ (NOT €3900.00!)

### Test 2: Configurator Item with price_cents=1990

**Setup:**
```javascript
// Add new configurator item
const testItem = {
  product_id: "glass_configurator",
  sku: "UNBREAK-GLAS-CONFIG",
  name: "Custom Glass Holder",
  price_cents: 1990,  // ✅ Canonical source
  configured: true,
  quantity: 1,
  config: { variant: "glass_holder" }
};

const cart = JSON.parse(localStorage.getItem('cart') || '[]');
cart.push(testItem);
localStorage.setItem('cart', JSON.stringify(cart));
window.location.reload();
```

**Expected:**
- Console: `[CART][NORMALIZE] Item normalized: { unit_price_cents: 1990 }`
- localStorage: `{ unit_price_cents: 1990, ... }` (NO price_cents field!)
- UI displays: **€19.90** ✅

### Test 3: Mixed Cart (Regression Test)

**Setup:**
```javascript
// Add multiple items with different price sources
localStorage.setItem('cart', JSON.stringify([
  // Legacy item (price in cents)
  { sku: "LEGACY-1", name: "Legacy Item", price: 2490, quantity: 1 },
  
  // Configurator item (price_cents)
  { sku: "CONFIG-1", name: "Configurator", price_cents: 1990, quantity: 2, configured: true },
  
  // Standard product (unit_price_cents - already canonical)
  { sku: "STD-1", name: "Standard", unit_price_cents: 1490, quantity: 1 },
]));

window.location.reload();
```

**Expected UI:**
```
Line 1: Legacy Item      €24.90  × 1 = €24.90
Line 2: Configurator     €19.90  × 2 = €39.80
Line 3: Standard         €14.90  × 1 = €14.90
───────────────────────────────────────────────
Subtotal:                         €79.60 ✅
Shipping:                         €4.90
───────────────────────────────────────────────
Total:                            €84.50 ✅
```

**localStorage After Migration:**
```javascript
[
  { sku: "LEGACY-1", unit_price_cents: 2490, ... },
  { sku: "CONFIG-1", unit_price_cents: 1990, quantity: 2, ... },
  { sku: "STD-1", unit_price_cents: 1490, ... }
]
// NO price, price_cents, or base_price fields!
```

### Test 4: Clear localStorage and Re-Test

**Purpose:** Verify migration is PERMANENT

**Steps:**
1. Run Test 3 above (mixed cart)
2. Wait for migration (check console logs)
3. Refresh page (F5)
4. Check console - NO migration logs (already done)
5. Check localStorage - items already have unit_price_cents
6. UI still shows correct prices

**Expected:**
- Console: `[CART][LOAD] ✅ All items valid, no migration needed`
- NO `[CART][NORMALIZE]` logs (items already normalized)
- localStorage unchanged (already canonical)
- UI displays same prices as before

---

## 🔧 DEBUG LOGS REFERENCE

**[CART][NORMALIZE]:**
```javascript
[CART][NORMALIZE] price >= 100 → treated as cents: {
  sku: "UNBREAK-GLAS-CONFIG",
  price: 3900,
  unit_price_cents: 3900
}
```
- Shows price field disambiguation
- Heuristic: >= 100 → cents, < 100 → euro

**[CART][LOAD][MIGRATION]:**
```javascript
[CART][LOAD][MIGRATION] 🔄 Migrated cart: {
  before: 3,
  after: 3,
  normalized: true
}
```
- Shows migration occurred
- `normalized: true` → legacy fields converted

**[CART][ITEMS_NORMALIZED]:**
```javascript
[CART][ITEMS_NORMALIZED] [
  { sku: "UNBREAK-GLAS-CONFIG", qty: 1, unit_price_cents: 3900, currency: "EUR" }
]
```
- Shows final canonical schema
- ONLY unit_price_cents field present

---

## ✅ SCHEMA VALIDATION

**ALLOWED FIELDS:**
```javascript
{
  product_id: string,
  sku: string,
  name: string,
  unit_price_cents: number (integer),  // ✅ ONLY price field
  quantity: number,
  currency: 'EUR',
  image_url: string | null,
  configured: boolean,
  config: object | null,
  lang: string | null
}
```

**FORBIDDEN FIELDS (legacy):**
- ❌ `price` (ambiguous - cents or euro?)
- ❌ `price_cents` (redundant - use unit_price_cents)
- ❌ `base_price` (legacy)
- ❌ `total_price` (calculated field)
- ❌ `displayPrice` (calculated field)
- ❌ `calculatedTotal` (calculated field)

**VALIDATION RULES:**
1. `unit_price_cents` MUST be integer
2. `unit_price_cents` MUST be >= 0
3. `unit_price_cents` MUST exist (no null/undefined)
4. `quantity` MUST be >= 1
5. `currency` MUST be 'EUR'

---

## 🐛 TROUBLESHOOTING

### Issue: Still shows €3900.00

**Cause:** localStorage not migrated yet

**Solution:**
1. Hard refresh (Ctrl+Shift+R)
2. Check console for `[CART][LOAD][MIGRATION]`
3. If no log, manually clear: `localStorage.clear()`
4. Reload page
5. Re-add items (will use new schema)

### Issue: Different prices for same item

**Cause:** Multiple items with same SKU but different price sources

**Solution:**
1. Clear cart: `localStorage.clear()`
2. Reload page
3. Re-add items one by one
4. Verify console logs show `[CART][NORMALIZE]`

### Issue: Configurator shows €0.00

**Cause:** Configurator item has `unit_price_cents: 0` (server calculates)

**Solution:**
- This is EXPECTED for configurator items
- Server will calculate correct price during checkout
- UI shows €0.00 as placeholder
- Pricing snapshot API provides real price

---

## 📝 COMMIT INFO

**Branch:** master  
**Commit:** 4b05466  
**Message:** fix(cart): CANONICAL SCHEMA - unit_price_cents ONLY, migrate legacy data

**Files Changed:**
- `lib/cart.js` - normalizeCartItem(), load(), addItem(), getTotal(), getCheckoutPayload()
- `pages/cart.js` - Remove temporary normalization

**Testing Date:** 2026-01-16  
**Priority:** CRITICAL 🚨  
**Status:** ✅ DEPLOYED TO MASTER

---

## 🚀 NEXT STEPS

1. **Clear localStorage in production:**
   - Users will auto-migrate on next page load
   - Migration is transparent (no user action needed)

2. **Monitor Sentry for errors:**
   - Watch for `[CART][NORMALIZE]` errors
   - Check for invalid price values

3. **Verify checkout API:**
   - Ensure `price_cents` field is correctly sent
   - Server should receive unit_price_cents values

4. **Remove debug logs after 1 week:**
   - `[CART][NORMALIZE]` logs
   - `[CART][LOAD][MIGRATION]` logs
   - Keep `[CART][ITEMS_NORMALIZED]` for debugging

5. **Future refactor (optional):**
   - Remove resolveCartItemPrice() (no longer needed)
   - Remove calculateCartTotal() (use simple sum)
   - Simplify pricing logic (single source of truth)
