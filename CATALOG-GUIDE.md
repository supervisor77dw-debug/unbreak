# UNBREAK ONE – Catalog Management Guide
## Bundles & Presets System

**Version:** 2.0  
**Datum:** Dezember 2024  

---

## 🎯 Schnellstart

### Was ist neu?

**Vorher:** Nur Konfigurator + Standard-Produkte  
**Jetzt:** + Bundles (Produktpakete) + Presets (Vorkonfigurierte Designs)

### Zugriff

- **Shop:** [/shop.html](/shop.html) – Öffentlich
- **Verwaltung:** [/ops/catalog.html](/ops/catalog.html) – Nur Staff/Admin

---

## 📦 Bundles

### Was sind Bundles?

Vorgepackte Produktpakete mit Mengenrabatt.

**Beispiele:**
- Gastro Starter Set: 4× Glashalter + 2× Flaschenhalter = €249
- Home Office Set: 2× Glashalter = €99

### Bundle erstellen

1. Login als Staff/Admin
2. `/ops/catalog.html` → Tab "Bundles"
3. Click "Neues Bundle"
4. Form ausfüllen:
   - **Titel DE:** Gastro Starter Set
   - **Titel EN:** Gastro Starter Set
   - **Beschreibung DE:** Perfekt für kleine Bars
   - **Preis:** 249.00 (wird automatisch in Cents konvertiert)
   - **Bild URL:** /images/bundle-gastro-starter.jpg
   - **Items:**
     - Row 1: SKU `UO-GLASSHOLDER`, Menge `4`
     - Row 2: SKU `UO-BOTTLEHOLDER`, Menge `2`
     - Click "+ Artikel hinzufügen" für weitere
   - **Aktiv:** ✓ (Checkbox)
5. Speichern

**Ergebnis:** Bundle erscheint sofort im Shop

### Bundle bearbeiten

1. Tabelle → Click "✏️ Bearbeiten"
2. Form öffnet mit vorausgefüllten Daten
3. Änderungen vornehmen
4. Speichern → Sofort live

### Bundle löschen

1. Tabelle → Click "🗑️ Löschen"
2. Confirm Dialog
3. Bundle wird gelöscht (nur Admin)

---

## 🎨 Presets

### Was sind Presets?

Vorkonfigurierte Konfigurator-Varianten mit Festpreis.

**Beispiele:**
- Schwarz/Gold Premium: Finish=Matte Black, Magnet=Gold = €79
- Weiß/Silber Clean: Finish=Glossy White, Magnet=Silver = €69

### Preset erstellen

1. Login als Staff/Admin
2. `/ops/catalog.html` → Tab "Presets"
3. Click "Neues Preset"
4. Form ausfüllen:
   - **Titel DE:** Schwarz/Gold Premium
   - **Titel EN:** Black/Gold Premium
   - **Beschreibung DE:** Edles Design
   - **Preis:** 79.00
   - **Bild URL:** /images/preset-black-gold.jpg
   - **Produkt SKU:** UO-CONFIGURED
   - **Konfiguration (JSON):**
     ```json
     {
       "finish": "matte-black",
       "magnet": "gold",
       "quantity": 1
     }
     ```
   - **Aktiv:** ✓
5. Speichern

**JSON Whitelist:**  
Erlaubte Felder: `finish`, `magnet`, `quantity`, `color`, `material`

Ungültige Felder werden beim Speichern abgelehnt.

---

## 🛍️ Shop Integration

### Wie Kunden kaufen

1. Kunde besucht `/shop.html`
2. Sieht 3 Sections:
   - **Einzelprodukte:** Standard-SKUs aus `products` Tabelle
   - **Bundles:** Vorgepackte Sets
   - **Presets:** Vorkonfigurierte Designs
3. Click "Jetzt kaufen" auf beliebiges Item
4. → Stripe Checkout öffnet
5. Zahlung abschließen
6. → Order wird erstellt, Payment confirmed
7. → Production Job wird in Queue gelegt

### Technischer Flow

**Bundle Checkout:**
```
Shop → /api/checkout/bundle → Stripe → Webhook → Production
```

**Preset Checkout:**
```
Shop → /api/checkout/preset → Configuration → Stripe → Webhook → Production
```

---

## 🔧 Datenbank

### Tabellen

**bundles:**
- `id` – UUID
- `title_de/en` – Name
- `description_de/en` – Beschreibung
- `price_cents` – Preis in Cents
- `items_json` – Array: `[{"sku":"UO-GLASSHOLDER","qty":4}]`
- `active` – Sichtbar im Shop?
- `image_url` – Produktbild

**presets:**
- `id` – UUID
- `title_de/en` – Name
- `description_de/en` – Beschreibung
- `price_cents` – Preis in Cents
- `product_sku` – Basis-Produkt (z.B. `UO-CONFIGURED`)
- `config_json` – Konfiguration: `{"finish":"...","magnet":"..."}`
- `active` – Sichtbar im Shop?
- `image_url` – Produktbild

### RLS Policies

**Public (anon):**
- `SELECT` auf `bundles` WHERE `active=true`
- `SELECT` auf `presets` WHERE `active=true`

**Staff/Admin (authenticated):**
- `SELECT` auf alle
- `INSERT`/`UPDATE` erlaubt
- `DELETE` nur Admin

---

## 🧪 Testing

