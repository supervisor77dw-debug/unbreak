# SSOT - Single Source of Truth

**Entscheidung: Variante A - Supabase Postgres als SSOT**

> Alle Entities werden in Supabase Postgres gespeichert.
> Prisma ist nur ORM-Layer für type-safe Queries, keine separate Datenbank!
> Beide (Prisma und Supabase Client) zeigen auf dieselbe DB.

---

## 📊 Entity-Tabellen-Matrix

| Entity | SSOT Tabelle | Access Layer | Notes |
|--------|--------------|--------------|-------|
| **Orders** | `simple_orders` | Supabase Client | Bereits SSOT |
| **Users/Auth** | `auth.users` | Supabase Auth | Credentials only |
| **User Metadata** | `admin_users` | Prisma (same DB) | Role, Name, isActive |
| **Products** | `products` | Supabase Client | Shop products |
| **Pricing Configs** | `pricing_configs` | Supabase Client | Konfigurator Preise |
| **Shipping Rates** | `shipping_rates` | Prisma (same DB) | Versandkosten |
| **Customers** | `customers` | Prisma (same DB) | Customer metadata |

---

## 🔑 Fingerprint System

Jeder API-Endpoint loggt seinen DataSource-Fingerprint:

```javascript
// lib/dataSourceFingerprint.js
export function logDataSourceFingerprint(context, options = {}) {
  const supabaseHost = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '')
    .replace('https://', '')
    .split('.')[0];
  
  const prismaHost = (process.env.DATABASE_URL || '')
    .match(/@([^:]+):/)?.[1] || 'unknown';

  console.log(`[FINGERPRINT] ${context}`);
  console.log(`  supabase_project: ${supabaseHost}`);
  console.log(`  prisma_host: ${prismaHost}`);
  console.log(`  tables_read: ${JSON.stringify(options.readTables || [])}`);
  console.log(`  tables_write: ${JSON.stringify(options.writeTables || [])}`);
  
  // CRITICAL: Both should point to same Supabase project!
  if (supabaseHost !== prismaHost.split('.')[0].replace('aws-1-eu-west-1', '')) {
    console.warn(`  ⚠️ WARNING: Supabase and Prisma may not point to same DB!`);
  }
}
```

### Erwartete Fingerprints (Localhost = Production)

```
[FINGERPRINT] checkout_standard
  supabase_project: qnzsdytdghfukrqpscsg
  prisma_host: aws-1-eu-west-1.pooler.supabase.co
  tables_read: ["pricing_configs", "shipping_rates", "products"]
  tables_write: ["simple_orders"]
```

---

## 📦 API Endpoints

### Shipping

| Endpoint | Method | Description | SSOT Table |
|----------|--------|-------------|------------|
| `/api/admin/shipping-rates` | GET | List all rates | `shipping_rates` |
| `/api/admin/shipping-rates` | POST | Create rate | `shipping_rates` |
| `/api/admin/shipping-rates` | PUT | Update rate | `shipping_rates` |
| `/api/admin/shipping-rates` | DELETE | Delete rate | `shipping_rates` |
| `/api/checkout/standard` | POST | Uses shipping | `shipping_rates` |

### Pricing

| Endpoint | Method | Description | SSOT Table |
|----------|--------|-------------|------------|
| `/api/admin/pricing` | GET | Get active configs | `pricing_configs` |
| `/api/admin/pricing` | PUT | Update config | `pricing_configs` |
| `/api/checkout/standard` | POST | Calculate price | `pricing_configs` |

### Users

| Endpoint | Method | Description | SSOT |
|----------|--------|-------------|------|
| `/api/admin/users` | GET | List users | `admin_users` (Prisma) |
| `/api/admin/users/create` | POST | Create user | `auth.users` + `admin_users` |
| `/api/admin/users/[id]` | PATCH | Update metadata | `admin_users` (Supabase) + `auth.users` |
| `/api/admin/users/reset-password` | POST | Reset password | `auth.users` (Supabase Auth) |

---

## ✅ Akzeptanztests (5-Minuten Testplan)

### Test 1: Shipping Edit ✅
1. Admin Panel → Versandkosten
2. Ändere "Deutschland" Preis von 4,90€ auf 5,90€
3. Speichern
4. **Refresh** → Preis zeigt 5,90€ ✅
5. Checkout im Shop starten → Versand zeigt 5,90€ ✅
6. Zurücksetzen auf 4,90€

### Test 2: Pricing Edit ✅
1. Admin Panel → Produkte → Preiskonfiguration
2. Glashalter Basispreis ändern (z.B. 19,90€ → 21,90€)
3. Speichern
4. **Refresh** → Preis zeigt 21,90€ ✅
5. Konfigurator öffnen → Glashalter zeigt 21,90€ ✅
6. Zurücksetzen auf 19,90€

### Test 3: User Management ✅
1. Admin Panel → Mitarbeiter → Neuen User anlegen
2. User erscheint in Liste ✅
3. Name ändern → wird in admin_users gespeichert ✅
4. Passwort ändern → altes PW invalid, neues PW funktioniert ✅

---

## 🚨 Stop-Rules

**Sofort stoppen wenn:**
- [ ] Fingerprint auf Localhost ≠ Fingerprint auf Production
- [ ] `supabase_project` ist unterschiedlich
- [ ] `prisma_host` zeigt nicht auf Supabase Pooler
- [ ] Shipping/Pricing Änderungen im Admin nicht im Shop sichtbar

---

## 📁 Betroffene Dateien (Migration 2026-01-19)

### Von Prisma → Supabase Direct migriert

- `pages/api/admin/users.js` - User-Liste
- `pages/api/admin/users/[id].js` - User-Update  
- `pages/api/admin/users/create.js` - User-Create
- `pages/api/admin/shipping-rates.js` - Shipping CRUD

### Bereits Supabase-Only

- `pages/api/admin/pricing.js` - Pricing Config
- `pages/api/admin/products.js` - Products CRUD
- `pages/api/checkout/standard.js` - Checkout
- `lib/pricing/calcConfiguredPriceDB.js` - Preis-Berechnung

### Deprecated (nur Fallback)

- `lib/pricing/pricingConfig.js` - Hardcode-Fallbacks
- `lib/pricing/calcConfiguredPrice.js` - Alte Engine (nicht verwendet)

---

## 🏷️ Version

- **Dokument Version:** 2026-01-19
- **SSOT Migration:** Vollständig (Local)
- **Fingerprint System:** Active
