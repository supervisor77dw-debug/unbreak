# 🚨 URGENT: Add Missing Columns to Customers Table

## Problem
Webhook fails with:
```
Could not find the 'default_billing' column of 'customers' in the schema cache
```

**Root Cause:** Columns `default_shipping` and `default_billing` do NOT exist in production database.

## Solution: Run SQL in Supabase

**Go to Supabase Dashboard → SQL Editor → New Query → Paste this:**

```sql
-- Add missing columns to customers table
ALTER TABLE public.customers 
ADD COLUMN IF NOT EXISTS default_shipping JSONB,
ADD COLUMN IF NOT EXISTS default_billing JSONB;

-- Verify columns were added
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'customers' 
  AND column_name IN ('default_shipping', 'default_billing');

-- Should show:
-- default_shipping | jsonb
-- default_billing  | jsonb
```

**Click RUN** → Should see "Success. No rows returned"

## Then Test Again

1. Wait 10 seconds (schema cache refresh)
2. Do new checkout test
3. Check webhook logs - should show:
   ```
   ✅ [CUSTOMER SYNC] Customer synced - ID: ...
   ✅ [CUSTOMER SYNC] Order linked to customer
   ```

## Verify Fix Worked

Run locally:
```bash
node scripts/check-customer-schema.js
```

Should show: `✅ COLUMNS EXIST!`

---

**Why did this happen?**

Migration `008_create_customers_extended.sql` uses `CREATE TABLE IF NOT EXISTS`.  
If table already existed (from earlier migration), columns were not added.

**Prevention:** Always use `ADD COLUMN IF NOT EXISTS` in migrations.
