# UNBREAK ONE – E-Commerce Backend Setup

## Übersicht

Vollständige Checkout- und Produktionsintegration für UNBREAK ONE:

- **Datenbank**: Supabase (Postgres) mit RLS
- **Zahlung**: Stripe Checkout + Webhooks
- **Backend**: Next.js API Routes (serverless)
- **Flow**: Konfigurator → Checkout → Payment → Production Queue

---

## 🗂️ Architektur

```
┌─────────────────┐
│  3D Konfigurator │
│  (Frontend)     │
└────────┬────────┘
         │ collectConfig()
         ▼
┌─────────────────────────────────────┐
│  POST /api/checkout/create          │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━   │
│  1. Validate product + config       │
│  2. Calculate price (server-side)   │
│  3. Upsert customer                 │
│  4. Create configuration            │
│  5. Create order (pending_payment)  │
│  6. Create Stripe Checkout Session  │
│  7. Return checkout_url             │
└────────────┬────────────────────────┘
             │
             ▼
┌──────────────────────┐
│  Stripe Checkout     │
│  (hosted by Stripe)  │
└──────────┬───────────┘
           │ User pays
           ▼
┌───────────────────────────────────────┐
│  POST /api/stripe/webhook             │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│  Event: checkout.session.completed    │
│  1. Verify signature                  │
│  2. Idempotency check                 │
│  3. Update order → paid               │
│  4. Create production_job (queued)    │
│  5. Send confirmation email (TODO)    │
└───────────────────────────────────────┘
```

---

## 📦 Dateien

### Database
- `database/schema.sql` – Vollständiges DB-Schema mit RLS

### Backend API
- `api/checkout/create.js` – Checkout Session erstellen
- `api/stripe/webhook.js` – Stripe Event Handler
- `lib/supabase.js` – Supabase Client (admin + public)
- `lib/stripe.js` – Stripe Client Config
- `lib/pricing.js` – Preisberechnung & Shipping/Tax

### Frontend
- `configurator/checkout-integration.js` – Buy Button Integration
- `success.html` – Erfolgsseite nach Zahlung
- `cancel.html` – Abbruchseite

---

## 🚀 Setup

### 1. Supabase Projekt erstellen

