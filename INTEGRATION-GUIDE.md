# UNBREAK ONE - Automatische Checkout-Integration

## 🚀 Quick Start (Automatische Button-Integration)

### ✨ Automatisches System
Seit dem neuesten Update werden **alle Buttons automatisch** über data-Attribute verbunden.
**Kein manueller onclick-Code mehr nötig!**

---

## 📋 Verfügbare Produkt-SKUs

| SKU | Produkt | Preis |
|-----|---------|-------|
| `UNBREAK-WEIN-01` | Weinglashalter | €59.90 |
| `UNBREAK-GLAS-01` | Glashalter Universal | €49.90 |
| `UNBREAK-FLASCHE-01` | Flaschenhalter | €54.90 |
| `UNBREAK-GASTRO-01` | Gastro Edition Set | €199.90 |

---

## 🔧 Button-Integration (data-Attribute)

### Standard-Produkt Button
```html
<!-- Einfach data-Attribute hinzufügen, kein onclick nötig! -->
<button 
  class="btn btn-primary"
  data-checkout="standard"
  data-sku="UNBREAK-WEIN-01"
  data-qty="1">
  Jetzt kaufen
</button>
```

**Wie es funktioniert:**
- `data-checkout="standard"` → Markiert Button als Standard-Produkt
- `data-sku="..."` → Produkt-SKU aus Datenbank
- `data-qty="..."` → Optional, Standard: 1

Das System bindet den Button **automatisch** beim Seitenladen!

---

### Konfigurator Button
```html
<button 
  class="btn btn-primary"
  data-checkout="configured"
  data-product-sku="UNBREAK-GLAS-01">
  Konfiguration kaufen
</button>
```

**Wie es funktioniert:**
- `data-checkout="configured"` → Markiert Button als Konfigurator-Produkt
- `data-product-sku="..."` → Basis-Produkt für Konfiguration
- Config wird automatisch via **postMessage** vom 3D-Konfigurator empfangen

---

## 📡 PostMessage-Protokoll (Konfigurator → Parent)

### Config-Update vom Konfigurator
```javascript
// Der 3D-Konfigurator sendet bei jeder Änderung:
window.parent.postMessage({
  type: 'UNBREAK_CONFIG_UPDATE',
  config: {
    color: 'petrol',
    finish: 'matte',
    engraving: null
  }
}, '*');
```

Das Checkout-System empfängt dies automatisch und speichert die Config in:
```javascript
window.UnbreakCheckoutState.lastConfig
```

Beim Klick auf "Jetzt kaufen" wird automatisch die **letzte Config** verwendet!

---

## 🎯 Integration Points

### 1. Globales checkout.js laden
**Bereits erledigt!** Das Script wird automatisch im Header geladen.

```javascript
// In header.js (automatisch):
<script src="checkout.js" defer></script>
```

---

### 2. Buttons markieren (Beispiele)

#### Shop-Page
```html
<!-- Weinglashalter -->
<a href="#" 
   class="btn btn-primary" 
   data-checkout="standard" 
   data-sku="UNBREAK-WEIN-01">
  Weinglashalter kaufen
</a>

<!-- Flaschenhalter -->
<a href="#" 
   class="btn btn-primary" 
   data-checkout="standard" 
   data-sku="UNBREAK-FLASCHE-01">
  Flaschenhalter kaufen
</a>

<!-- Gastro Set -->
<a href="#" 
   class="btn btn-primary" 
   data-checkout="standard" 
   data-sku="UNBREAK-GASTRO-01">
  Gastro Sets
</a>
```

#### Konfigurator-Page
```html
<button 
  class="btn btn-primary btn-magnetic"
  data-checkout="configured"
  data-product-sku="UNBREAK-GLAS-01">
  🛒 Jetzt kaufen
</button>
```

---

## 🔄 Workflow

### Standard-Produkt
1. User klickt Button mit `data-checkout="standard"`
2. System liest `data-sku` und `data-qty`
3. Automatischer API-Call zu `/api/checkout/create`
4. Redirect zu Stripe Checkout

### Konfiguriertes Produkt
1. User ändert Farbe/Finish im 3D-Konfigurator
2. Konfigurator sendet `UNBREAK_CONFIG_UPDATE` via postMessage
3. System speichert Config in `window.UnbreakCheckoutState.lastConfig`
4. User klickt "Jetzt kaufen" Button
5. System verwendet gespeicherte Config
6. API-Call zu `/api/checkout/create` mit Config
7. Redirect zu Stripe Checkout

---

## 🛡️ Sicherheit

### Origin-Check
```javascript
// checkout.js prüft automatisch:
const allowedOrigins = [
  'https://unbreak-3-d-konfigurator.vercel.app',
  window.location.origin
];

// Nur Messages von diesen Origins werden akzeptiert!
```

### Idempotenz
```javascript
// Buttons werden nur EINMAL gebunden:
if (button.dataset.bound === '1') return;
button.dataset.bound = '1';
```

---

## 🧪 Testing

### Test-Flow (Standard)
1. Öffne Shop-Page
2. Klicke "Weinglashalter kaufen"
3. Erwarte: Redirect zu Stripe
4. Zahle mit: `4242 4242 4242 4242`
5. Erwarte: Redirect zu success.html

### Test-Flow (Konfigurator)
1. Öffne configurator.html
2. Wähle Farbe im 3D-Konfigurator
3. Prüfe Console: "✓ Configurator config updated: {color: ...}"
4. Klicke "Jetzt kaufen"
5. Erwarte: Redirect zu Stripe mit Config
6. Zahle mit Testkarte
7. Prüfe Supabase: Config sollte in `configurations` Tabelle sein

---

## 📊 Database Structure

### Products (Basiskatalog)
```sql
SELECT * FROM products;
-- sku: UNBREAK-WEIN-01
-- base_price_cents: 5990 (59.90 EUR)
```

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
