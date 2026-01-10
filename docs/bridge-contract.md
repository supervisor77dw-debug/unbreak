# UNBREAK ONE - Bridge Communication Contract

**Version:** 1.0  
**Last Updated:** 2026-01-09  
**Status:** 🟢 Active

---

## 📋 Overview

This document defines the **verbindliches Contract** for all communication between:
- **Parent App** (`unbreak-one.vercel.app`) 
- **3D Configurator iframe** (`unbreak-3-d-konfigurator.vercel.app`)

### Goals
1. **Type Safety**: Versioned schema with validation
2. **Debuggability**: Full telemetry and logging
3. **Security**: Origin whitelisting
4. **Reliability**: Handshake & ACK protocol

---

## 🔐 Security: Allowed Origins

### Production
```javascript
[
  'https://unbreak-3-d-konfigurator.vercel.app',  // iframe
  'https://unbreak-one.vercel.app',                // parent
]
```

### Development
```javascript
[
  'http://localhost:3000',
  'http://localhost:5173',
  'http://127.0.0.1:3000',
]
```

### Vercel Preview Deployments
```regex
/^https:\/\/unbreak-[a-z0-9-]+\.vercel\.app$/
```

**⚠️ CRITICAL:** Never use `targetOrigin: "*"` in production!

---

## 📨 Message Schema v1.0

All messages MUST follow this structure:

```typescript
interface BridgeMessage {
  event: EventType;              // Required: Event identifier
  schemaVersion: string;         // Required: "1.0"
  correlationId: string;         // Required: Unique ID for tracking
  timestamp: string;             // Required: ISO 8601 timestamp
  payload: object;               // Required: Event-specific data
  replyTo?: string;              // Optional: correlationId of message being replied to
  error?: object;                // Optional: Error details
}
```

### Event Types

#### Parent → iframe
- `UNBREAK_PARENT_HELLO` - Initial handshake from parent
- `UNBREAK_SET_LOCALE` - Change language (de/en)
- `UNBREAK_GET_CONFIG` - Request current configuration

#### iframe → Parent
- `UNBREAK_IFRAME_READY` - iframe loaded and ready
- `UNBREAK_ACK` - Acknowledge received message
- `UNBREAK_CONFIG_CHANGED` - User changed configuration
- `UNBREAK_ADD_TO_CART` - User clicked "Add to Cart"
- `UNBREAK_RESET_VIEW` - User reset view
- `UNBREAK_ERROR` - Error occurred in iframe

---

## 🤝 Handshake Protocol

### 1. iframe Loads
```javascript
// iframe sends:
{
  event: "UNBREAK_IFRAME_READY",
  schemaVersion: "1.0",
  correlationId: "msg_1234567890_abc123",
  timestamp: "2026-01-09T12:00:00.000Z",
  payload: {
    iframeVersion: "1.0.0",
    supportedSchemaVersion: "1.0",
    supportedLocales: ["de", "en"]
  }
}
```

### 2. Parent Responds
```javascript
// Parent sends:
{
  event: "UNBREAK_PARENT_HELLO",
  schemaVersion: "1.0",
  correlationId: "msg_1234567891_def456",
  timestamp: "2026-01-09T12:00:00.100Z",
  replyTo: "msg_1234567890_abc123",  // References iframe message
  payload: {
    locale: "de",
    parentVersion: "2.0.0",
    supportedSchemaVersion: "1.0"
  }
}
```

### 3. iframe ACKs
```javascript
// iframe sends:
{
  event: "UNBREAK_ACK",
  schemaVersion: "1.0",
  correlationId: "msg_1234567892_ghi789",
  timestamp: "2026-01-09T12:00:00.200Z",
  replyTo: "msg_1234567891_def456",
  payload: {
    acknowledges: "msg_1234567891_def456",
    status: "success",
    message: "Handshake complete"
  }
}
```

**✅ Handshake Complete** - Normal message flow can begin

---

## 📦 Payload Schemas

### UNBREAK_ADD_TO_CART

**Most Important Event** - Triggers checkout flow

