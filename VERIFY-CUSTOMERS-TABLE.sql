-- Run this in Supabase SQL Editor to verify customers table

-- 1. Check if table exists
SELECT table_name, table_schema
FROM information_schema.tables
WHERE table_name = 'customers';

-- 2. Check all columns
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'customers'
  AND table_schema = 'public'
ORDER BY ordinal_position;

-- 3. Check if table is in public schema with correct grants
SELECT grantee, privilege_type
FROM information_schema.role_table_grants
WHERE table_name = 'customers'
  AND table_schema = 'public';

-- 4. If table doesn't exist or is broken, recreate it
-- ONLY RUN IF ABOVE SHOWS NO RESULTS:

DROP TABLE IF EXISTS public.customers CASCADE;

CREATE TABLE public.customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stripe_customer_id TEXT UNIQUE,
  email TEXT NOT NULL UNIQUE,
  name TEXT,
  phone TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Grant access
GRANT ALL ON public.customers TO postgres, anon, authenticated, service_role;

-- Enable RLS
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

-- Allow service role to do everything
CREATE POLICY "Service role can do everything"
  ON public.customers
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Refresh schema
NOTIFY pgrst, 'reload schema';

-- Verify it worked
SELECT column_name FROM information_schema.columns WHERE table_name = 'customers';
