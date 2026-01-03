# 3D Configurator Integration Contract

**Version:** integration.v1  
**Last Updated:** 2026-01-03  
**Status:** ✅ Production Ready

## Overview

This document defines the bi-directional postMessage contract between the 3D Configurator (running in an iFrame) and the host shop system.

### Goals

- **Deterministic Pricing:** Export complete BOM for price calculation
- **State Persistence:** Save/restore exact customer designs
- **Visual Consistency:** Provide preview images for cart/order/email
- **Validation:** Communicate configuration issues to customer
- **Real-time Updates:** Notify host of design changes

### Architecture

```
┌─────────────────────────────────────────────┐
│           Host Shop (Parent Window)         │
│  - Product pages                            │
│  - Cart system                              │
│  - Checkout flow                            │
│  - Order management                         │
└─────────────┬───────────────────────────────┘
              │ postMessage
              │ (origin validated)
              ▼
┌─────────────────────────────────────────────┐
│      3D Configurator (iFrame)               │
│  - Visual configurator UI                   │
│  - Real-time 3D rendering                   │
│  - Design state management                  │
│  - Preview generation                       │
│  - BOM calculation                          │
└─────────────────────────────────────────────┘
```

## Security

### Origin Validation

All postMessage communication includes strict origin validation:

**Allowed Origins (Configurator):**
- `https://unbreak-one.vercel.app` (production shop)
- `https://www.unbreakone.de` (production shop)
- `http://localhost:3000` (local development)

**Allowed Origins (Host):**
- `https://unbreak-3-d-konfigurator.vercel.app` (production configurator)
- `http://localhost:5173` (Vite dev server)
- `http://localhost:3000` (alternative dev port)

### Message Validation

All messages must:
- Be valid JSON objects
- Have a `type` field (string)
- Have a `payload` field (object)
- Come from an allowed origin

**Never** execute arbitrary code from messages.

## DesignPayload Schema v1

### Structure

```typescript
interface DesignPayloadV1 {
  version: "design.v1";
  designId: string;              // UUID
  productKey: string;            // Maps to shop SKU
  createdAt: string;             // ISO 8601
  updatedAt: string;             // ISO 8601
  locale: string;                // e.g. "de-DE"
  currency: string;              // e.g. "EUR"
  
  selections: {
    variant?: string;
    size?: string;
    material?: string;
    finish?: string;
    options?: { [key: string]: any };
  };
  
  bom: BOMItem[];
  previews: DesignPreviews;
  sceneState: object;            // Minimal reproducibility state
  validation: DesignValidation;
  userText?: UserText;
}

interface BOMItem {
  componentId: string;
  componentName: string;
  materialId?: string;
  color?: ColorSpec;
  qty: number;
  unit: string;                  // "pcs" | "m" | "cm" | "ml" | "g"
  dimensions?: object;
  notes?: string;
}

interface ColorSpec {
  system: "RAL" | "HEX" | "PANTONE" | "CUSTOM";
  code: string;                  // "RAL 9005" or "#0A0A0A"
  label: string;
}

interface DesignPreviews {
  thumbPngBase64?: string;       // 300x300 base64 or URL
  shopPngBase64?: string;        // 900x1125 base64 or URL
  glbUrl?: string;               // Optional 3D model
  snapshotAngle?: {
    yaw: number;
    pitch: number;
    zoom: number;
  };
}

interface DesignValidation {
  isValid: boolean;
  issues: ValidationIssue[];
}

interface ValidationIssue {
  code: string;
  message: string;
  severity?: "error" | "warning" | "info";
}

interface UserText {
  engraving?: string;
  noteToMaker?: string;
}
```

### Example Payloads

See `example-payloads.js` for 3 complete examples:
1. **Wine Glass Holder** - Standard configuration with engraving
2. **Bottle Holder** - Custom HEX color with gift box
3. **Gastro Edition** - Invalid config with validation errors

## Message Events

### Host → Configurator

#### REQUEST_EXPORT_DESIGN

Request full design payload from configurator.

```javascript
// Host sends:
{
  type: "REQUEST_EXPORT_DESIGN",
  payload: {}
}

// Configurator responds with:
{
  type: "EXPORT_DESIGN_RESULT",
  payload: {
    ok: true,
    payload: DesignPayloadV1,
    size: 45678,                    // bytes
    sizeFormatted: "44.6 KB"
  }
}

// Or on error:
{
  type: "EXPORT_DESIGN_RESULT",
  payload: {
    ok: false,
    error: "No design available",
    validationErrors?: string[]
  }
}
```

#### REQUEST_EXPORT_PREVIEWS

Request only preview images (faster than full export).

```javascript
// Host sends:
{
  type: "REQUEST_EXPORT_PREVIEWS",
  payload: {}
}

// Configurator responds:
{
  type: "EXPORT_PREVIEWS_RESULT",
  payload: {
    ok: true,
    previews: {
      thumbPngBase64: "data:image/png;base64,...",
      shopPngBase64: "data:image/png;base64,...",
      glbUrl: "https://...",
      snapshotAngle: { yaw: 45, pitch: 30, zoom: 1.2 }
    },
    designId: "e4c7a8b2-9d3f-4e5a-8b7c-2d1e9f6a3b4c"
  }
}
```

