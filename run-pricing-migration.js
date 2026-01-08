require('dotenv').config({ path: '.env.local' });
require('dotenv').config({ path: '.env' });

const fs = require('fs');
const { Client } = require('pg');

async function runMigration() {
  const databaseUrl = process.env.DIRECT_URL || process.env.DATABASE_URL;
  
  if (!databaseUrl) {
    console.error('❌ No DATABASE_URL or DIRECT_URL found in environment');
    process.exit(1);
  }

  const client = new Client({ connectionString: databaseUrl });

  try {
    await client.connect();
    console.log('✅ Connected to database\n');

    const sql = fs.readFileSync('migrations/add-pricing-config-table.sql', 'utf8');
    
    console.log('🔄 Running migration...\n');
    await client.query(sql);
    
    console.log('✅ Migration completed successfully!');
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

runMigration();
