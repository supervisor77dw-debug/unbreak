# 3D Configurator Integration Contract

## Overview
This document defines the integration contract between the UNBREAK ONE E-Commerce platform and the external 3D Configurator running at `https://unbreak-3-d-konfigurator.vercel.app/`.

**Last Updated:** 2026-01-04  
**Version:** 1.0  
**Status:** 🔴 INCOMPLETE - Awaiting Configurator Implementation

---

## Current Integration Status

### ✅ Shop-Side Implementation (COMPLETE)
- Manual color selectors added as fallback
- Config request system (`GET_CONFIGURATION` message)
- Multi-tier fallback strategy (iframe → manual → timeout)
- Full trace system for debugging

### 🔴 Configurator-Side Implementation (MISSING)
The external configurator does NOT currently send configuration data to the parent window.

**Required Actions on Configurator Project:**
1. Implement `GET_CONFIGURATION` request handler
2. Send `configChanged` messages on color selection
3. Send final config on user action (e.g., "Add to Cart" button in iframe)

---

## Message Protocol

### 1. Parent → iframe: Request Configuration

**When:** User clicks "Jetzt kaufen" button on configurator.html

**Message Format:**
```javascript
{
  type: 'GET_CONFIGURATION'
}
```

**Expected Response:** See Section 2

---

### 2. iframe → Parent: Send Configuration

**When:** 
- User selects/changes colors in 3D viewer
- Parent requests configuration via `GET_CONFIGURATION`
- User clicks internal "Add to Cart" button

**Message Format:**
```javascript
window.parent.postMessage({
  type: 'configChanged',  // or 'UNBREAK_CONFIG_UPDATE' or 'checkout_configuration'
  config: {
    // REQUIRED FIELDS
    colors: {
      base: "graphite",      // Color for base area
      top: "anthracite",     // Color for top area
      middle: "petrol"       // Color for middle area
    },
    finish: "matte",         // or "glossy"
    quantity: 1,
    
    // OPTIONAL FIELDS
    product: "glass_holder",
    product_name: "UNBREAK ONE Glass Holder",
    product_variant: "glass_holder",
    preview_image_url: "https://example.com/preview.jpg",  // Rendered preview
    engraving: null         // Future: custom text
  }
}, '*');  // Target origin - shop will filter by allowlist
```

**Field Specifications:**

| Field | Type | Required | Description | Example Values |
|-------|------|----------|-------------|----------------|
| `colors` | Object | ✅ YES | Color per area | `{base: "graphite", top: "anthracite", middle: "petrol"}` |
| `colors.base` | String | ✅ YES | Base area color | `"graphite"`, `"anthracite"`, `"petrol"`, `"silver"`, `"gold"` |
| `colors.top` | String | ✅ YES | Top area color | Same as base |
| `colors.middle` | String | ✅ YES | Middle area color | Same as base |
| `finish` | String | ✅ YES | Surface finish | `"matte"` or `"glossy"` |
| `quantity` | Number | ⚠️ Optional | Item count (default: 1) | `1`, `2`, `3`, etc. |
| `product` | String | ⚠️ Optional | Product type | `"glass_holder"` |
| `product_name` | String | ⚠️ Optional | Display name | `"UNBREAK ONE Glass Holder"` |
| `preview_image_url` | String | ⚠️ Optional | Rendered preview | Full URL to image |
| `engraving` | String | ⚠️ Optional | Custom text (future) | `null` or text |

---

### 3. iframe → Parent: Ready Signal

**When:** Configurator fully loaded and ready for interaction

**Message Format:**
```javascript
window.parent.postMessage({
  type: 'UNBREAK_CONFIG_READY'
}, '*');
```

**Purpose:** Hides loading overlay, shows iframe

---

### 4. iframe → Parent: Loading Progress (Optional)

**When:** During asset loading

**Message Format:**
```javascript
window.parent.postMessage({
  type: 'UNBREAK_CONFIG_LOADING',
  progress: 50  // 0-100
}, '*');
```

---

### 5. iframe → Parent: Error

**When:** Fatal error in configurator

**Message Format:**
```javascript
window.parent.postMessage({
  type: 'UNBREAK_CONFIG_ERROR',
  message: 'Failed to load 3D model'
}, '*');
```

---

## Color Values Reference

### Supported Colors
All color values must be lowercase strings from this list:

- `"graphite"` - Dark gray
- `"anthracite"` - Charcoal gray
- `"petrol"` - Teal/turquoise
- `"silver"` - Metallic silver
- `"gold"` - Metallic gold