#### IMPORT_DESIGN

Load an existing design into configurator.

```javascript
// Host sends:
{
  type: "IMPORT_DESIGN",
  payload: {
    designPayload: DesignPayloadV1
  }
}

// Configurator responds:
{
  type: "IMPORT_DESIGN_RESULT",
  payload: {
    ok: true,
    designId: "e4c7a8b2-9d3f-4e5a-8b7c-2d1e9f6a3b4c"
  }
}

// Or on error:
{
  type: "IMPORT_DESIGN_RESULT",
  payload: {
    ok: false,
    error: "Invalid design payload",
    issues: ["version must be design.v1", ...]
  }
}
```

#### SET_LOCALE

Update locale and currency display.

```javascript
// Host sends:
{
  type: "SET_LOCALE",
  payload: {
    locale: "en-US",
    currency: "USD"
  }
}

// Configurator responds:
{
  type: "SET_LOCALE_RESULT",
  payload: {
    ok: true,
    locale: "en-US",
    currency: "USD"
  }
}
```

#### PING

Health check / integration test.

```javascript
// Host sends:
{
  type: "PING",
  payload: {}
}

// Configurator responds immediately:
{
  type: "PONG",
  payload: {
    timestamp: "2026-01-03T10:30:00.000Z",
    version: "integration.v1"
  }
}
```

### Configurator → Host

#### CONFIG_CHANGED

Sent when user makes changes (debounced 300ms).

```javascript
{
  type: "CONFIG_CHANGED",
  payload: {
    designId: "e4c7a8b2-9d3f-4e5a-8b7c-2d1e9f6a3b4c",
    validation: {
      isValid: true,
      issues: []
    },
    selections: {
      variant: "wine_glass_holder",
      size: "standard",
      material: "steel",
      finish: "matte"
    },
    updatedAt: "2026-01-03T10:35:00.000Z",
    priceHint: null                 // Optional pre-calculated price
  }
}
```

**Usage:** Host can update UI (e.g. "Configuration changed") or fetch full design if needed.

#### UNBREAK_CONFIG_READY

Sent when configurator has loaded and is ready for interaction.

```javascript
{
  type: "UNBREAK_CONFIG_READY",
  payload: {
    ok: true,
    version: "integration.v1",
    timestamp: "2026-01-03T10:30:00.000Z"
  }
}
```

**Usage:** Host should hide loading overlay and make iFrame visible/interactive.

#### UNBREAK_CONFIG_LOADING

Sent during loading to report progress.

```javascript
{
  type: "UNBREAK_CONFIG_LOADING",
  payload: {
    progress: 75,                   // 0-100
    message: "Loading 3D models...",
    timestamp: "2026-01-03T10:30:00.000Z"
  }
}
```

**Usage:** Host can show progress bar or loading message.

#### UNBREAK_CONFIG_ERROR

Sent when a critical error occurs.

```javascript
{
  type: "UNBREAK_CONFIG_ERROR",
  payload: {
    message: "Failed to load 3D engine",
    stack: "Error: ...\n  at ...",
    timestamp: "2026-01-03T10:30:00.000Z"
  }
}
```

**Usage:** Host should show error UI with reload button.

## Integration Example

### Configurator Side (iFrame)

```javascript
import { IntegrationManager } from './integration-manager.js';
import { DebugOverlay } from './debug-overlay.js';
import { createEmptyDesignPayload } from './design-payload-schema.js';

// Initialize integration
const integration = new IntegrationManager({
  allowedOrigins: [
    'https://unbreak-one.vercel.app',
    'https://www.unbreakone.de'
  ],
  debug: true,
  
  // Callback when design changes
  onDesignChanged: (design) => {
    console.log('Design updated:', design);
    // Update 3D scene, recalculate BOM, etc.
  },
  
  // Callback to load imported design
  onImportDesign: async (designPayload) => {
    try {
      // Apply design to 3D scene
      await apply3DScene(designPayload.sceneState);
      
      return { ok: true };
    } catch (error) {
      return { ok: false, error: error.message };
    }
  },
  
  // Callback for locale changes
  onSetLocale: ({ locale, currency }) => {
    // Update UI language and price display
    updateLocale(locale, currency);
  }
});

// Show debug overlay (remove in production)
const debugOverlay = new DebugOverlay(integration);

// Notify ready after scene loads
window.addEventListener('load', () => {
  setTimeout(() => {
    integration.notifyReady();
  }, 500);
});

// Update design when user changes something
function handleUserChange(newSelections) {
  const design = createEmptyDesignPayload('UNBREAK-WEIN-01', {
    selections: newSelections,
    bom: calculateBOM(newSelections),
    previews: generatePreviews(),
    sceneState: capture3DState(),
    validation: validateDesign(newSelections)
  });
  
  integration.updateDesign(design);
}
```

### Host Side (Shop)

