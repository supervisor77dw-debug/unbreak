# Konfigurator Integration Code

## 1. URL Parameter Handler (beim Laden)

```javascript
/**
 * Parse URL parameters and initialize configurator
 * Call this on page load (e.g., in useEffect or componentDidMount)
 */
function initializeFromShop() {
  const urlParams = new URLSearchParams(window.location.search);
  
  // Get language from URL (Shop is source of truth)
  const lang = urlParams.get('lang') || 'de';
  const returnUrl = urlParams.get('return');
  const source = urlParams.get('source'); // optional
  
  console.info('[CONFIG] Initialized from Shop', {
    lang,
    returnUrl,
    source,
  });
  
  // Set language immediately (no postMessage)
  setLanguage(lang); // Your i18n function
  
  // Store returnUrl for later use
  window.SHOP_RETURN_URL = returnUrl;
  
  return { lang, returnUrl, source };
}
```

## 2. Save to Cart Handler (Button Click)

```javascript
/**
 * Save configuration and redirect to shop
 * Call this when user clicks "In den Warenkorb" / "Add to Cart"
 */
async function saveAndReturnToShop() {
  const returnUrl = window.SHOP_RETURN_URL;
  
  if (!returnUrl) {
    console.error('[CONFIG] No return URL - cannot redirect to shop');
    showError('Keine Rücksprung-URL vorhanden');
    return;
  }
  
  try {
    // Build config payload (adapt to your data structure)
    const configPayload = {
      product_type: getCurrentProductType(), // e.g., 'glass_holder' or 'bottle_holder'
      variant: getCurrentVariant(),          // e.g., 'glass_holder'
      product_sku: getCurrentSKU(),          // e.g., 'UNBREAK-GLAS-01'
      parts: getSelectedParts(),             // e.g., { base: 'black', holder: 'gold' }
      colors: getSelectedColors(),           // e.g., { primary: '#000', accent: '#FFD700' }
      finish: getCurrentFinish(),            // e.g., 'matte' or 'glossy'
      quantity: getQuantity(),               // Number, default 1
      price: calculateTotalPrice(),          // In cents (e.g., 4900 for 49€)
      lang: getCurrentLanguage(),            // 'de' or 'en'
    };
    
    console.info('[CONFIG] Saving session...', {
      payloadKeys: Object.keys(configPayload),
      quantity: configPayload.quantity,
      price: configPayload.price,
    });
    
    // Show loading state (optional)
    setButtonLoading(true);
    setButtonText('Wird gespeichert...');
    
    // POST to shop API
    const response = await fetch('https://www.unbreak-one.com/api/config-session', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        lang: configPayload.lang,
        config: configPayload, // Changed from 'payload' to 'config'
      }),
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `HTTP ${response.status}`);
    }
    
    const data = await response.json();
    
    if (!data.ok || !data.sessionId) {
      throw new Error('Invalid response format');
    }
    
    const sessionId = data.sessionId;
    console.info('[CONFIG] Saved sessionId:', sessionId);
    
    // Build redirect URL
    const separator = returnUrl.includes('?') ? '&' : '?';
    const redirectUrl = `${returnUrl}${separator}session=${sessionId}`;
    
    console.info('[CONFIG] Redirecting to shop:', redirectUrl);
    
    // Redirect to shop
    window.location.href = redirectUrl;
    
  } catch (error) {
    console.error('[CONFIG] Save failed:', error);
    
    // Show error UI (NOT alert)
    showError(
      getCurrentLanguage() === 'de'
        ? 'Speichern fehlgeschlagen – bitte erneut versuchen'
        : 'Save failed – please try again'
    );
    
    // Reset button state
    setButtonLoading(false);
    setButtonText(
      getCurrentLanguage() === 'de'
        ? 'In den Warenkorb'
        : 'Add to Cart'
    );
  }
}
```

## 3. Helper Functions (adapt to your app)

