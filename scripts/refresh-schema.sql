-- Force PostgREST to reload schema cache
-- Run this in Supabase SQL Editor

-- Method 1: Notify PostgREST to reload
NOTIFY pgrst, 'reload schema';

-- Method 2: Or use the helper function (if available)
-- SELECT extensions.notify_api_restart();

-- Verify columns exist
SELECT 
  table_name, 
  column_name, 
  data_type 
FROM information_schema.columns 
WHERE table_name = 'customers' 
  AND table_schema = 'public'
ORDER BY ordinal_position;
