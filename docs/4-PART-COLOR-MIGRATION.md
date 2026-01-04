# UNBREAK-ONE: 4-Part Color Migration - Status & TODOs

**Date:** 2026-01-04  
**Status:** 🚧 IN PROGRESS (50% complete)  
**Commit:** 75899b3

---

## ✅ COMPLETED

### 1. Canonical Color Validation (`lib/configValidation.js`)
- ✅ 7 canonical color IDs defined: `mint, green, purple, iceBlue, darkBlue, red, black`
- ✅ `isCanonicalColorId(value)` - validation helper
- ✅ `validateConfiguratorConfig(config, traceId)` - strict validation
  - Requires `colors.base/arm/module/pattern` for `glass_holder`
  - Only `pattern` for `bottle_holder` (others default to `black`)
  - Throws on validation errors (no silent failures)
- ✅ `getColorHex(colorId)` - returns #hex codes
- ✅ `getColorDisplayName(colorId)` - German display names

###  2. ConfiguratorBridge v2.0.0 (`lib/configuratorBridge.js`)
- ✅ Complete rewrite with 4-part color structure
- ✅ **NO color mapping** (shop uses same IDs as configurator)
- ✅ Strict origin filtering: `https://unbreak-3-d-konfigurator.vercel.app`
- ✅ Validation in `validateConfig()`:
  - `variant`: `glass_holder` | `bottle_holder`
  - `colors`: `{base, arm, module, pattern}`
  - All canonical color IDs validated
- ✅ `requestConfig()` returns validated config with:
  ```javascript
  {
    variant: "glass_holder",
    colors: {base, arm, module, pattern},
    finish: "matte",
    quantity: 1,
    source: "configurator_iframe",
    config_version: "1.0.0",
    trace_id: "trace_abc123"
  }
  ```
- ✅ sessionStorage persistence with TTL
- ✅ trace_id generation and logging

---

## ⏳ REMAINING TODOs

### 3. Update Checkout Payload (`public/checkout.js`)

**Current Problem (Line 247-253):**
```javascript
config: {
  color: config.color,  // ❌ WRONG: Single color (old)
  finish: config.finish || 'matte',
  // ...
}
```

**Required Fix:**
```javascript
config: {
  variant: config.variant || 'glass_holder',
  colors: {  // ✅ CORRECT: 4-part structure
    base: config.colors.base,
    arm: config.colors.arm,
    module: config.colors.module,
    pattern: config.colors.pattern
  },
  finish: config.finish || 'matte',
  quantity: config.quantity || 1,
  source: config.source || 'configurator_iframe',
  config_version: config.config_version || '1.0.0'
}
```

**Files to Edit:**
- `public/checkout.js` lines 240-260
- Remove `config.color` (singular)
- Send complete `config` object from bridge

---

### 4. Update API Validation (`pages/api/checkout/create.js`)

**Current State:**
- Unknown - needs inspection
- Likely validates old 3-color structure (base/top/middle)

**Required Changes:**
1. Import `lib/configValidation.js` validation helpers
2. In `POST` handler, validate incoming config:
   ```javascript
   const { validateConfiguratorConfig } = require('../../lib/configValidation');
   
   // Validate config structure
   try {
     const validatedConfig = validateConfiguratorConfig(
       req.body.config, 
       req.body.trace_id || 'unknown'
     );
     
     console.log('[CHECKOUT_CREATE] Config validated:', validatedConfig);
     
   } catch (error) {
     console.error('[CHECKOUT_CREATE] Validation failed:', error.message);
     return res.status(400).json({
       error: 'Invalid configuration',
       details: error.message,
       trace_id: req.body.trace_id
     });
   }
   ```

3. Store validated config in `orderData.config_json`:
   ```javascript
   const orderData = {
     product_sku: validatedConfig.variant === 'glass_holder' 
       ? 'UNBREAK-GLAS-01' 
       : 'UNBREAK-WEIN-01',
     config_json: validatedConfig,  // Complete 4-part structure
     items: [{
       sku: product_sku,
       name: productName,
       quantity: validatedConfig.quantity,
       unit_price_cents: priceInCents,
       config: validatedConfig  // Embed in items too
     }],
     // ...
   };
   ```