### Shop testen

```bash
# 1. Server starten
npm run dev

# 2. Browser öffnen
http://localhost:3000/shop.html

# 3. Prüfen:
✓ 3 Sections sichtbar
✓ Bundles laden (mind. 3 aus Seed Data)
✓ Presets laden (mind. 3 aus Seed Data)
✓ "Jetzt kaufen" → Stripe Checkout öffnet
```

### Ops UI testen

```bash
# 1. Login als Staff/Admin
http://localhost:3000/login.html

# 2. Ops Catalog öffnen
http://localhost:3000/ops/catalog.html

# 3. Prüfen:
✓ 3 Tabs sichtbar
✓ Bundles Tabelle zeigt Seed Data
✓ Create Bundle → Success
✓ Edit Bundle → Success
✓ Delete Bundle (als Admin) → Success
```

### Checkout testen

```bash
# Bundle Checkout
curl -X POST http://localhost:3000/api/checkout/bundle \
  -H "Content-Type: application/json" \
  -d '{"bundle_id":"<uuid>"}'

# Expected:
# {"url":"https://checkout.stripe.com/..."}

# Preset Checkout
curl -X POST http://localhost:3000/api/checkout/preset \
  -H "Content-Type: application/json" \
  -d '{"preset_id":"<uuid>"}'
```

---

## 📸 Screenshots

### Shop Page
```
[Hero]
Shop
Magnetische Halter für Gläser & Flaschen

[Products Section]
┌─────────────┬─────────────┬─────────────┐
│  Glashalter │Flaschenhalter│ Gastro Set  │
│  €49.00     │  €59.00      │  €199.00    │
│[Jetzt kaufen│ [Jetzt kaufen│ [Jetzt kaufen│
└─────────────┴─────────────┴─────────────┘

[Bundles Section]
┌─────────────────┬─────────────────┐
│[BUNDLE]         │[BUNDLE]         │
│Gastro Starter   │Home Office Set  │
│€249.00          │€99.00           │
│4 Artikel        │2 Artikel        │
│[Jetzt kaufen]   │[Jetzt kaufen]   │
└─────────────────┴─────────────────┘

[Presets Section]
┌─────────────────┬─────────────────┐
│[PRESET]         │[PRESET]         │
│Schwarz/Gold     │Weiß/Silber      │
│€79.00           │€69.00           │
│[Jetzt kaufen]   │[Jetzt kaufen]   │
└─────────────────┴─────────────────┘
```

### Ops Catalog
```
📦 Katalog Verwaltung
user@example.com | ← Zurück zu Ops | Konto

[Products] [Bundles] [Presets]
                     + Neues Bundle

┌─────────────┬────────┬───────┬────────┬────────┐
│ Titel (DE)  │ Preis  │Artikel│ Status │Aktionen│
├─────────────┼────────┼───────┼────────┼────────┤
│Gastro Start │€249.00 │ 6     │[Aktiv] │✏️ 🗑️  │
│Home Office  │€99.00  │ 2     │[Aktiv] │✏️ 🗑️  │
└─────────────┴────────┴───────┴────────┴────────┘
```

---

## 🚀 Production Deployment

### Schritte

1. **Database Migration:**
   ```sql
   -- Supabase Dashboard > SQL Editor
   -- Run: database/catalog-setup.sql
   ```

2. **Seed Production Data:**
   - Login als Admin → `/ops/catalog.html`
   - Create Production Bundles (3-5)
   - Create Production Presets (3-5)
   - Upload Images zu `/images/bundle-*.jpg` und `/images/preset-*.jpg`

3. **Environment Variablen:**
   ```bash
   # Vercel/Netlify Environment Variables
   NEXT_PUBLIC_SUPABASE_URL=https://prod.supabase.co
   STRIPE_SECRET_KEY=sk_live_...
   ```

4. **Deploy:**
   ```bash
   npm run build
   vercel --prod
   ```

5. **Verify:**
   ```
   https://unbreak-one.com/shop.html
   https://unbreak-one.com/ops/catalog.html
   ```

---

## 📋 Checkliste

### Setup
- [ ] `database/catalog-setup.sql` ausgeführt
- [ ] Seed Data in DB (3 Bundles, 3 Presets)
- [ ] Environment Variables gesetzt
- [ ] `npm run inject-env` ausgeführt
- [ ] Shop Page lädt ohne Errors

### Testing
- [ ] Bundle Checkout funktioniert
- [ ] Preset Checkout funktioniert
- [ ] Ops UI CRUD funktioniert
- [ ] RLS Policies getestet (anon vs staff)
- [ ] Webhook verarbeitet Bundle/Preset Orders

### Production
- [ ] Production Bundles erstellt
- [ ] Production Presets erstellt
- [ ] Bilder hochgeladen
- [ ] Alle Items `active=true`
- [ ] Stripe Webhook konfiguriert
- [ ] Live-Test: End-to-End Checkout

---

## 📞 Support

**Fragen?** Siehe [SETUP-ECOMMERCE.md](./SETUP-ECOMMERCE.md)  
**Auth System:** [AUTH-SETUP.md](./AUTH-SETUP.md)  
**Launch Status:** [LAUNCH-STATUS.md](./LAUNCH-STATUS.md)

---

**Version:** 2.0 (2024-12-27)  
**Lizenz:** Proprietary – UNBREAK ONE