```javascript
// Example implementations - adapt to your actual code

function getCurrentLanguage() {
  // Return current UI language
  return window.currentLang || 'de';
}

function setLanguage(lang) {
  // Set UI language (your i18n logic)
  window.currentLang = lang;
  // Update all UI text elements
  updateUILanguage(lang);
}

function getCurrentProductType() {
  // Return product type from your state
  return window.configState?.productType || 'glass_holder';
}

function getCurrentVariant() {
  // Usually same as product_type
  return getCurrentProductType();
}

function getCurrentSKU() {
  // Return SKU based on product type
  const type = getCurrentProductType();
  return type === 'bottle_holder' ? 'UNBREAK-FLASCHE-01' : 'UNBREAK-GLAS-01';
}

function getSelectedParts() {
  // Return selected parts/components
  return window.configState?.parts || {};
}

function getSelectedColors() {
  // Return selected colors
  return window.configState?.colors || {};
}

function getCurrentFinish() {
  // Return finish (matte/glossy)
  return window.configState?.finish || 'matte';
}

function getQuantity() {
  // Return quantity
  return window.configState?.quantity || 1;
}

function calculateTotalPrice() {
  // Calculate total price in cents
  const basePrice = 4900; // 49€
  const quantity = getQuantity();
  return basePrice * quantity;
}

function showError(message) {
  // Show error in UI (NOT alert)
  // Example: update error state or show toast
  const errorDiv = document.getElementById('error-message');
  if (errorDiv) {
    errorDiv.textContent = message;
    errorDiv.style.display = 'block';
    setTimeout(() => {
      errorDiv.style.display = 'none';
    }, 5000);
  }
}

function setButtonLoading(loading) {
  // Update button loading state
  const button = document.getElementById('add-to-cart-btn');
  if (button) {
    button.disabled = loading;
  }
}

function setButtonText(text) {
  // Update button text
  const button = document.getElementById('add-to-cart-btn');
  if (button) {
    button.textContent = text;
  }
}
```

## 4. React/Next.js Example

```jsx
import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';

export default function Configurator() {
  const router = useRouter();
  const [returnUrl, setReturnUrl] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  // Initialize from URL params
  useEffect(() => {
    const lang = router.query.lang || 'de';
    const returnUrl = router.query.return;
    
    console.info('[CONFIG] lang=', lang);
    
    if (lang) {
      setLanguage(lang);
    }
    
    if (returnUrl) {
      setReturnUrl(returnUrl);
    }
  }, [router.query]);
  
  // Save and return to shop
  async function handleAddToCart() {
    if (!returnUrl) {
      setError('Keine Rücksprung-URL');
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      console.info('[CONFIG] Saving session...');
      
      const response = await fetch('https://www.unbreak-one.com/api/config-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lang: getCurrentLanguage(),
          config: {
            product_type: 'glass_holder',
            parts: getSelectedParts(),
            colors: getSelectedColors(),
            quantity: 1,
            price: 4900,
          },
        }),
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      
      const data = await response.json();
      
      if (!data.ok || !data.sessionId) {
        throw new Error('Invalid response');
      }
      
      console.info('[CONFIG] Saved sessionId:', data.sessionId);
      
      const separator = returnUrl.includes('?') ? '&' : '?';
      window.location.href = `${returnUrl}${separator}session=${data.sessionId}`;
      
    } catch (err) {
      console.error('[CONFIG] Save failed:', err);
      setError('Speichern fehlgeschlagen – bitte erneut versuchen');
      setLoading(false);
    }
  }
  
  return (
    <div>
      {/* Your configurator UI */}
      
      {error && (
        <div className="error-message">
          {error}
        </div>
      )}
      
      <button 
        onClick={handleAddToCart}
        disabled={loading}
      >
        {loading ? 'Wird gespeichert...' : 'In den Warenkorb'}
      </button>
    </div>
  );
}
```

