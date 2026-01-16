# POST-MESSE CLEANUP: Admin Pricing System
**Priorität:** Medium  
**Status:** TODO (nach Messe)  
**Current:** HARDCODED Pricing in lib/cart.js (dirty fix)  
**Target:** Dynamic DB lookup

---

## 🎯 Current State (Dirty Fix - Works!)

**File:** `lib/cart.js` Lines 15-23

```javascript
const ADMIN_PRICING = {
  'UNBREAK-GLAS-01': 1990,  // €19.90 - Glashalter
  'UNBREAK-WEIN-01': 2490,  // €24.90 - Flaschenhalter
};
```

**Problem:** 
- Prices are HARDCODED in JavaScript
- Changes require code deployment
- No sync with Supabase products table

**Why it works for Messe:**
- Fast (no DB query)
- Reliable (no network dependency)
- Simple (no caching needed)

---

## ✅ Clean Solution (Post-Messe)

### Option A: Client-Side DB Lookup (Recommended)

**Implementation:**
1. Load products from Supabase on cart mount
2. Create productsIndex: `{ 'UNBREAK-GLAS-01': { base_price_cents: 1990 }, ... }`
3. Pass to `resolveCartItemPrice(item, null, productsIndex)`
4. Remove HARDCODED ADMIN_PRICING

**Files to change:**
- `pages/cart.js` - Add useEffect to load products
- `lib/cart.js` - Remove ADMIN_PRICING constant
- `lib/pricing/cartPriceResolver.js` - Already supports productsIndex!

**Code Example:**
```javascript
// pages/cart.js
const [productsIndex, setProductsIndex] = useState({});

useEffect(() => {
  async function loadProducts() {
    const { data } = await supabase
      .from('products')
      .select('sku, base_price_cents, name')
      .eq('active', true);
    
    const index = {};
    data?.forEach(p => {
      index[p.sku] = p;
    });
    setProductsIndex(index);
  }
  loadProducts();
}, []);

// Then in render:
const displayPrice = resolveCartItemPrice(item, null, productsIndex);
```

### Option B: Server-Side API (Alternative)

**Implementation:**
1. Create `/api/cart/resolve-prices`
2. POST cart items → GET prices from products table
3. Return enriched items with unit_price_cents

**Pros:**
- Single source of truth (DB)
- No client-side caching needed

**Cons:**
- Extra API call (slower)
- Network dependency

---

## 🔧 Migration Steps

### Step 1: Update DB (Already done!)
```sql
UPDATE products SET base_price_cents = 1990 WHERE sku = 'UNBREAK-GLAS-01';
UPDATE products SET base_price_cents = 2490 WHERE sku = 'UNBREAK-WEIN-01';
```
**File:** `scripts/fix-configurator-pricing-p0.sql`

### Step 2: Implement Option A
1. Add products fetch in pages/cart.js
2. Pass productsIndex to calculateLocalSubtotal
3. Use resolveCartItemPrice(item, null, productsIndex)

### Step 3: Remove Hardcoded Pricing
1. Delete ADMIN_PRICING constant from lib/cart.js
2. Remove fallback logic in normalizeCartItem (lines 93-99)
3. Test: All prices still resolve correctly

### Step 4: Verify
- [ ] Glashalter shows €19.90
- [ ] Flaschenhalter shows €24.90
- [ ] DB price changes reflect immediately (no code deploy)
- [ ] No HARDCODED prices in code

---

## 📊 Acceptance Criteria (Clean Solution)

**Must Have:**
- [ ] Prices come from Supabase products table
- [ ] No HARDCODED pricing in JavaScript
- [ ] Price changes via Admin Panel (no code deploy)
- [ ] Fast rendering (use productsIndex cache)
- [ ] Fallback to €0 if SKU not found (visual bug indicator)

**Nice to Have:**
- [ ] Loading state while fetching products
- [ ] Error handling if Supabase unavailable
- [ ] Stale-while-revalidate caching

---

## 🚨 Reminder

**Current dirty fix is PRODUCTION-SAFE for Messe:**
- ✅ Works reliably
- ✅ No performance impact
- ✅ No user-facing issues

**Clean up AFTER Messe when time allows!**

---

**Created:** 2026-01-16  
**Dirty Fix Commit:** 2aa0fa6  
**Priority:** Post-Messe cleanup