### Color Areas
The product has 3 configurable areas:

- `base` - Bottom/foundation
- `top` - Upper section
- `middle` - Center section

Users can choose different colors for each area.

---

## Checkout Flow

### Current Flow (with Fallback)

```
1. User opens /configurator.html
2. Parent page loads iframe from https://unbreak-3-d-konfigurator.vercel.app/
3. iframe sends UNBREAK_CONFIG_READY when loaded
4. Parent shows manual color selectors (fallback)
5. User selects colors in iframe OR manual dropdowns
6. User clicks "Jetzt kaufen" button
7. Parent sends GET_CONFIGURATION to iframe
8. iframe responds with configChanged message (EXPECTED - NOT IMPLEMENTED)
9. If no response after 1s, use manual selectors
10. If no manual selection, timeout after 3s with error
11. Parent calls /api/checkout/create with config
12. Stripe Checkout Session created
13. User completes payment
14. Webhook updates order with payment data
```

### Desired Flow (After Configurator Fix)

```
1. User opens /configurator.html
2. iframe loads and sends UNBREAK_CONFIG_READY
3. User selects colors in 3D viewer
4. iframe sends configChanged message IMMEDIATELY
5. Parent stores config in window.UnbreakCheckoutState.lastConfig
6. User clicks "Jetzt kaufen"
7. Checkout proceeds immediately with stored config
8. (Manual selectors can be hidden once iframe integration works)
```

---

## API Endpoints

### POST /api/checkout/create

**Purpose:** Create Stripe Checkout Session with configuration

**Request:**
```javascript
{
  product_sku: "UNBREAK-GLAS-01",
  config: {
    colors: {
      base: "graphite",
      top: "anthracite",
      middle: "petrol"
    },
    finish: "matte",
    quantity: 1
  },
  customer: {
    email: "test@example.com",  // Optional
    name: "Test User"            // Optional
  }
}
```

**Response:**
```javascript
{
  sessionId: "cs_test_...",
  url: "https://checkout.stripe.com/c/pay/...",
  orderId: "uuid",
  trace_id: "uuid"
}
```

**Error Handling:**

| Code | Reason | Solution |
|------|--------|----------|
| 400 | Missing `config` | Always include config object |
| 400 | Invalid `product_sku` | Use `"UNBREAK-GLAS-01"` |
| 500 | Database error | Check logs for `[ORDER_WRITE_ERROR]` |
| 500 | Stripe error | Check Stripe dashboard |

---

## Data Storage

### Database: simple_orders Table

**Columns Used:**
```sql
- id (UUID, primary key)
- customer_email (TEXT)
- customer_name (TEXT)
- stripe_customer_id (TEXT)
- customer_id (UUID, FK to customers.id)
- product_sku (TEXT) = "UNBREAK-GLAS-01"
- quantity (INTEGER) = 1
- total_amount_cents (INTEGER) = calculated price
- currency (TEXT) = "EUR"
- status (TEXT) = "pending" → "paid"
- items (JSONB) = [{sku, name, quantity, unit_price_cents, config}]
- config_json (JSONB) = full config object
- preview_image_url (TEXT) = optional preview
- trace_id (UUID) = for debugging
- created_at (TIMESTAMPTZ)
```

**What Gets Stored:**
- Full `config` object in `config_json`
- Individual item with embedded `config` in `items` array
- Preview image URL if provided
- Trace ID for debugging

---

## Testing

### Manual Test Protocol

1. **Open Configurator:**
   ```
   https://unbreak-2fort2m7j-supervisor77dw-debugs-projects.vercel.app/configurator.html
   ```

2. **Check Console:**
   ```javascript
   // Should see:
   ✓ UNBREAK_CONFIG_READY received
   📦 [MANUAL CONFIG] Generated from selectors: {...}
   ```

3. **Select Colors:**
   - Use manual dropdowns (Base: Graphite, Top: Anthracite, Middle: Petrol)
   - OR select in 3D viewer (if iframe sends messages)

4. **Click "Jetzt kaufen":**
   ```javascript
   // Console should show:
   🛒 [BUTTON] Got config: {colors: {...}, finish: "matte"}
   [TRACE] CHECKOUT_CONFIG_RECEIVED {has_colors_object: true}
   ```

5. **Complete Checkout:**
   - Use Stripe test card: `4242 4242 4242 4242`
   - Any future date, any CVC

6. **Verify in Admin:**
   ```
   https://unbreak-2fort2m7j-supervisor77dw-debugs-projects.vercel.app/admin/orders
   ```
   - Open latest order
   - Check "📦 Bestellte Produkte" section shows items
   - Check "🎨 Konfigurator-Konfiguration" shows colors

