# 🚨 MIGRATION 012 - SOFORT AUSFÜHREN

## Problem
**Customer fields fehlen komplett in production database!**

```
❌ orders.customer_email - does not exist
❌ orders.customer_name - does not exist  
❌ orders.customer_phone - does not exist
❌ orders.stripe_customer_id - does not exist
❌ orders.billing_address - does not exist
```

**Beweis:** `node scripts/diagnose-customers.js`

## Lösung: Migration JETZT ausführen

### SCHRITT 1: Supabase Dashboard öffnen

https://supabase.com/dashboard/project/qnzsdytdghfukrqpscsg/sql/new

### SCHRITT 2: SQL kopieren & ausführen

**Komplettes SQL (Copy-Paste in SQL Editor):**

```sql
-- =====================================================
-- Migration 012: Extend Orders with Customer Fields
-- =====================================================
-- Description: Adds customer data fields to orders/simple_orders
--              for better webhook sync and customer management
-- =====================================================

-- 1) Add missing customer fields to public.orders
DO $$
BEGIN
  -- stripe_customer_id (if not exists)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'orders' 
    AND column_name = 'stripe_customer_id'
    AND table_schema = 'public'
  ) THEN
    ALTER TABLE public.orders ADD COLUMN stripe_customer_id TEXT;
    CREATE INDEX idx_orders_stripe_customer_id ON public.orders(stripe_customer_id);
  END IF;

  -- customer_email (if not exists)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'orders' 
    AND column_name = 'customer_email'
    AND table_schema = 'public'
  ) THEN
    ALTER TABLE public.orders ADD COLUMN customer_email TEXT;
    CREATE INDEX idx_orders_customer_email ON public.orders(customer_email);
  END IF;

  -- customer_name (if not exists)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'orders' 
    AND column_name = 'customer_name'
    AND table_schema = 'public'
  ) THEN
    ALTER TABLE public.orders ADD COLUMN customer_name TEXT;
  END IF;

  -- customer_phone (if not exists)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'orders' 
    AND column_name = 'customer_phone'
    AND table_schema = 'public'
  ) THEN
    ALTER TABLE public.orders ADD COLUMN customer_phone TEXT;
  END IF;

  -- billing_address (if not exists)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'orders' 
    AND column_name = 'billing_address'
    AND table_schema = 'public'
  ) THEN
    ALTER TABLE public.orders ADD COLUMN billing_address JSONB;
  END IF;
END $$;

-- 2) Add missing customer fields to public.simple_orders
DO $$
BEGIN
  -- stripe_customer_id (already added in migration 008, but ensure it exists)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'simple_orders' 
    AND column_name = 'stripe_customer_id'
    AND table_schema = 'public'
  ) THEN
    ALTER TABLE public.simple_orders ADD COLUMN stripe_customer_id TEXT;
    CREATE INDEX idx_simple_orders_stripe_customer_id ON public.simple_orders(stripe_customer_id);
  END IF;

  -- customer_name (if not exists)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'simple_orders' 
    AND column_name = 'customer_name'
    AND table_schema = 'public'
  ) THEN
    ALTER TABLE public.simple_orders ADD COLUMN customer_name TEXT;
  END IF;

  -- customer_phone (if not exists)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'simple_orders' 
    AND column_name = 'customer_phone'
    AND table_schema = 'public'
  ) THEN
    ALTER TABLE public.simple_orders ADD COLUMN customer_phone TEXT;
  END IF;

  -- shipping_address (if not exists)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'simple_orders' 
    AND column_name = 'shipping_address'
    AND table_schema = 'public'
  ) THEN
    ALTER TABLE public.simple_orders ADD COLUMN shipping_address JSONB;
  END IF;

  -- billing_address (if not exists)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'simple_orders' 
    AND column_name = 'billing_address'
    AND table_schema = 'public'
  ) THEN
    ALTER TABLE public.simple_orders ADD COLUMN billing_address JSONB;
  END IF;
END $$;

-- 3) Rename old columns if they exist (backward compatibility)
DO $$
BEGIN
  -- Rename default_shipping to shipping_address in orders (if exists)
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'orders' 
    AND column_name = 'default_shipping'
    AND table_schema = 'public'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'orders' 
    AND column_name = 'shipping_address'
    AND table_schema = 'public'
  ) THEN
    ALTER TABLE public.orders RENAME COLUMN default_shipping TO shipping_address;
  END IF;

  -- Rename default_billing to billing_address in orders (if exists)
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'orders' 
    AND column_name = 'default_billing'
    AND table_schema = 'public'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'orders' 
    AND column_name = 'billing_address'
    AND table_schema = 'public'
  ) THEN
    ALTER TABLE public.orders RENAME COLUMN default_billing TO billing_address;
  END IF;
END $$;

-- 4) Success message
DO $$
BEGIN
  RAISE NOTICE 'Migration 012 completed successfully';
  RAISE NOTICE 'Customer fields added to orders and simple_orders';
END $$;
```

### SCHRITT 3: Verify Success

Nach Ausführung diese Query laufen lassen:

```sql
-- Verify columns exist
SELECT column_name, data_type
FROM information_schema.columns 
WHERE table_name = 'orders' 
AND table_schema = 'public'
AND column_name IN (
  'customer_email',
  'customer_name',
  'customer_phone',
  'stripe_customer_id',
  'billing_address',
  'shipping_address'
)
ORDER BY column_name;
```

**Erwartetes Ergebnis (6 rows):**
```
billing_address    | jsonb
customer_email     | text
customer_name      | text
customer_phone     | text
shipping_address   | jsonb
stripe_customer_id | text
```

### SCHRITT 4: Backfill ausführen

Nach erfolgreicher Migration:

```bash
node scripts/run-backfill.js
```

Das wird:
- Existierende Orders scannen
- Stripe Customer-Daten holen
- Customer-Tabelle befüllen
- Orders mit Customers verlinken

### SCHRITT 5: Verify Customers

```bash
node scripts/diagnose-customers.js
```

Sollte zeigen:
```
✅ Total customers: 12 (oder mehr)
✅ customer_email exists
✅ customer_name exists
...
```

## Akzeptanzkriterium

✅ Migration 012 erfolgreich ausgeführt  
✅ Alle 6 customer fields in orders vorhanden  
✅ Backfill erstellt customers aus orders  
✅ Admin Panel zeigt customers Liste  
✅ Neuer Test-Checkout erstellt customer automatisch  

## Warum ist das passiert?

Migration file existiert im Code seit Commit f65ba96, aber Supabase führt lokale Migrations nicht automatisch aus. Sie müssen manuell via Dashboard oder CLI gepusht werden.

**Fix für Zukunft:** Immer nach Deployment prüfen, dass Migrations applied sind.
