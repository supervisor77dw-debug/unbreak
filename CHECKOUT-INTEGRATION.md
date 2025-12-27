# 🛒 Dynamic Checkout Integration Guide
## UNBREAK ONE – Automatische Checkout-Buttons

**Erstellt:** 27. Dezember 2025  
**Status:** ✅ Production Ready

---

## 📝 Überblick

### Was ist das?

Zentrales Checkout-System für **UNBREAK ONE**, das automatisch Checkout-Buttons für alle Produkte, Bundles und Presets generiert – **ohne Hardcoding**.

### Kernprinzip

1. **Katalogdaten aus Supabase** → Automatisch kaufbar
2. **Keine SKU/ID-Hardcodierung** → Zentrale Library
3. **Preise serverseitig** → Sichere Berechnung
4. **data-Attribute statt inline-JS** → Sauberer Code

---

## 🏗️ Architektur

### Komponenten

```
/lib/checkout.js              # Zentrale Checkout-Library (Module)
/public/lib/checkout.js       # Kopie für Web-Zugriff

/pages/api/checkout/
  ├── standard.js             # Standard-Produkt Checkout
  ├── bundle.js               # Bundle Checkout
  └── preset.js               # Preset Checkout

/public/shop.html             # Dynamischer Shop (nutzt checkout.js)
```

### Datenfluss

```
┌─────────────────────┐
│   Supabase DB       │
│  products/bundles/  │
│      presets        │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│   shop.html         │
│ loadProducts()      │ ◄── Lädt Katalogdaten
│ createCatalogCard() │ ◄── Generiert Buttons mit data-Attributen
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ checkout.js         │
│ initCheckoutButtons()│ ◄── Bindet Event-Listener an Buttons
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ /api/checkout/*     │
│ - Holt Preis aus DB │ ◄── Server berechnet finale Preise
│ - Erstellt Order    │
│ - Stripe Session    │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│   Stripe Checkout   │
│   → Zahlung         │
└─────────────────────┘
```

---

## 🚀 Usage

### 1. Standard-Produkt

**HTML (mit data-Attributen):**
```html
<button 
  data-checkout="standard" 
  data-sku="UO-GLASS-01">
  Jetzt kaufen
</button>
```

**JavaScript (programmatisch):**
```javascript
import { buyStandard } from './lib/checkout.js';

// Einfach
buyStandard('UO-GLASS-01');

// Mit Options
buyStandard('UO-GLASS-01', {
  button: buttonElement,  // Optional: Button für Loading State
  email: 'customer@example.com'  // Optional: Pre-fill Email
});
```

---

### 2. Bundle

**HTML:**
```html
<button 
  data-checkout="bundle" 
  data-bundle-id="uuid-bundle-id">
  Bundle kaufen
</button>
```

**JavaScript:**
```javascript
import { buyBundle } from './lib/checkout.js';

buyBundle('uuid-bundle-id', { 
  button: buttonElement 
});
```

---

### 3. Preset

**HTML:**
```html
<button 
  data-checkout="preset" 
  data-preset-id="uuid-preset-id">
  Preset kaufen
</button>
```

**JavaScript:**
```javascript
import { buyPreset } from './lib/checkout.js';

buyPreset('uuid-preset-id', { 
  button: buttonElement 
});
```

---

## 🛍️ Shop-Integration (Beispiel)

### Automatische Button-Generierung

```javascript
// Supabase-Daten laden
const { data: products } = await supabase
  .from('products')
  .select('*')
  .eq('active', true);

// Katalog-Karten erstellen
products.forEach(product => {
  const card = document.createElement('div');
  
  card.innerHTML = `
    <h3>${product.name_de}</h3>
    <p>${formatPrice(product.base_price_cents)}</p>
    
    <button 
      data-checkout="standard" 
      data-sku="${product.sku}">
      Jetzt kaufen
    </button>
  `;
  
  grid.appendChild(card);
});

// Checkout-Buttons automatisch aktivieren
import('./lib/checkout.js').then(module => {
  module.initCheckoutButtons();
});
```

