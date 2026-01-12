# Checkout Pricing Snapshot System

## Overview

The Pricing Snapshot System ensures **Single Source of Truth** for order pricing. The backend NEVER recalculates prices - it only displays the snapshot created during checkout.

**Version:** `unbreak-one.pricing.v1`  
**Deployed:** 2026-01-12  
**Build:** a104b56+

---

## Data Flow Diagram

```
┌─────────────┐
│   CLIENT    │
│  (Browser)  │
└──────┬──────┘
       │ 1. POST /api/checkout/standard
       │    { items: [...], email, trace_id }
       ▼
┌──────────────────────────────────────────────┐
│         CHECKOUT API                         │
│  /pages/api/checkout/standard.js             │
├──────────────────────────────────────────────┤
│ 1. Generate trace_id + snapshot_id           │
│ 2. Calculate pricing from DB (calcConfiguredPrice) │
│ 3. Create pricing_snapshot (v1)             │
│    - snapshot_id, trace_id, build_id        │
│    - items[] with config + pricing          │
│    - subtotal, shipping, tax, total         │
│ 4. Save to DB: simple_orders                │
│    - price_breakdown_json = snapshot        │
│    - metadata.pricing_snapshot = snapshot   │
│    - trace_id, snapshot_id                  │
│ 5. Create Stripe session                    │
│    - metadata: order_id, trace_id, snapshot_id │
│ 6. Return: { url, session_id, trace_id }    │
└──────────┬───────────────────────────────────┘
           │
           ▼
┌──────────────────────────────────────────────┐
│            STRIPE REDIRECT                   │
│  Customer completes payment                  │
└──────────┬───────────────────────────────────┘
           │
           ▼
┌──────────────────────────────────────────────┐
│       STRIPE WEBHOOK (future)                │
│  /pages/api/webhooks/stripe.js               │
├──────────────────────────────────────────────┤
│ Event: checkout.session.completed            │
│ 1. Find order by session_id → metadata      │
│ 2. Verify snapshot exists                   │
│ 3. Update order: status=paid                │
│ 4. If snapshot missing → status=payment_review │
└──────────┬───────────────────────────────────┘
           │
           ▼
┌──────────────────────────────────────────────┐
│         ADMIN PANEL READ                     │
│  /pages/admin/orders/[id].js                 │
├──────────────────────────────────────────────┤
│ 1. Read snapshot from:                       │
│    - order.price_breakdown_json (primary)    │
│    - order.metadata.pricing_snapshot (fallback) │
│ 2. Display totals from snapshot ONLY         │
│ 3. Show config (colors, finish) from snapshot │
│ 4. Legacy check:                             │
│    - No snapshot + created < 2026-01-12 → OK │
│    - No snapshot + created >= 2026-01-12 → ERROR │
└──────────────────────────────────────────────┘
```

---

## Database Schema

### `simple_orders` Table

```sql
-- Core fields
id UUID PRIMARY KEY
customer_user_id UUID
customer_email TEXT
status TEXT (pending, paid, failed, refunded, canceled)

-- Pricing Snapshot (SINGLE SOURCE OF TRUTH)
price_breakdown_json JSONB  -- Primary storage
metadata JSONB DEFAULT '{}'  -- Contains pricing_snapshot as fallback

-- Traceability
trace_id TEXT  -- Client/server correlation ID
snapshot_id TEXT  -- Unique snapshot identifier
stripe_session_id TEXT
stripe_payment_intent_id TEXT

-- Legacy
items JSONB  -- Cart items (without pricing)
total_amount_cents INTEGER

-- Timestamps
created_at TIMESTAMPTZ DEFAULT NOW()
updated_at TIMESTAMPTZ DEFAULT NOW()
```

---

## Pricing Snapshot Structure

