# i18n Implementation - Simplified Approach

## Schneller Fix (30 Minuten)

Anstatt das gesamte System umzubauen, implementiere ich:

1. **lib/i18n-shop.js** ✅ DONE
   - Zentrale Translations
   - Helper-Funktionen

2. **CONFIGURATOR-LOCALSTORAGE-SPEC.md Update**
   - Konfigurator MUSS `lang: 'de'|'en'` im Item senden

3. **Email Lang Detection**
   - Aus Order Meta oder Cart Item
   - Fallback auf DE

4. **Stripe locale**
   - Quick fix im Checkout

## Konfigurator Requirements (UPDATE SPEC)

```javascript
// Konfigurator muss senden:
const cartItem = {
  product_id: "glass_configurator",
  sku: "glass_configurator",
  name: lang === 'de' ? "Individueller Glashalter" : "Custom Glass Holder",
  price: 0,
  configured: true,
  lang: lang, // CRITICAL: 'de' | 'en'
  config: { ... },
  meta: {
    lang: lang // Redundant aber sicher
  }
};
```

## Email System (Quick Fix)

```javascript
// In webhook:
const orderLang = order.cart_items?.[0]?.lang 
  || order.meta?.lang 
  || 'de';

await sendCustomerEmail(order, { lang: orderLang });
await sendAdminEmail(order, { lang: 'de' }); // Admin immer DE
```

## Testing

1. Konfigurator mit `?lang=en` öffnen
2. Item konfigurieren
3. "Add to Cart"
4. → Shop öffnet
5. Checkout
6. Email checken → sollte EN sein

VORTEIL: Minimal invasive, kein großer Rewrite needed