### Neue Produkte kaufbar machen

**KEIN Code-Ändern nötig!**

1. Neues Produkt in Supabase einfügen:
   ```sql
   INSERT INTO products (
     sku, 
     name_de, 
     base_price_cents, 
     active
   ) VALUES (
     'UO-GLASS-PREMIUM',
     'Premium Glashalter',
     7900,
     true
   );
   ```

2. Shop-Seite neu laden → Produkt erscheint automatisch mit Checkout-Button ✅

**Grund:** `createCatalogCard()` generiert Buttons dynamisch für ALLE Produkte.

---

## 🔐 Sicherheit

### Prinzip: "Never Trust the Frontend"

1. **Preise NIE aus Frontend senden**
   ```javascript
   // ❌ FALSCH
   fetch('/api/checkout', {
     body: JSON.stringify({ sku: 'UO-GLASS', price: 7900 })
   });
   
   // ✅ RICHTIG
   fetch('/api/checkout/standard', {
     body: JSON.stringify({ sku: 'UO-GLASS' })  // Nur Identifier
   });
   ```

2. **Server holt Preis aus Supabase**
   ```javascript
   // /api/checkout/standard.js
   const { data: product } = await supabase
     .from('products')
     .select('base_price_cents')
     .eq('sku', sku)
     .single();
   
   const finalPrice = product.base_price_cents;  // ← Aus DB, nicht aus Request
   ```

3. **Input Validation**
   ```javascript
   // checkout.js
   if (!sku) {
     throw new Error('SKU is required');
   }
   
   // Server-side
   if (!sku || typeof sku !== 'string') {
     return res.status(400).json({ error: 'Invalid SKU' });
   }
   ```

---

## 🛠️ API Endpoints

### POST /api/checkout/standard

**Request:**
```json
{
  "sku": "UO-GLASS-01",
  "email": "customer@example.com"  // optional
}
```

**Response:**
```json
{
  "url": "https://checkout.stripe.com/c/pay/cs_test_...",
  "order_id": "uuid",
  "session_id": "cs_test_..."
}
```

**Flow:**
1. Fetch product from DB (by SKU)
2. Create order in `orders` table
3. Create Stripe Checkout Session
4. Return checkout URL

---

### POST /api/checkout/bundle

**Request:**
```json
{
  "bundle_id": "uuid-bundle-id",
  "email": "customer@example.com"  // optional
}
```

**Response:**
```json
{
  "url": "https://checkout.stripe.com/...",
  "order_id": "uuid",
  "session_id": "cs_test_..."
}
```

**Flow:**
1. Fetch bundle from DB (with `items_json`)
2. Create order with `type='bundle'`
3. Stripe Session (bundle price from DB)
4. Return checkout URL

---

### POST /api/checkout/preset

**Request:**
```json
{
  "preset_id": "uuid-preset-id",
  "email": "customer@example.com"  // optional
}
```

**Response:**
```json
{
  "url": "https://checkout.stripe.com/...",
  "order_id": "uuid",
  "configuration_id": "uuid",
  "session_id": "cs_test_..."
}
```

**Flow:**
1. Fetch preset from DB (with `config_json`)
2. Create configuration record (pre-filled)
3. Create order with `type='preset'`
4. Stripe Session
5. Return checkout URL + configuration_id

---

## 📦 Installation

### 1. Dateien prüfen

```bash
# Library vorhanden?
ls lib/checkout.js
ls public/lib/checkout.js

# Checkout APIs vorhanden?
ls pages/api/checkout/standard.js
ls pages/api/checkout/bundle.js
ls pages/api/checkout/preset.js
```

### 2. Shop.html anpassen

```html
<!-- checkout.js einbinden -->
<script src="lib/checkout.js" type="module" defer></script>

<!-- Buttons mit data-Attributen erstellen -->
<button 
  data-checkout="standard" 
  data-sku="UO-GLASS-01">
  Kaufen
</button>
```