### SQL Verification

```sql
-- Check last order has config
SELECT 
  id,
  customer_email,
  items,
  config_json,
  total_amount_cents
FROM simple_orders
ORDER BY created_at DESC
LIMIT 1;

-- Expected result:
-- items: [{"sku": "UNBREAK-GLAS-01", "config": {"colors": {...}}}]
-- config_json: {"colors": {"base": "graphite", ...}, "finish": "matte"}
```

---

## Troubleshooting

### Problem: Colors are NULL in orders

**Symptoms:**
```json
{
  "config_json": {"color": null, "finish": "matte"}
}
```

**Causes:**
1. iframe not sending `configChanged` messages
2. User clicked buy before selecting colors
3. postMessage blocked by CORS/origin mismatch

**Solutions:**
1. Use manual color selectors as fallback ✅
2. Implement `GET_CONFIGURATION` in iframe ❌ (pending)
3. Send config on every color change ❌ (pending)

### Problem: Button disappeared

**Symptoms:**
- Buy button not visible on page

**Causes:**
1. Browser cache showing old version
2. CSS overflow hidden
3. Scroll container height wrong

**Solutions:**
1. Hard refresh: Ctrl+Shift+R
2. Check footer for build hash `bc16910`
3. Scroll to bottom of page
4. Use Incognito mode

### Problem: iframe timeout

**Symptoms:**
```
UNBREAK_CONFIG_ERROR: timeout
```

**Causes:**
1. iframe not sending READY signal
2. Origin mismatch
3. iframe blocked by adblocker

**Solutions:**
1. Check iframe console for errors
2. Verify origin: `https://unbreak-3-d-konfigurator.vercel.app`
3. Disable adblockers

---

## Action Items for Configurator Team

### Priority 1: Implement Config Broadcasting

**File:** Main configurator app (assumed: `src/App.tsx` or similar)

**Add:**
```typescript
// When colors change in 3D viewer
function onColorChange(area: string, color: string) {
  // Update local state
  setColors(prev => ({...prev, [area]: color}));
  
  // Send to parent immediately
  if (window.parent !== window) {
    window.parent.postMessage({
      type: 'configChanged',
      config: {
        colors: {
          base: colors.base,
          top: colors.top,
          middle: colors.middle
        },
        finish: selectedFinish,
        quantity: 1,
        product: 'glass_holder'
      }
    }, '*');
  }
}
```

### Priority 2: Implement GET_CONFIGURATION Handler

**File:** Main configurator app

**Add:**
```typescript
// Listen for config requests from parent
window.addEventListener('message', (event) => {
  if (event.data.type === 'GET_CONFIGURATION') {
    // Send current config
    event.source.postMessage({
      type: 'configChanged',
      config: {
        colors: getCurrentColors(),
        finish: getCurrentFinish(),
        quantity: 1
      }
    }, '*');
  }
});
```

### Priority 3: Send READY Signal

**File:** Main configurator app (on mount)

**Add:**
```typescript
useEffect(() => {
  // When 3D scene loaded and ready
  if (sceneReady && window.parent !== window) {
    window.parent.postMessage({
      type: 'UNBREAK_CONFIG_READY'
    }, '*');
  }
}, [sceneReady]);
```

---

## Success Criteria

### ✅ Integration Complete When:

1. **Config Transmission:**
   - [ ] iframe sends `configChanged` on every color selection
   - [ ] iframe responds to `GET_CONFIGURATION` requests
   - [ ] Parent receives `colors` object with 3 areas

2. **Order Data:**
   - [ ] `config_json` has non-null `colors` object
   - [ ] `items` array includes config
   - [ ] Admin UI shows colors in order detail

3. **Customer Stats:**
   - [ ] Total orders count matches actual orders (not 0)
   - [ ] Total spent calculation includes all orders
   - [ ] Last order date populated

4. **Stability:**
   - [ ] Buy button always visible and clickable
   - [ ] No silent errors in checkout flow
   - [ ] Cache busting works (build hash visible)

---

## Support

For questions or issues:
- **Shop-Side:** Check Vercel logs, trace_id in console
- **Configurator-Side:** Check this contract, implement missing handlers
- **Database:** Run SQL verification queries
- **Integration:** Check browser console for postMessage logs

**Build Info:**
- Commit: `bc16910`
- Deployed: Check footer on /configurator.html
- Trace System: Active (see browser console)
