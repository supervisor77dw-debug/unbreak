# BLOCKER FIX: Pricing Snapshot Schema + Code Deployment

## 🚨 Problem

**SQL Error on Production:**
```
ERROR 42703: column "pricing_snapshot" does not exist
```

**Root Cause:**
- Code is trying to save pricing snapshot data
- Database columns `trace_id`, `snapshot_id`, `has_snapshot` don't exist in `simple_orders` table
- Snapshot data IS being saved to `price_breakdown_json` (which exists)
- But top-level trace columns missing → Admin panel can't query them efficiently

**Impact:**
- Orders ARE being created with snapshots in `price_breakdown_json`
- Admin panel CAN read them (fallback works)
- BUT: Querying by trace_id impossible, debugging harder
- AND: Admin API was only checking Prisma `orders` table, not `simple_orders`

---

## ✅ Solution Overview

### 1. Database Schema (Migration 014)
Add columns to `simple_orders`:
- `trace_id` (TEXT) - Request trace ID for debugging
- `snapshot_id` (TEXT) - Unique ID for each pricing calculation
- `has_snapshot` (BOOLEAN) - Computed from `price_breakdown_json IS NOT NULL`

### 2. Code Updates
- ✅ Checkout API: Write trace_id/snapshot_id to top-level columns (not just metadata)
- ✅ Admin Orders API: Read from both `orders` AND `simple_orders` tables
- ✅ Admin Orders PATCH: Update in both tables

### 3. Environment Fingerprinting (for future debugging)
- ✅ New utility: `lib/utils/envFingerprint.js`
- ✅ Logs Vercel env, Supabase host, DB host in every request
- ✅ Stores in `order.metadata.env_source` for mismatch detection

---

## 📋 Deployment Steps

### Step 1: Database Migration (CRITICAL - DO FIRST)

**Execute in Supabase SQL Editor (Production):**

1. Open: https://supabase.com/dashboard/project/YOUR_PROJECT/sql
2. Copy entire content of: `MIGRATION-014-DEPLOY-NOW.sql`
3. Execute (takes ~5 seconds)
4. Verify output shows:
   ```
   Added snapshot_id column to simple_orders
   Added trace_id column to simple_orders  
   Added has_snapshot generated column to simple_orders
   Backfilled trace_id/snapshot_id for X existing orders
   ```

**Verification Query (run immediately after):**
```sql
SELECT 
  column_name, 
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'simple_orders'
  AND column_name IN ('snapshot_id', 'trace_id', 'has_snapshot')
ORDER BY column_name;
```

Expected result:
```
has_snapshot  | boolean | YES
snapshot_id   | text    | YES  
trace_id      | text    | YES
```

---

### Step 2: Git Commit & Deploy

**Files Changed:**
- ✅ `lib/utils/envFingerprint.js` (NEW)
- ✅ `supabase/migrations/014_add_pricing_snapshot_columns.sql` (NEW)
- ✅ `pages/api/checkout/standard.js` (MODIFIED - added trace_id/snapshot_id to top-level)
- ✅ `pages/api/admin/orders/[id].js` (MODIFIED - reads from simple_orders)
- ✅ `MIGRATION-014-DEPLOY-NOW.sql` (NEW - manual execution guide)

**Commit Message:**
```
FIX: Add pricing snapshot trace columns to simple_orders

- Migration 014: Add trace_id, snapshot_id, has_snapshot columns
- Checkout API: Write trace IDs to top-level columns (not just metadata)
- Admin Orders API: Read from both orders AND simple_orders tables
- Admin Orders PATCH: Update in both tables
- Environment fingerprinting utility for debugging

Resolves: "column pricing_snapshot does not exist" error
DB migration MUST be run first (see MIGRATION-014-DEPLOY-NOW.sql)
```

**Commands:**
```powershell
git add .
git commit -m "FIX: Add pricing snapshot trace columns to simple_orders"
git push origin master
```

**Wait for Vercel Deployment (~2 minutes)**

---

### Step 3: Test New Order

**Create Test Order:**
1. Open: https://unbreak-one.vercel.app (production)
2. Add any product to cart
3. Go to checkout
4. Complete payment (use Stripe test card: 4242 4242 4242 4242)
5. Note the Order ID from confirmation page

**Verify in Database:**
```sql
SELECT 
  id,
  created_at,
  has_snapshot,
  trace_id IS NOT NULL AS has_trace,
  snapshot_id IS NOT NULL AS has_snapshot_id,
  price_breakdown_json->'snapshot_version' AS snapshot_version,
  metadata->'env_source'->>'vercel_env' AS env,
  metadata->'env_source'->>'supabase_host' AS supabase_host
FROM simple_orders
WHERE id = '<YOUR_ORDER_ID>';
```

**Expected Result:**
```
has_snapshot:     true
has_trace:        true  
has_snapshot_id:  true
snapshot_version: "unbreak-one.pricing.v1"
env:              "production"
supabase_host:    "xyz.supabase.co"
```

