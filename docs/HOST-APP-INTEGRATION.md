# Host App Integration Guide - DesignPayload v1

Complete guide for integrating the 3D configurator into your shop for cart, pricing, checkout, and fulfillment.

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Business Logic & Product Model](#business-logic--product-model)
3. [Setup & Installation](#setup--installation)
4. [Iframe Integration](#iframe-integration)
5. [Pricing System](#pricing-system)
6. [Cart Integration](#cart-integration)
7. [Checkout & Orders](#checkout--orders)
8. [Fulfillment Export](#fulfillment-export)
9. [Debug & Observability](#debug--observability)
10. [Security](#security)
11. [Testing](#testing)

---

## Architecture Overview

```
┌────────────────────────────────────────────────┐
│ HOST SHOP (Next.js)                            │
│                                                 │
│  ┌──────────────────────────────────────────┐ │
│  │ ConfiguratorBridge                        │ │
│  │ - Mounts iframe                           │ │
│  │ - Listens to postMessage                  │ │
│  │ - Validates origin                        │ │
│  │ - Stores design payload                   │ │
│  └──────────────────────────────────────────┘ │
│                    ↓                            │
│  ┌──────────────────────────────────────────┐ │
│  │ Pricing Service                           │ │
│  │ - Re-prices server-side                   │ │
│  │ - Validates signature                     │ │
│  │ - Uses pricebook v1.0                     │ │
│  └──────────────────────────────────────────┘ │
│                    ↓                            │
│  ┌──────────────────────────────────────────┐ │
│  │ Cart (configurable items)                 │ │
│  │ - Single line item per design             │ │
│  │ - Embedded payload + pricing              │ │
│  │ - qty=1 (duplicate for multiples)         │ │
│  └──────────────────────────────────────────┘ │
│                    ↓                            │
│  ┌──────────────────────────────────────────┐ │
│  │ Checkout → Order → Fulfillment            │ │
│  │ - Server validates signature              │ │
│  │ - Creates order with design snapshot      │ │
│  │ - Exports BOM for production              │ │
│  └──────────────────────────────────────────┘ │
└────────────────────────────────────────────────┘
                     ↕ postMessage
┌────────────────────────────────────────────────┐
│ CONFIGURATOR (iframe)                          │
│ - Sends DESIGN_CHANGED (debounced 200ms)       │
│ - Sends DESIGN_SNAPSHOT (on user action)       │
│ - Handles GET_CURRENT_PAYLOAD request          │
└────────────────────────────────────────────────┘
```

---

## Business Logic & Product Model

**Complete business rules:** See [BUSINESS-LOGIC-PRICING.md](./BUSINESS-LOGIC-PRICING.md)

### Product Model (3 Components)

Every configurator design resolves to:

1. **Base Product (Mandatory)**
   - Exactly ONE base SKU (identical to shop product)
   - Price from shop catalog (single source of truth)
   - Examples: `UNBREAK-GLAS-SET-2` (€89.90)

2. **Customization Fee (Mandatory for Non-Default)**
   - ONE global fee: `CUSTOM_DESIGN_FEE` (€15.00)
   - Applied iff `customization.enabled = true`
   - Covers: design effort, handling, production setup

3. **Premium Components (Optional, Additive)**
   - DELTA prices ONLY (not base products)
   - Examples: Wood inlay (+€18), Custom color (+€30)
   - Added on top of base + customization

### Pricing Formula

```
TOTAL = BASE_PRICE + CUSTOMIZATION_FEE + SUM(PREMIUM_ADDONS)

Example:
  Base: Glashalter 2er Set         €89.90
  Customization                     €15.00
  Premium: Holzsockel               €18.00
  Premium: Individuelle Farbe       €30.00
  ──────────────────────────────────────────
  TOTAL                            €152.90
```

### Validation Rules (Hard Fail)

Reject design if:
1. Base SKU cannot be resolved
2. `customization.enabled = true` but no fee configured
3. Premium addon `pricingKey` is unknown
4. Pricing signature mismatch (client ≠ server)

### Revenue Accounting Split

```
Total Revenue: €152.90
├─ Base Products: €89.90 → assigned to SKU
├─ Customization Services: €15.00 → "Customization Services"
└─ Premium Components: €48.00 → addon categories
   ├─ Materials: €18.00
   └─ Colors: €30.00
```

**Example Order:** See [EXAMPLE-ORDER-SNAPSHOT.json](./EXAMPLE-ORDER-SNAPSHOT.json)

---

## Setup & Installation

### 1. Files Structure

```
lib/
  ├── configurator-bridge.js          # Iframe integration
  ├── pricing/
  │   ├── pricebook.js                # Fee/addon pricing config
  │   └── design-pricing.js           # Pricing calculation + signature
  ├── cart/
  │   └── configurable-cart-item.js   # Cart item type
  └── fulfillment/
      └── design-export.js            # Production export

pages/api/
  ├── cart/
  │   └── add-design.js               # Add design to cart
  └── pricing/
      └── validate-design.js          # Validate pricing

components/
  └── ConfiguratorDebugPanel.jsx      # Debug UI (dev only)

configurator/
  ├── design-payload-v1-types.js      # Shared types/validation
  ├── sku-mapping-config.js           # SKU mappings
  ├── postmessage-bridge.js           # Configurator-side bridge
  └── INTEGRATION-V1-SHOP.md          # Configurator docs
```

### 2. Environment Variables

```env
# .env.local
NEXT_PUBLIC_CONFIGURATOR_URL=https://configurator.unbreak.one
NEXT_PUBLIC_DEBUG_CONFIGURATOR=false  # Set true for debug panel

# Allowed origins (comma-separated)
CONFIGURATOR_ALLOWED_ORIGINS=https://configurator.unbreak.one,https://staging.unbreak.one
```

---

## Iframe Integration

### 1. Create Configurator Page

```jsx
// pages/configurator.js
import { useEffect, useState } from 'react';
import { ConfiguratorBridge, getAllowedOrigins } from '../lib/configurator-bridge.js';
import ConfiguratorDebugPanel from '../components/ConfiguratorDebugPanel.jsx';

export default function ConfiguratorPage() {
  const [bridge, setBridge] = useState(null);
  const [currentDesign, setCurrentDesign] = useState(null);
  
  useEffect(() => {
    const bridgeInstance = new ConfiguratorBridge({
      iframeUrl: process.env.NEXT_PUBLIC_CONFIGURATOR_URL,
      containerId: 'configurator-container',
      allowedOrigins: getAllowedOrigins(),
      debug: process.env.NEXT_PUBLIC_DEBUG_CONFIGURATOR === 'true',
      
      // Callbacks
      onReady: (info) => {
        console.log('Configurator ready:', info);
      },
      
      onDesignChanged: (payload) => {
        console.log('Design changed:', payload);
        setCurrentDesign(payload);
      },
      
      onDesignSnapshot: async (payload) => {
        console.log('Design snapshot:', payload);
        await handleAddToCart(payload);
      },
      
      onError: (error) => {
        console.error('Configurator error:', error);
        alert('Ein Fehler ist aufgetreten');
      }
    });
    
    bridgeInstance.mount();
    setBridge(bridgeInstance);
    
    return () => bridgeInstance.unmount();
  }, []);
  
  const handleAddToCart = async (payload) => {
    try {
      const response = await fetch('/api/cart/add-design', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ payload })
      });
      
      const result = await response.json();
      
      if (result.success) {
        alert('Design wurde zum Warenkorb hinzugefügt!');
        window.location.href = '/cart';
      } else {
        alert('Fehler: ' + result.message);
      }
    } catch (error) {
      console.error('Add to cart error:', error);
      alert('Ein Fehler ist aufgetreten');
    }
  };
  
  return (
    <div>
      <div id="configurator-container" style={{ width: '100%', height: '100vh' }} />
      
      <button
        onClick={async () => {
          const payload = await bridge.requestCurrentPayload();
          await handleAddToCart(payload);
        }}
        style={{
          position: 'fixed',
          bottom: '20px',
          left: '50%',
          transform: 'translateX(-50%)',
          padding: '16px 32px',
          fontSize: '18px',
          background: '#000',
          color: '#fff',
          border: 'none',
          borderRadius: '8px',
          cursor: 'pointer'
        }}
      >
        In den Warenkorb
      </button>
      
      {process.env.NEXT_PUBLIC_DEBUG_CONFIGURATOR === 'true' && (
        <ConfiguratorDebugPanel bridge={bridge} />
      )}
    </div>
  );
}
```

### 2. Bridge API Reference

```javascript
// Create and mount bridge
const bridge = new ConfiguratorBridge({
  iframeUrl: string,           // Configurator URL
  containerId: string,         // DOM container ID
  allowedOrigins: string[],    // Origin allowlist
  debug: boolean,              // Enable console logs
  onReady: (info) => {},       // CONFIG_READY callback
  onDesignChanged: (payload) => {},  // DESIGN_CHANGED callback (debounced)
  onDesignSnapshot: (payload) => {}, // DESIGN_SNAPSHOT callback (user action)
  onError: (error) => {}       // ERROR callback
});

bridge.mount();                // Mount iframe
bridge.unmount();              // Cleanup

// Request data from configurator
const payload = await bridge.requestCurrentPayload();  // Returns promise
bridge.requestPreviews();      // Trigger preview generation
bridge.requestReset();         // Reset to default

// Send commands
bridge.updateVariant(variantKey);
bridge.close();

// Get cached data
const payload = bridge.getCurrentPayload();  // Last known payload
const info = bridge.getConfiguratorInfo();   // Configurator metadata
const log = bridge.getMessageLog();          // Message history (last 50)
```

---

## Pricing System

### 1. Pricebook Configuration

Edit [`lib/pricing/pricebook.js`](lib/pricing/pricebook.js):

```javascript
// Increment version on ANY price change
export const PRICEBOOK_VERSION = 'v1.2024-01-03';

// Customization fees
export const CUSTOMIZATION_FEES = {
  CUSTOMIZE_FEE_V1: {
    amount: 15.00,
    currency: 'EUR',
    description: 'Standard Individualisierung',
    active: true
  }
};

// Premium addon deltas
export const ADDON_DELTAS = {
  ADDON_ENGRAVING_STANDARD: {
    amount: 12.00,
    currency: 'EUR',
    unit: 'pcs',
    description: 'Lasergravur Standard',
    active: true
  }
};
```

### 2. Pricing Calculation

```javascript
import { priceDesign } from '../lib/pricing/design-pricing.js';

const pricingResult = priceDesign(designPayload);
// {
//   valid: true,
//   errors: [],
//   currency: 'EUR',
//   baseTotal: 49.90,
//   customizationFee: 15.00,
//   addonsTotal: 12.00,
//   total: 76.90,
//   breakdownLines: [...],
//   pricebookVersion: 'v1.2024-01-03',
//   pricingSignature: 'a1b2c3d4...',
//   calculatedAt: '2024-01-03T10:30:00.000Z'
// }
```

### 3. Pricing Formula

```
TOTAL = SUM(baseComponents[i].sku price * qty)
      + customizationFee (if enabled)
      + SUM(premiumAddons[i].pricingKey price * qty)
```

**Important:**
- Base component prices come from **shop catalog** (single source of truth)
- Fees/addons come from **pricebook**
- Server re-calculates and validates pricing signature

### 4. Signature Validation

```javascript
import { verifyPricingSignature } from '../lib/pricing/design-pricing.js';

const verification = verifyPricingSignature(
  designPayload,
  clientSignature,
  clientPricebookVersion
);

if (!verification.valid) {
  // Handle mismatch:
  // - PRICEBOOK_VERSION_MISMATCH → reprice with new version
  // - SIGNATURE_MISMATCH → pricing tampered or needs recalc
  // - PRICING_CALCULATION_ERROR → invalid SKU/addon
}
```

---

## Cart Integration

### 1. Add Design to Cart (Client-Side)

```javascript
import { createConfigurableCartItem } from '../lib/cart/configurable-cart-item.js';

const cartItem = createConfigurableCartItem(designPayload, {
  title: 'Custom Glashalter'  // Optional
});

// Store in localStorage or send to server
localStorage.setItem('cart', JSON.stringify([...cart, cartItem]));
```

### 2. Cart Item Structure

```javascript
{
  type: 'CONFIGURATOR_DESIGN',
  cartItemId: 'cart_1234567890_abc123',
  designId: 'design_1234567890_xyz789',
  title: 'Glashalter individualisiert',
  quantity: 1,  // Always 1 per design
  
  pricing: {
    currency: 'EUR',
    unitPrice: 76.90,
    total: 76.90,
    breakdownLines: [
      { type: 'base', sku: 'UNBREAK-GLAS-01', qty: 1, unitPrice: 49.90, lineTotal: 49.90 },
      { type: 'customization', feeKey: 'CUSTOMIZE_FEE_V1', lineTotal: 15.00 },
      { type: 'addon', pricingKey: 'ADDON_ENGRAVING_STANDARD', qty: 1, lineTotal: 12.00 }
    ],
    pricebookVersion: 'v1.2024-01-03',
    pricingSignature: 'a1b2c3d4...',
    calculatedAt: '2024-01-03T10:30:00.000Z'
  },
  
  previews: {
    heroUrl: 'https://cdn.unbreak.one/designs/hero_123.png',
    thumbUrl: 'https://cdn.unbreak.one/designs/thumb_123.png'
  },
  
  payload: { /* full DesignPayloadV1 */ },
  
  addedAt: '2024-01-03T10:30:00.000Z',
  updatedAt: '2024-01-03T10:30:00.000Z'
}
```

### 3. Business Rules

**Quantity:**
- Configurable items MUST have `quantity = 1`
- To order multiples, user must **duplicate** the design (creates new `designId`)

```javascript
import { duplicateCartItem } from '../lib/cart/configurable-cart-item.js';

// User wants 2 of the same design
const duplicate = duplicateCartItem(cartItem);
cart.push(duplicate);  // Now cart has 2 items with different designIds
```

### 4. Cart UI Display

```jsx
import { getCartItemSummary, getCartTotals } from '../lib/cart/configurable-cart-item.js';

function CartItem({ item }) {
  const summary = getCartItemSummary(item);
  const [expanded, setExpanded] = useState(false);
  
  return (
    <div>
      <img src={summary.thumbUrl} alt={summary.title} />
      <h3>{summary.title}</h3>
      <p>{summary.pricing.formatted.total}</p>
      
      <button onClick={() => setExpanded(!expanded)}>
        {expanded ? 'Weniger' : 'Details'}
      </button>
      
      {expanded && (
        <div>
          <p>Basis: {summary.pricing.formatted.subtotal}</p>
          {summary.hasCustomization && (
            <p>Individualisierung: {summary.pricing.formatted.customization}</p>
          )}
          {summary.addonsCount > 0 && (
            <p>Addons ({summary.addonsCount}): {summary.pricing.formatted.addons}</p>
          )}
        </div>
      )}
    </div>
  );
}

function Cart({ items }) {
  const totals = getCartTotals(items);
  
  return (
    <div>
      {items.map(item => <CartItem key={item.cartItemId} item={item} />)}
      <div>
        <h3>Gesamt: {totals.total} EUR</h3>
        <p>{totals.itemCount} Artikel</p>
      </div>
    </div>
  );
}
```

---

## Checkout & Orders

### 1. Add Design to Cart API

**Endpoint:** `POST /api/cart/add-design`

```javascript
// Request
{
  payload: { /* DesignPayloadV1 */ },
  clientPricing: {
    pricingSignature: 'abc123...',
    pricebookVersion: 'v1.2024-01-03'
  }
}

// Success Response (200)
{
  success: true,
  cartItem: { /* ConfigurableCartItem */ },
  pricing: { /* Server pricing result */ },
  message: 'Design wurde zum Warenkorb hinzugefügt'
}

// Error Response (409 - Price Mismatch)
{
  error: 'SIGNATURE_MISMATCH',
  details: { client: '...', server: '...' },
  serverPricing: { /* Updated pricing */ },
  message: 'Preis muss neu berechnet werden'
}

// Error Response (400 - Invalid Payload)
{
  error: 'INVALID_PAYLOAD',
  details: ['Missing SKU', 'Invalid qty'],
  message: 'Design payload ist ungültig'
}
```

### 2. Checkout Session Creation

```javascript
// pages/api/checkout/create-session.js
import { verifyPricingSignature } from '../../../lib/pricing/design-pricing.js';

export default async function handler(req, res) {
  const { cartItems } = req.body;
  
  let totalAmount = 0;
  const lineItems = [];
  
  for (const item of cartItems) {
    if (item.type === 'CONFIGURATOR_DESIGN') {
      // 1. Re-validate payload
      const validation = validatePayloadV1(item.payload);
      if (!validation.valid) {
        return res.status(400).json({
          error: 'INVALID_PAYLOAD',
          designId: item.designId,
          details: validation.errors
        });
      }
      
      // 2. Verify pricing signature (smoking gun!)
      const verification = verifyPricingSignature(
        item.payload,
        item.pricing.pricingSignature,
        item.pricing.pricebookVersion
      );
      
      if (!verification.valid) {
        console.error('[Checkout] PRICE_MISMATCH_DETECTED:', {
          designId: item.designId,
          error: verification.error,
          clientSignature: item.pricing.pricingSignature,
          serverSignature: verification.serverPricing?.pricingSignature
        });
        
        return res.status(409).json({
          error: 'PRICE_MISMATCH_REPRICE_REQUIRED',
          designId: item.designId,
          details: verification.details,
          serverPricing: verification.serverPricing
        });
      }
      
      console.log('[Checkout] ✅ Pricing verified:', {
        designId: item.designId,
        total: verification.serverPricing.total,
        signature: verification.serverPricing.pricingSignature
      });
      
      // 3. Add to order line items
      totalAmount += verification.serverPricing.total;
      lineItems.push({
        type: 'CONFIGURATOR_DESIGN',
        designId: item.designId,
        payload: item.payload,
        pricing: verification.serverPricing
      });
    }
  }
  
  // 4. Create Stripe session or payment intent
  const session = await stripe.checkout.sessions.create({
    line_items: lineItems.map(item => ({
      price_data: {
        currency: 'eur',
        product_data: {
          name: `Design ${item.designId}`,
          metadata: {
            designId: item.designId,
            pricingSignature: item.pricing.pricingSignature
          }
        },
        unit_amount: Math.round(item.pricing.total * 100)
      },
      quantity: 1
    })),
    mode: 'payment',
    success_url: `${process.env.NEXT_PUBLIC_BASE_URL}/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${process.env.NEXT_PUBLIC_BASE_URL}/cart`
  });
  
  return res.status(200).json({ sessionId: session.id });
}
```

### 3. Order Creation

```javascript
// pages/api/orders/create.js
export default async function handler(req, res) {
  const { sessionId } = req.body;
  
  // 1. Retrieve Stripe session
  const session = await stripe.checkout.sessions.retrieve(sessionId);
  
  // 2. Create order in database
  const order = await db.order.create({
    data: {
      orderNumber: generateOrderNumber(),
      customerId: session.customer,
      status: 'PENDING',
      currency: 'EUR',
      total: session.amount_total / 100,
      
      // Store line items with full design payload
      lineItems: {
        create: cartItems.map(item => ({
          type: item.type,
          designId: item.designId,
          
          // Full payload for fulfillment
          designPayload: item.payload,
          
          // Pricing breakdown
          pricingBreakdown: item.pricing.breakdownLines,
          pricebookVersion: item.pricing.pricebookVersion,
          pricingSignature: item.pricing.pricingSignature,
          
          // Previews
          heroImageUrl: item.previews.heroUrl,
          thumbImageUrl: item.previews.thumbUrl,
          
          // Amounts
          unitPrice: item.pricing.total,
          quantity: 1,
          lineTotal: item.pricing.total
        }))
      }
    }
  });
  
  console.log('[Order] Created:', {
    orderId: order.id,
    orderNumber: order.orderNumber,
    lineItems: order.lineItems.length,
    total: order.total
  });
  
  return res.status(200).json({ order });
}
```

---

## Fulfillment Export

### 1. Export for Production

```javascript
import { exportDesignForFulfillment } from '../lib/fulfillment/design-export.js';

// Export single design
const fulfillmentExport = exportDesignForFulfillment(orderLineItem, order);
```

### 2. Fulfillment Export Structure

```javascript
{
  // Order metadata
  orderId: 'ord_123',
  orderNumber: 'ORD-2024-0001',
  customerId: 'cus_xyz',
  orderDate: '2024-01-03T10:30:00.000Z',
  
  // Design metadata
  designId: 'design_abc',
  productFamily: 'GLASSHOLDER',
  configuratorVersion: '1.0.0',
  
  // What to manufacture
  baseComponents: [
    { sku: 'UNBREAK-GLAS-01', qty: 1, variantId: 'single' }
  ],
  
  // Customizations
  customization: {
    enabled: true,
    feeKey: 'CUSTOMIZE_FEE_V1',
    complexity: 'standard'
  },
  
  // Premium addons
  premiumAddons: [
    {
      pricingKey: 'ADDON_ENGRAVING_STANDARD',
      addonId: 'ENGRAVING_STANDARD',
      label: 'Standardgravur',
      qty: 1,
      instructions: 'Lasergravur gemäß Kunden-Text'
    }
  ],
  
  // Technical specs
  bom: {
    parts: [...],
    materials: {...},
    assembly: {...}
  },
  
  sceneState: {
    camera: {...},
    colors: { primary: '#000000' },
    materials: { base: 'STAINLESS_STEEL' },
    dimensions: {...}
  },
  
  // Visual references
  previews: {
    heroUrl: 'https://...',
    thumbUrl: 'https://...'
  },
  
  // Production notes
  productionNotes: [
    '⚠️ INDIVIDUALISIERT - Sonderanfertigung',
    'Farbe: #000000',
    '⚠️ GRAVUR erforderlich'
  ],
  
  exportedAt: '2024-01-03T11:00:00.000Z',
  exportVersion: '1.0'
}
```

### 3. Batch Export

```javascript
import { 
  exportOrderForFulfillment,
  formatFulfillmentCSV,
  generatePickList 
} from '../lib/fulfillment/design-export.js';

// Export all designs from order
const exports = exportOrderForFulfillment(order);

// Generate CSV for production system
const csv = formatFulfillmentCSV(exports);

// Generate warehouse pick list
const pickList = generatePickList(exports);
// [
//   { sku: 'UNBREAK-GLAS-01', totalQty: 5, orders: [...] },
//   { sku: 'UNBREAK-FLASCHE-01', totalQty: 3, orders: [...] }
// ]
```

---

## Debug & Observability

### 1. Debug Panel (React Component)

Toggle with **Ctrl+Shift+K** or set `NEXT_PUBLIC_DEBUG_CONFIGURATOR=true`

```jsx
import ConfiguratorDebugPanel from '../components/ConfiguratorDebugPanel.jsx';

<ConfiguratorDebugPanel bridge={bridge} isOpen={isDev} />
```

Features:
- **Payload Tab:** Current design JSON
- **Pricing Tab:** Breakdown + signature + pricebook version
- **Messages Tab:** postMessage log (last 50)

### 2. Server Logs (Smoking Gun)

```javascript
// When receiving DESIGN_CHANGED
console.log('[Bridge] Design changed:', {
  designId: payload.designId,
  updatedAt: payload.updatedAt,
  baseComponents: payload.baseComponents.length,
  addons: payload.premiumAddons?.length || 0,
  customization: payload.customization?.enabled || false
});

// When pricing
console.log('[Pricing] Calculated:', {
  designId: payload.designId,
  baseTotal: pricing.baseTotal,
  customizationFee: pricing.customizationFee,
  addonsTotal: pricing.addonsTotal,
  total: pricing.total,
  pricebookVersion: pricing.pricebookVersion,
  signature: pricing.pricingSignature
});

// When checkout
console.log('[Checkout] Validating:', {
  orderId: order.id,
  designId: lineItem.designId,
  clientSignature: clientPricing.pricingSignature,
  serverSignature: serverPricing.pricingSignature,
  match: clientSignature === serverSignature
});

// SMOKING GUN: Signature mismatch
console.error('[Checkout] ⚠️ PRICE_MISMATCH_DETECTED:', {
  designId: item.designId,
  clientSignature: item.pricing.pricingSignature,
  serverSignature: verification.serverPricing.pricingSignature,
  clientTotal: item.pricing.total,
  serverTotal: verification.serverPricing.total,
  pricebookVersionClient: item.pricing.pricebookVersion,
  pricebookVersionServer: PRICEBOOK_VERSION
});
```

### 3. Console Prefixes

All modules use consistent prefixes:
- `[ConfiguratorBridge]` - Iframe integration
- `[Pricing]` - Pricing calculations
- `[Cart]` - Cart operations
- `[API:AddDesign]` - Add to cart API
- `[API:ValidateDesign]` - Pricing validation API
- `[Checkout]` - Checkout session
- `[Order]` - Order creation
- `[Fulfillment]` - Export generation

---

## Security

### 1. Origin Validation

```javascript
// lib/configurator-bridge.js
const ALLOWED_ORIGINS = [
  'https://configurator.unbreak.one',
  'https://staging.unbreak.one',
  'http://localhost:3000'  // Development only
];

function isOriginAllowed(origin) {
  return ALLOWED_ORIGINS.includes(origin);
}
```

**Never** use `origin: '*'` in production!

### 2. Payload Validation

```javascript
import { validatePayloadV1 } from '../configurator/design-payload-v1-types.js';

const validation = validatePayloadV1(payload);
if (!validation.valid) {
  throw new Error('Invalid payload: ' + validation.errors.join(', '));
}
```

### 3. Pricing Signature Enforcement

```javascript
// Server-side only
const verification = verifyPricingSignature(
  payload,
  clientSignature,
  clientPricebookVersion
);

if (!verification.valid) {
  // Reject checkout!
  return { error: 'PRICE_MISMATCH_REPRICE_REQUIRED' };
}
```

### 4. Server is Source of Truth

**CRITICAL:** Client-side pricing is **informational only**.

Server MUST:
1. ✅ Re-validate payload structure
2. ✅ Re-calculate pricing from pricebook
3. ✅ Verify signature matches
4. ✅ Reject if mismatch

Never trust client-provided prices without signature verification.

---

## Testing

### 1. Integration Test Checklist

- [ ] Iframe loads and sends CONFIG_READY
- [ ] DESIGN_CHANGED events received (debounced)
- [ ] DESIGN_SNAPSHOT on user action
- [ ] Origin validation blocks unauthorized messages
- [ ] Invalid payload rejected with clear error
- [ ] Pricing signature verification works
- [ ] Signature mismatch returns error + server pricing
- [ ] Pricebook version mismatch handled
- [ ] Cart item created with correct structure
- [ ] Duplicate design creates new designId
- [ ] Checkout validates signature server-side
- [ ] Order stores full design payload
- [ ] Fulfillment export contains all BOM data
- [ ] Debug panel shows payload/pricing/messages

### 2. Test Scenarios

**A) Happy Path**
1. Load configurator iframe
2. Modify design (variant, addons, colors)
3. Click "Add to Cart"
4. Verify cart item created
5. Proceed to checkout
6. Verify server validates pricing
7. Complete order
8. Export fulfillment data

**B) Price Mismatch**
1. Add design to cart
2. Update pricebook (change PRICEBOOK_VERSION)
3. Attempt checkout
4. Verify signature mismatch detected
5. Verify client receives updated pricing
6. User must re-add with new pricing

**C) Invalid Payload**
1. Send malformed payload (missing SKU)
2. Verify validation error returned
3. Check user-friendly error message

**D) Origin Attack**
1. Send message from unauthorized origin
2. Verify message rejected
3. Check console warning

### 3. Manual Testing

```bash
# 1. Start dev server
npm run dev

# 2. Open configurator page
http://localhost:3000/configurator

# 3. Open debug panel (Ctrl+Shift+K)

# 4. Modify design in iframe

# 5. Check debug panel:
#    - Payload tab: verify JSON structure
#    - Pricing tab: verify breakdown + signature
#    - Messages tab: verify DESIGN_CHANGED events

# 6. Add to cart

# 7. Verify cart item in localStorage:
localStorage.getItem('cart')

# 8. Proceed to checkout

# 9. Check server logs for signature verification
```

---

## Edge Cases

### 1. Missing Previews

```javascript
// If previews missing, request generation
if (!payload.previews?.heroUrl) {
  bridge.requestPreviews();
  
  // Wait for PREVIEWS_GENERATED event
  // Then retry add to cart
}
```

### 2. Unknown Addon

```javascript
// Server pricing will fail
{
  error: 'PRICING_ERROR',
  details: ['Unknown addon pricingKey: ADDON_XYZ'],
  message: 'Addon nicht verfügbar'
}

// Show user-friendly message
alert('Dieser Addon ist leider nicht verfügbar. Bitte wählen Sie eine andere Option.');
```

### 3. Missing SKU

```javascript
// Validation fails
{
  error: 'INVALID_PAYLOAD',
  details: ['Base component missing SKU'],
  message: 'Produkt-Konfiguration ungültig'
}

// This is a configurator bug - log and alert support
console.error('[CONFIGURATOR_BUG] Missing SKU in baseComponents');
```

### 4. Currency Mismatch

```javascript
// Normalize to shop currency
const shopCurrency = 'EUR';

if (payload.pricing?.currency !== shopCurrency) {
  // Option A: Convert (requires exchange rate API)
  // Option B: Reject and force re-pricing
  
  // For MVP: Force re-pricing
  const serverPricing = priceDesign(payload, { currency: shopCurrency });
}
```

---

## Production Checklist

Before deploying:

- [ ] Set `NEXT_PUBLIC_DEBUG_CONFIGURATOR=false`
- [ ] Update `CONFIGURATOR_ALLOWED_ORIGINS` to production domains only
- [ ] Remove `localhost` from allowed origins
- [ ] Set `PRICEBOOK_VERSION` to stable version
- [ ] Replace mock catalog in `design-pricing.js` with database lookup
- [ ] Implement server-side cart storage (remove localStorage)
- [ ] Add rate limiting to `/api/cart/add-design`
- [ ] Add monitoring for signature mismatch errors
- [ ] Test signature verification with production pricebook
- [ ] Document pricebook update procedure
- [ ] Set up alerts for pricing errors
- [ ] Test fulfillment export with production data
- [ ] Train production team on fulfillment format

---

## Support

For issues:

1. Check debug panel (Ctrl+Shift+K)
2. Verify allowed origins match configurator domain
3. Check server logs for signature verification
4. Validate payload structure
5. Verify pricebook version matches

Common issues:
- **No CONFIG_READY:** Check iframe URL and origin allowlist
- **Pricing mismatch:** Pricebook version changed, re-add to cart
- **Invalid payload:** Configurator mapping bug, contact support
- **Missing previews:** Request generation with `requestPreviews()`

---

## Version History

**v1.0.0** (2024-01-03)
- Initial host app integration
- ConfiguratorBridge with postMessage
- Pricing service + pricebook
- Cart integration (configurable items)
- Server-side validation + signature verification
- Fulfillment export structure
- Debug panel component
