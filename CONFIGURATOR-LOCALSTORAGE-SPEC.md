# Konfigurator → Shop localStorage Integration

## localStorage Key (EXACT)

```javascript
localStorage.setItem('pendingConfiguratorItem', JSON.stringify(item));
```

**CRITICAL:** Der Key MUSS exakt `pendingConfiguratorItem` sein (case-sensitive).

---

## Required Item Format

Der Konfigurator MUSS dieses Format speichern:

```javascript
{
  // Product Identity (REQUIRED)
  "product_id": "glass_configurator",  // Fixed ID for configurator items
  "sku": "glass_configurator",         // Fixed SKU
  
  // Display (REQUIRED)
  "name": "Individueller Glashalter",  // Product name (DE/EN based on lang)
  "title_de": "Individueller Glashalter",
  
  // Pricing (REQUIRED)
  "price": 3900,  // Price in CENTS (e.g., 39.00 EUR = 3900)
  
  // Quantity (OPTIONAL - defaults to 1)
  "quantity": 1,
  
  // Image (OPTIONAL)
  "image_url": "https://...",  // Product preview URL if available
  
  // Configurator Metadata (REQUIRED for checkout)
  "configured": true,  // Flag: this is a configured item
  "config": {
    // All configuration choices made by user
    "variant": "glass_holder",  // or "bottle_holder"
    "baseColor": "#1A1A1A",
    "accentColor": "#FFD700",
    "finish": "matte",
    "engraving": "UNBREAK",
    // ... all other config options
  },
  
  // Additional metadata (OPTIONAL)
  "meta": {
    "configured_at": "2026-01-15T10:30:00Z",
    "configurator_version": "1.0.0"
  }
}
```

---

## Minimal Working Example

Absolutes Minimum (ohne config-Details):

```javascript
const item = {
  product_id: "glass_configurator",
  sku: "glass_configurator",
  name: "Individueller Glashalter",
  price: 3900,  // 39.00 EUR in cents
  configured: true,
  config: {
    variant: "glass_holder",
    baseColor: "#1A1A1A",
    accentColor: "#FFD700"
  }
};

localStorage.setItem('pendingConfiguratorItem', JSON.stringify(item));
window.location.href = 'https://www.unbreak-one.com/shop';
```

---

## Shop-Side Processing

Der Shop ([pages/shop.js](pages/shop.js)):

1. **Liest beim Page-Load:**
   ```javascript
   const pendingItem = localStorage.getItem('pendingConfiguratorItem');
   ```

2. **Parsed JSON:**
   ```javascript
   const cartItem = JSON.parse(pendingItem);
   ```

3. **Fügt zum Cart hinzu:**
   ```javascript
   cart.addItem(cartItem);  // Uses lib/cart.js
   ```

4. **Löscht Key:**
   ```javascript
   localStorage.removeItem('pendingConfiguratorItem');
   ```

---

## Cart Item Structure (Internal)

Der Shop speichert Items im Cart so:

```javascript
{
  product_id: "glass_configurator",
  sku: "glass_configurator",
  name: "Individueller Glashalter",
  price: 3900,
  quantity: 1,
  image_url: null,
  configured: true,  // ← Important: marks as configurator item
  config: { ... },   // ← Required for checkout
  meta: { ... }      // Optional
}
```

---

## Validation Rules

✅ **MUST HAVE:**
- `product_id` = `"glass_configurator"`
- `sku` = `"glass_configurator"`
- `name` (string, not empty)
- `price` (number, cents, > 0)
- `configured` = `true`
- `config` (object, not empty)

❌ **FORBIDDEN:**
- Instant Stripe redirect from configurator
- Direct checkout without cart
- postMessage flow (not used anymore)

---

## Testing

**1. Konfigurator-seitig:**

```javascript
// In browser console auf konfigurator-seite:
const testItem = {
  product_id: "glass_configurator",
  sku: "glass_configurator",
  name: "Test Glashalter",
  price: 3900,
  configured: true,
  config: { variant: "glass_holder", baseColor: "#000" }
};

localStorage.setItem('pendingConfiguratorItem', JSON.stringify(testItem));
console.log('[CFG][TEST] Item saved to localStorage');

// Dann redirect:
window.location.href = 'https://www.unbreak-one.com/shop';
```

**2. Shop-seitig (Browser Console auf /shop):**

Nach Redirect sollte erscheinen:
```
[SHOP][CONFIGURATOR_ITEM] {"product_id":"glass_configurator",...}
[SHOP][CONFIGURATOR_ITEM_ADDED]
```

Und Item ist im Warenkorb sichtbar.

---

## Error Handling

**Parse Error:**
```javascript
console.error('[SHOP][CONFIGURATOR_ITEM_PARSE_FAILED]', err);
// Key wird trotzdem gelöscht (verhindert Endlosschleife)
localStorage.removeItem('pendingConfiguratorItem');
```

**Invalid Format:**
```javascript
// Cart.addItem() returns false if:
// - Missing required fields
// - Invalid price
// - Missing config for configured items
```

---

## Migration Notes

**Alte Varianten (nicht mehr verwendet):**
- ❌ `?from=configurator` URL parameter (war Bedingung, jetzt removed)
- ❌ postMessage zwischen iframe und shop
- ❌ Direct checkout flow

**Neue Variante (aktuell):**
- ✅ localStorage-only
- ✅ Standard cart flow
- ✅ Checkout nur über cart page
