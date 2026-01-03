# Business Logic - Pricing & Product Model

**Version:** 1.0  
**Date:** 2026-01-03  
**Status:** Final

Complete business rules for configurator pricing, SKUs, and order representation.

---

## Table of Contents

1. [Product Model (Authoritative)](#product-model-authoritative)
2. [Pricing Formula](#pricing-formula)
3. [Cart & Checkout Representation](#cart--checkout-representation)
4. [Order & Accounting Model](#order--accounting-model)
5. [Fulfillment / Production Export](#fulfillment--production-export)
6. [Validation Rules (Hard Fail)](#validation-rules-hard-fail)
7. [Example Order Snapshot](#example-order-snapshot)

---

## Product Model (Authoritative)

Every configurator design resolves to exactly **3 components**:

### A) Base Product (Mandatory)

**Business Rule:**
- Every design MUST resolve to exactly **ONE** base product SKU
- The base SKU MUST be identical to an existing shop product
- Base price is ALWAYS taken from the **shop catalog** (single source of truth)

**Examples:**
```
GLASSHOLDER → SKU: UNBREAK-GLAS-01 (€49.90)
              or   UNBREAK-GLAS-SET-2 (€89.90)
              or   UNBREAK-GLAS-SET-4 (€169.90)

BOTTLEHOLDER → SKU: UNBREAK-FLASCHE-01 (€54.90)
               or   UNBREAK-FLASCHE-SET-2 (€99.90)

WINEHOLDER → SKU: UNBREAK-WEIN-01 (€44.90)

GASTRO → SKU: UNBREAK-GASTRO-SET-6 (€249.90)
         or   UNBREAK-GASTRO-SET-12 (€469.90)
```

**Implementation:**
```javascript
// payload.baseComponents MUST have exactly 1 entry
{
  baseComponents: [
    {
      sku: "UNBREAK-GLAS-SET-2",
      qty: 1,
      variantId: "set-2",
      productKey: "glass_holder_set_2"
    }
  ]
}
```

---

### B) Customization Fee (Mandatory for Non-Default Designs)

**Business Rule:**
- ONE global customization surcharge: `CUSTOM_DESIGN_FEE`
- Applied **iff** `payload.customization.enabled === true`
- Quantity **always = 1**
- Covers: design effort, handling, production setup

**Pricing:**
```
feeKey: CUSTOM_DESIGN_FEE
amount: €15.00
label: "Individualisierung"
```

**Implementation:**
```javascript
{
  customization: {
    enabled: true,
    feeKey: "CUSTOM_DESIGN_FEE"
  }
}
```

**Revenue Accounting:**
- Assigned to: **"Customization Services"** category
- NOT assigned to base product SKU

---

### C) Premium Components (Optional, Additive)

**Business Rule:**
- Premium components are **NEVER base products**
- They are **DELTA prices ONLY** (additive on top of base + customization)
- Each premium component:
  - Has a `pricingKey`
  - Has a unit price
  - Adds price + production metadata

**Examples:**

| pricingKey | Label | Price | Category |
|---|---|---|---|
| ADDON_ENGRAVING_STANDARD | Gravur | €12.00 | Engraving |
| ADDON_ENGRAVING_LOGO | Logo-Gravur | €25.00 | Engraving |
| ADDON_WOOD_INLAY | Holzsockel | €18.00 | Materials |
| ADDON_METAL_RING | Metallring | €22.00 | Materials |
| ADDON_CUSTOM_COLOR_RAL | Wunschfarbe (RAL) | €20.00 | Colors |
| ADDON_CUSTOM_COLOR_HEX | Individuelle Farbe | €30.00 | Colors |
| ADDON_GIFT_BOX | Geschenkbox | €8.00 | Packaging |
| ADDON_PREMIUM_PACKAGING | Premium-Verpackung | €15.00 | Packaging |

**Implementation:**
```javascript
{
  premiumAddons: [
    {
      pricingKey: "ADDON_WOOD_INLAY",
      addonId: "WOOD_INLAY",
      label: "Holzsockel",
      qty: 1
    },
    {
      pricingKey: "ADDON_CUSTOM_COLOR_HEX",
      addonId: "CUSTOM_COLOR_HEX",
      label: "Individuelle Farbe",
      qty: 1,
      color: {
        system: "HEX",
        code: "#2C5F2D",
        label: "Moosgrün"
      }
    }
  ]
}
```

**Revenue Accounting:**
- Each addon assigned to its respective **addon category**
- Examples:
  - `ADDON_WOOD_INLAY` → "Premium Components - Materials"
  - `ADDON_CUSTOM_COLOR_HEX` → "Premium Components - Colors"

---

## Pricing Formula

```
TOTAL = BASE_PRICE + CUSTOMIZATION_FEE + SUM(PREMIUM_ADDONS)

where:
  BASE_PRICE = shop catalog price for SKU * qty
  CUSTOMIZATION_FEE = €15.00 (if customization.enabled = true, else €0)
  PREMIUM_ADDONS = SUM(addon.unitPrice * addon.qty)
```

**Example Calculation:**

```
Base: Glashalter 2er Set (UNBREAK-GLAS-SET-2)    €89.90
Customization: Individualisierung                €15.00
Addon 1: Holzsockel (qty=1)                      €18.00
Addon 2: Individuelle Farbe (qty=1)              €30.00
─────────────────────────────────────────────────────────
TOTAL                                            €152.90
```

**Pricing Signature:**
- SHA-256 hash of normalized payload + totals + pricebook version
- Ensures integrity and prevents tampering
- Server validates signature on checkout

---

## Cart & Checkout Representation

### Customer-Facing Display

**What Customer Sees:**

```
┌──────────────────────────────────────────────────────────┐
│ [Produktbild]                                            │
│                                                          │
│ Glashalter – individuelles Design                        │
│ 152,90 €                                                 │
│                                                          │
│ ▼ Preisaufschlüsselung                                   │
│   Glashalter 2er Set ........................ 89,90 €    │
│   Individualisierung ........................ 15,00 €    │
│   Holzsockel ................................ 18,00 €    │
│   Individuelle Farbe ........................ 30,00 €    │
│                                           ───────────    │
│                                   Gesamt: 152,90 €       │
└──────────────────────────────────────────────────────────┘
```

**IMPORTANT:**
- Customer NEVER sees internal SKUs or pricingKeys
- Only customer-facing labels are shown
- Price breakdown is expandable/collapsible

### Cart Item Structure (Technical)

```javascript
{
  type: 'CONFIGURATOR_DESIGN',
  cartItemId: 'cart_1704289800000_abc123',
  designId: 'design_1704289800000_xyz789',
  title: 'Glashalter – individuelles Design',
  quantity: 1,  // Always 1
  
  pricing: {
    currency: 'EUR',
    unitPrice: 152.90,
    total: 152.90,
    breakdownLines: [
      { type: 'base', sku: '...', title: 'Glashalter 2er Set', ... },
      { type: 'customization', feeKey: '...', title: 'Individualisierung', ... },
      { type: 'addon', pricingKey: '...', label: 'Holzsockel', ... },
      { type: 'addon', pricingKey: '...', label: 'Individuelle Farbe', ... }
    ],
    pricebookVersion: 'v1.2024-01-03',
    pricingSignature: 'a1b2c3d4...',
    calculatedAt: '2026-01-03T14:29:45.000Z'
  },
  
  previews: {
    heroUrl: 'https://...',
    thumbUrl: 'https://...'
  },
  
  payload: { /* full DesignPayloadV1 */ }
}
```

---

## Order & Accounting Model

### Order Storage (Server-Side)

**Database Structure:**

```
Order
├── orderId
├── orderNumber
├── customerId
├── total
├── lineItems[]
│   ├── lineItemId
│   ├── type: "CONFIGURATOR_DESIGN"
│   ├── designId
│   ├── pricing
│   │   ├── breakdownLines[]
│   │   ├── pricebookVersion
│   │   └── pricingSignature
│   └── payload (DesignPayloadV1)
└── ...
```

**Persisted Data:**
- Base SKU
- Customization fee key
- Premium addon pricing keys
- **Full DesignPayloadV1** (immutable snapshot)
- Pricing breakdown
- Pricebook version
- **Pricing signature** (audit trail)

### Revenue Accounting Split

**Revenue Categories:**

1. **Base Products**
   - Amount: Base SKU price * qty
   - Assigned to: Base product SKU
   - Example: `UNBREAK-GLAS-SET-2` → €89.90

2. **Customization Services**
   - Amount: Customization fee
   - Assigned to: "Customization Services" category
   - Example: `CUSTOM_DESIGN_FEE` → €15.00

3. **Premium Components**
   - Amount: Sum of all addon prices
   - Assigned to: Respective addon categories
   - Subcategories:
     - Materials (wood inlay, metal ring)
     - Colors (RAL, HEX)
     - Engraving (standard, logo)
     - Packaging (gift box, premium)

**Example Accounting Breakdown:**

```json
{
  "totalRevenue": 152.90,
  "revenueByCategory": {
    "baseProducts": {
      "amount": 89.90,
      "items": [
        { "sku": "UNBREAK-GLAS-SET-2", "amount": 89.90 }
      ]
    },
    "customizationServices": {
      "amount": 15.00,
      "items": [
        { "feeKey": "CUSTOM_DESIGN_FEE", "amount": 15.00 }
      ]
    },
    "premiumComponents": {
      "amount": 48.00,
      "itemsBySubcategory": {
        "materials": [
          { "pricingKey": "ADDON_WOOD_INLAY", "amount": 18.00 }
        ],
        "colors": [
          { "pricingKey": "ADDON_CUSTOM_COLOR_HEX", "amount": 30.00 }
        ]
      }
    }
  }
}
```

---

## Fulfillment / Production Export

Production export clearly separates **what to build**:

### A) What to Pick (Base Product)

```json
{
  "baseSKU": "UNBREAK-GLAS-SET-2",
  "qty": 1,
  "location": "WAREHOUSE_A_SHELF_15"
}
```

### B) What to Customize

```json
{
  "customizationEnabled": true,
  "sceneState": {
    "colors": { 
      "primary": "#2C5F2D", 
      "coating": "POWDER_COATING" 
    },
    "materials": { 
      "base": "STAINLESS_STEEL", 
      "inlay": "WALNUT_WOOD" 
    }
  },
  "previewImages": {
    "hero": "https://...",
    "thumb": "https://..."
  }
}
```

### C) What to Add (Premium Components)

```json
{
  "premiumComponents": [
    {
      "component": "WOOD_BASE",
      "material": "WALNUT_WOOD",
      "qty": 2,
      "instructions": "Walnuss-Einlage montieren"
    }
  ],
  "coatings": [
    {
      "type": "POWDER_COATING",
      "color": "#2C5F2D",
      "colorLabel": "Moosgrün",
      "instructions": "Pulverbeschichtung in individueller Farbe"
    }
  ]
}
```

### Production Notes (Auto-Generated)

```
⚠️ INDIVIDUALISIERT - Sonderanfertigung
Farbe: #2C5F2D (Moosgrün)
Material: STAINLESS_STEEL
⚠️ Individuelle Montage erforderlich
```

**IMPORTANT:** No pricing logic is required in fulfillment export!

---

## Validation Rules (Hard Fail)

The following conditions **MUST** be met, or the design is rejected:

### 1. Base SKU Resolution

**Rule:** Every design MUST resolve to exactly ONE base product SKU

**Validation:**
```javascript
if (!payload.baseComponents || payload.baseComponents.length !== 1) {
  throw new Error('HARD_FAIL: Exactly 1 base component required');
}

const product = getProductBySKU(payload.baseComponents[0].sku);
if (!product) {
  throw new Error('HARD_FAIL: Base SKU cannot be resolved');
}
```

**Error Message:**
```
"Base SKU cannot be resolved. Product does not exist in catalog."
```

---

### 2. Customization Fee Configuration

**Rule:** If `customization.enabled = true`, a valid fee MUST be configured

**Validation:**
```javascript
if (payload.customization?.enabled) {
  if (!payload.customization.feeKey) {
    throw new Error('HARD_FAIL: Customization enabled but no feeKey');
  }
  
  const fee = getCustomizationFee(payload.customization.feeKey);
  if (!fee) {
    throw new Error('HARD_FAIL: Unknown customization fee');
  }
}
```

**Error Message:**
```
"Customization fee configuration is invalid or missing."
```

---

### 3. Premium Addon Validation

**Rule:** All premium addon `pricingKey` values MUST be known

**Validation:**
```javascript
for (const addon of payload.premiumAddons || []) {
  const addonInfo = getAddonDelta(addon.pricingKey);
  if (!addonInfo) {
    throw new Error(`HARD_FAIL: Unknown addon: ${addon.pricingKey}`);
  }
}
```

**Error Message:**
```
"Premium addon 'ADDON_XYZ' is not available or has been discontinued."
```

---

### 4. Pricing Signature Match

**Rule:** Client pricing signature MUST match server calculation

**Validation:**
```javascript
const verification = verifyPricingSignature(
  payload,
  clientSignature,
  clientPricebookVersion
);

if (!verification.valid) {
  throw new Error('HARD_FAIL: Pricing signature mismatch');
}
```

**Error Codes:**
- `PRICEBOOK_VERSION_MISMATCH` → Pricebook updated, client must reprice
- `SIGNATURE_MISMATCH` → Pricing tampered or calculation error
- `PRICING_CALCULATION_ERROR` → Invalid SKU/addon in payload

**Error Message:**
```
"Price must be recalculated. Please refresh and try again."
```

---

## Example Order Snapshot

See complete example in [EXAMPLE-ORDER-SNAPSHOT.json](./EXAMPLE-ORDER-SNAPSHOT.json)

**Summary:**

```
Order: ORD-2026-001234
Customer: kunde@example.com
Total: €152.90

Line Item: Glashalter – individuelles Design
├─ Base: Glashalter 2er Set (€89.90)
├─ Customization: Individualisierung (€15.00)
├─ Addon 1: Holzsockel (€18.00)
└─ Addon 2: Individuelle Farbe (€30.00)

Revenue Split:
├─ Base Products: €89.90
├─ Customization Services: €15.00
└─ Premium Components: €48.00
    ├─ Materials: €18.00
    └─ Colors: €30.00

Fulfillment:
├─ Pick: UNBREAK-GLAS-SET-2 (qty=1)
├─ Customize: Color #2C5F2D, Material WALNUT_WOOD
└─ Add: Wood base (2x), Powder coating
```

---

## Implementation Checklist

- [x] Define product model (base, customization, premium)
- [x] Simplify to 1 customization fee (`CUSTOM_DESIGN_FEE`)
- [x] Clarify premium components as delta prices
- [x] Update pricing service with hard-fail validation
- [x] Update cart UI labels (customer-facing)
- [x] Create example order snapshot (JSON)
- [x] Document revenue accounting split
- [x] Document fulfillment export structure
- [x] Add validation rules (4 hard-fail conditions)

---

## Version History

**v1.0** (2026-01-03)
- Initial business logic definition
- Single customization fee model
- Premium components as delta prices
- Hard-fail validation rules
- Complete example order snapshot

---

## Support

For questions about business logic:
- **Pricing:** See [pricebook.js](../lib/pricing/pricebook.js)
- **Validation:** See [design-pricing.js](../lib/pricing/design-pricing.js)
- **Cart:** See [configurable-cart-item.js](../lib/cart/configurable-cart-item.js)
- **Fulfillment:** See [design-export.js](../lib/fulfillment/design-export.js)