```javascript
// Listen for configurator messages
window.addEventListener('message', (event) => {
  if (event.origin !== 'https://unbreak-3-d-konfigurator.vercel.app') {
    return;
  }
  
  const { type, payload } = event.data;
  
  switch (type) {
    case 'UNBREAK_CONFIG_READY':
      // Hide loading, show configurator
      document.getElementById('loading-overlay').style.display = 'none';
      document.getElementById('configurator-iframe').style.opacity = '1';
      break;
      
    case 'CONFIG_CHANGED':
      // Show "unsaved changes" indicator
      document.getElementById('save-indicator').textContent = 'Änderungen nicht gespeichert';
      
      // Enable "Add to Cart" if valid
      const addToCartBtn = document.getElementById('add-to-cart');
      addToCartBtn.disabled = !payload.validation.isValid;
      break;
      
    case 'EXPORT_DESIGN_RESULT':
      if (payload.ok) {
        // Save to cart/order
        saveDesignToCart(payload.payload);
      }
      break;
  }
});

// Request design when user clicks "Add to Cart"
function handleAddToCart() {
  const iframe = document.getElementById('configurator-iframe');
  iframe.contentWindow.postMessage({
    type: 'REQUEST_EXPORT_DESIGN',
    payload: {}
  }, 'https://unbreak-3-d-konfigurator.vercel.app');
}

// Load existing design (e.g. when editing cart item)
function loadExistingDesign(designPayload) {
  const iframe = document.getElementById('configurator-iframe');
  iframe.contentWindow.postMessage({
    type: 'IMPORT_DESIGN',
    payload: { designPayload }
  }, 'https://unbreak-3-d-konfigurator.vercel.app');
}
```

## Developer Tooling

### Debug Overlay

Activate with URL parameter: `?debug=1`

Features:
- **Event Log:** Last 50 postMessage events
- **Design Inspector:** View current DesignPayload JSON
- **Payload Size:** Real-time size calculation
- **Copy JSON:** Copy design to clipboard
- **Manual Triggers:** Test READY, CONFIG_CHANGED, ERROR, PING
- **Import Test:** Paste and test DesignPayload import
- **Origin Validation:** Show allowed origins

### Console Logs

When `debug: true`:
```javascript
[IntegrationManager] IntegrationManager initialized
[IntegrationManager] Received message { type: "REQUEST_EXPORT_DESIGN", origin: "https://..." }
[IntegrationManager] Sending message { type: "EXPORT_DESIGN_RESULT", targetOrigin: "https://..." }
```

## Testing

### Integration Test Checklist

- [ ] PING/PONG responds within 100ms
- [ ] READY message sent after full load
- [ ] CONFIG_CHANGED debounced to 300ms
- [ ] EXPORT_DESIGN returns valid DesignPayload
- [ ] EXPORT_PREVIEWS includes base64 images
- [ ] IMPORT_DESIGN restores exact scene state
- [ ] SET_LOCALE updates UI language
- [ ] Origin validation rejects unauthorized messages
- [ ] Payload validation catches schema errors
- [ ] Error recovery (reload button works)

### Manual Test Procedure

1. **Load Configurator**
   - Open shop page with `?debug=1`
   - Verify READY message in debug log
   - Check loading overlay hides

2. **Make Changes**
   - Change color/size/options
   - Verify CONFIG_CHANGED appears (debounced)
   - Check validation.isValid status

3. **Export Design**
   - Click "Copy DesignPayload JSON" in debug overlay
   - Verify JSON is valid
   - Check payload size is reasonable (<1MB)

4. **Import Design**
   - Paste JSON into debug overlay import test
   - Click "Test Import"
   - Verify scene restores exactly

5. **Error Handling**
   - Trigger error in debug overlay
   - Verify error UI shows
   - Test reload button

## Production Checklist

Before deploying to production:

- [ ] Remove `?debug=1` from URLs
- [ ] Disable DebugOverlay in production builds
- [ ] Update allowed origins to production domains only
- [ ] Test with real customer scenarios
- [ ] Verify SSL/HTTPS on both domains
- [ ] Test cross-browser (Chrome, Firefox, Safari, Edge)
- [ ] Test mobile responsiveness
- [ ] Verify preview image quality
- [ ] Test payload size limits (warn if >500KB)
- [ ] Add analytics tracking for integration events

## Troubleshooting

### "Message from unknown origin ignored"

**Cause:** Origin not in allowlist  
**Fix:** Add origin to `allowedOrigins` array in IntegrationManager config

### "INVALID CROP REJECTED"

**Cause:** DesignPayload doesn't match schema  
**Fix:** Run payload through `validateDesignPayload()` and fix validation errors

### "No design available" on export

**Cause:** updateDesign() never called  
**Fix:** Call `integration.updateDesign(payload)` after user makes changes

### iFrame stays frozen

**Cause:** READY message never sent  
**Fix:** Call `integration.notifyReady()` after scene loads

### Preview images too large

**Cause:** High-resolution base64 PNGs  
**Fix:** Resize to 300x300 (thumb) and 900x1125 (shop) before encoding

## License

Internal use only - UNBREAK ONE GmbH

## Changelog

**v1.0.0 (2026-01-03)**
- Initial release
- DesignPayload v1 schema
- Bi-directional postMessage contract
- Debug overlay
- Example payloads