4. **Remove all `try/catch` swallows** - let errors bubble up with logging:
   ```javascript
   // ❌ DON'T DO THIS:
   try {
     orderData.config_json = config;
   } catch (e) {
     // Silent fail - BAD!
   }
   
   // ✅ DO THIS:
   orderData.config_json = validatedConfig;  // Will throw if assignment fails
   ```

**Files to Edit:**
- `pages/api/checkout/create.js` (full validation rewrite)

---

### 5. Update Admin Order Detail UI (`pages/admin/orders/[id].js`)

**Current State:**
- Shows 3 colors: base/top/middle
- Uses old color names (graphite, petrol, anthracite)

**Required Changes:**

1. **Display 4 color swatches** (not 3):
   ```jsx
   {/* Color Swatches for 4 Parts */}
   <div className="color-swatches">
     <div className="swatch">
       <div 
         className="color-box" 
         style={{backgroundColor: getColorHex(config.colors.base)}}
       />
       <span>Base: {getColorDisplayName(config.colors.base)}</span>
     </div>
     
     <div className="swatch">
       <div 
         className="color-box" 
         style={{backgroundColor: getColorHex(config.colors.arm)}}
       />
       <span>Arm: {getColorDisplayName(config.colors.arm)}</span>
     </div>
     
     <div className="swatch">
       <div 
         className="color-box" 
         style={{backgroundColor: getColorHex(config.colors.module)}}
       />
       <span>Module: {getColorDisplayName(config.colors.module)}</span>
     </div>
     
     <div className="swatch">
       <div 
         className="color-box" 
         style={{backgroundColor: getColorHex(config.colors.pattern)}}
       />
       <span>Pattern: {getColorDisplayName(config.colors.pattern)}</span>
     </div>
   </div>
   ```

2. **Import color helpers:**
   ```javascript
   import { getColorHex, getColorDisplayName } from '../../../lib/configValidation';
   ```

3. **Update Items table** to show 4-part config per item

4. **Add variant display:**
   ```jsx
   <div className="config-field">
     <strong>Variant:</strong> {config.variant || 'glass_holder'}
   </div>
   ```

**Files to Edit:**
- `pages/admin/orders/[id].js` (lines ~250-400, Config display section)

---

### 6. Database Verification

**SQL Queries to Run:**

1. **Check latest order has 4-part colors:**
   ```sql
   SELECT 
     id,
     product_sku,
     config_json,
     config_json->'colors'->'base' as color_base,
     config_json->'colors'->'arm' as color_arm,
     config_json->'colors'->'module' as color_module,
     config_json->'colors'->'pattern' as color_pattern,
     config_json->>'variant' as variant,
     items,
     created_at
   FROM simple_orders 
   ORDER BY created_at DESC 
   LIMIT 1;
   ```

   **Expected:**
   - `color_base`, `color_arm`, `color_module`, `color_pattern` all have values from canonical set
   - NO `null` values
   - NO `'petrol'` or `'graphite'` (old names)

2. **Verify items structure:**
   ```sql
   SELECT 
     id,
     items->0->>'sku' as item_sku,
     items->0->'config'->'colors'->'base' as item_color_base,
     items->0->'config'->'colors'->'pattern' as item_color_pattern
   FROM simple_orders 
   ORDER BY created_at DESC 
   LIMIT 1;
   ```

   **Expected:**
   - Items have embedded `config.colors` matching top-level `config_json.colors`

---

### 7. Update E2E Test Protocol (`docs/E2E-TEST-PROTOCOL.md`)

**Changes Needed:**

1. Update **Step 2** color selection:
   ```diff
   - Base: Black → Converted to: graphite
   - Top: Red → Converted to: petrol
   - Middle: Purple → Converted to: anthracite
   + Base: black (canonical ID, no mapping)
   + Arm: black (canonical ID)
   + Module: black (canonical ID)
   + Pattern: red (canonical ID)
   ```

