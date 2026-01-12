# 🔑 Unified Order ID System - Deployment Guide

## Überblick

Dieses System löst die kritische Inkonsistenz zwischen verschiedenen Order-IDs und stellt sicher, dass:
- **UUID (orders.id)** = Einzige Wahrheit, PRIMARY KEY, immer verwendet für interne Referenzen
- **order_number** = Menschenlesbar (z.B. "UO-2026-000123") für Kunden & Support
- **public_id** = Kurz-ID (erste 8 Zeichen der UUID) für kompakte Anzeige
- Alle Systeme referenzieren Orders IMMER über UUID intern
- Admin zeigt ALLE relevanten IDs an und kann nach ALLEN suchen

## 📦 Implementierte Komponenten

### 1. Database Migration (015)
**Datei:** `supabase/migrations/015_add_order_number.sql`

**Hinzugefügt:**
- ✅ `order_number` Spalte (TEXT, UNIQUE, indexed) - Format: UO-YYYY-NNNNNN
- ✅ `public_id` Spalte (TEXT, UNIQUE, indexed) - Format: 8-char UUID substring
- ✅ PostgreSQL Sequence `order_number_seq` für atomare Nummernvergabe
- ✅ SQL Function `get_next_order_number()` - generiert sequenzielle Order Numbers
- ✅ Backfill für existierende Orders (Legacy-Format: UO-YYYYMMDD-8CHAR)
- ✅ Indexes auf `stripe_session_id` und `stripe_checkout_session_id` für Performance

**SQL Function:**
```sql
CREATE FUNCTION get_next_order_number() RETURNS TEXT AS $$
DECLARE
  next_val BIGINT;
  year_str TEXT;
  padded_num TEXT;
BEGIN
  next_val := nextval('order_number_seq');
  year_str := TO_CHAR(CURRENT_DATE, 'YYYY');
  padded_num := LPAD(next_val::TEXT, 6, '0');
  RETURN 'UO-' || year_str || '-' || padded_num;
END;
$$ LANGUAGE plpgsql;
```

### 2. Order Number Generator
**Datei:** `lib/utils/orderNumber.js`

**Funktionen:**
```javascript
generateOrderNumber()      // Ruft SQL function, Fallback bei Fehler
generateFallbackOrderNumber() // Timestamp-basiert (UO-YYYY-TNNNNNN)
generatePublicId(uuid)     // Substring der ersten 8 Zeichen
isValidOrderNumber(orderNumber) // Regex-Validierung
```

**Beispiele:**
- Normal: `UO-2026-000123`
- Fallback: `UO-2026-T123456`
- Public ID: `1243a009` (von UUID `1243a009-a080-4dc1-8cac-5e63ffd89f4c`)

### 3. Checkout API Updates
**Datei:** `pages/api/checkout/standard.js`

**Änderungen:**
1. Import von `generateOrderNumber` und `generatePublicId`
2. **KRITISCH:** UUID wird VOR Order-Erstellung generiert:
   ```javascript
   const orderId = randomUUID();
   const orderNumber = await generateOrderNumber();
   const publicId = generatePublicId(orderId);
   ```
3. Alle 3 IDs werden in `orderData` gespeichert:
   ```javascript
   const orderData = {
     id: orderId,              // Explicit UUID
     order_number: orderNumber,
     public_id: publicId,
     // ... rest
   };
   ```
4. **Stripe Metadata enthält ALLE IDs** (kritisch für Webhook):
   ```javascript
   metadata: {
     order_id: order.id,           // UUID - PRIMARY für Webhook
     order_number: order.order_number,
     public_id: order.public_id,
     // ... rest (customer_email, trace_id, snapshot_id, etc.)
   }
   ```

### 4. Webhook Updates
**Datei:** `pages/api/webhooks/stripe.js`

**Änderung:**
```javascript
// PRIORITY: Use metadata.order_id (UUID) - MOST RELIABLE
if (session.metadata?.order_id) {
  const { data: order } = await supabase
    .from('simple_orders')
    .eq('id', session.metadata.order_id)  // Direct UUID lookup
    .maybeSingle();
}

// FALLBACK: session_id lookup (für Legacy-Orders)
if (!order) {
  // ... existing session_id lookup code
}
```

