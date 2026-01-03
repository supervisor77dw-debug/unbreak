# MIGRATION 012 - MANUAL EXECUTION GUIDE

## Problem
Customer fields missing in `orders` table. Migration 012 exists in code but was never applied to production database.

## Evidence
```
❌ customer_email - column does not exist
❌ customer_name - column does not exist  
❌ customer_phone - column does not exist
❌ stripe_customer_id - column does not exist
❌ billing_address - column does not exist
```

## Solution: Run Migration Manually

### Option 1: Via Supabase Dashboard (RECOMMENDED)

1. Go to: https://supabase.com/dashboard/project/YOUR_PROJECT/sql

2. Copy the entire SQL from: `supabase/migrations/012_extend_orders_customer_fields.sql`

3. Paste into SQL Editor

4. Click "Run"

5. Verify success:
   ```sql
   SELECT column_name 
   FROM information_schema.columns 
   WHERE table_name = 'orders' 
   AND table_schema = 'public'
   AND column_name IN (
     'customer_email',
     'customer_name',
     'customer_phone',
     'stripe_customer_id',
     'billing_address'
   );
   ```
   
   Should return all 5 columns.

### Option 2: Via Script

```bash
node scripts/run-migration-012.js
```

This script will:
- Read the migration SQL file
- Execute it via Supabase API
- Verify columns exist
- Show success/failure status

## After Migration

1. **Verify Schema:**
   ```bash
   node scripts/diagnose-customers.js
   ```
   
   Should now show:
   ```
   ✅ customer_email
   ✅ customer_name
   ✅ customer_phone
   ✅ stripe_customer_id
   ✅ billing_address
   ```

2. **Run Backfill:**
   ```bash
   node scripts/run-backfill.js
   ```
   
   This will:
   - Fetch existing orders
   - Get Stripe customer data
   - Populate customer fields
   - Link orders to customers

3. **Create Test Order:**
   - Go to shop
   - Add product to cart
   - Complete checkout
   - Verify customer appears in `/admin/customers`

## Expected Results

After successful migration + backfill:

- ✅ `customers` table populated from existing orders
- ✅ New orders automatically create/link customers
- ✅ Webhook syncs customer data from Stripe
- ✅ Admin panel shows customers list
- ✅ Customer details page works

## Rollback

If migration causes issues (unlikely), rollback with:

```sql
-- Remove added columns from orders
ALTER TABLE public.orders 
  DROP COLUMN IF EXISTS stripe_customer_id,
  DROP COLUMN IF EXISTS customer_email,
  DROP COLUMN IF EXISTS customer_name,
  DROP COLUMN IF EXISTS customer_phone,
  DROP COLUMN IF EXISTS billing_address;

-- Remove added columns from simple_orders  
ALTER TABLE public.simple_orders
  DROP COLUMN IF EXISTS stripe_customer_id,
  DROP COLUMN IF EXISTS customer_name,
  DROP COLUMN IF EXISTS customer_phone,
  DROP COLUMN IF EXISTS shipping_address,
  DROP COLUMN IF EXISTS billing_address;
```

## Why This Happened

Migration file exists in codebase but Supabase doesn't auto-run local migration files. They must be:
1. Pushed to Supabase via CLI (`supabase db push`), OR
2. Run manually via Dashboard SQL Editor, OR
3. Executed programmatically via script

Since we don't have Supabase CLI configured, manual execution is required.

## Prevention

For future migrations:
1. Document migration in commit message
2. Add to deployment checklist
3. Verify in production after deploy
4. Consider adding migration status check to health endpoint