2. Update **Step 4** checkout payload:
   ```json
   {
     "config": {
       "variant": "glass_holder",
       "colors": {
         "base": "black",
         "arm": "black",
         "module": "black",
         "pattern": "red"
       },
       "finish": "matte",
       "quantity": 1,
       "source": "configurator_iframe",
       "config_version": "1.0.0"
     }
   }
   ```

3. Update **Step 6** database verification:
   - Check for 4 color fields (not 3)
   - Validate canonical IDs (not old mapped names)

4. Update **Step 7** admin UI expectations:
   - 4 color swatches (not 3)
   - Correct canonical color names

**Files to Edit:**
- `docs/E2E-TEST-PROTOCOL.md` (full update)

---

## 🎯 Implementation Order

**Priority 1 (Critical Path):**
1. ✅ ConfiguratorBridge v2 (DONE)
2. ⏳ Update `checkout.js` payload (20 min)
3. ⏳ Update `/api/checkout/create` validation (30 min)
4. ⏳ Test order creation → verify DB has 4 colors (15 min)

**Priority 2 (Display & Verification):**
5. ⏳ Update Admin Order Detail UI (30 min)
6. ⏳ Run SQL verification queries (10 min)
7. ⏳ Update E2E test protocol (20 min)

**Total Estimated Time:** ~2 hours

---

## 📝 Code Snippets for Quick Copy-Paste

### Checkout.js Fix (Line ~247)
```javascript
// Replace OLD payload:
body: JSON.stringify({
  trace_id,
  product_sku: sku,
  config: {
    color: config.color,  // ❌ OLD
    finish: config.finish || 'matte',
    // ...
  }
})

// With NEW payload:
body: JSON.stringify({
  trace_id,
  product_sku: sku,
  config: config,  // ✅ Send complete validated config from bridge
  customer: {
    email: config.email || null,
    // ...
  }
})
```

### API Validation Template
```javascript
// At top of pages/api/checkout/create.js:
const { validateConfiguratorConfig } = require('../../lib/configValidation');

// In POST handler:
try {
  const validated = validateConfiguratorConfig(
    req.body.config, 
    req.body.trace_id || 'api_' + Date.now()
  );
  
  console.log('[CHECKOUT_CREATE] trace_id=' + validated.trace_id + ' validated');
  
  // Use validated.colors.base/arm/module/pattern
  
} catch (error) {
  console.error('[CHECKOUT_CREATE] Validation failed:', error.message);
  return res.status(400).json({
    error: 'Invalid configuration',
    details: error.message
  });
}
```

---

## ⚠️ Breaking Changes

1. **Config Structure Changed:**
   - Old: `{color: "petrol", finish: "matte"}`  
   - New: `{variant: "glass_holder", colors: {base, arm, module, pattern}, finish: "matte"}`

2. **Color IDs Changed:**
   - Old: `graphite`, `petrol`, `anthracite` (shop-specific)  
   - New: `mint`, `green`, `purple`, `iceBlue`, `darkBlue`, `red`, `black` (canonical)

3. **No More Color Mapping:**
   - Old: `black → graphite` (transformation in bridge)  
   - New: `black → black` (direct passthrough)

4. **Validation is Strict:**
   - Missing color: **throws error** (not silent default)
   - Invalid color ID: **throws error** (not fallback to "petrol")
   - Incomplete config: **checkout blocked** (not proceeding with partial data)

---

## 🧪 Testing Checklist

After implementation, verify:

- [ ] Bridge receives 4-part config from iframe
- [ ] `requestConfig()` returns validated config with all 4 colors
- [ ] Checkout payload contains `config.colors.{base,arm,module,pattern}`
- [ ] API validates config and rejects invalid colors
- [ ] Database stores all 4 colors (NO nulls)
- [ ] Admin UI displays 4 color swatches correctly
- [ ] Customer stats still accurate (regression test)
- [ ] Error scenarios handled gracefully (not ready, invalid config, timeout)

---

**END OF STATUS DOCUMENT**

**Next Action:** Continue with TODO #3 (update checkout.js payload)