**Vorteile:**
- ✅ Direkte UUID-Suche (indexed, O(1))
- ✅ Kein Spaltenname-Mismatch (stripe_session_id vs stripe_checkout_session_id)
- ✅ Garantiert eindeutig
- ✅ Fallback für alte Orders

### 5. Admin API Normalization
**Datei:** `pages/api/admin/orders/[id].js`

**Änderungen:**
```javascript
return res.status(200).json({
  ...simpleOrder,
  
  // ORDER IDENTIFICATION - All IDs normalized
  id: simpleOrder.id,
  order_number: simpleOrder.order_number,
  public_id: simpleOrder.public_id,
  
  // ... existing fields
  
  // DEBUG INFO - All identifiers
  _debug: {
    uuid: simpleOrder.id,
    order_number: simpleOrder.order_number || '(not set)',
    public_id: simpleOrder.public_id || '(not set)',
    stripe_session_id: simpleOrder.stripe_session_id || '(not set)',
    stripe_payment_intent: simpleOrder.stripe_payment_intent_id || '(not set)',
    trace_id: simpleOrder.trace_id || '(not set)',
    snapshot_id: simpleOrder.snapshot_id || '(not set)',
    has_snapshot: simpleOrder.has_snapshot || false,
    customer_id: simpleOrder.customer_id || '(not set)',
    created_at: simpleOrder.created_at,
  }
});
```

### 6. Admin UI Debug Panel
**Datei:** `pages/admin/orders/[id].js`

**Neues Feature:**
```javascript
{/* 🆔 ORDER IDENTIFIERS DEBUG PANEL */}
{order._debug && (
  <div className="info-card">
    <h2>🔍 Bestellnummern & IDs</h2>
    <div className="info-grid">
      <div>Bestellnummer: {order._debug.order_number} [📋 Kopieren]</div>
      <div>UUID: {order._debug.uuid} [📋]</div>
      <div>Public ID: {order._debug.public_id}</div>
      <div>Stripe Session: {order._debug.stripe_session_id}</div>
      <div>Trace ID: {order._debug.trace_id}</div>
      <div>Snapshot ID: {order._debug.snapshot_id}</div>
      <div>Pricing Snapshot: {has_snapshot ? '✅ Vorhanden' : '❌ Fehlt'}</div>
      // ... more
    </div>
  </div>
)}
```

**Header zeigt jetzt Order Number:**
```javascript
<div className="order-id">
  {order.order_number ? (
    <span style={{ color: '#0891b2', fontWeight: 'bold' }}>
      {order.order_number}
    </span>
  ) : (
    <span>ID: {order.id.substring(0, 8)}...</span>
  )}
</div>
```

## 🚀 Deployment Steps

### Step 1: Migration ausführen
```bash
# Option A: Supabase SQL Editor
1. Öffne Supabase Dashboard
2. SQL Editor
3. Kopiere gesamten Inhalt von supabase/migrations/015_add_order_number.sql
4. Führe aus
5. Verifiziere:
   SELECT column_name FROM information_schema.columns 
   WHERE table_name = 'simple_orders' 
   AND column_name IN ('order_number', 'public_id');

# Option B: Supabase CLI
supabase db push
```

**Erwartete Output:**
```
✅ Added order_number column to simple_orders
✅ Added public_id column to simple_orders
✅ Created sequence order_number_seq
✅ Created function get_next_order_number()
✅ Backfilled public_id for X existing orders
✅ Backfilled order_number for X existing orders
```

### Step 2: Code deployen
```bash
git add -A
git commit -m "FEAT: Unified order ID system - UUID + order_number + public_id

- Migration 015: order_number, public_id columns + sequence + SQL function
- Checkout: Generate all 3 IDs before order creation
- Stripe metadata: Include order_id (UUID), order_number, public_id
- Webhook: Prefer UUID lookup from metadata, fallback to session_id
- Admin API: Normalize all ID fields, add debug metadata
- Admin UI: Display all IDs in debug panel with copy buttons

Resolves: Order ID inconsistency, findability issues, 'Pricing Snapshot fehlt' due to ID confusion"

git push origin master
```

