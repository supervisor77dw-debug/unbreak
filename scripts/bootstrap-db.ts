#!/usr/bin/env tsx

/**
 * Database Bootstrap Script
 * Run: npm run db:bootstrap
 * 
 * Executes all migrations and seeds admin user
 */

import { bootstrapDatabase } from '../lib/supabase-bootstrap';
import * as dotenv from 'dotenv';
import path from 'path';

// Load .env.local
dotenv.config({ path: path.join(process.cwd(), '.env.local') });

async function main() {
  console.log('╔════════════════════════════════════════╗');
  console.log('║   UNBREAK ONE - Database Bootstrap    ║');
  console.log('╚════════════════════════════════════════╝\n');

  // Check required env vars
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('❌ Missing required environment variables:');
    console.error('   - SUPABASE_URL');
    console.error('   - SUPABASE_SERVICE_ROLE_KEY');
    console.error('\nMake sure .env.local is configured correctly.\n');
    process.exit(1);
  }

  try {
    const result = await bootstrapDatabase();

    if (result.success) {
      console.log('\n✅ SUCCESS - Database is ready!\n');
      
      if (result.hasAdmin) {
        console.log('👤 Admin user exists');
      } else {
        console.log('⚠️  No admin user found');
        console.log('   Set SEED_ADMIN_EMAIL in .env.local and run again');
      }
      
      console.log('');
      process.exit(0);
    } else {
      console.error('\n❌ FAILED - Check errors above\n');
      process.exit(1);
    }
  } catch (error: any) {
    console.error('\n💥 FATAL ERROR:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

main();