```javascript
{
  event: "UNBREAK_ADD_TO_CART",
  schemaVersion: "1.0",
  correlationId: "msg_...",
  timestamp: "2026-01-09T12:00:00.000Z",
  payload: {
    variant: "glass_holder",           // Required: "glass_holder" | "bottle_holder"
    sku: "UNBREAK-GLAS-01",            // Required: Product SKU
    colors: {                          // Required: Color configuration
      base: "mint",                    // camelCase color IDs
      arm: "darkBlue",                 // NOT dark_blue
      module: "black",
      pattern: "red"
    },
    finish: "matte",                   // Required: "matte" | "glossy"
    quantity: 1,                       // Required: Number
    locale: "de",                      // Required: "de" | "en"
    pricing: {                         // Optional: Pricing info
      basePrice: 4900,                 // in cents
      totalPrice: 4900
    }
  }
}
```

**Parent Action:**
1. Validate payload
2. Call `/api/checkout/create-checkout-session`
3. Redirect to Stripe Checkout

### UNBREAK_CONFIG_CHANGED

**Passive Update** - User changed config (no checkout)

```javascript
{
  event: "UNBREAK_CONFIG_CHANGED",
  schemaVersion: "1.0",
  correlationId: "msg_...",
  timestamp: "2026-01-09T12:00:00.000Z",
  payload: {
    variant: "glass_holder",
    colors: {
      base: "green",
      arm: "purple",
      module: "black",
      pattern: "iceBlue"
    },
    finish: "matte",
    quantity: 1
  }
}
```

**Parent Action:**
1. Store config in `ConfiguratorBridge.lastConfig`
2. Emit `unbreak-config-changed` event
3. No checkout triggered

### UNBREAK_SET_LOCALE

**Parent → iframe** - Change language

```javascript
{
  event: "UNBREAK_SET_LOCALE",
  schemaVersion: "1.0",
  correlationId: "msg_...",
  timestamp: "2026-01-09T12:00:00.000Z",
  payload: {
    locale: "de"  // "de" | "en"
  }
}
```

**iframe Action:**
1. Update UI language
2. Send ACK

### UNBREAK_ERROR

**iframe → Parent** - Error occurred

```javascript
{
  event: "UNBREAK_ERROR",
  schemaVersion: "1.0",
  correlationId: "msg_...",
  timestamp: "2026-01-09T12:00:00.000Z",
  payload: {
    code: "CONFIG_LOAD_FAILED",
    message: "Failed to load saved configuration",
    details: {
      reason: "Invalid JSON",
      configId: "abc123"
    }
  }
}
```

---

## 🛠️ Implementation Guide

### Parent App Setup

```html
<!-- Load in this order -->
<script src="/lib/bridge-schema.js"></script>
<script src="/lib/bridge-debug.js"></script>
<script src="/lib/bridge-debug-panel.js"></script>
<script src="/iframe-language-bridge-v2.js"></script>
```

### Enable Debug Mode

```javascript
// URL param
https://unbreak-one.vercel.app/configurator?debug=1

// Or localStorage
localStorage.setItem('unbreak_bridge_debug', 'true');

// Or programmatically
window.UnbreakBridgeDebug.enable();
```

### Send Message from iframe

```javascript
// In iframe code
const message = {
  event: "UNBREAK_ADD_TO_CART",
  schemaVersion: "1.0",
  correlationId: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
  timestamp: new Date().toISOString(),
  payload: {
    variant: "glass_holder",
    sku: "UNBREAK-GLAS-01",
    colors: { base: "mint", arm: "darkBlue", module: "black", pattern: "red" },
    finish: "matte",
    quantity: 1,
    locale: "de"
  }
};

window.parent.postMessage(message, "https://unbreak-one.vercel.app");
```

### Listen in Parent

```javascript
// Bridge automatically handles this!
// But you can listen to custom events:

window.addEventListener('unbreak-config-changed', (e) => {
  console.log('Config changed:', e.detail);
});
```

---

## 🧪 Testing

### Test Page
```
https://unbreak-one.vercel.app/debug/bridge.html
```