### Step 3: Vercel Deployment verifizieren
```bash
# Warte auf Vercel Deployment
# Prüfe Logs: https://vercel.com/your-project/deployments

# Verifiziere Environment Variables sind gesetzt:
- SUPABASE_URL
- SUPABASE_SERVICE_ROLE_KEY
- NEXT_PUBLIC_SUPABASE_URL
- NEXT_PUBLIC_SUPABASE_ANON_KEY
```

### Step 4: End-to-End Test
```bash
# 1. Erstelle Test-Order auf Production
- Gehe zu unbreak-one.vercel.app
- Füge Produkt zum Warenkorb
- Checkout durchlaufen

# 2. Prüfe Vercel Logs
- Suche nach "identifiers_generated"
- Erwarte:
  {
    order_id: "UUID",
    order_number: "UO-2026-000001",
    public_id: "8-char-id"
  }

# 3. Prüfe Datenbank
SELECT id, order_number, public_id, trace_id, snapshot_id, has_snapshot
FROM simple_orders 
ORDER BY created_at DESC 
LIMIT 1;

# Erwarte:
- id: volle UUID
- order_number: "UO-2026-000001" (oder nächste Sequenz)
- public_id: erste 8 Zeichen der UUID
- trace_id: gesetzt
- snapshot_id: gesetzt
- has_snapshot: true

# 4. Öffne Order in Admin
- Gehe zu /admin/orders/<uuid>
- Verifiziere Debug Panel zeigt alle IDs
- Teste "Kopieren" Buttons
- Verifiziere Bestellnummer prominent angezeigt

# 5. Teste Search (nach Implementierung)
- Suche nach order_number → findet Order
- Suche nach UUID → findet Order
- Suche nach public_id → findet Order
```

## 🔍 Troubleshooting

### Migration schlägt fehl
```bash
# Prüfe ob simple_orders Tabelle existiert
SELECT * FROM information_schema.tables WHERE table_name = 'simple_orders';

# Prüfe existierende Spalten
SELECT column_name FROM information_schema.columns WHERE table_name = 'simple_orders';

# Manuell aufräumen (falls nötig)
DROP SEQUENCE IF EXISTS order_number_seq CASCADE;
DROP FUNCTION IF EXISTS get_next_order_number() CASCADE;
ALTER TABLE simple_orders DROP COLUMN IF EXISTS order_number;
ALTER TABLE simple_orders DROP COLUMN IF EXISTS public_id;
```

### Neue Orders haben keine order_number
```bash
# Prüfe ob generateOrderNumber() funktioniert
SELECT get_next_order_number(); -- Sollte "UO-2026-000001" zurückgeben

# Prüfe Checkout Logs
# Suche nach "identifiers_generated" step
# Falls Fehler → Fallback "UO-YYYY-TNNNNNN" wird verwendet

# Prüfe Supabase Connection
# lib/utils/orderNumber.js verwendet SUPABASE_URL + ANON_KEY
```

### Webhook findet Order nicht
```bash
# Prüfe Stripe Metadata
# Dashboard → Payments → Session → Metadata
# Muss enthalten:
# - order_id (UUID)
# - order_number
# - public_id

# Prüfe Webhook Logs
# Suche nach "Looking for order..."
# Falls metadata.order_id fehlt → Legacy Fallback aktiv

# Prüfe simple_orders Tabelle
SELECT id, order_number, stripe_session_id 
FROM simple_orders 
WHERE stripe_session_id = 'cs_test_...';
```

### Admin zeigt keine IDs
```bash
# Prüfe API Response
curl -H "Cookie: next-auth.session-token=..." \
  https://unbreak-one.vercel.app/api/admin/orders/<uuid>

# Erwarte _debug Objekt in Response
# Falls fehlt → Admin API nicht deployed oder DB fehlen Spalten

# Prüfe Browser Console
# React sollte order._debug rendern
```

## ✅ Success Criteria

Nach erfolgreichem Deployment:

