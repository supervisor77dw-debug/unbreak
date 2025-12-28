#!/usr/bin/env node

/**
 * Database Bootstrap Script
 * Run: npm run db:bootstrap
 * 
 * Executes all migrations and seeds admin user
 */

const { bootstrapDatabase } = require('./lib/supabase-bootstrap.ts');

async function main() {
  console.log('╔════════════════════════════════════════╗');
  console.log('║   UNBREAK ONE - Database Bootstrap    ║');
  console.log('╚════════════════════════════════════════╝\n');

  try {
    const result = await bootstrapDatabase();

    if (result.success) {
      console.log('\n✅ SUCCESS - Database is ready!\n');
      process.exit(0);
    } else {
      console.error('\n❌ FAILED - Check errors above\n');
      process.exit(1);
    }
  } catch (error) {
    console.error('\n💥 FATAL ERROR:', error);
    process.exit(1);
  }
}

main();
