/**
 * Database Health Check
 * Verifies critical tables exist
 */

import { getSupabaseAdmin } from './supabase';

export interface HealthCheck {
  healthy: boolean;
  tables: Record<string, boolean>;
  errors: string[];
}

export async function checkDatabaseHealth(): Promise<HealthCheck> {
  const supabase = getSupabaseAdmin();
  const requiredTables = ['profiles', 'products'];
  
  const results: Record<string, boolean> = {};
  const errors: string[] = [];

  for (const table of requiredTables) {
    try {
      const { error } = await supabase
        .from(table)
        .select('id')
        .limit(1);

      results[table] = !error;

      if (error) {
        errors.push(`Table '${table}': ${error.message}`);
      }
    } catch (err: any) {
      results[table] = false;
      errors.push(`Table '${table}': ${err.message}`);
    }
  }

  const healthy = Object.values(results).every(v => v);

  return { healthy, tables: results, errors };
}

export async function logHealthStatus() {
  const health = await checkDatabaseHealth();

  if (!health.healthy) {
    console.error('❌ DATABASE NOT INITIALIZED');
    console.error('Missing tables:', Object.entries(health.tables)
      .filter(([, exists]) => !exists)
      .map(([name]) => name)
      .join(', '));
    console.error('');
    console.error('🔧 To fix, run migrations:');
    console.error('   1. Via API: POST /api/admin/bootstrap');
    console.error('   2. Via SQL: Execute files in supabase/migrations/');
    console.error('   3. Via Supabase CLI: supabase db push');
    console.error('');
    console.error('Errors:', health.errors);
  } else {
    console.log('✅ Database tables verified');
  }

  return health;
}