1. **Database:**
   - ✅ order_number Spalte existiert in simple_orders
   - ✅ public_id Spalte existiert in simple_orders
   - ✅ get_next_order_number() Function existiert
   - ✅ Alle bestehenden Orders haben backfilled order_number + public_id

2. **Neue Orders:**
   - ✅ Haben sequenzielle order_number (UO-2026-000001, 000002, ...)
   - ✅ Haben public_id (erste 8 chars der UUID)
   - ✅ Stripe metadata enthält order_id, order_number, public_id
   - ✅ trace_id und snapshot_id gesetzt
   - ✅ has_snapshot = true

3. **Webhook:**
   - ✅ Findet Orders über metadata.order_id (UUID)
   - ✅ Fallback auf session_id für Legacy-Orders funktioniert
   - ✅ "Pricing Snapshot fehlt" Fehler verschwindet

4. **Admin Panel:**
   - ✅ Header zeigt order_number prominent
   - ✅ Debug Panel zeigt alle IDs
   - ✅ Kopieren-Buttons funktionieren
   - ✅ trace_id, snapshot_id, has_snapshot werden angezeigt
   - ✅ Routing über /admin/orders/<uuid> funktioniert

5. **API:**
   - ✅ GET /api/admin/orders/<uuid> enthält _debug Objekt
   - ✅ Alle ID-Felder normalisiert
   - ✅ Response enthält order_number, public_id

## 📊 Monitoring

Nach Deployment überwachen:

```bash
# Vercel Logs - Prüfe auf Fehler
- Suche: "orderNumber" | "generateOrderNumber"
- Suche: "identifiers_generated"
- Suche: "metadata.order_id"

# Supabase Logs - Prüfe Sequence
SELECT currval('order_number_seq'); -- Aktuelle Sequenznummer

# Prüfe ob alle neuen Orders IDs haben
SELECT 
  COUNT(*) as total,
  COUNT(order_number) as with_order_number,
  COUNT(public_id) as with_public_id
FROM simple_orders
WHERE created_at > NOW() - INTERVAL '1 hour';
-- Erwarte: total = with_order_number = with_public_id

# Prüfe Stripe Metadata Vollständigkeit
SELECT 
  COUNT(*) as total,
  COUNT(*) FILTER (WHERE metadata ? 'order_id') as with_order_id,
  COUNT(*) FILTER (WHERE metadata ? 'order_number') as with_order_number
FROM stripe_sessions_log
WHERE created_at > NOW() - INTERVAL '1 hour';
```

## 🔮 Nächste Schritte (Optional)

### Multi-Field Search
**TODO:** Implementiere `/api/admin/orders/search?q=...`

```javascript
// pages/api/admin/orders/search.js
const { q } = req.query;
const { data } = await supabase
  .from('simple_orders')
  .select('*')
  .or(`
    order_number.ilike.%${q}%,
    id::text.ilike.%${q}%,
    public_id.ilike.%${q}%,
    stripe_session_id.ilike.%${q}%,
    customer_email.ilike.%${q}%
  `)
  .limit(20);
```

### Order Number in Customer Emails
**TODO:** Zeige order_number in Bestellbestätigungs-E-Mails

```javascript
// lib/email/orderConfirmation.js
<h2>Ihre Bestellung {orderNumber}</h2>
<p>Bestellnummer: {orderNumber}</p>
<p>Order ID: {publicId}</p>
```

### CSV Export mit allen IDs
**TODO:** Export enthält order_number, uuid, public_id

```javascript
// pages/api/admin/orders/export.js
const csv = orders.map(o => ({
  order_number: o.order_number,
  uuid: o.id,
  public_id: o.public_id,
  // ... rest
}));
```

---

**Deployment Checklist:**
- [ ] Migration 015 ausgeführt
- [ ] Code committed & pushed
- [ ] Vercel Deployment erfolgreich
- [ ] Test-Order erstellt
- [ ] IDs in DB verifiziert
- [ ] Admin Panel zeigt Debug Panel
- [ ] Webhook findet Order über UUID
- [ ] Keine "Pricing Snapshot fehlt" Fehler
