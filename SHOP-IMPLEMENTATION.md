# UNBREAK ONE - Professional Shop Implementation

## 📦 Overview

Professional e-commerce shop mit Supabase-Integration, dynamischen Produktdaten und Stripe Checkout.

---

## 🏗️ Architektur

```
/pages/shop.js              → Professionelle Shop-Seite (Next.js SSR)
/pages/ops/products.js      → Produktpflege für Staff/Admin
/pages/api/checkout/standard.js  → Stripe Checkout API (bereits vorhanden)
/database/shop-products-migration.sql  → Supabase Migration + Seed
```

---

## 🎯 Features

### Shop-Seite (/shop)
- ✅ **Server-Side Rendering (SSR)** - Produkte werden beim Build geladen
- ✅ **Dynamische Produktdaten** aus Supabase
- ✅ **Responsive Design** - Desktop: 3-spaltig, Mobile: 1-spaltig
- ✅ **Glassmorphism Style** - Konsistent mit bestehender Site
- ✅ **Stripe Checkout** - Direkter „Kaufen"-Button ohne Zwischenseiten
- ✅ **Keine Subdomains** - Alle Links relativ (/shop, nicht shop.unbreak-one.com)

### Produktverwaltung (/ops/products)
- ✅ **Role-Based Access** - Nur Staff und Admin
- ✅ **Inline Editing** - Modal für Produktbearbeitung
- ✅ **Quick Toggle** - Aktivieren/Deaktivieren per Klick
- ✅ **Echtzeit Preview** - Preisvorschau in EUR

### Checkout-Integration
- ✅ **Dynamische Origin** - Funktioniert auf localhost, Vercel Preview, Production
- ✅ **Success/Cancel URLs** - Automatisch auf aktuelle Domain
- ✅ **Order Tracking** - Bestellungen in Supabase
- ✅ **Stripe Metadata** - SKU, Order ID, User ID

---

## 📊 Datenbankstruktur

### Products Tabelle

| Feld | Typ | Beschreibung |
|------|-----|--------------|
| `id` | UUID | Primärschlüssel |
| `sku` | TEXT | Eindeutiger Produktcode (z.B. `UNBREAK-BASIC-SET`) |
| `slug` | TEXT | URL-freundlich (z.B. `basic-set`) |
| `name` | TEXT | Produktname |
| `short_description_de` | TEXT | Kurz (Shop-Card) |
| `short_description_en` | TEXT | Kurz (Shop-Card EN) |
| `long_description_de` | TEXT | Lang (Detail-Seite) |
| `long_description_en` | TEXT | Lang (Detail-Seite EN) |
| `base_price_cents` | INTEGER | Preis in Cent (7990 = 79,90 EUR) |
| `currency` | TEXT | Währung (EUR) |
| `image_url` | TEXT | Bildpfad (z.B. `/images/set-basic.jpg`) |
| `active` | BOOLEAN | Sichtbar im Shop |
| `sort_order` | INTEGER | Sortierreihenfolge |
| `stripe_price_id` | TEXT | Stripe Price ID (optional) |
| `created_at` | TIMESTAMPTZ | Erstellungsdatum |
| `updated_at` | TIMESTAMPTZ | Letzte Änderung |

### Seed-Produkte

1. **UNBREAK-BASIC-SET** - 79,90 EUR
   - 2x Weinglashalter + 1x Flaschenhalter
   - Slug: `basic-set`

2. **UNBREAK-PREMIUM-SET** - 149,90 EUR
   - 4x Weinglashalter + 2x Flaschenhalter
   - Slug: `premium-set`

3. **UNBREAK-GASTRO-BUNDLE** - 249,90 EUR
   - 10x Weinglashalter (professionell)
   - Slug: `gastro-edition`

---

## 🚀 Deployment

### 1. Supabase Migration ausführen

```bash
# In Supabase SQL Editor:
```

