-- Add config_json column to admin_orders table if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'admin_orders' 
        AND column_name = 'config_json'
    ) THEN
        ALTER TABLE public.admin_orders 
        ADD COLUMN config_json JSONB;
        
        RAISE NOTICE 'Column config_json added to admin_orders table';
    ELSE
        RAISE NOTICE 'Column config_json already exists in admin_orders table';
    END IF;
END $$;
