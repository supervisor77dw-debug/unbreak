# Admin Products - Source of Truth Documentation

## Übersicht

Das Admin-Panel und der Shop nutzen **dieselbe Datenquelle** für Produkte - die `products` Tabelle in Supabase.

## Source of Truth

**DB-Tabelle:** `products` (siehe `database/schema.sql`)

### Schema
```sql
CREATE TABLE products (
  id UUID PRIMARY KEY,
  sku TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  base_price_cents INTEGER NOT NULL,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

## Die 4 UNBREAK-ONE Produkte

| SKU | Name | Preis | Beschreibung |
|-----|------|-------|--------------|
| `UNBREAK-WEIN-01` | Weinglashalter | 59,90 € | Magnetischer Halter für Weingläser |
| `UNBREAK-GLAS-01` | Glashalter Universal | 49,90 € | Magnetischer Halter für Gläser |
| `UNBREAK-FLASCHE-01` | Flaschenhalter | 54,90 € | Magnetischer Halter für Flaschen |
| `UNBREAK-GASTRO-01` | Gastro Edition Set | 199,90 € | Professionelles Set für Gastronomie (4x Weinglashalter) |

## System-Architektur

### Shop
- **Quelle:** `pages/shop.js` lädt aus `products` Tabelle
- **Endpunkt:** `supabase.from('products').select('*').eq('active', true)`
- **Display:** Zeigt nur aktive Produkte

### Admin Panel
- **Zugriff:** Nur ADMIN-Rolle
- **Liste:** `/admin/products` → GET `/api/admin/products`
- **Details:** `/admin/products/[id]` → GET/PATCH `/api/admin/products/[id]`
- **Suche:** Name, SKU, Beschreibung
- **Filter:** Alle / Nur Aktive / Nur Inaktive

### Produktverwaltung

**ADMIN kann:**
- ✅ Name ändern
- ✅ Beschreibung ändern
- ✅ Preis ändern (betrifft nur neue Bestellungen)
- ✅ Status togglen (aktiv/inaktiv)
- ❌ SKU ändern (nach Erstellung locked - Bestellstabilität)
- ❌ Produkte löschen (nur deaktivieren - active=false)

**STAFF/SUPPORT:**
- ❌ Kein Zugriff auf Produktverwaltung

## Checkout & Orders

### Standard Shop Checkout
```javascript
// pages/api/checkout/standard.js
const product = await supabase
  .from('products')
  .select('*')
  .eq('sku', sku)
  .eq('active', true)
  .single();
```

### Configurator Checkout
```javascript
// lib/pricing.js
const product = await supabase
  .from('products')
  .select('*')
  .eq('sku', productSku)
  .eq('active', true)
  .single();
```

### Order Items
Bestell-Items speichern:
- `sku` (stabil, ändert sich nie)
- `name` (Snapshot zum Zeitpunkt der Bestellung)
- `unit_price` (Snapshot zum Zeitpunkt der Bestellung)

**Wichtig:** Alte Bestellungen bleiben unverändert, auch wenn Produktpreise/-namen aktualisiert werden.

## Datenfluss

```
┌─────────────────┐
│  products (DB)  │  ← SOURCE OF TRUTH
│  (Supabase)     │
└────────┬────────┘
         │
    ┌────┴────┐
    │         │
┌───▼────┐  ┌▼────────┐
│  Shop  │  │  Admin  │
│ (READ) │  │ (WRITE) │
└────────┘  └─────────┘
    │
    │ Checkout
    ▼
┌──────────┐
│  Orders  │  ← Snapshots (sku, name, price)
└──────────┘
```

## API Endpoints

### GET /api/admin/products
**Auth:** ADMIN only  
**Query Params:**
- `search` - Suche in name, sku, description
- `active` - Filter: true/false

**Response:**
```json
{
  "products": [
    {
      "id": "uuid",
      "sku": "UNBREAK-WEIN-01",
      "name": "Weinglashalter",
      "description": "Magnetischer Halter für Weingläser",
      "base_price_cents": 5990,
      "active": true,
      "created_at": "2024-...",
      "updated_at": "2024-..."
    }
  ]
}
```

### GET /api/admin/products/[id]
**Auth:** ADMIN only  
**Response:** Einzelnes Produkt-Objekt

### PATCH /api/admin/products/[id]
**Auth:** ADMIN only  
**Body:** Felder zum Aktualisieren
```json
{
  "name": "Neuer Name",
  "description": "Neue Beschreibung",
  "base_price_cents": 6990,
  "active": false
}
```

### POST /api/admin/products
**Auth:** ADMIN only  
**Body:** Neues Produkt
```json
{
  "sku": "UNBREAK-NEW-01",
  "name": "Neues Produkt",
  "description": "Beschreibung...",
  "base_price_cents": 4990,
  "active": true
}
```

## Änderungsprotokoll

**2024-12-31:**
- ❌ Entfernt: Halluzinierte `shop_products` Tabelle
- ✅ Admin nutzt jetzt `products` (= Shop Source of Truth)
- ✅ UI aligned: Entfernt DE/EN Duplikate, Lagerbestand, Bilder
- ✅ Schema aligned: name, description, sku, base_price_cents, active
- ✅ SKU locked nach Erstellung (Bestellstabilität)
- ✅ DELETE = Soft Delete (active=false)

## Zukunft / Erweiterungen

**Geplant:**
- Product Options (colors, finishes) - siehe `product_options` Tabelle
- Product Images (separate Tabelle oder JSON array)
- Multi-language Support (i18n translations table)
- Variants (sizes, bundles)
- Inventory Tracking (stock_quantity mit Synchronisation)

**Aktuell NICHT implementiert:**
- Bilder (image_url)
- Lagerbestand (stock_quantity)
- Mehrsprachigkeit (name_de/name_en) - Shop nutzt aktuell DE

---

**Regel:** Alle Produktdaten kommen aus `products`. Keine Hardcodes im Frontend. Admin ADMIN-only.
