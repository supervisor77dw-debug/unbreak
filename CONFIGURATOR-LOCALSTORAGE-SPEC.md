# Konfigurator → Shop Integration

## ⚠️ CRITICAL: Cross-Domain localStorage Problem

**Problem:** Konfigurator läuft auf `unbreak-3-d-konfigurator.vercel.app`, Shop auf `www.unbreak-one.com`.  
**localStorage ist domain-specific** - Cross-Origin Security verhindert Zugriff!

```
Konfigurator Domain: unbreak-3-d-konfigurator.vercel.app
└─ localStorage hier ❌ Shop kann NICHT lesen (andere Domain)

Shop Domain: www.unbreak-one.com  
└─ localStorage hier ✅ Nur eigene Domain
```

---

## ✅ LÖSUNG: URL Parameter (REQUIRED)

Der Konfigurator MUSS die Config als **URL Parameter** übergeben.

### Implementierung (Konfigurator-seitig)

```javascript
// Nach erfolgreicher Konfiguration:
const cartItem = {
  product_id: "glass_configurator",
  sku: "glass_configurator",
  name: currentLang === 'de' ? "Individueller Glashalter" : "Custom Glass Holder",
  price: 3900,  // CENTS
  configured: true,
  config: {
    variant: selectedVariant,
    baseColor: selectedBaseColor,
    accentColor: selectedAccentColor,
    finish: selectedFinish,
    engraving: engravingText
  }
};

// JSON stringify + base64 encode
const jsonString = JSON.stringify(cartItem);
const encoded = btoa(jsonString);  // base64 encode

// Redirect mit config parameter
const shopUrl = `https://www.unbreak-one.com/shop?config=${encoded}`;
window.location.href = shopUrl;
```

### Alternative: URL-encoded (ohne base64)

```javascript
const jsonString = JSON.stringify(cartItem);
const encoded = encodeURIComponent(jsonString);
const shopUrl = `https://www.unbreak-one.com/shop?config=${encoded}`;
window.location.href = shopUrl;
```

---

## Shop-Side Processing (IMPLEMENTED)

Der Shop ([pages/shop.js](pages/shop.js)) prüft:

1. **URL Parameter** (für Cross-Domain Konfigurator) ← PRIMARY
2. **localStorage** (für Same-Domain Fallback) ← SECONDARY

```javascript
// METHOD 1: URL parameter
const configParam = urlParams.get('config');
if (configParam) {
  const decoded = atob(configParam);  // or decodeURIComponent
  const cartItem = JSON.parse(decoded);
  cart.addItem(cartItem);
}

// METHOD 2: localStorage (fallback)
if (!cartItem) {
  const pending = localStorage.getItem('pendingConfiguratorItem');
  if (pending) {
    const cartItem = JSON.parse(pending);
    cart.addItem(cartItem);
  }
}
```

---

## Required Item Format

```javascript
{
  // Product Identity (REQUIRED)
  "product_id": "glass_configurator",
  "sku": "glass_configurator",
  
  // Display (REQUIRED)
  "name": "Individueller Glashalter",
  
  // Pricing (REQUIRED)
  "price": 3900,  // CENTS
  
  // Configurator Metadata (REQUIRED)
  "configured": true,
  "config": {
    "variant": "glass_holder",
    "baseColor": "#1A1A1A",
    "accentColor": "#FFD700",
    "finish": "matte"
  }
}
```

---

## Testing

**1. Konfigurator Test (Browser Console):**

```javascript
const testItem = {
  product_id: "glass_configurator",
  sku: "glass_configurator",
  name: "Test Glashalter",
  price: 3900,
  configured: true,
  config: { variant: "glass_holder", baseColor: "#000000" }
};

const encoded = btoa(JSON.stringify(testItem));
console.log('[CFG][TEST] Encoded config:', encoded);

window.location.href = `https://www.unbreak-one.com/shop?config=${encoded}`;
```

**2. Shop Test (nach Redirect):**

Browser Console sollte zeigen:
```
[SHOP][CONFIGURATOR_URL] Config parameter found
[SHOP][CONFIGURATOR_ITEM] {...}
[SHOP][CONFIGURATOR_SOURCE] URL parameter
[SHOP][CONFIGURATOR_ITEM_PARSED] {...}
[SHOP][CONFIGURATOR_ITEM_ADDED]
```

Item erscheint im Warenkorb.

---

## Error Handling

**Parse Error:**
```javascript
console.error('[SHOP][CONFIGURATOR_URL_PARSE_FAILED]', err);
// URL parameter wird ignoriert, kein Redirect-Loop
```

**Invalid Format:**
```javascript
console.error('[SHOP][CONFIGURATOR_ITEM_ADD_FAILED]');
// Cart.addItem() returns false bei Validierung
```

---

## Why NOT localStorage?

❌ **localStorage ist domain-specific:**
- Konfigurator: `unbreak-3-d-konfigurator.vercel.app` → localStorage A
- Shop: `www.unbreak-one.com` → localStorage B
- A und B sind KOMPLETT getrennt (Browser Security)

❌ **postMessage geht nicht:**
- Funktioniert nur während iframe/popup offen ist
- Nach redirect existiert kein parent window mehr

✅ **URL Parameter funktioniert:**
- Cross-Domain safe
- Survives redirect
- Standard HTTP mechanism

---

## URL Length Limits

**Max URL Length:**
- Chrome/Edge: ~2MB
- Firefox: ~65k chars
- Safari: ~80k chars

**Base64 Overhead:** +33% size

**Typical Config Size:**
```json
{"product_id":"glass_configurator","sku":"glass_configurator","name":"Individueller Glashalter","price":3900,"configured":true,"config":{"variant":"glass_holder","baseColor":"#1A1A1A","accentColor":"#FFD700","finish":"matte","engraving":"UNBREAK"}}
```
→ ~250 chars → base64 ~333 chars ✅ **Well under limit**

---

## Migration Path

**Phase 1 (CURRENT):** URL parameter ONLY
- Konfigurator sendet via URL
- Shop liest aus URL

**Phase 2 (Optional):** Server-side config storage
- Konfigurator POSTet config zu `/api/temp-config`
- Bekommt ID zurück
- Redirected mit kurzer URL: `/shop?cid=abc123`
- Shop fetched config von API

---

## localStorage Key (Deprecated)

**Nur für same-domain deployment:**

```javascript
localStorage.setItem('pendingConfiguratorItem', JSON.stringify(item));
```

**CURRENT:** Nicht verwendet (cross-domain)