**Features:**
- Embedded iframe
- Simulate all message types
- Real-time debug panel
- Copy debug dump to clipboard
- Network call monitoring

### Manual Test Flow

1. **Open test page with debug mode:**
   ```
   https://unbreak-one.vercel.app/debug/bridge.html?debug=1
   ```

2. **Wait for handshake:**
   - Check status: "Handshake: complete" ✅

3. **Click "Simulate ADD_TO_CART":**
   - Watch Network tab for API call
   - Should redirect to Stripe

4. **Check debug panel:**
   - Messages Received: +1
   - Checkout Triggered: +1
   - No drops

5. **Copy debug dump:**
   - Click "Copy Debug Dump"
   - Share for troubleshooting

---

## 🐛 Debugging Guide

### Common Issues

#### "Messages Dropped: > 0"
**Check:**
- Origin whitelist includes iframe domain
- Message has valid `schemaVersion: "1.0"`
- `correlationId` is unique
- `payload` matches event schema

**Debug:**
```javascript
// Check last drop reason
console.log(window.UnbreakBridgeDebug.lastDropReason);

// View all drops
console.log(window.UnbreakBridgeDebug.drops);
```

#### "No Checkout Triggered"
**Check:**
1. Event is `UNBREAK_ADD_TO_CART` (not `configChanged`)
2. Payload has `variant`, `colors`, `sku`
3. `UnbreakCheckout.createCheckoutSession` exists
4. Network tab shows API call

**Debug:**
```javascript
// Check if handler was reached
window.UnbreakBridgeDebug.logs.filter(l => l.stage === 'HANDLER_MATCHED');

// Check if checkout was triggered
window.UnbreakBridgeDebug.stats.checkoutTriggered;  // Should be > 0

// Check API call status
window.UnbreakBridgeDebug.lastCheckoutResponse;
```

#### "Listener Re-Init Spam"
**Fixed in v2.0!** Listener is registered only once.

**Verify:**
```javascript
// Should only see this ONCE on page load:
// [BRIDGE][INIT] listenerRegistered: true
```

---

## 📊 Telemetry

### Available Stats

```javascript
const stats = window.UnbreakBridgeDebug.stats;

console.log({
  messagesReceived: stats.messagesReceived,
  messagesSent: stats.messagesSent,
  messagesDropped: stats.messagesDropped,
  checkoutTriggered: stats.checkoutTriggered,
  apiCallsStarted: stats.apiCallsStarted,
  apiCallsSucceeded: stats.apiCallsSucceeded,
  apiCallsFailed: stats.apiCallsFailed,
  redirectAttempts: stats.redirectAttempts
});
```

### Debug Panel (Keyboard Shortcut)

Press **`Ctrl + Shift + D`** to toggle debug panel

**Shows:**
- Last 50 messages
- Message drops with reasons
- Real-time stats
- Checkout status
- Copy dump button

---

## 🚀 Migration from v1.0

### Old Format (Deprecated)
```javascript
{
  type: "configChanged",
  reason: "add_to_cart",
  config: {...}
}
```

### New Format (v1.0)
```javascript
{
  event: "UNBREAK_ADD_TO_CART",
  schemaVersion: "1.0",
  correlationId: "msg_...",
  timestamp: "2026-01-09T12:00:00.000Z",
  payload: {...}
}
```

**⚠️ Legacy Support:** Parent will accept old format temporarily, but will be removed in future versions.

---

## 📞 Support

**Issues:** Create ticket with debug dump:
1. Open `/debug/bridge.html?debug=1`
2. Reproduce issue
3. Click "Copy Debug Dump"
4. Attach to ticket

**Questions:** Check:
- This document
- `/debug/bridge.html` test page
- Browser console logs with `[BRIDGE]` prefix

---

## 📝 Changelog

### v1.0 (2026-01-09)
- ✅ Versioned message schema
- ✅ Origin security
- ✅ Handshake protocol
- ✅ Debug panel UI
- ✅ Full telemetry
- ✅ Test harness page
- ✅ Single listener registration (no spam)

### v0.0 (Legacy)
- Basic postMessage
- No schema validation
- No telemetry
- Listener re-init spam