```json
{
  "snapshot_id": "550e8400-e29b-41d4-a716-446655440000",
  "snapshot_version": "unbreak-one.pricing.v1",
  "trace_id": "client-generated-or-server-uuid",
  "pricing_source": "adminpanel_db",
  "build_id": "a104b56",
  "calculated_at": "2026-01-12T10:30:00.000Z",
  
  "items": [
    {
      "product_id": "glass_configurator",
      "sku": "glass_configurator",
      "name": "Glashalter – Konfigurator",
      "quantity": 1,
      "unit_price_cents": 5990,
      "line_total_cents": 5990,
      "is_configurator": true,
      "config": {
        "colors": {
          "base": "purple",
          "arm": "black",
          "module": "white",
          "pattern": "purple"
        },
        "finish": "matte",
        "variant": "glass_holder"
      },
      "pricing_breakdown": {
        "pricing_version": "2.0",
        "base_price_cents": 4990,
        "option_prices_cents": 1000,
        "custom_fee_cents": 0,
        "computed_subtotal_cents": 5990
      }
    }
  ],
  
  "subtotal_cents": 5990,
  "shipping_cents": 490,
  "shipping_country": "DE",
  "tax_cents": 0,
  "grand_total_cents": 6480,
  "currency": "EUR"
}
```

---

## Structured Logging (Steps)

All checkout operations log JSON with trace_id for correlation:

### Step 1: `checkout_start`
```json
{
  "step": "checkout_start",
  "trace_id": "uuid",
  "snapshot_id": "uuid",
  "build_id": "a104b56",
  "timestamp": "2026-01-12T10:30:00.000Z",
  "items_count": 1,
  "has_email": true
}
```

### Step 2: `snapshot_created`
```json
{
  "step": "snapshot_created",
  "trace_id": "uuid",
  "snapshot_id": "uuid",
  "items_count": 1,
  "subtotal_cents": 5990,
  "shipping_cents": 490,
  "grand_total_cents": 6480,
  "has_configurator_items": true,
  "configurator_colors": ["purple"]
}
```

### Step 3: `order_saved`
```json
{
  "step": "order_saved",
  "trace_id": "uuid",
  "order_id": "order-uuid",
  "table": "simple_orders",
  "snapshot_saved": true,
  "snapshot_in_price_breakdown": true,
  "snapshot_in_metadata": true
}
```

### Step 4: `stripe_session_created`
```json
{
  "step": "stripe_session_created",
  "trace_id": "uuid",
  "order_id": "order-uuid",
  "stripe_session_id": "cs_test_xxx",
  "stripe_amount_total": 6480,
  "expected_amount_cents": 6480,
  "amount_match": true
}
```

### Step 5: `checkout_success`
```json
{
  "step": "checkout_success",
  "trace_id": "uuid",
  "order_id": "order-uuid",
  "stripe_session_id": "cs_test_xxx",
  "session_url_length": 280
}
```

### Error Step: `checkout_error`
```json
{
  "step": "checkout_error",
  "trace_id": "uuid",
  "error_type": "StripeInvalidRequestError",
  "error_message": "Amount must be at least €0.50",
  "error_code": "amount_too_small"
}
```

### Warning Step: `WARNING_SNAPSHOT_NOT_SAVED`
```json
{
  "step": "WARNING_SNAPSHOT_NOT_SAVED",
  "trace_id": "uuid",
  "order_id": "order-uuid",
  "fields_checked": ["price_breakdown_json", "metadata.pricing_snapshot"]
}
```

---

## Debugging with Trace ID

### Example: Find all logs for a checkout attempt

1. **Get trace_id from response:**
```json
{
  "url": "https://checkout.stripe.com/...",
  "session_id": "cs_test_xxx",
  "order_id": "uuid",
  "trace_id": "550e8400-e29b-41d4-a716-446655440000"
}
```

2. **Search Vercel logs:**
```bash
# Filter by trace_id
trace_id: "550e8400-e29b-41d4-a716-446655440000"
```

3. **Expected log chain:**
```
Step 1: checkout_start
Step 2: snapshot_created
Step 3: order_saved (snapshot_saved=true)
Step 4: stripe_session_created
Step 5: checkout_success
```

4. **If snapshot missing:**
```
Step 3: order_saved (snapshot_saved=false)
Step 3b: WARNING_SNAPSHOT_NOT_SAVED
```

---

## Admin Panel Legacy Detection

### Logic
```javascript
const SNAPSHOT_ROLLOUT_DATE = new Date('2026-01-12');
const orderDate = new Date(order.created_at);
const isOldOrder = orderDate < SNAPSHOT_ROLLOUT_DATE;

if (!snapshot) {
  if (isOldOrder) {
    // Show: "⚠️ Legacy-Bestellung"
    // Display legacy items from order.items
  } else {
    // Show: "🚨 FEHLER: Pricing Snapshot fehlt!"
    // Display trace_id + snapshot_id for debugging
    // Order should be in payment_review status
  }
}
```

