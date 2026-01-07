import pkg from 'pg';
const { Client } = pkg;
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

// Parse DATABASE_URL
const dbUrl = process.env.DIRECT_URL || process.env.DATABASE_URL;

async function addColumn() {
  const client = new Client({
    connectionString: dbUrl,
  });

  try {
    await client.connect();
    console.log('✅ Connected to database');

    const sql = `
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
              RAISE NOTICE 'Column config_json already exists';
          END IF;
      END $$;
    `;

    await client.query(sql);
    console.log('✅ Migration completed successfully!');
    
    // Verify
    const { rows } = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'admin_orders' 
      AND column_name = 'config_json'
    `);
    
    if (rows.length > 0) {
      console.log('✅ Verified: config_json column exists', rows[0]);
    } else {
      console.log('⚠️  Column not found in verification');
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await client.end();
  }
}

addColumn();