### 3. Dynamische Buttons re-initialisieren

```javascript
// Nach Supabase-Laden
await loadProducts();
await loadBundles();
await loadPresets();

// Checkout-Buttons neu initialisieren
import('./lib/checkout.js').then(module => {
  module.initCheckoutButtons();
});
```

---

## 🧪 Testing

### Manual Testing

1. **Standard-Produkt:**
   ```bash
   # Shop öffnen
   http://localhost:3000/shop.html
   
   # Produkt-Button klicken
   # → Stripe Checkout öffnet sich
   # → Preis stimmt mit DB überein
   ```

2. **Bundle:**
   ```bash
   # Bundle-Button klicken
   # → Stripe zeigt Bundle-Preis
   # → Metadata enthält bundle_id
   ```

3. **Preset:**
   ```bash
   # Preset-Button klicken
   # → Stripe zeigt Preset-Preis
   # → Configuration wird erstellt
   ```

### Console Logs

**Erfolgreiche Initialisierung:**
```
[Checkout] Initialized checkout buttons
[Shop] Checkout buttons re-initialized after catalog load
```

**Button-Click:**
```
Redirecting to Stripe Checkout...
→ https://checkout.stripe.com/c/pay/cs_test_...
```

**Fehler:**
```
[Checkout] Standard product error: Product not found
[Checkout] Missing data-sku on button: <button>
```

---

## 🎯 Best Practices

### 1. Button Loading State

```javascript
// checkout.js macht das automatisch
buyStandard('UO-GLASS', { 
  button: myButton  // Button wird disabled + "Wird geladen..."
});
```

### 2. Error Handling

```javascript
try {
  await buyStandard('INVALID-SKU');
} catch (error) {
  // checkout.js zeigt bereits alert()
  console.error('Checkout failed:', error);
}
```

### 3. i18n Support

```javascript
// checkout.js erkennt automatisch Sprache
const lang = document.documentElement.lang || 'de';
button.textContent = lang === 'de' ? 'Wird geladen...' : 'Loading...';
```

### 4. Re-Initialisierung nach dynamischem Content

```javascript
// Immer nach DOM-Änderungen
document.getElementById('grid').innerHTML = newCards;

// Buttons neu binden
import('./lib/checkout.js').then(m => m.initCheckoutButtons());
```

---

## 🐛 Troubleshooting

### Problem: Button funktioniert nicht

**Check 1: data-Attribute korrekt?**
```html
<!-- ✅ RICHTIG -->
<button data-checkout="standard" data-sku="UO-GLASS">

<!-- ❌ FALSCH -->
<button data-checkout="standard" sku="UO-GLASS">  <!-- Fehlt data- Prefix -->
<button onclick="buyStandard('UO-GLASS')">        <!-- Inline-JS, nicht data-Attribut -->
```

**Check 2: Module korrekt geladen?**
```javascript
// Browser Console
console.log(window.supabase);  // Sollte Object sein
```

**Check 3: checkout.js initialisiert?**
```javascript
// Console sollte zeigen:
[Checkout] Initialized checkout buttons
```

---

### Problem: Preis stimmt nicht

**Check: Preis wird serverseitig geholt?**
```javascript
// ✅ RICHTIG (Server holt Preis)
const { data: product } = await supabase.from('products')...
const price = product.base_price_cents;

// ❌ FALSCH (Frontend sendet Preis)
const price = req.body.price;  // Niemals!
```

---

### Problem: Module Import Error

**Check: Pfad korrekt?**
```html
<!-- Von /public/shop.html aus -->
<script src="lib/checkout.js" type="module"></script>  <!-- ✅ Richtig -->
<script src="../lib/checkout.js" type="module"></script>  <!-- ❌ Falsch -->
```

---

## 📊 Feature-Matrix

