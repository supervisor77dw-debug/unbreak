-- Check actual schema of orders and simple_orders
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema='public' AND table_name IN ('orders','simple_orders')
ORDER BY table_name, ordinal_position;