## 5. Error Message UI (CSS)

```css
.error-message {
  position: fixed;
  top: 20px;
  right: 20px;
  background: #dc2626;
  color: white;
  padding: 12px 20px;
  border-radius: 8px;
  box-shadow: 0 4px 6px rgba(0,0,0,0.1);
  z-index: 9999;
  font-family: sans-serif;
  font-size: 14px;
  animation: slideIn 0.3s ease-out;
}

@keyframes slideIn {
  from {
    transform: translateX(100%);
    opacity: 0;
  }
  to {
    transform: translateX(0);
    opacity: 1;
  }
}
```

## Test URLs

### Development (localhost)
```
http://localhost:3001/?lang=de&return=http://localhost:3000/shop/config-return
http://localhost:3001/?lang=en&return=http://localhost:3000/shop/config-return
```

### Production
```
https://unbreak-3-d-konfigurator.vercel.app/?lang=de&return=https://www.unbreak-one.com/shop/config-return
https://unbreak-3-d-konfigurator.vercel.app/?lang=en&return=https://www.unbreak-one.com/shop/config-return
```

### With source parameter (optional)
```
https://unbreak-3-d-konfigurator.vercel.app/?lang=de&return=https://www.unbreak-one.com/shop/config-return&source=shop
```

## Testing

### 1. Test URL Parsing
Open browser console:
```javascript
const url = new URL(window.location.href);
console.log('lang:', url.searchParams.get('lang'));
console.log('return:', url.searchParams.get('return'));
```

### 2. Test Save Function
```javascript
// In browser console after loading config
saveAndReturnToShop();
```

Check Network tab:
- Should see OPTIONS request → 204 No Content
- Should see POST request → 201 Created
- Response: `{"ok":true,"sessionId":"..."}`
- Browser redirects to: `${returnUrl}?session=${sessionId}`

### 3. Test Complete Flow
1. Open shop: https://www.unbreak-one.com/shop
2. Switch to EN
3. Click "Jetzt gestalten"
4. Config opens with `?lang=en&return=...`
5. Make selection in config
6. Click "Add to Cart"
7. Network shows OPTIONS + POST (both successful)
8. Redirect to `/shop/config-return?session=xyz`
9. Item appears in cart

## Troubleshooting

### CORS Error
Check:
- Origin header is set correctly
- OPTIONS returns 204 with CORS headers
- POST includes CORS headers in response

Console should show:
```
[CORS] { method: 'OPTIONS', origin: 'https://unbreak-3-d-konfigurator.vercel.app', allowed: true }
[CORS] { method: 'POST', origin: 'https://unbreak-3-d-konfigurator.vercel.app', allowed: true }
```

### Invalid Response
Check request body format:
```json
{
  "lang": "de",
  "config": { ... }
}
```

NOT:
```json
{
  "lang": "de",
  "payload": { ... }
}
```

### No Redirect
Check:
- `returnUrl` is set
- `data.sessionId` exists
- No JavaScript errors in console

## Summary

**What to implement in Config App:**
1. Parse URL params: `lang`, `return`, `source`
2. Set language from `lang` param (no postMessage)
3. On save button: POST to `/api/config-session`
4. Redirect to `${returnUrl}?session=${sessionId}`
5. Show error UI (not alert) on failure
6. Add console.info logs for debugging

**What NOT to do:**
- ❌ No postMessage
- ❌ No iframe bridge
- ❌ No alert() for errors
- ❌ No dependency on Shop CSS/JS

**API Endpoint:**
```
POST https://www.unbreak-one.com/api/config-session
Content-Type: application/json

{
  "lang": "de",
  "config": {
    "product_type": "glass_holder",
    "parts": {...},
    "colors": {...},
    "quantity": 1,
    "price": 4900
  }
}

Response:
{
  "ok": true,
  "sessionId": "550e8400-e29b-41d4-a716-446655440000"
}
```