| Feature | Standard | Bundle | Preset |
|---------|----------|--------|--------|
| data-checkout | `"standard"` | `"bundle"` | `"preset"` |
| Identifier | data-sku | data-bundle-id | data-preset-id |
| Preis aus DB | ✅ products.base_price_cents | ✅ bundles.price_cents | ✅ presets.price_cents |
| Configuration | ❌ Nein | ❌ Nein | ✅ Ja (auto-create) |
| Order Type | `standard` | `bundle` | `preset` |
| Webhook Support | ✅ | ✅ | ✅ |

---

## 🚀 Production Checklist

- [ ] `checkout.js` in `/public/lib/` kopiert
- [ ] Shop.html nutzt `data-checkout` Attribute
- [ ] Keine inline `onclick="handleBuy(...)"`
- [ ] Checkout APIs deployed (`/api/checkout/*`)
- [ ] Supabase RLS Policies aktiv
- [ ] Stripe Webhook konfiguriert
- [ ] Preise werden NIE aus Frontend gesendet
- [ ] Error Handling vorhanden
- [ ] Loading States funktionieren
- [ ] i18n Support aktiv (DE/EN)

---

## 📚 Weitere Dokumentation

- [CATALOG-GUIDE.md](./CATALOG-GUIDE.md) – Katalog-Management für Staff
- [CATALOG-IMPLEMENTATION.md](./CATALOG-IMPLEMENTATION.md) – Technische Details
- [SETUP-ECOMMERCE.md](./SETUP-ECOMMERCE.md) – E-Commerce Backend
- [AUTH-SETUP.md](./AUTH-SETUP.md) – Authentication System

---

## 💡 FAQ

### Q: Wie füge ich ein neues Produkt hinzu?

**A:** Einfach in Supabase einfügen. Kein Code-Ändern nötig!

```sql
INSERT INTO products (sku, name_de, base_price_cents, active)
VALUES ('UO-NEW', 'Neues Produkt', 8900, true);
```

Shop-Seite lädt → Produkt erscheint mit funktionierendem Checkout-Button.

---

### Q: Kann ich Preise im Frontend anpassen?

**A:** NEIN! Preise werden IMMER serverseitig aus Supabase geholt.

Frontend sendet nur: `{ sku: "UO-GLASS" }`  
Server holt: `SELECT base_price_cents FROM products WHERE sku = ...`

---

### Q: Unterstützt checkout.js Custom-Buttons?

**A:** Ja! Nutze einfach data-Attribute:

```html
<div class="my-fancy-button" data-checkout="standard" data-sku="...">
  <span>🛒</span> Kaufen
</div>
```

checkout.js bindet Events an **alle** Elemente mit `data-checkout`.

---

### Q: Kann ich ohne data-Attribute arbeiten?

**A:** Ja, rufe Funktionen direkt auf:

```javascript
import { buyStandard } from './lib/checkout.js';

myButton.addEventListener('click', () => {
  buyStandard('UO-GLASS', { button: myButton });
});
```

---

## ✅ Zusammenfassung

**Vorher:**
```javascript
// Hardcoded SKUs
<button onclick="buyProduct('UO-GLASS', 7900)">Kaufen</button>
<button onclick="buyProduct('UO-BOTTLE', 8900)">Kaufen</button>

// Preis aus Frontend (unsicher)
fetch('/api/checkout', { body: { sku, price } });
```

**Nachher:**
```javascript
// Automatisch aus Katalog generiert
<button data-checkout="standard" data-sku="UO-GLASS">Kaufen</button>

// Preis serverseitig (sicher)
fetch('/api/checkout/standard', { body: { sku } });
→ Server holt Preis aus Supabase
```

**Ergebnis:**
✅ Neue Produkte automatisch kaufbar  
✅ Keine SKU-Hardcodierung  
✅ Sichere Preisberechnung  
✅ Sauberer, wartbarer Code  

---

**Erstellt:** 27. Dezember 2025  
**Version:** 1.0  
**Autor:** GitHub Copilot
