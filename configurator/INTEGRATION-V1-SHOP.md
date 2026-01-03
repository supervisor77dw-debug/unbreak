# DesignPayload v1 Integration - Shop-Focused

Shop-optimized integration contract between 3D Configurator (iFrame) and Host Shop, focused on SKU-based pricing and order conversion.

## Overview

This integration enables the configurator to send **pricing-ready design data** to the host shop for seamless checkout and order processing.

### Key Differences from Generic Contract

| Feature | Generic Contract | DesignPayload v1 (Shop) |
|---------|-----------------|-------------------------|
| **Focus** | Design state export | Pricing + order conversion |
| **Base Components** | Generic componentId | **Shop SKU required** |
| **Pricing** | Generic BOM | SKU + pricingKey based |
| **Validation** | Loose | **Strict** (SKUs required) |
| **Addons** | Optional | Premium addons with pricingKey |
| **Fees** | N/A | Customization feeKey |

## Architecture

```
┌─────────────────────────────────────┐
│  Host Shop (pages/configurator.js)  │
│  - Receives DesignPayloadV1         │
│  - Validates SKUs                   │
│  - Calculates pricing               │
│  - Adds to cart                     │
└─────────────┬───────────────────────┘
              │ postMessage
              │ namespace: "UNBREAK-ONE_CONFIG"
              │ origin validation
              ▼
┌─────────────────────────────────────┐
│  Configurator (iFrame)              │
│  - Manages design state             │
│  - Sends DesignPayloadV1            │
│  - Generates previews               │
│  - Handles host requests            │
└─────────────────────────────────────┘
```

## Message Flow

### 1. Initialization

**Configurator → Host: CONFIG_READY**
```javascript
{
  namespace: "UNBREAK-ONE_CONFIG",
  type: "CONFIG_READY",
  payload: {
    configuratorVersion: "1.0.0",
    productFamily: "GLASSHOLDER",
    capabilities: ["sku-based-pricing", "preview-generation", ...],
    ready: true
  },
  timestamp: "2024-01-15T10:30:00.000Z"
}
```

### 2. Design Changes (Debounced 200ms)

**Configurator → Host: DESIGN_CHANGED**
```javascript
{
  namespace: "UNBREAK-ONE_CONFIG",
  type: "DESIGN_CHANGED",
  payload: {
    version: "1.0",
    designId: "uuid-v4",
    productFamily: "GLASSHOLDER",
    baseComponents: [
      {
        sku: "UNBREAK-GLAS-01",  // REQUIRED
        qty: 1,
        variantId: "single",
        productKey: "glass_holder_single"
      }
    ],
    customization: {
      enabled: true,
      feeKey: "CUSTOMIZE_FEE_V1"  // Maps to pricing
    },
    premiumAddons: [
      {
        pricingKey: "ADDON_ENGRAVING_STANDARD",  // REQUIRED
        qty: 1,
        addonId: "ENGRAVING_STANDARD",
        label: "Standardgravur"
      }
    ],
    // ... rest of payload
  },
  timestamp: "2024-01-15T10:30:05.123Z"
}
```

### 3. Host Requests

**Host → Configurator: GET_CURRENT_PAYLOAD**
```javascript
{
  namespace: "UNBREAK-ONE_CONFIG",
  type: "GET_CURRENT_PAYLOAD",
  payload: null,
  timestamp: "2024-01-15T10:31:00.000Z"
}
```

**Configurator → Host: CURRENT_PAYLOAD** (response)
```javascript
{
  namespace: "UNBREAK-ONE_CONFIG",
  type: "CURRENT_PAYLOAD",
  payload: { /* DesignPayloadV1 */ },
  timestamp: "2024-01-15T10:31:00.050Z"
}
```

## Integration Steps

### Configurator Side (iFrame)

1. **Initialize** (`configurator-integration.js`):
```javascript
import { initConfiguratorIntegration } from './configurator-integration.js';

// Auto-initializes on DOM ready
// Or call manually:
initConfiguratorIntegration();
```

2. **Notify on changes**:
```javascript
import { notifyDesignChanged } from './configurator-integration.js';

// Called automatically when design state changes
// Debounced to 200ms
notifyDesignChanged();
```

3. **Handle user actions**:
```javascript
import { saveDesignSnapshot } from './configurator-integration.js';

// On "Save Design" button click
saveDesignSnapshot(); // Not debounced
```

### Host Shop Side