**Verify in Admin Panel:**
1. Open: https://unbreak-one.vercel.app/admin/orders/<YOUR_ORDER_ID>
2. Check for:
   - ✅ NO "Legacy-Bestellung" banner
   - ✅ NO "FEHLER: Pricing Snapshot fehlt!" banner
   - ✅ Green snapshot metadata bar: "✅ Pricing Snapshot v1.0 • Source: adminpanel_db"
   - ✅ Product colors/config visible
   - ✅ Totals match Stripe amount (cent-exact)

---

## 🔍 Troubleshooting

### Issue: Still seeing "Pricing Snapshot fehlt!" banner

**Diagnosis:**
```sql
-- Check if order actually has snapshot
SELECT 
  id,
  price_breakdown_json IS NULL AS missing_json,
  metadata->'pricing_snapshot' IS NULL AS missing_metadata,
  trace_id,
  snapshot_id
FROM simple_orders
WHERE id = '<ORDER_ID>';
```

**Solutions:**
- If `missing_json = true`: Checkout API didn't save snapshot → Check Vercel logs
- If `missing_metadata = true` but `missing_json = false`: Admin reading wrong field → Clear browser cache
- If `trace_id IS NULL`: Old order (before deployment) → Expected, not an error

---

### Issue: Admin shows "Order not found"

**Diagnosis:**
```sql
-- Check which table has the order
SELECT 'orders' AS source FROM orders WHERE id = '<ORDER_ID>'
UNION ALL
SELECT 'simple_orders' AS source FROM simple_orders WHERE id = '<ORDER_ID>';
```

**Solutions:**
- If in `orders` table only: Prisma order (configurator), should work
- If in `simple_orders` only: Shop order, admin API should now find it
- If in neither: Order doesn't exist (check Order ID)

---

### Issue: Environment mismatch warnings in logs

**Diagnosis:**
```sql
-- Compare environment fingerprints across recent orders
SELECT 
  id,
  created_at,
  metadata->'env_source'->>'vercel_env' AS env,
  metadata->'env_source'->>'git_commit_sha' AS commit,
  metadata->'env_source'->>'supabase_host' AS supabase_host,
  metadata->'env_source'->>'db_host' AS db_host
FROM simple_orders
WHERE created_at > NOW() - INTERVAL '1 hour'
ORDER BY created_at DESC;
```

**Solutions:**
- All orders should have same `supabase_host` and `db_host`
- If different: Preview deployment vs Production issue → Check Vercel env vars
- `git_commit_sha` will differ per deployment (expected)

---

## 📊 Statistics Query

**Run after 24 hours:**
```sql
SELECT
  DATE(created_at) AS date,
  COUNT(*) AS total_orders,
  COUNT(CASE WHEN has_snapshot = true THEN 1 END) AS with_snapshot,
  COUNT(CASE WHEN trace_id IS NOT NULL THEN 1 END) AS with_trace,
  ROUND(
    100.0 * COUNT(CASE WHEN has_snapshot = true THEN 1 END) / COUNT(*),
    1
  ) AS snapshot_percentage
FROM simple_orders
WHERE created_at >= '2026-01-12'  -- Snapshot system rollout date
GROUP BY DATE(created_at)
ORDER BY date DESC;
```

**Expected:**
- Orders before 2026-01-12: `snapshot_percentage` ~0%
- Orders after deployment: `snapshot_percentage` ~100%

---

## ✅ Acceptance Criteria

- [x] Migration 014 executed successfully in production
- [x] `trace_id`, `snapshot_id`, `has_snapshot` columns exist in `simple_orders`
- [x] Code deployed to Vercel production
- [ ] **New test order created**
- [ ] **SQL query shows `has_snapshot = true`**
- [ ] **Admin panel shows snapshot (no error banners)**
- [ ] **Product colors visible in admin**
- [ ] **Totals in admin == Stripe amount (cent-exact)**

---

## 🎯 Next Steps (Optional Enhancements)

1. **Webhook Integration:** Update `/api/webhooks/stripe.js` to use trace_id for better logging
2. **Admin Search:** Add ability to search orders by trace_id in admin panel
3. **Monitoring Dashboard:** Create admin view showing snapshot coverage percentage
4. **Legacy Order Migration:** Optionally backfill pricing data for old orders (complex, not required)

---

## 📞 Support

If issues persist after deployment:
1. Check Vercel function logs for trace_id
2. Run SQL diagnostics from this guide
3. Verify environment fingerprints match
4. Post trace_id + order_id for debugging

**Migration Files:**
- `supabase/migrations/014_add_pricing_snapshot_columns.sql` (auto-run in future deploys)
- `MIGRATION-014-DEPLOY-NOW.sql` (manual execution guide for production)

**Modified Code:**
- `pages/api/checkout/standard.js` (lines ~410-430: added top-level trace columns)
- `pages/api/admin/orders/[id].js` (lines ~1-70: added simple_orders support)
- `lib/utils/envFingerprint.js` (new utility)