### Expected Behavior

**Old Orders (before 2026-01-12):**
- No snapshot → Yellow "Legacy" banner
- Display items from `order.items`
- Use Stripe `amount_total` for totals

**New Orders (after 2026-01-12):**
- Has snapshot → Display from snapshot, NO banner
- No snapshot → Red "ERROR" banner with trace_id

---

## Error Handling

### Missing Snapshot on New Order

**Checkout API:**
```javascript
if (!snapshotSaved) {
  log('WARNING_SNAPSHOT_NOT_SAVED', { order_id });
}
```

**Webhook (future):**
```javascript
if (!order.price_breakdown_json && !order.metadata?.pricing_snapshot) {
  await supabase
    .from('simple_orders')
    .update({ status: 'payment_review' })
    .eq('id', order.id);
  
  log('SNAPSHOT_MISSING_ON_FINALIZE', {
    order_id,
    trace_id: order.trace_id,
    snapshot_id: order.snapshot_id,
  });
}
```

**Admin Panel:**
- Display error banner with trace_id
- Do NOT treat as normal legacy order
- Do NOT recalculate pricing

---

## Acceptance Criteria

### ✅ New Test Order (after deployment)

**Database Check:**
```sql
SELECT 
  id,
  trace_id,
  snapshot_id,
  price_breakdown_json IS NOT NULL as has_snapshot,
  (price_breakdown_json->>'snapshot_version')::text as version,
  (price_breakdown_json->>'grand_total_cents')::int as total_cents,
  created_at
FROM simple_orders
WHERE id = 'test-order-uuid';
```

Expected:
```
has_snapshot: true
version: unbreak-one.pricing.v1
total_cents: 6480
```

**Admin Panel Check:**
- ❌ NO "Legacy-Bestellung" banner
- ✅ Shows config colors (e.g., "Base: Lila")
- ✅ Shows subtotal, shipping, tax separately
- ✅ Total matches Stripe amount_total (cent-exact)

**Log Chain:**
```
checkout_start → snapshot_created → order_saved (snapshot_saved=true) 
→ stripe_session_created → checkout_success
```

### ❌ Missing Snapshot (error case)

**Admin Panel:**
- Shows: "🚨 FEHLER: Pricing Snapshot fehlt!"
- Displays: trace_id, snapshot_id, order_id
- Status should be: `payment_review`

**Log Chain:**
```
checkout_start → snapshot_created → order_saved (snapshot_saved=false)
→ WARNING_SNAPSHOT_NOT_SAVED
```

---

## Migration & Rollout

**Deployment Date:** 2026-01-12  
**Commits:**
- `a104b56` - Store snapshot in price_breakdown_json
- `4505bb1` - Dual-mode pricing API
- `[CURRENT]` - Trace ID + structured logging + admin fix

**Before Rollout:**
- ✅ DB has `price_breakdown_json` column
- ✅ DB has `trace_id` and `snapshot_id` columns (add if missing)

**After Rollout:**
- All new orders have snapshots
- Old orders (before 2026-01-12) show as legacy (acceptable)
- New orders without snapshot trigger error banner

---

## Future Enhancements

1. **Webhook Integration:**
   - Verify snapshot on `checkout.session.completed`
   - Set `status=payment_review` if missing

2. **Admin Snapshot Viewer:**
   - JSON viewer for `price_breakdown_json`
   - Compare Stripe amount vs snapshot total

3. **Snapshot Validation:**
   - Schema validation on creation
   - Checksum/hash for integrity

4. **Metrics:**
   - Track % orders with snapshots
   - Alert if snapshot save rate < 100%

---

## Contact & Support

**Trace ID Issues:**
Search logs with: `trace_id: "uuid"`

**Snapshot Missing:**
Check DB: `SELECT price_breakdown_json FROM simple_orders WHERE id = 'uuid'`

**Admin Errors:**
Verify rollout date: `SNAPSHOT_ROLLOUT_DATE = 2026-01-12`