1. **Add listener** (in `pages/configurator.js` or layout):
```javascript
window.addEventListener('message', (event) => {
  const { data, origin } = event;
  
  // Validate origin
  if (!['https://unbreak.one', 'http://localhost:3000'].includes(origin)) {
    return;
  }
  
  // Validate namespace
  if (data.namespace !== 'UNBREAK-ONE_CONFIG') {
    return;
  }
  
  // Handle message
  switch (data.type) {
    case 'CONFIG_READY':
      console.log('Configurator ready:', data.payload);
      break;
      
    case 'DESIGN_CHANGED':
      handleDesignChanged(data.payload);
      break;
      
    case 'CURRENT_PAYLOAD':
      handleCurrentPayload(data.payload);
      break;
  }
});
```

2. **Process design payload**:
```javascript
function handleDesignChanged(designPayload) {
  // 1. Extract SKUs
  const skus = designPayload.baseComponents.map(c => c.sku);
  
  // 2. Calculate pricing
  let totalPrice = 0;
  
  // Base components
  for (const component of designPayload.baseComponents) {
    const price = lookupPrice(component.sku);
    totalPrice += price * component.qty;
  }
  
  // Customization fee
  if (designPayload.customization?.enabled) {
    const feePrice = lookupPrice(designPayload.customization.feeKey);
    totalPrice += feePrice;
  }
  
  // Premium addons
  for (const addon of designPayload.premiumAddons || []) {
    const addonPrice = lookupPrice(addon.pricingKey);
    totalPrice += addonPrice * addon.qty;
  }
  
  // 3. Update UI
  updatePriceDisplay(totalPrice);
  
  // 4. Store design state
  sessionStorage.setItem('currentDesign', JSON.stringify(designPayload));
}
```

3. **Request current state**:
```javascript
function requestCurrentDesign() {
  const iframe = document.getElementById('configurator-iframe');
  
  iframe.contentWindow.postMessage({
    namespace: 'UNBREAK-ONE_CONFIG',
    type: 'GET_CURRENT_PAYLOAD',
    payload: null,
    timestamp: new Date().toISOString()
  }, 'https://unbreak.one');
}
```

## Files

| File | Purpose |
|------|---------|
| `design-payload-v1-types.js` | TypeScript-style JSDoc types + validation |
| `sku-mapping-config.js` | Product SKU mappings |
| `postmessage-bridge.js` | Message envelope + event handlers |
| `design-manager.js` | Design state management + `getDesignPayloadV1()` |
| `debug-panel-compact.js` | Developer debug UI (Ctrl+Shift+D) |
| `configurator-integration.js` | Complete integration example |

## Data Schema

### DesignPayloadV1

```javascript
{
  version: "1.0",
  designId: "uuid-v4",
  createdAt: "ISO 8601",
  updatedAt: "ISO 8601",
  productFamily: "GLASSHOLDER" | "BOTTLEHOLDER" | "WINEHOLDER" | "GASTRO",
  configuratorVersion: "1.0.0",
  
  // REQUIRED: Base product SKUs for pricing
  baseComponents: [
    {
      sku: string,           // REQUIRED - Shop SKU
      qty: number,
      variantId: string?,    // Optional variant identifier
      productKey: string?    // Optional product key
    }
  ],
  
  // Customization fee (if design is individualized)
  customization: {
    enabled: boolean,
    feeKey: string?        // e.g., "CUSTOMIZE_FEE_V1"
  },
  
  // Premium addons (engraving, materials, packaging)
  premiumAddons: [
    {
      pricingKey: string,  // REQUIRED - Pricing lookup key
      qty: number,
      addonId: string?,
      label: string?
    }
  ],
  
  // Bill of materials (technical data)
  bom: {
    parts: [...],
    materials: {...},
    assembly: {...}
  },
  
  // Scene state (3D configurator state)
  sceneState: {
    camera: {...},
    colors: {...},
    materials: {...},
    dimensions: {...}
  },
  
  // Preview images
  previews: {
    heroUrl: string?,
    thumbUrl: string?,
    heroPngBase64: string?,
    thumbPngBase64: string?
  },
  
  // Validation result
  validation: {
    valid: boolean,
    errors: string[]
  }
}
```

## Validation Rules

**Strict validation** is applied before sending to host:

1. ✅ **baseComponents** MUST be non-empty
2. ✅ Every `baseComponents[i].sku` MUST be present and non-empty
3. ✅ If `premiumAddons` exists, every item MUST have `pricingKey` and `qty`
4. ✅ `customization.enabled` MUST be boolean
5. ✅ All timestamps MUST be valid ISO 8601