1. Öffne [Supabase Dashboard → SQL Editor](https://app.supabase.com/project/_/sql)
2. Kopiere den Inhalt von `database/shop-products-migration.sql`
3. Führe das SQL aus
4. Verifiziere: Es sollten 3 Produkte erstellt sein

### 2. Bilder hinzufügen

Platziere folgende Bilder in `/public/images/`:
- `set-basic.jpg`
- `set-premium.jpg`
- `gastro-set.jpg`

### 3. Stripe Produkte erstellen (optional)

Wenn du Stripe Price IDs nutzen möchtest:

1. Gehe zu [Stripe Dashboard → Products](https://dashboard.stripe.com/products)
2. Erstelle 3 Produkte:
   - **UNBREAK ONE Basic Set** - 79,90 EUR
   - **UNBREAK ONE Premium Set** - 149,90 EUR
   - **UNBREAK ONE Gastro Edition** - 249,90 EUR
3. Kopiere die `price_...` IDs
4. Update in Supabase:
   ```sql
   UPDATE products 
   SET stripe_price_id = 'price_...' 
   WHERE sku = 'UNBREAK-BASIC-SET';
   ```

**Oder:** Lasse `stripe_price_id` NULL und nutze SKU-basiertes Checkout (bereits implementiert in `/api/checkout/standard.js`)

### 4. Vercel Deploy

```bash
git add .
git commit -m "Shop: Professional implementation with Supabase"
git push origin master
```

Vercel deployed automatisch. Die neue `/shop` Route ist sofort live.

---

## 🔒 Zugriffskontrolle

### Shop-Seite (/shop)
- ✅ **Öffentlich** - Jeder kann Produkte sehen
- ✅ **RLS Policy:** `active = true` - Nur aktive Produkte sichtbar

### Produktverwaltung (/ops/products)
- 🔒 **Nur Staff/Admin** - Prüft `profiles.role IN ('staff', 'admin')`
- 🔒 **Redirect zu /login** - Falls nicht eingeloggt
- 🔒 **RLS:** Staff/Admin können alle Produkte sehen und bearbeiten

### Checkout API (/api/checkout/standard)
- ✅ **Öffentlich** - Nutzt Service Role Key
- ✅ **Validierung:** Produkt muss `active = true` sein
- ✅ **Order Tracking:** Speichert Bestellung in Supabase

---

## 🎨 Design-System

### Shop Cards
- **Grid:** 3-spaltig (Desktop), 1-spaltig (Mobile)
- **Card:** Weiß, Glassmorphism-Shadow
- **Hover:** translateY(-4px), erhöhter Shadow
- **Button:** Petrol (#0c7c7c), rounded, hover scale(1.05)

### Colors
- **Petrol:** `#0c7c7c` (Primary CTA)
- **Petrol Dark:** `#0a6565` (Hover)
- **Text Primary:** `#1a1a1a`
- **Text Muted:** `#666`
- **Border Light:** `#eee`

### Typography
- **Title:** 1.35rem, 600 weight
- **Description:** 0.95rem, Muted
- **Price:** 1.75rem, 700 weight, Petrol

---

## 🛠️ Technische Details

### Dynamic Origin Detection

Alle Checkout-URLs nutzen `getOrigin(req)`:

```javascript
function getOrigin(req) {
  if (req.headers.origin) return req.headers.origin;
  
  const host = req.headers.host || 'localhost:3000';
  const protocol = req.headers['x-forwarded-proto'] || 
                   (host.includes('localhost') ? 'http' : 'https');
  return `${protocol}://${host}`;
}

// Success URL angepasst an Environment:
success_url: `${getOrigin(req)}/success.html?session_id={CHECKOUT_SESSION_ID}`
```

**Resultat:**
- Localhost: `http://localhost:3000/success.html`
- Vercel Preview: `https://unbreak-xyz-preview.vercel.app/success.html`
- Production: `https://unbreak-one.com/success.html`

### Server-Side Rendering

```javascript
export async function getServerSideProps() {
  const supabase = createClient(supabaseUrl, supabaseAnonKey);

  const { data: products } = await supabase
    .from('products')
    .select('*')
    .eq('active', true)
    .order('sort_order', { ascending: true });

  return { props: { initialProducts: products || [] } };
}
```

**Vorteile:**
- ✅ SEO-optimiert (Produkte im HTML)
- ✅ Schnelleres First Paint
- ✅ Fallback auf Client-Side Fetching

---

## ✅ Verification Checklist

Nach Deployment:

- [ ] **Shop lädt:** https://unbreak-one.com/shop
- [ ] **3 Produkte sichtbar:** Basic, Premium, Gastro
- [ ] **Bilder laden:** Alle `/images/*.jpg` vorhanden
- [ ] **Preise korrekt:** 79,90 / 149,90 / 249,90 EUR
- [ ] **„Kaufen"-Button:** Startet Stripe Checkout
- [ ] **Success URL:** Redirect nach `/success.html`
- [ ] **Keine Subdomains:** Grep nach `shop.unbreak-one.com` → 0 Treffer
- [ ] **Ops-Zugriff:** `/ops/products` nur für Staff/Admin
- [ ] **Edit Modal:** Produktbearbeitung funktioniert
- [ ] **Toggle Active:** Produkt erscheint/verschwindet im Shop

---

## 🐛 Troubleshooting

### Shop zeigt keine Produkte

**Ursache:** Supabase RLS Policy blockiert Zugriff

**Lösung:**
```sql
-- Prüfe Policy:
SELECT * FROM pg_policies WHERE tablename = 'products';

-- Falls fehlend, erstelle:
CREATE POLICY "Public can read active products"
  ON products FOR SELECT
  USING (active = true);
```

### Checkout führt zu 404

**Ursache:** `/api/checkout/standard.js` fehlt oder falsche Route

**Lösung:**
```bash
# Prüfe Datei existiert:
ls pages/api/checkout/standard.js

# Falls fehlend, aus Git holen:
git checkout main -- pages/api/checkout/standard.js
```

### Ops-Seite: "Zugriff verweigert"

**Ursache:** User hat keine Staff/Admin-Rolle

**Lösung:**
```sql
-- Setze User zu Staff:
UPDATE profiles 
SET role = 'staff' 
WHERE email = 'dein@email.de';
```

### Bilder laden nicht

**Ursache:** Bildpfade relativ, aber Dateien fehlen

**Lösung:**
```bash
# Erstelle Ordner:
mkdir -p public/images

# Füge Dummy-Bilder hinzu oder aktualisiere URLs in DB:
UPDATE products 
SET image_url = 'https://placehold.co/400x300/0c7c7c/white?text=UNBREAK' 
WHERE image_url LIKE '/images/%';
```

---

## 📝 Next Steps

### Empfohlene Erweiterungen:

1. **Product Detail Pages**
   - Route: `/shop/[slug]`
   - Zeigt `long_description`, zusätzliche Bilder
   - SEO-optimiert

2. **Bundles & Presets**
   - Nutze `bundles` und `presets` Tabellen (bereits in DB)
   - Eigene Sections im Shop

3. **Kategorien**
   - Filtermöglichkeit (Weinglashalter, Flaschenhalter, Sets)
   - Category-Feld zur Products-Tabelle

4. **Search & Filter**
   - Client-side Suche
   - Preis-Range Filter

5. **Shopping Cart**
   - Multi-Product Checkout
   - Quantity Management

6. **Inventory Management**
   - Stock-Feld zur Tabelle
   - "Ausverkauft"-Status

---

## 🔗 Related Documentation

- [AUTH-SETUP.md](./AUTH-SETUP.md) - User Roles (staff, admin)
- [CATALOG-GUIDE.md](./CATALOG-GUIDE.md) - Bundles & Presets Setup
- [CHECKOUT-INTEGRATION.md](./CHECKOUT-INTEGRATION.md) - Stripe Integration
- [VERCEL-DEPLOYMENT.md](./VERCEL-DEPLOYMENT.md) - Environment Variables

---

## 📅 Changelog

### 2025-12-27 - Initial Shop Implementation
- ✅ Created `pages/shop.js` (Next.js SSR)
- ✅ Created `pages/ops/products.js` (Admin Interface)
- ✅ Created `database/shop-products-migration.sql` (3 Seed Products)
- ✅ Removed all `shop.unbreak-one.com` references
- ✅ Verified Stripe Checkout integration (already working)
- ✅ Implemented dynamic origin detection
- ✅ Professional responsive design
