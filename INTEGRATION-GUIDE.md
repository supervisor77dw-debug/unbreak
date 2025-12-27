# UNBREAK ONE - Konfigurator → Stripe Integration

## Quick Reference Guide

### 🎯 Integration Points

```javascript
// 1. In configurator.js - Add Buy Button Handler
import { startCheckout } from './checkout-integration.js';

document.getElementById('buy-button').addEventListener('click', async () => {
  const config = {
    product: 'wine_glass_holder',
    color: selectedColor,      // aus UI State
    finish: selectedFinish,     // aus UI State
    engraving: engravingText,   // optional
    previewImageUrl: captureScreenshot(), // optional
  };
  
  await startCheckout(config);
});

// 2. Product SKU Mapping
const productSkus = {
  'wine_glass_holder': 'UNBREAK-WEIN-01',
  'bottle_holder': 'UNBREAK-FLASCHE-01',
  'gastro_edition': 'UNBREAK-GASTRO-01',
};

// 3. Config Structure
const configExample = {
  product: 'wine_glass_holder',
  color: 'petrol',           // petrol | anthracite | graphite
  finish: 'matte',           // matte | glossy (+2 EUR)
  engraving: null,           // null oder { text: 'Text', font: 'sans' } (+9.90 EUR)
  
  // Optional - für Produktion
  modelData: exportSceneState(),
  previewImageUrl: 'https://...',
  modelExportUrl: 'https://...',
};
```

### 📊 Database Tables (wichtigste)

```sql
-- Products (Basiskatalog)
SELECT * FROM products;
-- sku: UNBREAK-WEIN-01
-- base_price_cents: 5990 (59.90 EUR)

-- Product Options (Konfigurierbare Optionen)
SELECT * FROM product_options WHERE product_id = '...';
-- option_type: 'color', option_key: 'petrol', price_delta_cents: 0
-- option_type: 'finish', option_key: 'glossy', price_delta_cents: 200 (+2 EUR)

-- Orders (Bestellungen)
SELECT * FROM orders WHERE status = 'paid' ORDER BY created_at DESC;
-- order_number: UB-20250127-A1B2
-- status: pending_payment → paid → in_production → fulfilled

-- Production Jobs (Produktionsqueue)
SELECT * FROM production_jobs WHERE status = 'queued';
-- payload_json: Komplette Produktionsdaten (config, customer, shipping)
```

### 🔄 Workflow

```
User klickt "Jetzt kaufen"
    ↓
frontend: collectConfigurationData()
    ↓
frontend: startCheckout() → POST /api/checkout/create
    ↓
backend: Validierung + Preisberechnung
    ↓
backend: DB inserts (customer, configuration, order)
    ↓
backend: Stripe Checkout Session erstellen
    ↓
frontend: Redirect zu Stripe Checkout
    ↓
User: Zahlt mit Kreditkarte
    ↓
Stripe: Webhook → POST /api/stripe/webhook
    ↓
backend: Order → status: paid
    ↓
backend: production_jobs.insert({status: 'queued', payload_json: {...}})
    ↓
frontend: Redirect zu /success.html?order_number=UB-...
```

### 🧪 Testing (Lokal)

```bash
# 1. Environment Setup
cp .env.example .env.local
# → Fülle Supabase + Stripe Keys ein

# 2. Dependencies
npm install

# 3. Start Dev Server
npm run dev

# 4. Stripe Webhook (separates Terminal)
stripe listen --forward-to localhost:3000/api/stripe/webhook

# 5. Test Payment
# Testkarte: 4242 4242 4242 4242
# Expiry: 12/34, CVC: 123

# 6. Verify in Supabase
# → orders table: status = 'paid'
# → production_jobs table: status = 'queued'
```

### 🚨 Häufige Fehler

**1. Webhook wird nicht ausgelöst**
```bash
# Check Stripe CLI
stripe listen --print-json

# Check Webhook Secret
echo $STRIPE_WEBHOOK_SECRET  # muss mit Stripe Dashboard übereinstimmen
```

**2. Order bleibt "pending_payment"**
```javascript
// In api/stripe/webhook.js - Log hinzufügen:
console.log('[Webhook] Event:', event.type, event.id);
console.log('[Webhook] Metadata:', event.data.object.metadata);
```

**3. Preis falsch berechnet**
```sql
-- Prüfe Product Options
SELECT * FROM product_options WHERE active = true;

-- Prüfe Config in Configuration
SELECT config_json, price_cents FROM configurations ORDER BY created_at DESC LIMIT 1;
```

### 📦 Production Payload Struktur

```json
{
  "order_number": "UB-20250127-A1B2",
  "product": {
    "sku": "UNBREAK-WEIN-01",
    "name": "Weinglashalter"
  },
  "configuration": {
    "color": "petrol",
    "finish": "matte",
    "engraving": null
  },
  "customer": {
    "email": "kunde@example.com",
    "name": "Max Mustermann",
    "phone": "+49 123 456789"
  },
  "shipping_address": {
    "street": "Musterstraße 123",
    "city": "Berlin",
    "zip": "10115",
    "country": "DE"
  },
  "pricing": {
    "subtotal_cents": 5990,
    "shipping_cents": 590,
    "tax_cents": 1250,
    "total_cents": 7830,
    "currency": "EUR"
  },
  "preview_image_url": "https://storage.supabase.co/...",
  "model_export_url": "https://storage.supabase.co/...",
  "paid_at": "2025-01-27T14:30:00Z"
}
```

### 🎨 UI Integration

```html
<!-- In configurator.html -->
<div class="configurator-actions">
  <!-- Buy Button -->
  <button id="buy-button" class="btn btn-primary">
    Jetzt kaufen – ab 59,90 €
  </button>
  
  <!-- Loading State -->
  <div id="checkout-loading" style="display: none;">
    Checkout wird vorbereitet...
  </div>
</div>

<script src="configurator/checkout-integration.js"></script>
```

### 📧 E-Mail Versand (Phase 2)

```javascript
// In api/stripe/webhook.js nach Production Job:

import { sendOrderConfirmation } from '../../lib/email';

await sendOrderConfirmation({
  to: order.customer.email,
  orderNumber: order.order_number,
  productName: product.name,
  total: formatPrice(order.total_cents),
  estimatedDelivery: '2-3 Wochen',
});
```

### 🔐 Security Checklist

- [x] RLS auf allen DB-Tabellen aktiviert
- [x] Service Role Key NUR server-side
- [x] Stripe Webhook Signature Verification
- [x] Idempotency Check (stripe_event_id)
- [x] Price Calculation server-side (nicht Frontend)
- [x] `.env.local` in `.gitignore`
- [ ] HTTPS in Production (Let's Encrypt/Vercel)
- [ ] Rate Limiting auf API Endpoints
- [ ] CORS Headers konfiguriert

---

**Bei Fragen**: Siehe [SETUP-ECOMMERCE.md](SETUP-ECOMMERCE.md) für vollständige Dokumentation