## SKU Mapping

Product SKUs are defined in `sku-mapping-config.js`:

```javascript
import { getBaseComponent, getPremiumAddon } from './sku-mapping-config.js';

// Get base component
const component = getBaseComponent('GLASSHOLDER', 'single');
// => { sku: 'UNBREAK-GLAS-01', productKey: 'glass_holder_single', ... }

// Get premium addon
const addon = getPremiumAddon('ENGRAVING_STANDARD');
// => { pricingKey: 'ADDON_ENGRAVING_STANDARD', label: 'Standardgravur', ... }
```

## Debug Tools

### Compact Debug Panel

Press **Ctrl+Shift+D** to toggle debug panel (development mode only).

Features:
- Current payload JSON viewer
- Refresh/copy buttons
- Message event log (last 10)
- Timestamp tracking

### Console Logging

All modules log to console with prefixes:
- `[PostMessageBridge]` - Message events
- `[DesignManager]` - State changes
- `[DebugPanel]` - UI events
- `[ConfigIntegration]` - Integration lifecycle

## Example Usage

### Simple Integration

```javascript
// In your configurator main file
import { 
  initDesignManager, 
  updateVariant, 
  addPremiumAddon,
  setCustomization 
} from './design-manager.js';

import { notifyDesignChanged } from './configurator-integration.js';

// Initialize
initDesignManager('GLASSHOLDER', 'single');

// User changes variant
function onVariantChange(variantKey) {
  updateVariant(variantKey);
  notifyDesignChanged(); // Debounced
}

// User adds engraving
function onAddEngraving() {
  addPremiumAddon('ENGRAVING_STANDARD', 1);
  setCustomization(true, 'standard'); // Enable customization fee
  notifyDesignChanged();
}
```

### Advanced: Custom Preview Generation

```javascript
import { updatePreviews, generatePreviews } from './design-manager.js';
import { postPreviewsGenerated } from './postmessage-bridge.js';

async function generateAndSendPreviews() {
  // Render 3D scene to canvas
  const heroCanvas = render3DScene('hero');
  const thumbCanvas = render3DScene('thumb');
  
  // Convert to base64
  const heroPngBase64 = heroCanvas.toDataURL('image/png');
  const thumbPngBase64 = thumbCanvas.toDataURL('image/png');
  
  // Upload to storage (optional)
  const heroUrl = await uploadImage(heroPngBase64, 'hero');
  const thumbUrl = await uploadImage(thumbPngBase64, 'thumb');
  
  // Update state
  const previews = { heroUrl, thumbUrl, heroPngBase64, thumbPngBase64 };
  updatePreviews(previews);
  
  // Notify host
  postPreviewsGenerated(previews);
}
```

## Testing

### Test Message Flow

1. Open configurator in iFrame
2. Press **Ctrl+Shift+D** to open debug panel
3. Change design (variant, addons, etc.)
4. Observe message log in debug panel
5. Verify payload JSON is valid

### Test Validation

```javascript
import { validatePayloadV1 } from './design-payload-v1-types.js';

const testPayload = { /* ... */ };
const result = validatePayloadV1(testPayload);

if (!result.valid) {
  console.error('Validation errors:', result.errors);
}
```

## Security

### Origin Validation

Only accept messages from allowed origins:

```javascript
// Configurator side (sku-mapping-config.js)
const allowedOrigins = [
  'https://unbreak.one',
  'https://www.unbreak.one',
  'http://localhost:3000'  // Development only
];

initBridge(allowedOrigins);
```

### Message Namespace

All messages use namespace `"UNBREAK-ONE_CONFIG"` to avoid conflicts.

## Migration from Generic Contract

If you already use `design-payload-schema.js` (generic contract):

1. ✅ Keep generic contract for non-shop integrations
2. ✅ Use DesignPayload v1 for shop/pricing integrations
3. ✅ Both can coexist in same configurator
4. ✅ Use different message types to distinguish

## Support

For issues or questions:
- Check console logs (all modules log with prefixes)
- Use debug panel (Ctrl+Shift+D)
- Verify SKU mappings in `sku-mapping-config.js`
- Validate payload with `validatePayloadV1()`

## Version History

- **v1.0.0** (2024-01-15): Initial shop-focused integration
  - SKU-based pricing
  - Strict validation
  - Customization fees
  - Premium addons with pricingKey
  - Compact debug panel