1. Gehe zu [supabase.com](https://supabase.com)
2. Erstelle neues Projekt
3. Warte auf Provisionierung (~2 Minuten)

### 2. Datenbank Schema deployen

```bash
# Option A: Supabase Dashboard
# → SQL Editor → Neues Query → Inhalt von database/schema.sql einfügen → Run

# Option B: Supabase CLI
supabase db push database/schema.sql
```

Verifizierung:
```sql
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public';
-- Sollte zeigen: products, product_options, configurations, customers, orders, payments, production_jobs
```

### 3. Stripe Setup

1. Erstelle [Stripe Account](https://dashboard.stripe.com/register)
2. Hole API Keys:
   - **Test Mode**: Dashboard → Developers → API keys
   - Publishable key: `pk_test_...` (Frontend - später)
   - Secret key: `pk_test_...` (Backend - jetzt)

3. Webhook Endpoint erstellen:
   - Dashboard → Developers → Webhooks
   - Add endpoint: `https://deine-domain.com/api/stripe/webhook`
   - Events auswählen:
     - `checkout.session.completed`
     - `payment_intent.succeeded`
     - `charge.refunded`
   - Signing secret kopieren: `whsec_...`

### 4. Environment Variables

Erstelle `.env.local` im Root:

```env
# Supabase
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Stripe
STRIPE_SECRET_KEY=sk_test_...  # oder sk_live_... für Production
STRIPE_WEBHOOK_SECRET=whsec_...

# App (main domain only - no subdomains)
NEXT_PUBLIC_BASE_URL=http://localhost:3000  # oder https://unbreak-one.com (Production)
```

**WICHTIG**: Füge `.env.local` zu `.gitignore` hinzu!

### 5. Dependencies installieren

```bash
npm install @supabase/supabase-js stripe micro
```

### 6. Next.js Setup (falls noch nicht vorhanden)

```bash
# Falls noch kein Next.js Projekt
npx create-next-app@latest .

# Anpassen:
# - pages/api/ Ordner → verschiebe unsere API routes dorthin
# - public/ → statische Assets
```

**Ordnerstruktur**:
```
├── pages/
│   └── api/
│       ├── checkout/
│       │   └── create.js
│       └── stripe/
│           └── webhook.js
├── lib/
│   ├── supabase.js
│   ├── stripe.js
│   └── pricing.js
├── database/
│   └── schema.sql
├── configurator/
│   ├── configurator.js
│   └── checkout-integration.js
├── success.html
├── cancel.html
└── .env.local
```

---

## 🧪 Testing

### Lokaler Test (Webhook)

Webhooks funktionieren nur mit öffentlicher URL. Optionen:

#### Option A: Stripe CLI (empfohlen für lokalen Test)

```bash
# Installiere Stripe CLI
# Windows: scoop install stripe
# Mac: brew install stripe/stripe-cli/stripe

# Login
stripe login

# Leite Webhooks lokal weiter
stripe listen --forward-to localhost:3000/api/stripe/webhook

# Kopiere Webhook Signing Secret (whsec_...) → .env.local
```

#### Option B: ngrok (öffentlicher Tunnel)

```bash
# Installiere ngrok
# https://ngrok.com/download

# Starte Tunnel
ngrok http 3000

# Kopiere HTTPS URL → Stripe Webhook Endpoint
# https://abc123.ngrok.io/api/stripe/webhook
```

### Test-Zahlungen

Stripe Testkarten:
- **Erfolg**: `4242 4242 4242 4242`
- **Declined**: `4000 0000 0000 0002`
- **3D Secure**: `4000 0025 0000 3155`

Expiry: beliebig in Zukunft (z.B. `12/34`)  
CVC: beliebig (z.B. `123`)

### Test Flow

1. **Konfigurator öffnen**: http://localhost:3000/configurator.html
2. **Konfiguration wählen**: Farbe, Finish, etc.
3. **"Jetzt kaufen" klicken**
4. **E-Mail eingeben** (Testadresse)
5. **Stripe Checkout**: Testkarte `4242 4242 4242 4242`
6. **Success-Page**: http://localhost:3000/success.html?order_number=UB-...

Verifizierung in Supabase:
```sql
-- Neuste Order
SELECT * FROM orders ORDER BY created_at DESC LIMIT 1;

-- Production Job sollte existieren
SELECT * FROM production_jobs ORDER BY created_at DESC LIMIT 1;
```

---

## 📊 Datenmodell

### Products
Basiskatalog (Weinglashalter, Flaschenhalter, Gastro Edition)
- `sku`: eindeutige Produkt-ID
- `base_price_cents`: Basispreis in Cent (5990 = 59,90 €)

### Product_Options
Konfigurierbare Optionen mit Preisanpassungen
- `option_type`: color, finish, engraving
- `option_key`: petrol, matte, yes
- `price_delta_cents`: +/- in Cent (+500 = +5 €)

### Configurations
Vom Konfigurator erstellte Produktkonfigurationen
- `config_json`: komplette Auswahl (`{color: 'petrol', finish: 'matte', ...}`)
- `price_cents`: berechneter Endpreis
- `preview_image_url`: Screenshot/Render vom 3D Viewer
- `model_export_url`: exportiertes 3D-Modell (.glb/.obj)

### Orders
Bestellungen mit Lifecycle-Status
- `order_number`: UB-YYYYMMDD-XXXX (menschenlesbar)
- `status`: draft → pending_payment → **paid** → in_production → fulfilled
- `stripe_checkout_session_id`: Verknüpfung zu Stripe
- `total_cents`: Gesamtpreis inkl. Versand + Steuer

### Production_Jobs
Produktionsqueue
- `status`: queued → processing → done
- `payload_json`: **komplette Produktionsdaten**:
  ```json
  {
    "order_number": "UB-20250127-A1B2",
    "product": {"sku": "UNBREAK-WEIN-01", "name": "Weinglashalter"},
    "configuration": {"color": "petrol", "finish": "matte"},
    "customer": {"email": "...", "name": "..."},
    "shipping_address": {...},
    "preview_image_url": "https://...",
    "model_export_url": "https://..."
  }
  ```

---

## 🔐 Sicherheit

### Row Level Security (RLS)

Alle Tabellen haben RLS aktiviert:

- **Products/Options**: PUBLIC READ (Katalog)
- **Alle anderen**: NUR service_role (Backend API)

Frontend kann **nicht direkt** auf Orders/Payments schreiben.

### Stripe Webhook Signature

**KRITISCH**: Webhook-Handler MUSS Signature verifizieren:

```javascript
const event = stripe.webhooks.constructEvent(
  rawBody, 
  signature, 
  webhookSecret
);
```

Sonst können Angreifer fake Payment-Events senden!

### Idempotenz

Webhooks können mehrfach zugestellt werden. Schutz:

```javascript
// Prüfe stripe_event_id in payments Tabelle
// Wenn bereits verarbeitet → skip
```

---

## 🎨 Frontend Integration

### Konfigurator Buy Button

In `configurator.html`:

```html
<!-- Buy Button -->
<button id="buy-button" class="btn btn-primary">
  Jetzt kaufen – ab 59,90 €
</button>

<!-- Integration Script -->
<script src="configurator/checkout-integration.js"></script>
```

In `configurator/configurator.js` → `collectConfigurationData()` anpassen:

```javascript
function collectConfigurationData() {
  return {
    product: getCurrentProduct(), // 'wine_glass_holder'
    color: getSelectedColor(),    // 'petrol'
    finish: getSelectedFinish(),  // 'matte'
    engraving: getEngraving(),    // null oder {text: '...'}
    
    // Optional: 3D Model Data
    modelData: exportModelState(),
    previewImageUrl: captureScreenshot(),
    modelExportUrl: exportModel(),
  };
}
```

---

## 🚦 Production Checklist

- [ ] Supabase Projekt erstellt
- [ ] DB Schema deployed (`database/schema.sql`)
- [ ] Stripe Account (Test + Live Keys)
- [ ] Webhook Endpoint registriert
- [ ] `.env.local` mit allen Keys
- [ ] Test-Zahlung erfolgreich
- [ ] Webhook-Logs überprüft
- [ ] Success/Cancel Pages getestet
- [ ] Konfigurator Buy Button integriert
- [ ] E-Mail Versand (TODO - Resend/SendGrid)
- [ ] Production Monitoring (Sentry)

---

## 📧 E-Mail Integration (TODO - Phase 2)

Nach erfolgreichem Payment E-Mail senden:

**Option A: Resend** (einfach, modern)
```bash
npm install resend
```

**Option B: SendGrid** (etabliert)
```bash
npm install @sendgrid/mail
```

In `api/stripe/webhook.js` nach Production Job Erstellung:

```javascript
// TODO: Send confirmation email
await sendOrderConfirmation({
  to: order.customer.email,
  orderNumber: order.order_number,
  total: formatPrice(order.total_cents),
  config: order.configuration.config_json,
});
```

---

## 🐛 Troubleshooting

### Webhook wird nicht ausgelöst

1. **Stripe CLI logs**: `stripe listen --print-json`
2. **Dashboard**: Stripe → Developers → Webhooks → Event Log
3. **Signature Secret**: Stimmt `STRIPE_WEBHOOK_SECRET` überein?

### Order bleibt "pending_payment"

- Webhook nicht empfangen
- Webhook-Handler hat Fehler geworfen
- Supabase Service Role Key falsch
- `stripe_checkout_session_id` stimmt nicht überein

Logs:
```javascript
// In webhook.js
console.log('[Webhook] Received:', event.type, event.id);
```

### Preise stimmen nicht

- Server-seitige Berechnung prüfen (`lib/pricing.js`)
- Product_Options Deltas in DB verifizieren
- Frontend darf Preise NICHT berechnen

---

## 🔄 Workflow Zusammenfassung

1. **User**: Konfigurator öffnen → Produkt konfigurieren
2. **Frontend**: `startCheckout()` → POST `/api/checkout/create`
3. **Backend**: 
   - Validiere Input
   - Berechne Preis (server-side)
   - Erstelle Customer, Configuration, Order
   - Erstelle Stripe Checkout Session
4. **Frontend**: Redirect zu `checkout_url`
5. **Stripe**: User zahlt
6. **Webhook**: `checkout.session.completed`
   - Order → `paid`
   - ProductionJob → `queued`
7. **User**: Redirect zu `success.html`

---

## 📈 Next Steps

### Phase 2 - Essentials
- [ ] E-Mail Versand (Resend/SendGrid)
- [ ] Shipping Address Collection (in Stripe Checkout)
- [ ] Admin Dashboard (Orders/Production Queue)

### Phase 3 - Optimierungen
- [ ] Abandoned Cart Recovery
- [ ] Multi-Currency Support
- [ ] Tax Calculation (EU/Worldwide)
- [ ] Shipping Zones
- [ ] Promo Codes

### Phase 4 - Produktion
- [ ] Production Job Processor (Backend Worker)
- [ ] Status Updates (Email/SMS)
- [ ] Tracking Integration
- [ ] Analytics (Plausible/Umami)

---

## 🎯 Support

- **Supabase Docs**: https://supabase.com/docs
- **Stripe API**: https://stripe.com/docs/api
- **Next.js API Routes**: https://nextjs.org/docs/api-routes/introduction

**Bei Fragen**: Prüfe Console Logs, Stripe Dashboard Events, Supabase Logs.
