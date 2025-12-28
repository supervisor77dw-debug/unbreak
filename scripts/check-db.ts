#!/usr/bin/env tsx

/**
 * Database Health Check Script
 * Run: npm run db:check
 * 
 * Verifies database tables exist
 */

import { checkDatabaseHealth } from '../lib/health-check';
import { hasAdminUser } from '../lib/supabase-bootstrap';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(process.cwd(), '.env.local') });

async function main() {
  console.log('╔════════════════════════════════════════╗');
  console.log('║   UNBREAK ONE - Database Check        ║');
  console.log('╚════════════════════════════════════════╝\n');

  const health = await checkDatabaseHealth();

  console.log('📊 Table Status:');
  for (const [table, exists] of Object.entries(health.tables)) {
    console.log(`   ${exists ? '✅' : '❌'} ${table}`);
  }

  if (health.errors.length > 0) {
    console.log('\n⚠️  Errors:');
    health.errors.forEach(err => console.log(`   - ${err}`));
  }

  const adminExists = await hasAdminUser();
  console.log(`\n👤 Admin user: ${adminExists ? '✅ exists' : '❌ not found'}`);

  if (!health.healthy) {
    console.log('\n❌ DATABASE NOT READY');
    console.log('\n🔧 To fix, run:');
    console.log('   npm run db:bootstrap\n');
    process.exit(1);
  } else {
    console.log('\n✅ DATABASE READY\n');
    process.exit(0);
  }
}

main();
