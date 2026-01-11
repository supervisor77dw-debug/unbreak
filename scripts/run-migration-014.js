/**
 * Run migration 014 - Create config_sessions table
 * 
 * Usage: node scripts/run-migration-014.js
 */

import { getSupabaseAdmin } from '../lib/supabase.js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function runMigration() {
  console.log('🔄 Running migration 014: Create config_sessions table...\n');

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    throw new Error('❌ Supabase admin client not available');
  }

  // Read migration SQL
  const migrationPath = join(__dirname, '../supabase/migrations/014_create_config_sessions.sql');
  const sql = readFileSync(migrationPath, 'utf-8');

  console.log('📄 Migration SQL loaded');
  console.log('=' .repeat(60));

  try {
    // Execute migration
    const { data, error } = await supabase.rpc('exec_sql', { sql_string: sql });

    if (error) {
      // Try direct execution if RPC doesn't exist
      console.log('⚠️  RPC not available, trying direct execution...');
      
      // Split by semicolon and execute each statement
      const statements = sql
        .split(';')
        .map(s => s.trim())
        .filter(s => s.length > 0 && !s.startsWith('--'));

      for (const statement of statements) {
        const { error: execError } = await supabase.rpc('exec', { query: statement });
        if (execError) {
          console.error('❌ Statement failed:', statement.substring(0, 100) + '...');
          throw execError;
        }
      }
    }

    console.log('✅ Migration 014 completed successfully!\n');
    
    // Verify table exists
    const { data: tables, error: verifyError } = await supabase
      .from('config_sessions')
      .select('session_id')
      .limit(0);

    if (verifyError) {
      console.warn('⚠️  Warning: Could not verify table creation:', verifyError.message);
    } else {
      console.log('✅ Table config_sessions verified');
    }

    console.log('\n📊 Next steps:');
    console.log('1. Deploy updated API endpoints');
    console.log('2. Test session creation: POST /api/config-session');
    console.log('3. Test session retrieval: GET /api/config-session/[id]');
    console.log('4. Test debug endpoint: GET /api/config-session-debug/[id]');

  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    console.error('Error details:', error.message);
    process.exit(1);
  }
}

runMigration().catch(console.error);
